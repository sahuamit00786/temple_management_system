import { useEffect, useState, useCallback, useRef } from 'react';
import { Wallet, Flame, HandCoins, ShoppingBag, ChevronLeft, ChevronRight, Info, Banknote, Trash2, Plus, X, Bell, Check, Pencil, Calendar, WifiOff } from 'lucide-react';
import { WhatsAppIcon } from '../components/WhatsAppIcon.jsx';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import { useDismissals } from '../hooks/useDismissals.js';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import LookupSelect from '../components/LookupSelect.jsx';
import DevoteeSearch from '../components/DevoteeSearch.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import SendMessageModal from '../components/SendMessageModal.jsx';
import MembershipModal from '../components/MembershipModal.jsx';

const emptyForm = {
  eventTypeId: '',
  startDate: '', startTime: '09:00',
  endDate: '', endTime: '17:00',
  notes: '',
  devotee: { name: '', phone: '', altPhone: '', icNumber: '', address: '', addressTa: '' },
  advanceAmount: '', advPayMode: 'CASH',
};

const RM = (n) => `RM ${Number(n || 0).toFixed(2)}`;
const fmtDT = (d) => new Date(d).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const RAW_STATUS = {
  PENDING_DEPOSIT: 'chip chip-due',
  CONFIRMED: 'chip chip-partial',
  FULLY_PAID: 'chip chip-paid',
  COMPLETED: 'chip chip-paid',
  CANCELLED: 'chip chip-cancelled',
};

const dashStatusChip = (b) => {
  if (b.status === 'CANCELLED') return <span className="chip-cancelled">Cancelled</span>;
  if (b.balancePaidAt) return <span className="chip-paid">Fully paid</span>;
  if (b.depositPaidAt) {
    const overdue = new Date(b.balanceDueAt) < new Date();
    return <span className={overdue ? 'chip-overdue' : 'chip-due'}>{overdue ? 'Balance overdue' : 'Balance due'}</span>;
  }
  return <span className="chip-due">Deposit pending</span>;
};

