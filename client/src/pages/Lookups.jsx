import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import Tabs from '../components/Tabs.jsx';
import Modal from '../components/Modal.jsx';

export default function Lookups() {
  const { can, refreshMasterData } = useApp();
  const [allLookups, setAllLookups] = useState({});
  const [tab, setTab] = useState('');
  const [editing, setEditing] = useState(null);
  const [deletingVal, setDeletingVal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const loadAll = useCallback(async () => {
    try { setAllLookups(await api('/lookups?all=1')); } catch {}
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Only show non-POS-menu types (dropdown types for system use)
  const tabs = useMemo(() =>
    Object.entries(allLookups)
      .filter(([, t]) => !t.isPosMenu)
      .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0) || a[0].localeCompare(b[0]))
      .map(([code, t]) => ({ key: code, label: t.name })),
    [allLookups]
  );

  // Auto-select first tab
  useEffect(() => {
    if (tabs.length > 0 && (!tab || !tabs.find((t) => t.key === tab))) {
      setTab(tabs[0].key);
    }
  }, [tabs, tab]);

  const all = (allLookups[tab]?.values || []);
  const parents = all.filter((v) => !v.parentId);
  const isHallEvent = tab === 'HALL_EVENT';
  const isMembership = tab === 'MEMBERSHIP_TYPE';
  const showPrice = !['PAYMENT_MODE', 'BOOKING_PAYMENT_MODE', 'NATCHATHIRAM'].includes(tab);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = {
        nameEn: editing.nameEn,
        nameTa: editing.nameTa || null,
        price: editing.price === '' || editing.price == null ? null : Number(editing.price),
        depositPct: isHallEvent ? Number(editing.depositPct || 50) : undefined,
        meta: isMembership && editing.durationQty
          ? { unit: editing.durationUnit || 'month', quantity: Number(editing.durationQty) }
          : undefined,
        parentId: editing.parentId || null,
      };
      if (editing.id) await api(`/lookups/values/${editing.id}`, { method: 'PUT', body });
      else await api(`/lookups/${tab}/values`, { method: 'POST', body });
      await Promise.all([loadAll(), refreshMasterData()]);
      setEditing(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await api(`/lookups/values/${deletingVal.id}`, { method: 'DELETE' });
      setMsg(res.message || `"${deletingVal.nameEn}" deleted`);
      setDeletingVal(null);
      await Promise.all([loadAll(), refreshMasterData()]);
      setTimeout(() => setMsg(''), 4000);
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const toggleActive = async (v) => {
    await api(`/lookups/values/${v.id}`, { method: 'PUT', body: { isActive: !v.isActive } });
    await Promise.all([loadAll(), refreshMasterData()]);
  };

  const fmtDuration = (v) => {
    const qty = v.meta?.quantity || v.meta?.months;
    const unit = v.meta?.unit || (v.meta?.months ? 'month' : null);
    if (!qty || !unit) return '—';
    return `${qty} ${unit}${qty > 1 ? 's' : ''}`;
  };

  const Row = ({ v }) => (
    <tr>
      <td><span className={`font-medium${!v.isActive ? ' text-ink-500' : ''}`}>{v.nameEn}</span></td>
      <td className="text-ink-600">{v.nameTa || '—'}</td>
      {showPrice && <td className="tabular-nums">{v.price != null ? `RM ${Number(v.price).toFixed(2)}` : '—'}</td>}
      {isMembership && <td className="text-ink-600">{fmtDuration(v)}</td>}
      {isHallEvent && <td className="tabular-nums">{v.depositPct ?? 50}%</td>}
      <td><span className={v.isActive ? 'chip chip-paid' : 'chip chip-cancelled'}>{v.isActive ? 'Active' : 'Inactive'}</span></td>
      <td className="whitespace-nowrap">
        {can('lookups', 'edit') && (
          <>
            <button className="btn-ghost !p-1.5" title="Edit" onClick={() => setEditing({
              ...v,
              price: v.price ?? '',
              durationQty: v.meta?.quantity || v.meta?.months || '',
              durationUnit: v.meta?.unit || (v.meta?.months ? 'month' : 'month'),
            })}><Pencil size={15} /></button>
            <button className="btn-ghost !p-1.5" title={v.isActive ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(v)}>
              {v.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </>
        )}
        {can('lookups', 'delete') && (
          <button className="btn-ghost !p-1.5 text-kumkum-600" title="Delete" onClick={() => setDeletingVal(v)}><Trash2 size={15} /></button>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <p className="text-sm text-ink-600 mb-3">System dropdown values used across forms and filters. POS counter items are managed in Temple Config.</p>

      {tabs.length === 0 ? (
        <div className="card p-10 text-center text-ink-600 text-sm">Loading…</div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-gold-300/60 mb-5">
            <Tabs tabs={tabs} active={tab} onChange={setTab} className="!mb-0 !border-b-0" />
            {can('lookups', 'create') && (
              <button className="btn-primary" onClick={() => setEditing({ nameEn: '', price: '', parentId: null })}>
                <Plus size={16} /> Add value
              </button>
            )}
          </div>

          {msg && <p className="text-sm text-leaf-700 mb-3">{msg}</p>}

          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name (English)</th>
                  <th>Name (Tamil)</th>
                  {showPrice && <th>Price</th>}
                  {isMembership && <th>Duration</th>}
                  {isHallEvent && <th>Deposit %</th>}
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parents.length === 0
                  ? <tr><td colSpan={4 + (showPrice ? 1 : 0) + (isMembership ? 1 : 0) + (isHallEvent ? 1 : 0)} className="text-center text-ink-600 py-8">No values yet — add the first one.</td></tr>
                  : parents.map((p) => <Row key={p.id} v={p} />)
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        title={editing?.id ? `Edit ${editing.nameEn}` : `Add to ${allLookups[tab]?.name || tab}`}
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">Name (English)</label>
              <input className="input" placeholder="Enter name" value={editing.nameEn}
                onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">Name (Tamil) — prints on chit</label>
              <input className="input" placeholder="Tamil name (optional)" value={editing.nameTa || ''}
                onChange={(e) => setEditing({ ...editing, nameTa: e.target.value })} />
            </div>
            {!['PAYMENT_MODE', 'BOOKING_PAYMENT_MODE', 'NATCHATHIRAM'].includes(tab) && (
              <div>
                <label className="label">Price (RM)</label>
                <input className="input" type="number" step="0.01" placeholder="0.00" value={editing.price ?? ''}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
              </div>
            )}
            {isMembership && (
              <div>
                <label className="label">Duration</label>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" type="number" min="1" placeholder="e.g. 1"
                    value={editing.durationQty || ''}
                    onChange={(e) => setEditing({ ...editing, durationQty: e.target.value })} />
                  <select className="input" value={editing.durationUnit || 'month'}
                    onChange={(e) => setEditing({ ...editing, durationUnit: e.target.value })}>
                    <option value="day">Day(s)</option>
                    <option value="month">Month(s)</option>
                    <option value="year">Year(s)</option>
                  </select>
                </div>
              </div>
            )}
            {isHallEvent && (
              <div>
                <label className="label">Deposit %</label>
                <input className="input" type="number" placeholder="50" value={editing.depositPct ?? 50}
                  onChange={(e) => setEditing({ ...editing, depositPct: e.target.value })} />
              </div>
            )}
            {err && <p className="text-sm text-kumkum-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={!editing.nameEn?.trim() || busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deletingVal}
        title="Delete value"
        message={`Delete "${deletingVal?.nameEn}"? If it has been used it will be deactivated instead.`}
        onConfirm={remove}
        onClose={() => setDeletingVal(null)}
        busy={busy}
      />
    </div>
  );
}
