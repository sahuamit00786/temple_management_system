import { useState, useEffect, useCallback } from 'react';
import { useTabParam } from '../hooks/useTabParam.js';
import { downloadName } from '../branding.js';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, X, Check, Trash2, StickyNote, Plus, Printer, Download } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import { ldb } from '../db/dexie.js';
import { generateInvoicePdf, generateMembershipPdf } from '../print/InvoicePDF.jsx';
import Tabs from '../components/Tabs.jsx';
import Modal from '../components/Modal.jsx';
import LookupSelect from '../components/LookupSelect.jsx';
import MembershipModal from '../components/MembershipModal.jsx';

const TABS = [
  { key: 'details', label: 'Devotee Details' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'payments', label: 'Payments' },
  { key: 'orders', label: 'Orders' },
  { key: 'membership', label: 'Membership' },
];

const todayIso = new Date().toISOString().slice(0, 10);
const addDuration = (dateStr, unit, qty) => {
  const d = new Date(dateStr + 'T00:00:00');
  const n = Number(qty);
  if (unit === 'day') d.setDate(d.getDate() + n);
  else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

const RM = (n) => `RM ${Number(n || 0).toFixed(2)}`;
const fmtDT = (d) => new Date(d).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUS_CLASS = {
  PENDING_DEPOSIT: 'chip chip-due',
  DEPOSIT_PAID: 'chip chip-partial',
  FULLY_PAID: 'chip chip-paid',
  CANCELLED: 'chip chip-cancelled',
};

export default function DevoteeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, lookups, eventTypes, settings } = useApp();
  const [tab, setTab] = useTabParam('details', ['details', 'bookings', 'payments', 'orders', 'membership']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [offlineMode, setOfflineMode] = useState(false);

  // Edit devotee
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  // Membership edit: { data: object, membershipId: number|null }
  const [memEdit, setMemEdit] = useState(null);

  // Notes
  const [noteModal, setNoteModal] = useState(null); // null | { mode: 'add'|'edit', noteId, text }
  const [notesBusy, setNotesBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api(`/devotees/${id}`)
      .then((d) => { setData(d); setOfflineMode(false); })
      .catch(async (e) => {
        const cached = await ldb.devotees.get(Number(id));
        if (cached) {
          setData({ devotee: cached, bookings: [], transactions: [], notes: [], memberships: [] });
          setOfflineMode(true);
        } else {
          setErr(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => { setEditErr(''); setEditing({ ...data.devotee }); };
  const cancelEdit = () => setEditing(null);

  const save = async () => {
    setBusy(true); setEditErr('');
    try {
      await api(`/devotees/${id}`, { method: 'PUT', body: editing });
      setEditing(null); load();
    } catch (e) { setEditErr(e.message); }
    finally { setBusy(false); }
  };

  const saveNote = async () => {
    if (!noteModal?.text?.trim()) return;
    setNotesBusy(true);
    try {
      if (noteModal.mode === 'add') {
        await api(`/devotees/${id}/notes`, { method: 'POST', body: { body: noteModal.text } });
      } else {
        await api(`/devotees/${id}/notes/${noteModal.noteId}`, { method: 'PUT', body: { body: noteModal.text } });
      }
      setNoteModal(null); load();
    } catch (e) { alert(e.message); }
    finally { setNotesBusy(false); }
  };

  const deleteNote = async (noteId) => {
    try {
      await api(`/devotees/${id}/notes/${noteId}`, { method: 'DELETE' });
      load();
    } catch (e) { alert(e.message); }
  };

  const hallEvents = eventTypes;
  const eventName = (typeId) => hallEvents.find((e) => e.id === typeId)?.nameEn || '—';

  const openMembershipEdit = (rec, membershipId = null) => setMemEdit({ data: rec, membershipId });

  const handlePrintInvoice = async (b) => {
    if (invoiceBusy) return;
    setInvoiceBusy(true);
    try {
      const full = await api(`/bookings/${b.id}`);
      const url = await generateInvoicePdf(full, settings, eventName(full.eventTypeId));
      window.open(url, '_blank');
    } catch (e) { alert(e.message); }
    finally { setInvoiceBusy(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  const printMembership = async (membershipRec) => {
    const dev = data.devotee;
    // Merge membership record fields onto devotee for the PDF
    const payload = { ...dev, ...membershipRec };
    try {
      const url = await generateMembershipPdf(payload, settings);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName(`Membership-${dev.name.replace(/\s+/g, '_')}.pdf`);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="py-16 text-center text-ink-600">Loading…</div>;
  if (err) return <div className="py-16 text-center text-kumkum-600">{err}</div>;
  if (!data) return null;

  const { devotee, bookings, transactions, notes = [], memberships = [] } = data;
  const payments = transactions.filter((t) => t.kind === 'HALL_PAYMENT');
  const orders = transactions.filter((t) => t.kind !== 'HALL_PAYMENT');
  const d = editing || devotee;
  const isEditing = !!editing;

  // Merge devotee notes + booking notes into one timeline
  const bookingNotes = bookings
    .filter((b) => b.notes)
    .map((b) => ({ type: 'booking', tag: b.bookingNo, body: b.notes, createdAt: b.createdAt }));
  const allNotes = [
    ...notes.map((n) => ({ type: 'staff', ...n })),
    ...bookingNotes,
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const field = (key, label, opts = {}) => (
    <div key={key} className="flex items-center gap-4">
      <label className="label w-32 shrink-0 mb-0">{label}</label>
      <input
        className="input flex-1"
        type={opts.type || 'text'}
        placeholder={opts.placeholder || ''}
        value={d[key] || ''}
        readOnly={!isEditing}
        autoFocus={opts.autoFocus && isEditing}
        onChange={(e) => isEditing && setEditing({ ...editing, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div>
      {offlineMode && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 mb-4 text-sm text-amber-800 flex items-center gap-2">
          <span>Offline — showing cached data. Bookings, payments and notes unavailable until reconnected.</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-5">
        <button className="btn-ghost !p-1.5" onClick={() => navigate('/devotees')} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-display text-maroon-900 flex-1">{devotee.name}</h1>
        {can('devotees', 'edit') && !isEditing && !offlineMode && tab === 'details' && (
          <button className="btn-outline" onClick={startEdit}><Pencil size={15} /> Edit devotee</button>
        )}
        {can('devotees', 'edit') && !isEditing && !offlineMode && tab === 'membership' && devotee.memberType !== 'COMMITTEE' && (
          <button className="btn-primary" onClick={() => openMembershipEdit(devotee, null)}><Plus size={15} /> Add Membership</button>
        )}
        {isEditing && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={cancelEdit} disabled={busy}><X size={15} /> Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy || !editing.name?.trim()}>
              <Check size={15} /> {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={(t) => { if (!isEditing) setTab(t); }} />

      {tab === 'details' && (
        <div className="space-y-5">
          {/* Devotee fields */}
          <div className="card p-5 space-y-3">
            {field('name', 'Name', { autoFocus: true })}
            {field('phone', 'Phone', { placeholder: '012-3456789' })}
            {field('altPhone', 'Alt phone', { placeholder: '011-2345678' })}
            {field('icNumber', 'IC / Passport', { placeholder: 'XXXXXX-XX-XXXX or Passport No' })}
            {field('email', 'Email', { type: 'email', placeholder: 'email@example.com' })}
            {field('address', 'Address')}
            <div className="flex items-center gap-4">
              <label className="label w-32 shrink-0 mb-0">Added</label>
              <input className="input flex-1" readOnly value={fmtDT(devotee.createdAt)} />
            </div>
            {editErr && <p className="text-sm text-kumkum-600">{editErr}</p>}
          </div>

          {/* Membership info — only for members */}
          {devotee.memberType === 'MEMBER' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-maroon-900">Membership Details</h2>
                <button className="btn-outline !py-1 !px-2.5 text-xs flex items-center gap-1.5" onClick={printMembership}>
                  <Printer size={13} /> Print
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="text-ink-500">Plan</div>
                <div className="font-medium">{devotee.membershipTypeLabel || '—'}</div>
                <div className="text-ink-500">Amount Paid</div>
                <div className="font-semibold text-maroon-900">RM {Number(devotee.membershipPrice || 0).toFixed(2)}</div>
                <div className="text-ink-500">Paid Via</div>
                <div className="font-medium">{devotee.membershipPaidVia || '—'}</div>
                <div className="text-ink-500">Valid From</div>
                <div className="font-medium">{fmtDate(devotee.membershipStartDate)}</div>
                <div className="text-ink-500">Valid Until</div>
                <div className="font-medium">{fmtDate(devotee.membershipEndDate)}</div>
              </div>
            </div>
          )}

          {/* Committee info — only for committee members */}
          {devotee.memberType === 'COMMITTEE' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-maroon-900">Committee Details</h2>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="text-ink-500">Role / Term</div>
                <div className="font-medium">{devotee.membershipTypeLabel || '—'}</div>
                <div className="text-ink-500">Amount Paid</div>
                <div className="font-semibold text-maroon-900">
                  {devotee.membershipPrice != null ? `RM ${Number(devotee.membershipPrice).toFixed(2)}` : '—'}
                </div>
                <div className="text-ink-500">Paid Via</div>
                <div className="font-medium">{devotee.membershipPaidVia || '—'}</div>
                <div className="text-ink-500">Term Start</div>
                <div className="font-medium">{fmtDate(devotee.membershipStartDate)}</div>
                <div className="text-ink-500">Term End</div>
                <div className="font-medium">{fmtDate(devotee.membershipEndDate)}</div>
              </div>
            </div>
          )}

          {/* Notes section */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-maroon-900 flex items-center gap-2">
                <StickyNote size={15} /> Notes
              </h2>
              {can('devotees', 'edit') && (
                <button className="btn-outline !py-1 !px-2 text-xs flex items-center gap-1"
                  onClick={() => setNoteModal({ mode: 'add', noteId: null, text: '' })}>
                  <Plus size={12} /> Add note
                </button>
              )}
            </div>

            {allNotes.length === 0 ? (
              <p className="text-sm text-ink-500">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {allNotes.map((n, i) => (
                  <div key={i} className="bg-cream-50 border border-gold-300/40 rounded-lg p-3">
                    {n.type === 'booking' && (
                      <span className="chip bg-gold-300/30 text-maroon-800 mb-2 inline-block text-xs">Booking — {n.tag}</span>
                    )}
                    <p className="text-sm whitespace-pre-wrap text-ink-900">{n.body}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-ink-500">
                        {n.type === 'staff' && n.createdBy?.name ? `${n.createdBy.name} · ` : ''}
                        {fmtDT(n.createdAt)}
                      </span>
                      {n.type === 'staff' && can('devotees', 'edit') && (
                        <div className="flex gap-1">
                          <button className="btn-ghost !p-1"
                            onClick={() => setNoteModal({ mode: 'edit', noteId: n.id, text: n.body })}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn-ghost !p-1 text-kumkum-600" onClick={() => deleteNote(n.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Note modal */}
      <Modal
        title={noteModal?.mode === 'add' ? 'Add note' : 'Edit note'}
        open={!!noteModal}
        onClose={() => !notesBusy && setNoteModal(null)}
      >
        {noteModal && (
          <div className="space-y-3">
            <textarea
              className="input resize-none w-full"
              rows={4}
              placeholder="Write your note here…"
              value={noteModal.text}
              autoFocus
              onChange={(e) => setNoteModal({ ...noteModal, text: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) saveNote(); }}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setNoteModal(null)} disabled={notesBusy}>Cancel</button>
              <button className="btn-primary" disabled={notesBusy || !noteModal.text.trim()} onClick={saveNote}>
                {notesBusy ? 'Saving…' : noteModal.mode === 'add' ? 'Add note' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {tab === 'bookings' && (
        <div className="card overflow-x-auto">
          {bookings.length === 0 ? (
            <p className="text-ink-600 text-sm p-6 text-center">No hall bookings found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Booking No</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const paid = b.transactions.filter((t) => t.status !== 'CANCELLED').reduce((s, t) => s + Number(t.total), 0);
                  const balance = Number(b.hallRate) - paid;
                  return (
                    <tr key={b.id}>
                      <td className="font-mono text-xs">{b.bookingNo}</td>
                      <td>{eventName(b.eventTypeId)}</td>
                      <td>{new Date(b.eventDate).toLocaleDateString('en-MY')}</td>
                      <td><span className={STATUS_CLASS[b.status] || 'chip'}>{b.status.replace(/_/g, ' ')}</span></td>
                      <td className="text-right tabular-nums">{RM(b.hallRate)}</td>
                      <td className="text-right tabular-nums text-leaf-700">{RM(paid)}</td>
                      <td className="text-right tabular-nums text-kumkum-600">{balance > 0 ? RM(balance) : '—'}</td>
                      <td>
                        <button
                          className="btn-ghost !p-1 text-ink-500 hover:text-maroon-900"
                          title="Download Invoice PDF"
                          disabled={invoiceBusy}
                          onClick={() => handlePrintInvoice(b)}
                        >
                          <Download size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'payments' && (() => {
        const allPayments = [
          ...payments.map((t) => ({
            _key: `tx-${t.id}`,
            _type: 'Hall Booking',
            _date: t.txDate,
            ref: t.receiptNo,
            desc: t.bookingId ? `Booking #${t.bookingId}` : '—',
            mode: (t.paymentMode || '').replace(/_/g, ' '),
            amount: t.total,
            statusEl: <span className={t.status === 'PAID' ? 'chip chip-paid' : 'chip chip-cancelled'}>{t.status}</span>,
            actionEl: null,
          })),
          ...memberships.map((m) => {
            const isExpired = m.membershipEndDate && new Date(m.membershipEndDate) < new Date();
            const isCommittee = devotee.memberType === 'COMMITTEE';
            return {
              _key: `mem-${m.id}`,
              _type: isCommittee ? 'Committee' : 'Membership',
              _date: m.membershipStartDate,
              ref: m.membershipTypeLabel || '—',
              desc: `${fmtDate(m.membershipStartDate)} – ${fmtDate(m.membershipEndDate)}`,
              mode: m.membershipPaidVia || '—',
              amount: m.membershipPrice,
              statusEl: <span className={isExpired ? 'chip chip-cancelled' : 'chip chip-paid'}>{isExpired ? 'Expired' : 'Active'}</span>,
              actionEl: <button className="btn-ghost !p-1.5" title="Print Receipt" onClick={() => printMembership(m)}><Printer size={14} /></button>,
            };
          }),
        ].sort((a, b) => new Date(b._date) - new Date(a._date));

        const typeChip = (type) => {
          if (type === 'Membership') return <span className="chip bg-maroon-100 text-maroon-800 border-maroon-200">Membership</span>;
          if (type === 'Committee') return <span className="chip bg-gold-100 text-gold-800 border-gold-200">Committee</span>;
          return <span className="chip bg-blue-100 text-blue-800 border-blue-200">Hall Booking</span>;
        };

        return (
          <div className="card overflow-x-auto">
            {allPayments.length === 0 ? (
              <p className="text-ink-600 text-sm p-6 text-center">No payment records found.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th><th>Date</th><th>Reference</th><th>Description</th>
                    <th>Mode</th><th className="text-right">Amount</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((row) => (
                    <tr key={row._key}>
                      <td>{typeChip(row._type)}</td>
                      <td className="text-sm text-ink-600 whitespace-nowrap">{fmtDate(row._date)}</td>
                      <td className="font-mono text-xs">{row.ref}</td>
                      <td className="text-sm">{row.desc}</td>
                      <td>{row.mode}</td>
                      <td className="text-right tabular-nums font-semibold text-maroon-900">
                        {row.amount != null ? RM(row.amount) : '—'}
                      </td>
                      <td>{row.statusEl}</td>
                      <td>{row.actionEl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {tab === 'membership' && (
        <div className="card overflow-x-auto">
          {memberships.length === 0 ? (
            <p className="text-ink-600 text-sm p-6 text-center">No membership records yet. Click <strong>Add Membership</strong> to get started.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Paid Via</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => {
                  const isExpired = m.membershipEndDate && new Date(m.membershipEndDate) < new Date();
                  return (
                    <tr key={m.id}>
                      <td className="font-medium">{m.membershipTypeLabel || '—'}</td>
                      <td>{m.membershipPaidVia || '—'}</td>
                      <td>{fmtDate(m.membershipStartDate)}</td>
                      <td>{fmtDate(m.membershipEndDate)}</td>
                      <td className="text-right tabular-nums font-semibold text-maroon-900">
                        {m.membershipPrice != null ? `RM ${Number(m.membershipPrice).toFixed(2)}` : '—'}
                      </td>
                      <td>
                        <span className={isExpired ? 'chip chip-cancelled' : 'chip chip-paid'}>
                          {isExpired ? 'Expired' : 'Active'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <button className="btn-ghost !p-1.5" title="Print Receipt" onClick={() => printMembership(m)}><Printer size={15} /></button>
                        {can('devotees', 'edit') && (
                          <button className="btn-ghost !p-1.5" title="Edit" onClick={() => openMembershipEdit(m, m.id)}><Pencil size={15} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <MembershipModal
        devoteeId={id}
        membershipId={memEdit?.membershipId}
        initialData={memEdit?.data}
        open={!!memEdit}
        onClose={() => setMemEdit(null)}
        onSaved={() => { setMemEdit(null); load(); }}
      />

      {tab === 'orders' && (
        <div className="card overflow-x-auto">
          {orders.length === 0 ? (
            <p className="text-ink-600 text-sm p-6 text-center">No POS orders found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt No</th><th>Date &amp; Time</th><th>Items</th><th>Mode</th>
                  <th className="text-right">Total</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs">{t.receiptNo}</td>
                    <td>{fmtDT(t.txDate)}</td>
                    <td className="text-sm text-ink-600 max-w-xs truncate">
                      {t.items.map((i) => `${i.nameSnapshot}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}
                    </td>
                    <td>{(t.paymentMode || '').replace(/_/g, ' ')}</td>
                    <td className="text-right tabular-nums">{RM(t.total)}</td>
                    <td><span className={t.status === 'PAID' ? 'chip chip-paid' : 'chip chip-cancelled'}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