export default function Dashboard() {
  const { lookups, can, online } = useApp();
  const { dismissedIds, dismissedMemberIds, dismissBooking, dismissMember } = useDismissals();
  const [data, setData] = useState(null);
  const [cacheAge, setCacheAge] = useState(null);
  const [err, setErr] = useState('');
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [calRows, setCalRows] = useState([]);

  // New booking form
  const [form, setForm] = useState(null);
  const [formErr, setFormErr] = useState('');
  const [formBusy, setFormBusy] = useState(false);

  // Day modal
  const [dayModal, setDayModal] = useState(null); // { date, bookings, events }
  const [dayTab, setDayTab] = useState('bookings');

  // Info modal
  const [viewing, setViewing] = useState(null);
  const [viewingFull, setViewingFull] = useState(null);
  const [viewNote, setViewNote] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);

  // Cancel
  const [cancelling, setCancelling] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelNote, setCancelNote] = useState('');

  // Pay
  const [paying, setPaying] = useState(null);
  const [payMode, setPayMode] = useState('CASH');
  const [payBusy, setPayBusy] = useState(false);

  // Send message
  const [messaging, setMessaging] = useState(null); // { devotee, booking, eventTypeName }


  const [renewMember, setRenewMember] = useState(null);

  // ── Reminders / Events ─────────────────────────────────────
  const [eventsOpen, setEventsOpen] = useState(false);
  const [reminders, setReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tmadj.reminders') || '[]'); } catch { return []; }
  });
  const [reminderForm, setReminderForm] = useState(null); // null | { id?, title, date, note, color }
  const REMINDER_COLORS = [
    { value: 'saffron', label: 'Saffron', bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
    { value: 'maroon',  label: 'Maroon',  bg: '#FEE2E2', border: '#B91C1C', text: '#7F1D1D' },
    { value: 'leaf',    label: 'Green',   bg: '#D1FAE5', border: '#059669', text: '#064E3B' },
    { value: 'blue',    label: 'Blue',    bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' },
  ];
  const colorCfg = (c) => REMINDER_COLORS.find((x) => x.value === c) || REMINDER_COLORS[0];

  const saveReminders = (next) => {
    setReminders(next);
    localStorage.setItem('tmadj.reminders', JSON.stringify(next));
  };
  const saveReminderForm = () => {
    if (!reminderForm?.title?.trim()) return;
    const existing = reminderForm.id
      ? reminders.map((r) => (r.id === reminderForm.id ? { ...r, ...reminderForm } : r))
      : [...reminders, { ...reminderForm, id: Date.now(), done: false, createdAt: new Date().toISOString() }];
    saveReminders(existing);
    setReminderForm(null);
  };
  const toggleDone = (id) => saveReminders(reminders.map((r) => r.id === id ? { ...r, done: !r.done } : r));
  const deleteReminder = (id) => saveReminders(reminders.filter((r) => r.id !== id));

  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Month/year picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e) => { if (!pickerRef.current?.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  const payModes = ((lookups.BOOKING_PAYMENT_MODE?.values || lookups.PAYMENT_MODE?.values) || []).filter((v) => v.isActive);

  const load = useCallback(() => {
    api('/dashboard/summary')
      .then((d) => {
        setData(d);
        setCacheAge(null);
        setErr('');
        localStorage.setItem('tmadj.dashboardCache', JSON.stringify({ data: d, cachedAt: Date.now() }));
      })
      .catch((e) => {
        const cached = (() => { try { return JSON.parse(localStorage.getItem('tmadj.dashboardCache')); } catch { return null; } })();
        if (cached) { setData(cached.data); setCacheAge(cached.cachedAt); }
        else setErr(e.message);
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadCal = useCallback(() => {
    api(`/bookings/calendar?month=${month}`).then(setCalRows).catch(() => {});
  }, [month]);
  useEffect(() => { loadCal(); }, [loadCal]);

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
    } catch (e) { alert(e.message); }
    finally { setNotesBusy(false); }
  };

  const cancelBooking = async () => {
    setCancelBusy(true);
    try {
      await api(`/bookings/${cancelling.id}/cancel`, { method: 'POST', body: { note: cancelNote.trim() } });
      setCancelling(null); setCancelNote(''); loadCal();
    } catch (e) { alert(e.message); }
    finally { setCancelBusy(false); }
  };

  const openPay = async (b) => {
    try {
      const full = await api(`/bookings/${b.id}`);
      const totalPaid = full.transactions.filter((t) => t.status === 'PAID').reduce((s, t) => s + Number(t.total), 0);
      const remaining = Number(full.hallRate) - totalPaid;
      if (remaining <= 0) { alert('Booking is already fully paid'); return; }
      setPayMode('CASH');
      setPaying({ booking: { ...full, totalPaid }, amount: remaining.toFixed(2) });
    } catch (e) { alert(e.message); }
  };

  const recordPayment = async () => {
    setPayBusy(true);
    try {
      await api(`/bookings/${paying.booking.id}/payments`, { method: 'POST', body: { amount: paying.amount, paymentMode: payMode } });
      setPaying(null); loadCal();
    } catch (e) { alert(e.message); }
    finally { setPayBusy(false); }
  };

  const saveBooking = async () => {
    setFormBusy(true); setFormErr('');
    try {
      await api('/bookings', {
        method: 'POST',
        body: {
          eventTypeId: form.eventTypeId,
          eventDate: form.startDate,
          startTime: `${form.startDate}T${form.startTime}:00`,
          endTime: `${form.endDate}T${form.endTime}:00`,
          notes: form.notes,
          ...(form.devotee.id ? { devoteeId: form.devotee.id } : { devotee: form.devotee }),
          advanceAmount: form.advanceAmount ? Number(form.advanceAmount) : 0,
          paymentMode: form.advPayMode || 'CASH',
        },
      });
      setForm(null); loadCal();
    } catch (e) { setFormErr(e.message); }
    finally { setFormBusy(false); }
  };

  const shiftMonth = (n) => {
    const d = new Date(`${month}-01T00:00:00`); d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const eventTypes = lookups.HALL_EVENT?.values || [];
  const typeName = (id) => eventTypes.find((t) => t.id === id)?.nameEn || '';

  const first = new Date(`${month}-01T00:00:00`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const startPad = first.getDay();
  const bookingsByDay = {};
  for (const b of calRows) {
    const d = new Date(b.eventDate).getDate();
    (bookingsByDay[d] ||= []).push(b);
  }
  const remindersByDay = {};
  for (const r of reminders) {
    if (r.date) (remindersByDay[r.date] ||= []).push(r);
  }

  if (err) return <p className="text-ink-600 py-10 text-center">Dashboard needs a connection the first time — {err}</p>;
  if (!data) return <p className="text-ink-600 py-10 text-center">Lighting the lamps…</p>;

  const { cards, recentBookings, membershipExpiry = [] } = data;

  return (
    <div className="space-y-5">
      {cacheAge && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <WifiOff size={15} className="shrink-0" />
          <span>Offline — showing data cached {new Date(cacheAge).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}. Calendar unavailable.</span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Today's collection" value={RM(cards.totalToday)} accent="gold" />
        <StatCard icon={Flame} label="Archanai today" value={cards.archanaiCount} accent="saffron" />
        <StatCard icon={HandCoins} label="Donations today" value={RM(cards.donationsToday)} accent="leaf" />
        <StatCard icon={ShoppingBag} label="Orders today" value={cards.ordersToday ?? 0} accent="saffron" />
      </div>

      {/* Upcoming bookings — next 30 days, non-cancelled */}
      {(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in30 = new Date(today); in30.setDate(today.getDate() + 30);
        const upcoming = (recentBookings || []).filter((b) => {
          if (b.status === 'CANCELLED') return false;
          if (dismissedIds.includes(b.id)) return false;
          const d = new Date(b.eventDate); d.setHours(0, 0, 0, 0);
          return d >= today && d <= in30;
        });
        const rowStyle = (b) => {
          const d = new Date(b.eventDate); d.setHours(0, 0, 0, 0);
          const days = Math.round((d - today) / 86400000);
          return { backgroundColor: days <= 7 ? '#FDE8E2' : '#E8F5EC' };
        };
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">Upcoming hall bookings</h2>
              <button
                className="btn-outline !py-1.5 !px-2.5 flex items-center gap-1.5 relative text-sm"
                onClick={() => setEventsOpen(true)}
                title="Events & Reminders"
              >
                <Bell size={15} className="text-saffron-600" />
                <span className="text-xs font-medium">Events</span>
                {sortedReminders.filter((r) => !r.done).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-kumkum-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {sortedReminders.filter((r) => !r.done).length}
                  </span>
                )}
              </button>
            </div>
            <DataTable
              empty="No upcoming bookings in the next 30 days."
              rowStyle={rowStyle}
              columns={[
                { key: 'bookingNo', label: 'Booking', render: (b) => <span className="font-semibold text-maroon-900">{b.bookingNo}</span> },
                { key: 'devotee', label: 'Devotee', render: (b) => (
                  <div>
                    <div className="font-medium text-ink-900">{b.devotee?.name || '—'}</div>
                    <div className="text-xs text-ink-500">{b.devotee?.phone}</div>
                  </div>
                )},
                { key: 'eventDate', label: 'Event date', render: (b) => new Date(b.eventDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { key: 'eventType', label: 'Type', render: (b) => typeName(b.eventTypeId) },
                { key: 'hallRate', label: 'Rate', right: true, render: (b) => RM(b.hallRate) },
                { key: 'status', label: 'Status', render: dashStatusChip },
                { key: 'actions', label: '', render: (b) => (
                  <span className="flex gap-1 items-center">
                    <button
                      className="btn-ghost !p-1.5"
                      title="Send WhatsApp message"
                      onClick={() => setMessaging({ devotee: b.devotee, booking: b, eventTypeName: typeName(b.eventTypeId) })}
                    >
                      <WhatsAppIcon size={15} className="text-leaf-600" />
                    </button>
                    <button
                      className="btn-ghost !p-1.5 text-ink-400 hover:text-kumkum-600"
                      title="Dismiss — hide from upcoming list"
                      onClick={() => dismissBooking(b.id)}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )},
              ]}
              rows={upcoming}
            />
          </div>
        );
      })()}

      {/* Membership Expiry — next 30 days */}
      {(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const visible = membershipExpiry.filter((m) => !dismissedMemberIds.includes(m.id));
        const rowStyle = (m) => {
          const d = new Date(m.membershipEndDate); d.setHours(0, 0, 0, 0);
          const days = Math.round((d - today) / 86400000);
          return { backgroundColor: days <= 7 ? '#FDE8E2' : '#E8F5EC' };
        };
        const fmtDate = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
        const daysLeft = (d) => {
          const diff = Math.round((new Date(d).setHours(0,0,0,0) - today) / 86400000);
          return diff === 0 ? 'Today' : diff === 1 ? '1 day' : `${diff} days`;
        };
        return (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600 mb-2">Membership Expiry</h2>
            <DataTable
              empty="No memberships expiring in the next 30 days."
              rowStyle={rowStyle}
              columns={[
                { key: 'name', label: 'Member', render: (m) => (
                  <div>
                    <div className="font-semibold text-maroon-900">{m.name}</div>
                    {m.phone && <div className="text-xs text-ink-500">{m.phone}</div>}
                  </div>
                )},
                { key: 'membershipTypeLabel', label: 'Plan', render: (m) => m.membershipTypeLabel || '—' },
                { key: 'membershipEndDate', label: 'Expires On', render: (m) => fmtDate(m.membershipEndDate) },
                { key: 'daysLeft', label: 'Days Left', render: (m) => (
                  <span className={`font-semibold ${Math.round((new Date(m.membershipEndDate).setHours(0,0,0,0) - today) / 86400000) <= 7 ? 'text-kumkum-600' : 'text-leaf-700'}`}>
                    {daysLeft(m.membershipEndDate)}
                  </span>
                )},
                { key: 'membershipPrice', label: 'Fee', right: true, render: (m) => RM(m.membershipPrice) },
                { key: 'actions', label: '', render: (m) => (
                  <span className="flex gap-1 items-center">
                    <button
                      className="btn-ghost !p-1.5"
                      title="Renew membership"
                      onClick={() => setRenewMember(m)}
                    >
                      <Plus size={14} className="text-maroon-700" />
                    </button>
                    <button
                      className="btn-ghost !p-1.5"
                      title="Send WhatsApp message"
                      onClick={() => setMessaging({ devotee: m, booking: null, eventTypeName: '' })}
                    >
                      <WhatsAppIcon size={15} className="text-leaf-600" />
                    </button>
                    <button
                      className="btn-ghost !p-1.5 text-ink-400 hover:text-kumkum-600"
                      title="Dismiss"
                      onClick={() => dismissMember(m.id)}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )},
              ]}
              rows={visible}
            />
          </div>
        );
      })()}

      {/* Calendar — hidden when showing cached data */}
      {!cacheAge && <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            className="rounded-lg border border-gold-300/60 bg-cream-50 hover:bg-saffron-100/50 !p-2 transition"
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
            className="rounded-lg border border-gold-300/60 bg-cream-50 hover:bg-saffron-100/50 !p-2 transition"
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
            const ds = `${month}-${String(day).padStart(2, '0')}`;
            const dayEvents = remindersByDay[ds] || [];
            const booked = dayBookings.length > 0;
            const hasEvents = dayEvents.length > 0;
            const todayStr = new Date().toLocaleDateString('en-CA');
            const isToday = ds === todayStr;
            const isPast = ds < todayStr;
            const summaryParts = [
              dayBookings.length > 0 && `${dayBookings.length} booking${dayBookings.length !== 1 ? 's' : ''}`,
              dayEvents.length > 0 && `${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`,
            ].filter(Boolean);
            return (
              <button
                key={day}
                disabled={isPast && !booked && !hasEvents}
                className={`min-h-[72px] rounded-lg border p-1.5 text-left transition
                  ${booked ? 'bg-maroon-900 border-maroon-800 text-cream-50 cursor-pointer'
                  : hasEvents ? 'bg-saffron-50 border-saffron-300 cursor-pointer hover:bg-saffron-100'
                  : isPast ? 'bg-cream-100 border-cream-300 opacity-40 cursor-not-allowed'
                  : isToday ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                  : 'bg-cream-50 border-gold-300/50 hover:bg-saffron-100/50'}`}
                title={[...dayBookings.map((b) => `${b.bookingNo} · ${b.devotee?.name}`), ...dayEvents.map((e) => `Event: ${e.title}`)].join('\n') || (isPast ? 'Past date' : 'Available')}
                onClick={() => {
                  setDayTab(booked ? 'bookings' : (hasEvents ? 'events' : 'bookings'));
                  setDayModal({ date: ds, bookings: dayBookings, events: dayEvents });
                }}
              >
                <span className={`text-xs font-semibold ${booked ? 'text-gold-300' : 'text-ink-600'}`}>{day}</span>
                {dayBookings[0] && <p className="text-[10px] truncate leading-tight mt-0.5">{typeName(dayBookings[0].eventTypeId)} · {dayBookings[0].devotee?.name}</p>}
                {dayEvents.slice(0, booked ? 1 : 2).map((e) => (
                  <div key={e.id} className="flex items-center gap-0.5 mt-0.5 min-w-0">
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full border-2 ${e.done ? 'bg-saffron-400 border-saffron-400' : booked ? 'border-gold-300' : 'border-saffron-500'}`} />
                    <p className={`text-[10px] truncate leading-tight ${booked ? 'text-gold-200' : 'text-saffron-800'} ${e.done ? 'line-through opacity-60' : ''}`}>{e.title}</p>
                  </div>
                ))}
                {summaryParts.length > 0 && (
                  <p className={`text-[10px] mt-0.5 ${booked ? 'text-gold-300/80' : 'text-saffron-600'}`}>{summaryParts.join(' · ')}</p>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-ink-600">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-maroon-900" /> Booked</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-cream-50 border border-gold-300/50" /> Available</span>
        </div>
      </div>}

      {/* Day bookings modal */}
      <Modal
        title={dayModal ? new Date(dayModal.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        open={!!dayModal}
        onClose={() => setDayModal(null)}
        wide
      >
        {dayModal && (() => {
          const isFuture = dayModal.date >= new Date().toLocaleDateString('en-CA');
          return (
            <div className="space-y-3">
              {/* Always show tabs */}
              <div className="flex border-b border-gold-300/50 -mt-1 mb-1">
                <button
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${dayTab === 'bookings' ? 'border-maroon-900 text-maroon-900' : 'border-transparent text-ink-600 hover:text-ink-900'}`}
                  onClick={() => setDayTab('bookings')}
                >
                  Bookings{dayModal.bookings.length > 0 ? ` (${dayModal.bookings.length})` : ''}
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${dayTab === 'events' ? 'border-maroon-900 text-maroon-900' : 'border-transparent text-ink-600 hover:text-ink-900'}`}
                  onClick={() => setDayTab('events')}
                >
                  Events{dayModal.events.length > 0 ? ` (${dayModal.events.length})` : ''}
                </button>
              </div>

              {dayTab === 'bookings' && (
                <>
                  {dayModal.bookings.length === 0 && (
                    <p className="text-sm text-ink-500 text-center py-4">No bookings for this day.</p>
                  )}
                  {dayModal.bookings.map((b) => (
                    <div key={b.id} className="border border-gold-300/50 rounded-lg p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-semibold text-maroon-900 text-sm">{b.bookingNo}</p>
                        <p className="text-sm font-medium">{b.devotee?.name}</p>
                        <p className="text-xs text-ink-600">{b.devotee?.phone} · {typeName(b.eventTypeId)}</p>
                        <p className="text-xs text-ink-600 tabular-nums mt-0.5">{RM(b.hallRate)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={RAW_STATUS[b.status] || 'chip'}>{b.status.replace(/_/g, ' ')}</span>
                        <div className="flex gap-1">
                          <button className="btn-ghost !p-1.5 text-maroon-700" title="View details" onClick={() => { setDayModal(null); setViewing(b); }}><Info size={14} /></button>
                          {can('bookings', 'edit') && b.status !== 'CANCELLED' && (
                            <button className="btn-outline !py-1 !px-2 text-xs" onClick={() => { setDayModal(null); openPay(b); }}>
                              <Banknote size={13} /> Pay
                            </button>
                          )}
                          {can('bookings', 'delete') && b.status !== 'CANCELLED' && (
                            <button className="btn-ghost !p-1.5 text-kumkum-600" title="Cancel booking" onClick={() => { setDayModal(null); setCancelNote(''); setCancelling(b); }}><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {can('bookings', 'create') && isFuture && (
                    <button
                      className="btn-primary w-full justify-center mt-1"
                      onClick={() => { setDayModal(null); setFormErr(''); setForm({ ...emptyForm, startDate: dayModal.date, endDate: dayModal.date, devotee: { ...emptyForm.devotee } }); }}
                    >
                      <Plus size={16} /> Add booking
                    </button>
                  )}
                </>
              )}

              {dayTab === 'events' && (
                <div className="space-y-2">
                  {dayModal.events.length === 0 && (
                    <p className="text-sm text-ink-500 text-center py-4">No events for this day.</p>
                  )}
                  {dayModal.events.map((e) => {
                    const isOverdue = e.date && !e.done && e.date < new Date().toLocaleDateString('en-CA');
                    return (
                      <div key={e.id} className={`flex items-start gap-3 rounded-xl border p-3 ${e.done ? 'bg-cream-100 border-cream-300 opacity-60' : 'bg-cream-50 border-gold-300/50'}`}>
                        <button onClick={() => { toggleDone(e.id); setDayModal((m) => ({ ...m, events: m.events.map((ev) => ev.id === e.id ? { ...ev, done: !ev.done } : ev) })); }} className="mt-0.5 shrink-0" title={e.done ? 'Mark undone' : 'Mark done'}>
                          {e.done ? <Check size={16} className="text-leaf-600" /> : <div className="w-4 h-4 rounded-full border-2 border-saffron-500" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${e.done ? 'line-through text-ink-500' : 'text-ink-900'}`}>{e.title}</p>
                          {e.date && (
                            <p className={`text-xs mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-kumkum-600 font-semibold' : 'text-ink-500'}`}>
                              <Calendar size={11} />
                              {new Date(e.date + 'T00:00:00').toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {isOverdue && ' · Overdue'}
                            </p>
                          )}
                          {e.note && <p className="text-xs text-ink-600 mt-1 leading-snug">{e.note}</p>}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    className="btn-outline w-full justify-center text-sm"
                    onClick={() => {
                      const date = dayModal.date;
                      setDayModal(null);
                      setReminderForm({ title: '', date, note: '', color: 'saffron' });
                      setEventsOpen(true);
                    }}
                  >
                    <Plus size={14} /> Add event
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Booking Info modal */}
      <Modal title={viewing ? `Booking — ${viewing.bookingNo}` : ''} open={!!viewing} onClose={() => setViewing(null)} wide>
        {!viewingFull ? (
          <p className="text-center text-ink-600 py-8">Loading…</p>
        ) : (() => {
          const bk = viewingFull;
          const dev = bk.devotee || {};
          const totalPaid = bk.transactions.filter((t) => t.status === 'PAID').reduce((s, t) => s + Number(t.total), 0);
          const balance = Number(bk.hallRate) - totalPaid;
          const fmtD = (d) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
          const fmtT = (d) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
          return (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Booking</p>
                  <DRow label="Booking No" value={<span className="font-mono font-semibold">{bk.bookingNo}</span>} />
                  <DRow label="Event" value={typeName(bk.eventTypeId) || '—'} />
                  <DRow label="Date" value={fmtD(bk.eventDate)} />
                  <DRow label="Time" value={bk.startTime ? `${fmtT(bk.startTime)} – ${fmtT(bk.endTime)}` : '—'} />
                  <DRow label="Status" value={dashStatusChip(bk)} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Devotee</p>
                  <DRow label="Name" value={dev.name || '—'} />
                  <DRow label="Phone" value={dev.phone || '—'} />
                  {dev.altPhone && <DRow label="Alt phone" value={dev.altPhone} />}
                  {dev.icNumber && <DRow label="IC / Passport" value={dev.icNumber} />}
                  {dev.email && <DRow label="Email" value={dev.email} />}
                  {dev.address && <DRow label="Address" value={dev.address} />}
                </div>
              </div>
              <div className="border border-gold-300/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Financials</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-ink-600">Hall Rate</p><p className="font-semibold text-maroon-900">{RM(bk.hallRate)}</p></div>
                  <div><p className="text-xs text-ink-600">Total Paid</p><p className="font-semibold text-leaf-700">{RM(totalPaid)}</p></div>
                  <div><p className="text-xs text-ink-600">Balance</p><p className={`font-semibold ${balance > 0 ? 'text-kumkum-600' : 'text-leaf-700'}`}>{balance > 0 ? RM(balance) : 'Nil'}</p></div>
                </div>
              </div>
              {bk.transactions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Payment History</p>
                  <div className="rounded-lg border border-gold-300/50 overflow-hidden">
                    <table className="table !text-xs">
                      <thead><tr><th>Receipt</th><th>Date</th><th>Mode</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
                      <tbody>
                        {bk.transactions.map((t) => (
                          <tr key={t.id}>
                            <td className="font-mono">{t.receiptNo}</td>
                            <td>{fmtDT(t.txDate)}</td>
                            <td>{(t.paymentMode || '').replace(/_/g, ' ')}</td>
                            <td className={`text-right tabular-nums ${t.status === 'CANCELLED' ? 'line-through text-ink-400' : ''}`}>{RM(t.total)}</td>
                            <td>{t.status === 'CANCELLED' ? <span className="chip-cancelled">Cancelled</span> : <span className="chip-paid">Paid</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {bk.status === 'CANCELLED' && bk.cancelNote && (
                <div className="border border-kumkum-300/60 bg-kumkum-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-kumkum-700 uppercase tracking-wide mb-2">Cancellation reason</p>
                  <p className="text-sm text-ink-900 whitespace-pre-wrap">{bk.cancelNote.note}</p>
                  <p className="text-xs text-ink-500 mt-2">
                    {bk.cancelNote.cancelledBy?.name} · {fmtDT(bk.cancelNote.createdAt)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Booking Notes</p>
                {can('bookings', 'edit') ? (
                  <div className="space-y-2">
                    <textarea className="input resize-none" rows={3} placeholder="Add notes…" value={viewNote} onChange={(e) => setViewNote(e.target.value)} />
                    <div className="flex justify-end">
                      <button className="btn-primary !py-1.5 !px-3 text-xs" disabled={notesBusy || viewNote === (bk.notes || '')} onClick={saveViewNote}>
                        {notesBusy ? 'Saving…' : 'Save note'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{bk.notes || <span className="text-ink-500">No notes.</span>}</p>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* New booking modal */}
      <Modal title="New hall booking" open={!!form} onClose={() => setForm(null)} wide>
        {form && (() => {
          const selectedType = (lookups.HALL_EVENT?.values || []).find((t) => String(t.id) === form.eventTypeId);
          const deposit = selectedType ? (Number(selectedType.price || 0) * (selectedType.depositPct ?? 50)) / 100 : 0;
          const payModeOptions = payModes.map((m) => ({ value: m.meta?.code || m.nameEn.toUpperCase(), label: m.nameEn }));
          const endBeforeStart = form.startDate && form.endDate && form.startTime && form.endTime &&
            new Date(`${form.endDate}T${form.endTime}`) <= new Date(`${form.startDate}T${form.startTime}`);
          return (
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
                {endBeforeStart && <p className="text-xs text-kumkum-600 mt-1">End must be after start</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="label">Devotee</label>
                <DevoteeSearch value={form.devotee} onChange={(d) => setForm({ ...form, devotee: { ...form.devotee, ...d } })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={3} placeholder="Special requirements, remarks…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {selectedType && (
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
                        <input type="number" className="input !pl-10" placeholder={deposit.toFixed(2)} value={form.advanceAmount} min="0" step="0.01"
                          onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })} />
                      </div>
                      {form.advanceAmount && Number(form.advanceAmount) > Number(selectedType.price) ? (
                        <p className="text-xs text-kumkum-600 mt-1">Cannot exceed hall rate of <b>{RM(selectedType.price)}</b></p>
                      ) : form.advanceAmount && Number(form.advanceAmount) > 0 ? (
                        <p className="text-xs text-ink-600 mt-1">Remaining after payment: <b className="text-maroon-900">{RM(Number(selectedType.price) - Number(form.advanceAmount))}</b></p>
                      ) : null}
                    </div>
                    <div>
                      <label className="label">Payment mode</label>
                      <SearchableSelect options={payModeOptions} value={form.advPayMode} onChange={(v) => setForm({ ...form, advPayMode: v })} placeholder="Select mode…" />
                    </div>
                  </div>
                </div>
              )}
              {formErr && <p className="sm:col-span-2 text-sm text-kumkum-600">{formErr}</p>}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
                <button className="btn-primary"
                  disabled={formBusy || !form.eventTypeId || !form.startDate || !form.endDate || !form.devotee.name || !!endBeforeStart || (selectedType && Number(form.advanceAmount) > Number(selectedType.price))}
                  onClick={saveBooking}>
                  {formBusy ? 'Saving…' : 'Save booking'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Pay modal */}
      <Modal title={paying ? `Add payment — ${paying.booking.bookingNo}` : ''} open={!!paying} onClose={() => setPaying(null)}>
        {paying && (() => {
          const totalPaid = Number(paying.booking.totalPaid || 0);
          const hallRate = Number(paying.booking.hallRate);
          const remaining = hallRate - totalPaid;
          return (
            <div className="space-y-3">
              {totalPaid > 0 && <p className="text-xs text-ink-600">Paid so far: <b className="text-leaf-700">{RM(totalPaid)}</b></p>}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="label !mb-0">Amount collecting now</label>
                  <span className="text-xs text-ink-600 tabular-nums">Remaining <b className="text-maroon-900">{RM(remaining)}</b></span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-ink-600 text-sm pointer-events-none">RM</span>
                  <input type="number" className="input !pl-10 text-lg font-semibold" value={paying.amount}
                    onChange={(e) => setPaying({ ...paying, amount: e.target.value })} min="0.01" step="0.01" max={remaining} autoFocus onFocus={(e) => e.target.select()} />
                </div>
                {paying.amount && Number(paying.amount) > remaining
                  ? <p className="text-xs text-kumkum-600 mt-1">Cannot exceed remaining balance of <b>{RM(remaining)}</b></p>
                  : paying.amount && Number(paying.amount) > 0 && Number(paying.amount) < remaining
                  ? <p className="text-xs text-ink-600 mt-1">Still outstanding after: <b className="text-kumkum-600">{RM(remaining - Number(paying.amount))}</b></p>
                  : null}
              </div>
              <div>
                <label className="label">Payment mode</label>
                <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                  {payModes.length ? payModes.map((m) => <option key={m.id} value={m.meta?.code || m.nameEn.toUpperCase()}>{m.nameEn}</option>)
                    : ['CASH', 'ONLINE_TRANSFER', 'CARD'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <button className="btn-primary w-full justify-center" disabled={payBusy || !paying.amount || Number(paying.amount) <= 0 || Number(paying.amount) > remaining} onClick={recordPayment}>
                {payBusy ? 'Recording…' : `Confirm ${RM(Number(paying.amount || 0))} received`}
              </button>
            </div>
          );
        })()}
      </Modal>

      <ConfirmModal
        open={!!cancelling}
        title="Cancel booking"
        message={`Cancel booking ${cancelling?.bookingNo} for ${cancelling?.devotee?.name}? This cannot be undone.`}
        onConfirm={cancelBooking}
        onClose={() => { setCancelling(null); setCancelNote(''); }}
        busy={cancelBusy}
        confirmLabel="Cancel booking"
        confirmDisabled={!cancelNote.trim()}
      >
        <div>
          <label className="label">Reason for cancellation <span className="text-kumkum-600">*</span></label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Why is this booking being cancelled?"
            value={cancelNote}
            autoFocus
            onChange={(e) => setCancelNote(e.target.value)}
          />
        </div>
      </ConfirmModal>

      <SendMessageModal
        open={!!messaging}
        onClose={() => setMessaging(null)}
        devotee={messaging?.devotee}
        booking={messaging?.booking}
        eventTypeName={messaging?.eventTypeName}
      />

      <MembershipModal
        devoteeId={renewMember?.id}
        initialData={renewMember}
        open={!!renewMember}
        onClose={() => setRenewMember(null)}
        onSaved={() => { setRenewMember(null); load(); }}
      />

      {/* Events & Reminders modal */}
      <Modal title="Events & Reminders" open={eventsOpen} onClose={() => { setEventsOpen(false); setReminderForm(null); }} wide>
        {reminderForm ? (
          /* Add / Edit form */
          <div className="space-y-3">
            <p className="text-sm font-semibold text-maroon-900">{reminderForm.id ? 'Edit event' : 'Add new event'}</p>
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="e.g. Temple cleaning, Staff meeting, Festival…" autoFocus
                value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Date <span className="text-ink-500 font-normal">(optional)</span></label>
              <input type="date" className="input" value={reminderForm.date || ''}
                onChange={(e) => setReminderForm({ ...reminderForm, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Description <span className="text-ink-500 font-normal">(optional)</span></label>
              <textarea className="input resize-none" rows={3} placeholder="Details, notes…"
                value={reminderForm.note || ''} onChange={(e) => setReminderForm({ ...reminderForm, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={() => setReminderForm(null)}>Back</button>
              <button className="btn-primary" disabled={!reminderForm.title?.trim()} onClick={saveReminderForm}>
                {reminderForm.id ? 'Save changes' : 'Add event'}
              </button>
            </div>
          </div>
        ) : (
          /* Events list */
          <div className="space-y-3">
            <div className="flex justify-end">
              <button className="btn-primary !py-1.5 !px-3 text-sm" onClick={() => setReminderForm({ title: '', date: '', note: '', color: 'saffron' })}>
                <Plus size={14} /> Add event
              </button>
            </div>
            {sortedReminders.length === 0 ? (
              <p className="text-sm text-ink-500 text-center py-8">No events yet. Add one to keep track of important dates and tasks.</p>
            ) : (
              <div className="space-y-2">
                {sortedReminders.map((r) => {
                  const isOverdue = r.date && !r.done && r.date < new Date().toLocaleDateString('en-CA');
                  return (
                    <div key={r.id} className={`flex items-start gap-3 rounded-xl border p-3 ${r.done ? 'bg-cream-100 border-cream-300 opacity-60' : 'bg-cream-50 border-gold-300/50'}`}>
                      <button onClick={() => toggleDone(r.id)} className="mt-0.5 shrink-0" title={r.done ? 'Mark undone' : 'Mark done'}>
                        {r.done
                          ? <Check size={16} className="text-leaf-600" />
                          : <div className="w-4 h-4 rounded-full border-2 border-saffron-500" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${r.done ? 'line-through text-ink-500' : 'text-ink-900'}`}>{r.title}</p>
                        {r.date && (
                          <p className={`text-xs mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-kumkum-600 font-semibold' : 'text-ink-500'}`}>
                            <Calendar size={11} />
                            {new Date(r.date + 'T00:00:00').toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {isOverdue && ' · Overdue'}
                          </p>
                        )}
                        {r.note && <p className="text-xs text-ink-600 mt-1 leading-snug">{r.note}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="btn-ghost !p-1.5" title="Edit" onClick={() => setReminderForm({ ...r })}><Pencil size={13} /></button>
                        <button className="btn-ghost !p-1.5 text-kumkum-600" title="Delete" onClick={() => deleteReminder(r.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DRow({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-ink-500 w-20 shrink-0">{label}</span>
      <span className="text-ink-900">{value}</span>
    </div>
  );
}
