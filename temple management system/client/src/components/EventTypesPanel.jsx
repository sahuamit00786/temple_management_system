import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';
import ConfirmModal from './ConfirmModal.jsx';

// Hall & event types: own table (not a lookup). Hall rate = price, deposit = depositPct.
export default function EventTypesPanel() {
  const { eventTypes, can, online, refreshMasterData } = useApp();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const canEdit = can('temple-config', 'edit') && online;
  const canDelete = can('temple-config', 'delete') && online;

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); await refreshMasterData(); return true; }
    catch (e) { setErr(e.message); flash(e.message); return false; }
    finally { setBusy(false); }
  };

  const save = async () => {
    const body = { nameEn: editing.nameEn, nameTa: editing.nameTa, price: editing.price, depositPct: editing.depositPct };
    const ok = await run(() => (editing.id
      ? api(`/event-types/${editing.id}`, { method: 'PUT', body: { ...body, isActive: editing.isActive } })
      : api('/event-types', { method: 'POST', body })));
    if (ok) setEditing(null);
  };

  const toggle = (t) => run(() => api(`/event-types/${t.id}`, {
    method: 'PUT',
    body: { nameEn: t.nameEn, nameTa: t.nameTa, price: t.price, depositPct: t.depositPct, isActive: !t.isActive },
  }));

  const move = (idx, dir) => {
    const ids = eventTypes.map((t) => t.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    run(() => api('/event-types/reorder', { method: 'PUT', body: { ids } }));
  };

  const remove = async () => {
    let message = '';
    const ok = await run(async () => {
      const r = await api(`/event-types/${deleting.id}`, { method: 'DELETE' });
      message = r.message || 'Deleted';
    });
    if (ok) { setDeleting(null); flash(message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold">
          Hall &amp; Event Types — {eventTypes.length} type{eventTypes.length !== 1 ? 's' : ''}
        </p>
        {can('temple-config', 'create') && (
          <button
            className="btn-outline disabled:opacity-40"
            disabled={!online}
            onClick={() => { setErr(''); setEditing({ nameEn: '', nameTa: '', price: '', depositPct: 50, isActive: true }); }}
          >
            <Plus size={15} /> Add event type
          </button>
        )}
      </div>
      {msg && <p className="text-sm text-leaf-700 mb-3">{msg}</p>}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Name (English)</th><th>Name (Tamil)</th><th>Hall rate</th><th>Deposit %</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {eventTypes.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-ink-600 py-10">No event types yet — click "Add event type".</td></tr>
            ) : eventTypes.map((t, i) => (
              <tr key={t.id}>
                <td className={`font-medium${!t.isActive ? ' text-ink-400 line-through' : ''}`}>{t.nameEn}</td>
                <td className="text-ink-600 text-sm">{t.nameTa || '—'}</td>
                <td className="tabular-nums font-semibold text-saffron-700 text-sm">{t.price != null ? `RM ${Number(t.price).toFixed(2)}` : '—'}</td>
                <td className="tabular-nums">{t.depositPct ?? 50}%</td>
                <td><span className={`chip ${t.isActive ? 'chip-paid' : 'chip-cancelled'}`}>{t.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <span className="flex items-center gap-0.5">
                    {canEdit && (
                      <>
                        <button className="btn-ghost !p-1.5" title="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                        <button className="btn-ghost !p-1.5" title="Move down" disabled={i === eventTypes.length - 1 || busy} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                        <button className="btn-ghost !p-1.5" title="Edit" onClick={() => { setErr(''); setEditing({ ...t, price: t.price ?? '', depositPct: t.depositPct ?? 50 }); }}><Pencil size={14} /></button>
                        <button className="btn-ghost !p-1.5" title={t.isActive ? 'Deactivate' : 'Activate'} onClick={() => toggle(t)}>{t.isActive ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      </>
                    )}
                    {canDelete && (
                      <button className="btn-ghost !p-1.5 text-kumkum-600" title="Delete" onClick={() => { setErr(''); setDeleting(t); }}><Trash2 size={14} /></button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing?.id ? 'Edit event type' : 'Add event type'} open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">Name (English)</label>
              <input className="input" value={editing.nameEn} autoFocus onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
            </div>
            <div>
              <label className="label">Name (Tamil) — optional</label>
              <input className="input" value={editing.nameTa || ''} onChange={(e) => setEditing({ ...editing, nameTa: e.target.value })} />
            </div>
            <div>
              <label className="label">Hall rate (RM)</label>
              <input className="input" type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Deposit %</label>
              <input className="input" type="number" placeholder="50" value={editing.depositPct} onChange={(e) => setEditing({ ...editing, depositPct: e.target.value })} />
            </div>
            {err && <p className="text-sm text-kumkum-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={!editing.nameEn?.trim() || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Delete event type"
        message={deleting ? `Delete "${deleting.nameEn}"? If bookings use it, it will be deactivated instead.` : ''}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </div>
  );
}
