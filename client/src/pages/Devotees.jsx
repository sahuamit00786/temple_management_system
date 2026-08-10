import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, RotateCcw, Undo2, WifiOff, Download, Printer } from 'lucide-react';
import { WhatsAppIcon } from '../components/WhatsAppIcon.jsx';
import { useApp } from '../auth/AppContext.jsx';
import { api, qs } from '../api/client.js';
import { exportCsv } from '../components/FilterBar.jsx';
import { generateTablePdf } from '../print/TablePDF.jsx';
import { ldb } from '../db/dexie.js';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import DataGrid from '../components/DataGrid.jsx';
import SendMessageModal from '../components/SendMessageModal.jsx';
import LookupSelect from '../components/LookupSelect.jsx';

const todayIso = new Date().toISOString().slice(0, 10);
const addDuration = (dateStr, unit, qty) => {
  const [y, mo, dy] = dateStr.split('-').map(Number);
  const d = new Date(y, mo - 1, dy);
  const n = Number(qty);
  if (unit === 'day') d.setDate(d.getDate() + n);
  else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MEMBER_TYPE_LABELS = { DEVOTEE: 'Devotee', MEMBER: 'Member', COMMITTEE: 'Committee' };

const empty = { name: '', phone: '', altPhone: '', icNumber: '', address: '', addressTa: '', email: '',
  memberType: '', membershipTypeId: '', membershipTypeLabel: '', membershipPrice: '',
  membershipMonths: '', membershipUnit: 'month', membershipQty: '',
  membershipStartDate: todayIso, membershipEndDate: '',
  membershipPaidVia: '', membershipPaidViaId: '' };

export default function Devotees() {
  const { can, online, lookups } = useApp();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({});
  const [data, setData] = useState({ rows: [], total: 0 });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteErr, setDeleteErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [messaging, setMessaging] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (key) => {
    if (key === sortBy) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortOrder('asc'); }
    setPage(1);
  };

  const handleFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const load = useCallback(async () => {
    setLoading(true);
    if (!online) {
      try {
        const q = (filters.search || '').trim().toLowerCase();
        const all = await ldb.devotees.orderBy('name').toArray();
        const filtered = q
          ? all.filter((d) => d.name?.toLowerCase().includes(q) || d.phone?.includes(q) || d.icNumber?.toLowerCase().includes(q))
          : all;
        const ps = 10;
        const offset = (page - 1) * ps;
        setData({ rows: filtered.slice(offset, offset + ps), total: filtered.length });
      } catch { setData({ rows: [], total: 0 }); }
      finally { setLoading(false); }
      return;
    }
    api(`/devotees${qs({ ...filters, page, pageSize, sortBy, sortOrder })}`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filters, page, pageSize, sortBy, sortOrder, online]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (!online && !editing.id) {
        // Offline create: save locally and queue for sync
        const tempId = `tmp_${Date.now()}`;
        await ldb.devotees.put({ ...editing, id: tempId, createdAt: new Date().toISOString(), _pending: true });
        await ldb.devoteeOutbox.add({ data: editing, tempId, status: 'pending', createdAt: new Date().toISOString() });
        setEditing(null); load(); return;
      }
      if (editing.id) await api(`/devotees/${editing.id}`, { method: 'PUT', body: editing });
      else await api('/devotees', { method: 'POST', body: editing });
      setEditing(null); load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setDeleteErr('');
    try { await api(`/devotees/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); load(); }
    catch (e) { setDeleteErr(e.message); }
    finally { setBusy(false); }
  };

  const reactivate = async (d) => {
    try { await api(`/devotees/${d.id}/reactivate`, { method: 'POST' }); load(); }
    catch (e) { setErr(e.message); }
  };

  const maskIc = (ic) => (ic ? ic.replace(/.(?=.{4})/g, 'X') : '—');

  const DEVOTEE_EXPORT_COLS = [
    { key: 'name', label: 'Name', flex: 1.5, csv: (d) => d.name },
    { key: 'phone', label: 'Phone', flex: 1, csv: (d) => d.phone || '' },
    { key: 'altPhone', label: 'Alt Phone', flex: 1, csv: (d) => d.altPhone || '' },
    { key: 'icNumber', label: 'IC / Passport', flex: 1.2, csv: (d) => d.icNumber || '' },
    { key: 'email', label: 'Email', flex: 1.5, csv: (d) => d.email || '' },
    { key: 'address', label: 'Address', flex: 2, csv: (d) => d.address || '' },
    { key: 'createdAt', label: 'Added', flex: 1, csv: (d) => new Date(d.createdAt).toLocaleDateString('en-MY') },
  ];

  const fetchAllDevotees = async () => {
    const d = await api(`/devotees${qs({ ...filters, page: 1, pageSize: 5000, sortBy, sortOrder })}`);
    return d.rows || [];
  };

  const doExportCsv = async () => {
    try { exportCsv(`devotees-${new Date().toLocaleDateString('en-CA')}.csv`, DEVOTEE_EXPORT_COLS, await fetchAllDevotees()); } catch {}
  };

  const doExportPdf = async () => {
    try { await generateTablePdf('Devotees', DEVOTEE_EXPORT_COLS, await fetchAllDevotees()); } catch {}
  };

  return (
    <div>
      {!online && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <WifiOff size={15} className="shrink-0" />
          Offline — showing cached data (up to 10 per page). Sorting and advanced filters unavailable.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-600/50" />
          <input className="input !pl-8" placeholder="Name, phone or IC" value={filters.search || ''} onChange={(e) => { if (!online) { handleFilter('search', e.target.value); } else { handleFilter('search', e.target.value); } }} />
        </div>
        <select className="input !w-auto" value={filters.memberType || ''} onChange={(e) => handleFilter('memberType', e.target.value || undefined)} disabled={!online}>
          <option value="">All types</option>
          <option value="DEVOTEE">Devotee</option>
          <option value="MEMBER">Member</option>
          <option value="COMMITTEE">Committee</option>
        </select>
        <select className="input !w-auto" value={filters.isActive || ''} onChange={(e) => handleFilter('isActive', e.target.value || undefined)} disabled={!online}>
          <option value="">Active</option>
          <option value="false">Inactive</option>
          <option value="all">All</option>
        </select>
        <button className="btn-ghost !p-2" title="Reset filters" onClick={() => { setFilters({}); setPage(1); }}><RotateCcw size={15} /></button>
        {can('devotees', 'export') && online && (
          <>
            <button className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1.5" onClick={doExportCsv}><Download size={13} /> CSV</button>
            <button className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1.5" onClick={doExportPdf}><Printer size={13} /> PDF</button>
          </>
        )}
        {can('devotees', 'create') && (
          <button className="btn-primary" onClick={() => { setErr(''); setEditing({ ...empty }); }}><Plus size={16} /> Add Member</button>
        )}
      </div>
      {err && <p className="text-sm text-kumkum-600 mb-3">{err}</p>}
      <DataGrid
        loading={loading}
        empty="No devotees found — add the first one."
        total={data.total}
        page={page}
        pageSize={online ? pageSize : 10}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={online ? handleSort : undefined}
        onPageChange={setPage}
        onPageSizeChange={online ? (s) => { setPageSize(s); setPage(1); } : undefined}
        columns={[
          { key: 'name', label: 'Name', sortable: true, render: (d) => (
            d._pending
              ? <span className="flex items-center gap-2"><span className="font-medium text-ink-600">{d.name}</span><span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">Pending sync</span></span>
              : <button className="font-medium text-maroon-900 hover:underline text-left" onClick={() => navigate(`/devotees/${d.id}`)}>{d.name}</button>
          )},
          { key: 'phone', label: 'Contact', sortable: true, render: (d) => d.phone || '—' },
          { key: 'icNumber', label: 'IC / Passport', render: (d) => (
            <span className="group cursor-pointer inline-block w-36 font-mono text-xs" title={d.icNumber || ''}>
              <span className="group-hover:hidden">{maskIc(d.icNumber)}</span>
              <span className="hidden group-hover:inline">{d.icNumber || '—'}</span>
            </span>
          )},
          { key: 'email', label: 'Email', sortable: true, render: (d) => d.email || '—' },
          { key: 'memberType', label: 'Type', render: (d) => (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
              d.memberType === 'MEMBER' ? 'bg-gold-100 text-gold-800' :
              d.memberType === 'COMMITTEE' ? 'bg-maroon-100 text-maroon-800' :
              'bg-cream-100 text-ink-600'
            }`}>{MEMBER_TYPE_LABELS[d.memberType] || 'Devotee'}</span>
          )},
          { key: 'isActive', label: 'Status', render: (d) => d.isActive === false
            ? <span className="chip-cancelled">Inactive</span>
            : <span className="chip-paid">Active</span> },
          { key: 'createdAt', label: 'Added', sortable: true, render: (d) => new Date(d.createdAt).toLocaleDateString('en-MY') },
          { key: 'actions', label: '', render: (d) => (
            <span className="flex gap-1">
              {!d._pending && <button className="btn-ghost !p-1.5 text-leaf-600" title="Send WhatsApp message" onClick={() => setMessaging(d)}><WhatsAppIcon size={15} /></button>}
              {!d._pending && can('devotees', 'edit') && <button className="btn-ghost !p-1.5" onClick={() => {
                const allModes = [
                  ...(lookups['PAYMENT_MODE']?.values || []),
                  ...(lookups['BOOKING_PAYMENT_MODE']?.values || []),
                ];
                const payViaId = allModes.find((v) => v.nameEn === d.membershipPaidVia)?.id;
                const memType = lookups['MEMBERSHIP_TYPE']?.values?.find((v) => v.id === d.membershipTypeId);
                const unit = memType?.meta?.unit || 'month';
                const qty = memType?.meta?.quantity || memType?.meta?.months || d.membershipMonths || '';
                setEditing({ ...d, membershipPaidViaId: payViaId ? String(payViaId) : '', membershipUnit: unit, membershipQty: qty });
              }}><Pencil size={15} /></button>}
              {!d._pending && can('devotees', 'delete') && (
                d.isActive === false
                  ? <button className="btn-ghost !p-1.5 text-leaf-600" title="Reactivate member" onClick={() => reactivate(d)}><Undo2 size={15} /></button>
                  : <button className="btn-ghost !p-1.5 text-kumkum-600" title="Remove member" onClick={() => setDeleting(d)}><Trash2 size={15} /></button>
              )}
            </span>
          )},
        ]}
        rows={data.rows}
      />

      <Modal title={editing?.id ? `Edit ${editing.name}` : 'Add Member'} open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <div className="space-y-3">
            <div><label className="label">Name</label><input className="input" placeholder="Full name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Contact</label><input className="input" placeholder="e.g. 012-3456789" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div><label className="label">Secondary contact</label><input className="input" placeholder="e.g. 011-2345678" value={editing.altPhone || ''} onChange={(e) => setEditing({ ...editing, altPhone: e.target.value })} /></div>
            </div>
            <div><label className="label">IC / Passport</label><input className="input" placeholder="XXXXXX-XX-XXXX or Passport No" value={editing.icNumber || ''} onChange={(e) => setEditing({ ...editing, icNumber: e.target.value })} /></div>
            <div><label className="label">Address</label><input className="input" placeholder="Full address" value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div><label className="label">முகவரி <span className="text-ink-500 font-normal">(Tamil address)</span></label><input className="input" placeholder="தமிழ் முகவரி…" value={editing.addressTa || ''} onChange={(e) => setEditing({ ...editing, addressTa: e.target.value })} style={{ fontFamily: "'Noto Sans Tamil','Latha',Arial,sans-serif" }} /></div>
            <div><label className="label">Email</label><input className="input" type="email" placeholder="email@example.com" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>

            <div><label className="label">Member Type</label>
              <select className="input" value={editing.memberType || ''} onChange={(e) => setEditing({ ...editing, memberType: e.target.value, membershipTypeId: '', membershipTypeLabel: '', membershipPrice: '', membershipMonths: '', membershipStartDate: todayIso, membershipEndDate: '', membershipPaidVia: '', membershipPaidViaId: '' })}>
                <option value="">Devotee</option>
                <option value="MEMBER">Member</option>
                <option value="COMMITTEE">Committee</option>
              </select>
            </div>

            {editing.memberType === 'MEMBER' && (
              <>
                <div><label className="label">Membership Type</label>
                  <LookupSelect
                    typeCode="MEMBERSHIP_TYPE"
                    value={editing.membershipTypeId ? String(editing.membershipTypeId) : ''}
                    showPrice
                    onChange={(id) => {
                      const lv = lookups['MEMBERSHIP_TYPE']?.values?.find((v) => String(v.id) === id);
                      const unit = lv?.meta?.unit || 'month';
                      const qty = lv?.meta?.quantity || lv?.meta?.months || null;
                      setEditing((prev) => {
                        const startDate = prev.membershipStartDate || todayIso;
                        return {
                          ...prev,
                          membershipTypeId: id ? Number(id) : null,
                          membershipTypeLabel: lv?.nameEn || '',
                          membershipPrice: lv?.price != null ? Number(lv.price) : null,
                          membershipMonths: qty || null,
                          membershipUnit: unit,
                          membershipQty: qty,
                          membershipEndDate: qty ? addDuration(startDate, unit, qty) : '',
                        };
                      });
                    }}
                    allowAdd={false}
                  />
                </div>
                {editing.membershipPrice != null && editing.membershipPrice !== '' && (
                  <p className="text-sm text-ink-700">Fee: <span className="font-semibold">RM {Number(editing.membershipPrice).toFixed(2)}</span>{editing.membershipMonths ? ` · ${editing.membershipMonths} month${editing.membershipMonths > 1 ? 's' : ''}` : ''}</p>
                )}
                <div><label className="label">Paid Via</label>
                  <LookupSelect
                    typeCode="PAYMENT_MODE"
                    value={editing.membershipPaidViaId || ''}
                    onChange={(id) => {
                      const allModes = [
                        ...(lookups['PAYMENT_MODE']?.values || []),
                        ...(lookups['BOOKING_PAYMENT_MODE']?.values || []),
                      ];
                      const lv = allModes.find((v) => String(v.id) === id);
                      setEditing((prev) => ({ ...prev, membershipPaidViaId: id || '', membershipPaidVia: lv?.nameEn || '' }));
                    }}
                    allowAdd={false}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Start Date</label>
                    <input type="date" className="input" value={editing.membershipStartDate || todayIso}
                      onChange={(e) => {
                        const start = e.target.value;
                        setEditing((prev) => ({
                          ...prev,
                          membershipStartDate: start,
                          membershipEndDate: (prev.membershipQty || prev.membershipMonths)
                            ? addDuration(start, prev.membershipUnit || 'month', prev.membershipQty || prev.membershipMonths)
                            : prev.membershipEndDate,
                        }));
                      }} />
                  </div>
                  <div><label className="label">End Date <span className="text-xs text-ink-400 font-normal">(auto)</span></label>
                    <input type="date" className="input !bg-cream-100 cursor-not-allowed" readOnly
                      value={editing.membershipEndDate || ''} />
                  </div>
                </div>
              </>
            )}

            {editing.memberType === 'COMMITTEE' && (
              <>
                <div><label className="label">Committee Term / Role</label>
                  <LookupSelect
                    typeCode="MEMBERSHIP_TYPE"
                    value={editing.membershipTypeId ? String(editing.membershipTypeId) : ''}
                    showPrice
                    onChange={(id) => {
                      const lv = lookups['MEMBERSHIP_TYPE']?.values?.find((v) => String(v.id) === id);
                      const unit = lv?.meta?.unit || 'month';
                      const qty = lv?.meta?.quantity || lv?.meta?.months || null;
                      setEditing((prev) => {
                        const startDate = prev.membershipStartDate || todayIso;
                        return {
                          ...prev,
                          membershipTypeId: id ? Number(id) : null,
                          membershipTypeLabel: lv?.nameEn || '',
                          membershipPrice: lv?.price != null ? Number(lv.price) : null,
                          membershipMonths: qty || null,
                          membershipUnit: unit,
                          membershipQty: qty,
                          membershipEndDate: qty ? addDuration(startDate, unit, qty) : '',
                        };
                      });
                    }}
                    allowAdd={false}
                  />
                </div>
                <div><label className="label">Amount (RM)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={editing.membershipPrice ?? ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, membershipPrice: e.target.value !== '' ? Number(e.target.value) : null }))}
                  />
                </div>
                <div><label className="label">Paid Via</label>
                  <LookupSelect
                    typeCode="PAYMENT_MODE"
                    value={editing.membershipPaidViaId || ''}
                    onChange={(id) => {
                      const allModes = [
                        ...(lookups['PAYMENT_MODE']?.values || []),
                        ...(lookups['BOOKING_PAYMENT_MODE']?.values || []),
                      ];
                      const lv = allModes.find((v) => String(v.id) === id);
                      setEditing((prev) => ({ ...prev, membershipPaidViaId: id || '', membershipPaidVia: lv?.nameEn || '' }));
                    }}
                    allowAdd={false}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Term Start</label>
                    <input type="date" className="input" value={editing.membershipStartDate || todayIso}
                      onChange={(e) => {
                        const start = e.target.value;
                        setEditing((prev) => ({
                          ...prev,
                          membershipStartDate: start,
                          membershipEndDate: (prev.membershipQty || prev.membershipMonths)
                            ? addDuration(start, prev.membershipUnit || 'month', prev.membershipQty || prev.membershipMonths)
                            : prev.membershipEndDate,
                        }));
                      }} />
                  </div>
                  <div><label className="label">Term End</label>
                    <input type="date" className="input" value={editing.membershipEndDate || ''}
                      onChange={(e) => setEditing((prev) => ({ ...prev, membershipEndDate: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {err && <p className="text-sm text-kumkum-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy || !editing.name?.trim()} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Remove member"
        message={`Remove "${deleting?.name}" from the active list? They'll be marked inactive — their past transactions and bookings are kept as-is.`}
        onConfirm={remove}
        onClose={() => { setDeleting(null); setDeleteErr(''); }}
        busy={busy}
        error={deleteErr}
      />

      <SendMessageModal
        open={!!messaging}
        onClose={() => setMessaging(null)}
        devotee={messaging}
      />
    </div>
  );
}
