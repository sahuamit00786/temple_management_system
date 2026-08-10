import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Banknote, Trash2, Info, Pencil, WifiOff, Download } from 'lucide-react';
import { generateInvoicePdf } from '../print/InvoicePDF.jsx';
import { useApp } from '../auth/AppContext.jsx';
import { api, qs } from '../api/client.js';
import { ldb } from '../db/dexie.js';
import { Toast, useToast } from '../components/Toast.jsx';
import { exportCsv } from '../components/FilterBar.jsx';
import { generateTablePdf } from '../print/TablePDF.jsx';
import Tabs from '../components/Tabs.jsx';
import Modal from '../components/Modal.jsx';
import DataGrid from '../components/DataGrid.jsx';
import FilterBar from '../components/FilterBar.jsx';
import LookupSelect from '../components/LookupSelect.jsx';
import DevoteeSearch from '../components/DevoteeSearch.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import SendMessageModal from '../components/SendMessageModal.jsx';
import { WhatsAppIcon } from '../components/WhatsAppIcon.jsx';

const RM = (n) => `RM ${Number(n || 0).toFixed(2)}`;
const TABS = [{ key: 'calendar', label: 'Calendar' }, { key: 'list', label: 'Bookings List' }];

const statusChip = (b) => {
  const totalPaid = Number(b.totalPaid || 0);
  const hallRate = Number(b.hallRate || 0);
  const depositDue = Number(b.depositDue || 0);
  if (b.status === 'CANCELLED') return <span className="chip-cancelled">Cancelled</span>;
  if (totalPaid >= hallRate && hallRate > 0) return <span className="chip-paid">Fully paid</span>;
  if (totalPaid >= depositDue && depositDue > 0) {
    return new Date(b.balanceDueAt) < new Date()
      ? <span className="chip-overdue">Balance overdue</span>
      : <span className="chip-due">Balance due</span>;
  }
  if (totalPaid > 0) return <span className="chip-partial">Partial ({Math.round((totalPaid / hallRate) * 100)}%)</span>;
  return <span className="chip-due">Deposit pending</span>;
};

const emptyForm = {
  eventTypeId: '',
  startDate: '', startTime: '09:00',
  endDate: '', endTime: '17:00',
  notes: '',
  devotee: { name: '', phone: '', altPhone: '', icNumber: '', address: '', addressTa: '' },
  advanceAmount: '', advPayMode: 'CASH',
};

export default function Bookings() {
  const { lookups, settings, can, online } = useApp();
  const [tab, setTab] = useState('calendar');
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [calRows, setCalRows] = useState([]);
  const [list, setList] = useState({ rows: [], total: 0 });
  const [filters, setFilters] = useState({});
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('eventDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [form, setForm] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewingFull, setViewingFull] = useState(null);
  const [viewNote, setViewNote] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [dayModal, setDayModal] = useState(null); // { date, bookings }
  const [cancelling, setCancelling] = useState(null);
  const [paying, setPaying] = useState(null); // { booking, amount }
  const [payMode, setPayMode] = useState('CASH');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [conflict, setConflict] = useState(null);
  const [noteModal, setNoteModal] = useState(null); // { mode: 'add'|'edit', noteId, text }
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteErr, setNoteErr] = useState('');
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [messaging, setMessaging] = useState(null);
  const { msg: toastMsg, show: showToast, clear: clearToast } = useToast();

  // Month/year picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e) => { if (!pickerRef.current?.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  const handleSort = (key) => {
    if (key === sortBy) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortOrder('asc'); }
    setPage(1);
  };
  const handleFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const eventTypes = lookups.HALL_EVENT?.values?.filter((v) => v.isActive) || [];
  const typeName = (id) => eventTypes.find((t) => t.id === id)?.nameEn || '';
  const payModes = (lookups.BOOKING_PAYMENT_MODE?.values || lookups.PAYMENT_MODE?.values || []).filter((v) => v.isActive);
  const payModeOptions = payModes.map((m) => ({ value: m.meta?.code || m.nameEn.toUpperCase(), label: m.nameEn }));

  const loadCal = useCallback(() => {
    if (!online) {
      try {
        const cached = JSON.parse(localStorage.getItem(`tmadj.calCache.${month}`) || 'null');
        setCalRows(cached || []);
      } catch { setCalRows([]); }
      return;
    }
    api(`/bookings/calendar?month=${month}`).then((rows) => {
      setCalRows(rows);
      try { localStorage.setItem(`tmadj.calCache.${month}`, JSON.stringify(rows)); } catch {}
    }).catch(() => {
      try {
        const cached = JSON.parse(localStorage.getItem(`tmadj.calCache.${month}`) || 'null');
        if (cached) setCalRows(cached);
      } catch {}
    });
  }, [month, online]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    if (!online) {
      try {
        const { ldb } = await import('../db/dexie.js');
        const all = await ldb.cachedBookings.orderBy('eventDate').reverse().toArray();
        const ps = 10;
        const offset = (page - 1) * ps;
        setList({ rows: all.slice(offset, offset + ps), total: all.length });
      } catch { setList({ rows: [], total: 0 }); }
      finally { setListLoading(false); }
      return;
    }
    api(`/bookings${qs({ ...filters, page, pageSize, sortBy, sortOrder })}`)
      .then(setList).catch(() => {}).finally(() => setListLoading(false));
  }, [filters, page, pageSize, sortBy, sortOrder, online]);

  useEffect(() => { loadCal(); }, [loadCal]);
  useEffect(() => { if (tab === 'list') loadList(); }, [tab, loadList]);

  useEffect(() => {
    if (!form) { setConflict(null); return; }
    const { startDate, startTime, endDate, endTime } = form;
    if (!startDate || !startTime || !endDate || !endTime) { setConflict(null); return; }
    const start = `${startDate}T${startTime}:00`;
    const end = `${endDate}T${endTime}:00`;
    if (new Date(end) <= new Date(start)) { setConflict(null); return; }
    const t = setTimeout(() => {
      api(`/bookings/check-conflict?startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`)
        .then(({ conflict: c }) => setConflict(c))
        .catch(() => setConflict(null));
    }, 400);
    return () => clearTimeout(t);
  }, [form?.startDate, form?.startTime, form?.endDate, form?.endTime]);

  const selectedType = eventTypes.find((t) => String(t.id) === form?.eventTypeId);
  const deposit = selectedType ? (Number(selectedType.price || 0) * (selectedType.depositPct ?? 50)) / 100 : 0;

  const save = async () => {
    setBusy(true); setErr('');
    const payload = {
      eventTypeId: form.eventTypeId,
      eventDate: form.startDate,
      startTime: `${form.startDate}T${form.startTime}:00`,
      endTime: `${form.endDate}T${form.endTime}:00`,
      notes: form.notes,
      ...(form.devotee.id ? { devoteeId: form.devotee.id } : { devotee: form.devotee }),
      advanceAmount: form.advanceAmount ? Number(form.advanceAmount) : 0,
      paymentMode: form.advPayMode || 'CASH',
    };
    try {
      if (!online) {
        await ldb.bookingOutbox.add({ data: payload, status: 'pending', createdAt: new Date().toISOString() });
        // Add pending entry to calendar so it shows immediately
        const pendingEntry = {
          id: `pending-${Date.now()}`,
          eventDate: form.startDate,
          eventTypeId: form.eventTypeId,
          bookingNo: 'Pending',
          devotee: form.devotee,
          _pending: true,
        };
        setCalRows((prev) => [...prev, pendingEntry]);
        setForm(null);
        showToast('Booking queued — will sync when back online.');
        return;
      }
      await api('/bookings', { method: 'POST', body: payload });
      setForm(null); loadCal(); if (tab === 'list') loadList();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!viewing) { setViewingFull(null); setViewNote(''); return; }
    api(`/bookings/${viewing.id}`).then((full) => { setViewingFull(full); setViewNote(full.notes || ''); }).catch(() => {});
  }, [viewing]);

  const saveViewNote = async () => {
    if (!viewingFull) return;
    setNotesBusy(true);
    try {
      await api(`/bookings/${viewingFull.id}/notes`, { method: 'PATCH', body: { notes: viewNote } });
      setViewingFull((p) => ({ ...p, notes: viewNote }));
      loadList();
    } catch (e) { alert(e.message); }
    finally { setNotesBusy(false); }
  };

  const reloadViewing = async () => {
    if (!viewingFull) return;
    const full = await api(`/bookings/${viewingFull.id}`);
    setViewingFull(full);
  };

  const saveNote = async () => {
    setNoteBusy(true); setNoteErr('');
    try {
      if (noteModal.mode === 'add') {
        await api(`/bookings/${viewingFull.id}/booking-notes`, { method: 'POST', body: { note: noteModal.text } });
      } else {
        await api(`/bookings/${viewingFull.id}/booking-notes/${noteModal.noteId}`, { method: 'PUT', body: { note: noteModal.text } });
      }
      setNoteModal(null);
      await reloadViewing();
    } catch (e) { setNoteErr(e.message); }
    finally { setNoteBusy(false); }
  };

  const deleteNote = async (noteId) => {
    try {
      await api(`/bookings/${viewingFull.id}/booking-notes/${noteId}`, { method: 'DELETE' });
      await reloadViewing();
    } catch (e) { alert(e.message); }
  };

  const handlePrintInvoice = async (b) => {
    if (invoiceBusy) return;
    setInvoiceBusy(true);
    try {
      const full = await api(`/bookings/${b.id}`);
      const eName = eventTypes.find((t) => t.id === full.eventTypeId)?.nameEn || '';
      const url = await generateInvoicePdf(full, settings, eName);
      window.open(url, '_blank');
    } catch (e) { alert(e.message); }
    finally { setInvoiceBusy(false); }
  };

  const cancelBooking = async () => {
    setBusy(true);
    try { await api(`/bookings/${cancelling.id}/cancel`, { method: 'PATCH' }); setCancelling(null); loadCal(); loadList(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const openPay = async (b) => {
    try {
      const full = await api(`/bookings/${b.id}`);
      const totalPaid = full.transactions.reduce((s, t) => s + Number(t.total), 0);
      const remaining = Number(full.hallRate) - totalPaid;
      if (remaining <= 0) { alert('Booking is already fully paid'); return; }
      setPayMode('CASH');
      setPaying({ booking: { ...full, totalPaid }, amount: remaining.toFixed(2) });
    } catch (e) { alert(e.message); }
  };

  const recordPayment = async () => {
    setBusy(true);
    try {
      if (!online) {
        await ldb.paymentOutbox.add({
          bookingId: paying.booking.id,
          data: { amount: paying.amount, paymentMode: payMode },
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        setPaying(null);
        showToast('Payment queued — will sync when back online.');
        return;
      }
      await api(`/bookings/${paying.booking.id}/payments`, { method: 'POST', body: { amount: paying.amount, paymentMode: payMode } });
      setPaying(null); loadCal(); loadList();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  // Calendar grid
  const first = new Date(`${month}-01T00:00:00`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const startPad = first.getDay();
  const bookingsByDay = {};
  for (const b of calRows) {
    const d = new Date(b.eventDate).getDate();
    (bookingsByDay[d] ||= []).push(b);
  }
  const BOOKING_EXPORT_COLS = [
    { key: 'bookingNo', label: 'Booking No', flex: 1, csv: (b) => b.bookingNo },
    { key: 'devoteeName', label: 'Devotee', flex: 1.5, csv: (b) => b.devotee?.name || '' },
    { key: 'devoteePhone', label: 'Phone', flex: 1, csv: (b) => b.devotee?.phone || '' },
    { key: 'eventDate', label: 'Event Date', flex: 1, csv: (b) => new Date(b.eventDate).toLocaleDateString('en-MY') },
    { key: 'eventType', label: 'Event Type', flex: 1.2, csv: (b) => typeName(b.eventTypeId) },
    { key: 'hallRate', label: 'Hall Rate', flex: 0.8, right: true, csv: (b) => `RM ${Number(b.hallRate||0).toFixed(2)}` },
    { key: 'totalPaid', label: 'Paid', flex: 0.8, right: true, csv: (b) => `RM ${Number(b.totalPaid||0).toFixed(2)}` },
    { key: 'status', label: 'Status', flex: 0.9, csv: (b) => b.status },
  ];

  const fetchAllBookings = async () => {
    const d = await api(`/bookings${qs({ ...filters, page: 1, pageSize: 5000, sortBy, sortOrder })}`);
    return d.rows || [];
  };

  const shiftMonth = (n) => {
    const d = new Date(`${month}-01T00:00:00`); d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gold-300/60 mb-5">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="!mb-0 !border-b-0" />
        {can('bookings', 'create') && (
          <button className="btn-primary" onClick={() => { setErr(''); setConflict(null); setForm({ ...emptyForm, devotee: { ...emptyForm.devotee } }); }}>
            <Plus size={16} /> New booking
          </button>
        )}
      </div>

      {tab === 'calendar' && (
        <div className="card p-4">
          {!online && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              <WifiOff size={15} className="shrink-0" />
              Offline — showing cached calendar. New bookings will be queued.
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <button
              className="rounded-lg border border-gold-300/60 bg-cream-50 hover:bg-saffron-100/50 p-2 transition"
              onClick={() => shiftMonth(-1)} aria-label="Previous month"
            >
              <ChevronLeft size={24} strokeWidth={2.5} className="text-maroon-900" />
            </button>
            <div className="relative" ref={pickerRef}>
              <button
                className="text-lg font-semibold text-maroon-900 hover:text-maroon-700 px-3 py-1 rounded-lg hover:bg-saffron-100/50 transition"
                onClick={() => setPickerOpen((o) => !o)}
                title="Click to jump to a month"
              >
                {first.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
              </button>
              {pickerOpen && (() => {
                const py = first.getFullYear();
                const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border border-gold-300/60 rounded-xl shadow-xl p-3 w-56">
                    <div className="flex items-center justify-between mb-2">
                      <button className="btn-ghost !p-1" onClick={() => { const d = new Date(`${month}-01T00:00:00`); d.setFullYear(d.getFullYear()-1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }}><ChevronLeft size={16} /></button>
                      <span className="font-semibold text-maroon-900">{py}</span>
                      <button className="btn-ghost !p-1" onClick={() => { const d = new Date(`${month}-01T00:00:00`); d.setFullYear(d.getFullYear()+1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }}><ChevronRight size={16} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {MONTHS.map((mn, idx) => {
                        const val = `${py}-${String(idx+1).padStart(2,'0')}`;
                        return (
                          <button key={mn} className={`py-1.5 rounded-lg text-sm font-medium transition ${val === month ? 'bg-maroon-900 text-cream-50' : 'hover:bg-saffron-100/60 text-ink-800'}`}
                            onClick={() => { setMonth(val); setPickerOpen(false); }}>
                            {mn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            <button
              className="rounded-lg border border-gold-300/60 bg-cream-50 hover:bg-saffron-100/50 p-2 transition"
              onClick={() => shiftMonth(1)} aria-label="Next month"
            >
              <ChevronRight size={24} strokeWidth={2.5} className="text-maroon-900" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-600 mb-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayBookings = bookingsByDay[day] || [];
              const booked = dayBookings.length > 0;
              const hasPending = dayBookings.some((b) => b._pending);
              const hasReal = dayBookings.some((b) => !b._pending);
              const todayStr = new Date().toLocaleDateString('en-CA');
              const ds = `${month}-${String(day).padStart(2, '0')}`;
              const isToday = ds === todayStr;
              const isPast = ds < todayStr;
              return (
                <button
                  key={day}
                  disabled={isPast && !booked}
                  className={`min-h-[72px] rounded-lg border p-1.5 text-left transition
                    ${hasReal ? 'bg-maroon-900 border-maroon-800 text-cream-50'
                    : hasPending ? 'bg-amber-100 border-amber-400 text-amber-900'
                    : isPast ? 'bg-cream-100 border-cream-300 opacity-40 cursor-not-allowed'
                    : isToday ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                    : 'bg-cream-50 border-gold-300/50 hover:bg-saffron-100/50'}`}
                  onClick={() => {
                    if (dayBookings.length > 0) {
                      setDayModal({ date: ds, bookings: dayBookings });
                    } else if (!isPast && can('bookings', 'create')) {
                      setErr(''); setConflict(null); setForm({ ...emptyForm, startDate: ds, endDate: ds, devotee: { ...emptyForm.devotee } });
                    }
                  }}
                  title={dayBookings.map((b) => `${b.bookingNo} · ${b.devotee?.name}`).join('\n') || (isPast ? 'Past date' : 'Available — tap to book')}
                >
                  <span className={`text-xs font-semibold ${booked ? 'text-gold-300' : 'text-ink-600'}`}>{day}</span>
                  {dayBookings.slice(0, 1).map((b) => (
                    <p key={b.id} className="text-[10px] truncate leading-tight mt-0.5">{typeName(b.eventTypeId)} · {b.devotee?.name}</p>
                  ))}
                  {dayBookings.length > 1 && <p className="text-[10px] text-gold-300/80 mt-0.5">+{dayBookings.length - 1} more</p>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-ink-600">
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-maroon-900" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-cream-50 border border-gold-300/50" /> Available</span>
            <span className="ml-auto italic">Tap a day to start a booking</span>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <>
          {!online && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              <WifiOff size={15} className="shrink-0" />
              Offline — showing cached bookings (10 per page). Filters and sorting are not available.
            </div>
          )}
          {online && (
            <FilterBar
              filters={[
                { key: 'dateFrom', label: 'From', type: 'date' },
                { key: 'dateTo', label: 'To', type: 'date' },
                { key: 'eventTypeId', label: 'Event type', type: 'select', options: eventTypes.map((t) => ({ value: t.id, label: t.nameEn })) },
                { key: 'status', label: 'Status', type: 'select', options: ['PENDING_DEPOSIT', 'CONFIRMED', 'FULLY_PAID', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: s.replaceAll('_', ' ') })) },
                { key: 'search', label: 'Search', type: 'search', placeholder: 'Booking no, name or phone' },
              ]}
              values={filters}
              onChange={handleFilter}
              onReset={() => { setFilters({}); setPage(1); }}
              canExport={can('bookings', 'export')}
              exportOptions={[
                { label: 'CSV', onClick: async () => { exportCsv(`bookings-${filters.dateFrom || 'all'}.csv`, BOOKING_EXPORT_COLS, await fetchAllBookings()); } },
                { label: 'PDF', onClick: async () => { await generateTablePdf('Bookings', BOOKING_EXPORT_COLS, await fetchAllBookings()); } },
              ]}
            />
          )}
          <DataGrid
            loading={listLoading}
            empty="No bookings match these filters."
            total={list.total}
            page={page}
            pageSize={online ? pageSize : 10}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={online ? handleSort : undefined}
            onPageChange={setPage}
            onPageSizeChange={online ? (s) => { setPageSize(s); setPage(1); } : undefined}
            columns={[
              { key: 'bookingNo', label: 'Booking', sortable: true, render: (b) => (
                <span className="font-semibold text-maroon-900">{b.bookingNo}</span>
              )},
              { key: 'devotee', label: 'Devotee', render: (b) => (
                <div>
                  <div className="font-medium text-ink-900">{b.devotee?.name || '—'}</div>
                  <div className="text-xs text-ink-500">{b.devotee?.phone}</div>
                </div>
              )},
              { key: 'eventTypeId', label: 'Event', render: (b) => typeName(b.eventTypeId) },
              { key: 'eventDate', label: 'Date', sortable: true, render: (b) => new Date(b.eventDate).toLocaleDateString('en-MY') },
              { key: 'hallRate', label: 'Rate', right: true, sortable: true, render: (b) => RM(b.hallRate) },
              {
                key: 'totalPaid', label: 'Paid', right: true, render: (b) => {
                  const paid = Number(b.totalPaid || 0);
                  const remaining = Number(b.hallRate) - paid;
                  return (
                    <div>
                      <div className="tabular-nums">{RM(paid)}</div>
                      {remaining > 0 && <div className="text-xs text-kumkum-600 tabular-nums">{RM(remaining)} left</div>}
                    </div>
                  );
                },
              },
              { key: 'status', label: 'Status', sortable: true, render: statusChip },
              {
                key: 'actions', label: '', render: (b) => (
                  <span className="flex gap-1 items-center">
                    {can('bookings', 'edit') && b.status !== 'CANCELLED' && Number(b.hallRate) - Number(b.totalPaid || 0) > 0 && (
                      <button
                        className="btn-outline !py-1 !px-2 text-xs"
                        onClick={() => { const rem = Number(b.hallRate) - Number(b.totalPaid || 0); setPayMode('CASH'); setPaying({ booking: b, amount: rem.toFixed(2) }); }}
                      >
                        <Banknote size={13} /> Pay
                      </button>
                    )}
                    <button className="btn-ghost !p-1.5 text-maroon-700" title="View details" onClick={() => setViewing(b)}><Info size={14} /></button>
                    <button className="btn-ghost !p-1.5 text-leaf-600" title="Send WhatsApp message" onClick={() => setMessaging({ devotee: b.devotee, booking: b, eventTypeName: typeName(b.eventTypeId) })}>
                      <WhatsAppIcon size={14} />
                    </button>
                    {can('bookings', 'delete') && b.status !== 'CANCELLED' && (
                      <button className="btn-ghost !p-1.5 text-kumkum-600" title="Cancel booking" onClick={() => setCancelling(b)}><Trash2 size={14} /></button>
                    )}
                  </span>
                ),
              },
            ]}
            rows={list.rows}
          />
        </>
      )}

      {/* New booking */}
      <Modal title="New hall booking" open={!!form} onClose={() => setForm(null)} wide>
        {form && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Event type</label>
              <LookupSelect typeCode="HALL_EVENT" value={form.eventTypeId} onChange={(v) => setForm({ ...form, eventTypeId: v, advanceAmount: '' })} showPrice />
            </div>
            <div>
              <label className="label">Start date &amp; time</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input" value={form.startDate} min={new Date().toLocaleDateString('en-CA')}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate || e.target.value })} />
                <input type="time" className="input" value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">End date &amp; time</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input" value={form.endDate} min={form.startDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                <input type="time" className="input" value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
              {form.startDate && form.endDate && form.endTime && form.startTime &&
                new Date(`${form.endDate}T${form.endTime}`) <= new Date(`${form.startDate}T${form.startTime}`) && (
                <p className="text-xs text-kumkum-600 mt-1">End must be after start</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="label">Devotee</label>
              <DevoteeSearch
                value={form.devotee}
                onChange={(d) => setForm({ ...form, devotee: { ...form.devotee, ...d } })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Special requirements, remarks…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {selectedType && (
              <>
                {/* Advance payment */}
                <div className="sm:col-span-2 border border-gold-300/50 rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="text-sm font-semibold text-maroon-900">Collect advance payment <span className="font-normal text-ink-600">(optional)</span></p>
                    <span className="text-xs text-ink-600 tabular-nums">Rate <b className="text-maroon-900">{RM(selectedType.price)}</b> · Suggested deposit <b className="text-saffron-600">{RM(deposit)}</b></span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="label">Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-ink-600 text-sm pointer-events-none">RM</span>
                        <input
                          type="number"
                          className="input !pl-10"
                          placeholder={deposit.toFixed(2)}
                          value={form.advanceAmount}
                          min="0"
                          step="0.01"
                          onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })}
                        />
                      </div>
                      {form.advanceAmount && Number(form.advanceAmount) > Number(selectedType.price) ? (
                        <p className="text-xs text-kumkum-600 mt-1">Cannot exceed hall rate of <b>{RM(selectedType.price)}</b></p>
                      ) : form.advanceAmount && Number(form.advanceAmount) > 0 ? (
                        <p className="text-xs text-ink-600 mt-1">
                          Remaining after payment: <b className="text-maroon-900">{RM(Number(selectedType.price) - Number(form.advanceAmount))}</b>
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="label">Payment mode</label>
                      <SearchableSelect
                        options={payModeOptions}
                        value={form.advPayMode}
                        onChange={(v) => setForm({ ...form, advPayMode: v })}
                        placeholder="Select mode…"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {conflict && (
              <p className="sm:col-span-2 text-sm text-kumkum-600">
                Hall already booked — conflicts with{' '}
                <button
                  type="button"
                  className="underline font-semibold hover:text-kumkum-700"
                  onClick={() => { setForm(null); setConflict(null); setFilters({ search: conflict.bookingNo }); setTab('list'); }}
                >
                  {conflict.bookingNo}
                </button>
                {conflict.devotee?.name ? ` (${conflict.devotee.name})` : ''}
              </p>
            )}
            {err && <p className="sm:col-span-2 text-sm text-kumkum-600">{err}</p>}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setForm(null); setConflict(null); }}>Cancel</button>
              <button
                className="btn-primary"
                disabled={
                  busy || !form.eventTypeId || !form.startDate || !form.endDate || !form.devotee.name || !!conflict ||
                  new Date(`${form.endDate}T${form.endTime}`) <= new Date(`${form.startDate}T${form.startTime}`) ||
                  (selectedType && Number(form.advanceAmount) > Number(selectedType.price))
                }
                onClick={save}
              >
                {busy ? 'Saving…' : 'Save booking'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add payment */}
      <Modal
        title={paying ? `Add payment — ${paying.booking.bookingNo}` : ''}
        open={!!paying}
        onClose={() => setPaying(null)}
      >
        {paying && (() => {
          const totalPaid = Number(paying.booking.totalPaid || 0);
          const hallRate = Number(paying.booking.hallRate);
          const remaining = hallRate - totalPaid;
          return (
            <div className="space-y-3">
              {totalPaid > 0 && (
                <p className="text-xs text-ink-600">Paid so far: <b className="text-leaf-700">{RM(totalPaid)}</b></p>
              )}

              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="label !mb-0">Amount collecting now</label>
                  <span className="text-xs text-ink-600 tabular-nums">Remaining <b className="text-maroon-900">{RM(remaining)}</b></span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-ink-600 text-sm pointer-events-none">RM</span>
                  <input
                    type="number"
                    className="input !pl-10 text-lg font-semibold"
                    value={paying.amount}
                    onChange={(e) => setPaying({ ...paying, amount: e.target.value })}
                    min="0.01"
                    step="0.01"
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                {paying.amount && Number(paying.amount) > remaining ? (
                  <p className="text-xs text-kumkum-600 mt-1">Cannot exceed remaining balance of <b>{RM(remaining)}</b></p>
                ) : paying.amount && Number(paying.amount) > 0 && Number(paying.amount) < remaining ? (
                  <p className="text-xs text-ink-600 mt-1">Still outstanding after: <b className="text-kumkum-600">{RM(remaining - Number(paying.amount))}</b></p>
                ) : null}
              </div>

              <div>
                <label className="label">Payment mode</label>
                <SearchableSelect options={payModeOptions} value={payMode} onChange={setPayMode} />
              </div>

              <button
                className="btn-primary w-full justify-center"
                disabled={busy || !paying.amount || Number(paying.amount) <= 0 || Number(paying.amount) > remaining}
                onClick={recordPayment}
              >
                {busy ? 'Recording…' : `Confirm ${RM(Number(paying.amount || 0))} received`}
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* Day bookings modal */}
      <Modal
        title={dayModal ? new Date(dayModal.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        open={!!dayModal}
        onClose={() => setDayModal(null)}
        wide
      >
        {dayModal && (
          <div className="space-y-3">
            {dayModal.bookings.map((b) => {
              const rawStatus = { PENDING_DEPOSIT: 'chip chip-due', CONFIRMED: 'chip chip-partial', FULLY_PAID: 'chip chip-paid', COMPLETED: 'chip chip-paid', CANCELLED: 'chip chip-cancelled' };
              return (
                <div key={b.id} className="border border-gold-300/50 rounded-lg p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-semibold text-maroon-900 text-sm">{b.bookingNo}</p>
                    <p className="text-sm font-medium">{b.devotee?.name}</p>
                    <p className="text-xs text-ink-600">{b.devotee?.phone} · {typeName(b.eventTypeId)}</p>
                    <p className="text-xs text-ink-600 tabular-nums mt-0.5">{RM(b.hallRate)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={rawStatus[b.status] || 'chip'}>{b.status.replace(/_/g, ' ')}</span>
                    <div className="flex gap-1">
                      <button className="btn-ghost !p-1.5 text-maroon-700" title="View details" onClick={() => { setDayModal(null); setViewing(b); }}><Info size={14} /></button>
                      {can('bookings', 'edit') && b.status !== 'CANCELLED' && (
                        <button className="btn-outline !py-1 !px-2 text-xs" onClick={() => { setDayModal(null); openPay(b); }}>
                          <Banknote size={13} /> Pay
                        </button>
                      )}
                      {can('bookings', 'delete') && b.status !== 'CANCELLED' && (
                        <button className="btn-ghost !p-1.5 text-kumkum-600" title="Cancel booking" onClick={() => { setDayModal(null); setCancelling(b); }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {can('bookings', 'create') && dayModal.date >= new Date().toLocaleDateString('en-CA') && (
              <button
                className="btn-primary w-full justify-center mt-1"
                onClick={() => { setDayModal(null); setErr(''); setConflict(null); setForm({ ...emptyForm, startDate: dayModal.date, endDate: dayModal.date, devotee: { ...emptyForm.devotee } }); }}
              >
                <Plus size={16} /> Add booking for this date
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Add / Edit note modal */}
      <Modal
        title={noteModal?.mode === 'add' ? 'Add note' : 'Edit note'}
        open={!!noteModal}
        onClose={() => setNoteModal(null)}
      >
        {noteModal && (
          <div className="space-y-3">
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Write your note here…"
              value={noteModal.text}
              autoFocus
              onChange={(e) => setNoteModal({ ...noteModal, text: e.target.value })}
            />
            {noteErr && <p className="text-sm text-kumkum-600">{noteErr}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setNoteModal(null)}>Cancel</button>
              <button className="btn-primary" disabled={noteBusy || !noteModal.text.trim()} onClick={saveNote}>
                {noteBusy ? 'Saving…' : noteModal.mode === 'add' ? 'Add note' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>


      <ConfirmModal
        open={!!cancelling}
        title="Cancel booking"
        message={`Cancel booking ${cancelling?.bookingNo} for ${cancelling?.devotee?.name}? This cannot be undone.`}
        onConfirm={cancelBooking}
        onClose={() => setCancelling(null)}
        busy={busy}
        confirmLabel="Cancel booking"
      />

      {/* Booking Info Modal */}
      <Modal title={viewing ? `Booking — ${viewing.bookingNo}` : ''} open={!!viewing} onClose={() => setViewing(null)} wide>
        {!viewingFull ? (
          <p className="text-center text-ink-600 py-8">Loading…</p>
        ) : (() => {
          const bk = viewingFull;
          const dev = bk.devotee || {};
          const totalPaid = bk.transactions.reduce((s, t) => s + Number(t.total), 0);
          const balance = Number(bk.hallRate) - totalPaid;
          const fmtDT = (d) => new Date(d).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          const fmtD = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
          const fmtT = (d) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
          return (
            <div className="space-y-5">
              {/* Booking header */}
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Booking</p>
                  <Row2 label="Booking No" value={<span className="font-mono font-semibold">{bk.bookingNo}</span>} />
                  <Row2 label="Event" value={typeName(bk.eventTypeId) || '—'} />
                  <Row2 label="Date" value={fmtD(bk.eventDate)} />
                  <Row2 label="Time" value={bk.startTime ? `${fmtT(bk.startTime)} – ${fmtT(bk.endTime)}` : '—'} />
                  <Row2 label="Status" value={statusChip({ ...bk, totalPaid })} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Devotee</p>
                  <Row2 label="Name" value={dev.name || '—'} />
                  <Row2 label="Phone" value={dev.phone || '—'} />
                  {dev.altPhone && <Row2 label="Alt phone" value={dev.altPhone} />}
                  {dev.icNumber && <Row2 label="IC / Passport" value={dev.icNumber} />}
                  {dev.email && <Row2 label="Email" value={dev.email} />}
                  {dev.address && <Row2 label="Address" value={dev.address} />}
                </div>
              </div>

              {/* Financials */}
              <div className="border border-gold-300/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Financials</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-ink-600">Hall Rate</p><p className="font-semibold text-maroon-900">{RM(bk.hallRate)}</p></div>
                  <div><p className="text-xs text-ink-600">Total Paid</p><p className="font-semibold text-leaf-700">{RM(totalPaid)}</p></div>
                  <div><p className="text-xs text-ink-600">Balance</p><p className={`font-semibold ${balance > 0 ? 'text-kumkum-600' : 'text-leaf-700'}`}>{balance > 0 ? RM(balance) : 'Nil'}</p></div>
                </div>
              </div>

              {/* Payment history */}
              {bk.transactions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Payment History</p>
                  <div className="rounded-lg border border-gold-300/50 overflow-hidden">
                    <table className="table !text-xs">
                      <thead><tr><th>Receipt</th><th>Date</th><th>Mode</th><th className="text-right">Amount</th></tr></thead>
                      <tbody>
                        {bk.transactions.map((t) => (
                          <tr key={t.id}>
                            <td className="font-mono">{t.receiptNo}</td>
                            <td>{fmtDT(t.txDate)}</td>
                            <td>{(t.paymentMode || '').replace(/_/g, ' ')}</td>
                            <td className="text-right tabular-nums">{RM(t.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Notes</p>
                  {can('bookings', 'edit') && (
                    <button className="btn-outline !py-1 !px-2 text-xs" onClick={() => { setNoteErr(''); setNoteModal({ mode: 'add', noteId: null, text: '' }); }}>
                      <Plus size={12} /> Add note
                    </button>
                  )}
                </div>
                {bk.bookingNotes?.length > 0 ? (
                  <div className="space-y-2">
                    {bk.bookingNotes.map((n) => (
                      <div key={n.id} className="bg-cream-50 border border-gold-300/40 rounded-lg p-3">
                        <p className="text-sm text-ink-900 whitespace-pre-wrap">{n.note}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-ink-500">
                            {n.createdBy?.name} · {new Date(n.createdAt).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {can('bookings', 'edit') && (
                            <div className="flex gap-1">
                              <button className="btn-ghost !p-1" title="Edit" onClick={() => { setNoteErr(''); setNoteModal({ mode: 'edit', noteId: n.id, text: n.note }); }}><Pencil size={13} /></button>
                              <button className="btn-ghost !p-1 text-kumkum-600" title="Delete" onClick={() => deleteNote(n.id)}><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">No notes yet.</p>
                )}
              </div>
              {can('bookings', 'export') && (
                <div className="flex justify-end pt-2 border-t border-gold-300/40">
                  <button
                    className="btn-outline !py-1.5 !px-3 text-sm"
                    disabled={invoiceBusy}
                    onClick={() => handlePrintInvoice(viewingFull)}
                  >
                    <Download size={14} /> Download Invoice PDF
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <SendMessageModal
        open={!!messaging}
        onClose={() => setMessaging(null)}
        devotee={messaging?.devotee}
        booking={messaging?.booking}
        eventTypeName={messaging?.eventTypeName}
      />
      <Toast message={toastMsg} onClose={clearToast} />
    </div>
  );
}

function Row2({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-ink-500 w-20 shrink-0">{label}</span>
      <span className="text-ink-900">{value}</span>
    </div>
  );
}
