import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, AlertTriangle, MessageSquare, ChevronDown } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api, qs } from '../api/client.js';

export const PLACEHOLDERS = [
  { key: '{{name}}',              label: 'Devotee Name' },
  { key: '{{phone}}',             label: 'Phone' },
  { key: '{{altPhone}}',          label: 'Alt Phone' },
  { key: '{{icNumber}}',          label: 'IC / Passport' },
  { key: '{{email}}',             label: 'Email' },
  { key: '{{address}}',           label: 'Address' },
  { key: '{{bookingNo}}',         label: 'Booking No' },
  { key: '{{eventDate}}',         label: 'Event Date' },
  { key: '{{eventType}}',         label: 'Event Type' },
  { key: '{{hallRate}}',          label: 'Hall Rate' },
  { key: '{{outstanding}}',       label: 'Outstanding' },
  { key: '{{balanceDueAt}}',      label: 'Balance Due Date' },
  { key: '{{membershipPlan}}',    label: 'Membership Plan',       memberOnly: true },
  { key: '{{membershipFee}}',     label: 'Membership Fee',        memberOnly: true },
  { key: '{{membershipStart}}',   label: 'Membership Start Date', memberOnly: true },
  { key: '{{membershipEnd}}',     label: 'Membership End Date',   memberOnly: true },
  { key: '{{membershipPaidVia}}', label: 'Paid Via (Membership)', memberOnly: true },
];

const BOOKING_PLACEHOLDERS = ['{{bookingNo}}', '{{eventDate}}', '{{eventType}}', '{{hallRate}}', '{{outstanding}}', '{{balanceDueAt}}'];
const MEMBERSHIP_PLACEHOLDER_KEYS = PLACEHOLDERS.filter((p) => p.memberOnly).map((p) => p.key);

function tplUsesBookingFields(body) {
  return !!body && BOOKING_PLACEHOLDERS.some((p) => body.includes(p));
}

function tplUsesMembershipFields(body) {
  return !!body && MEMBERSHIP_PLACEHOLDER_KEYS.some((p) => body.includes(p));
}

function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('60')) return digits;
  if (digits.startsWith('0')) return '60' + digits.slice(1);
  return '60' + digits;
}

export function buildCtx(devotee, booking, eventTypeName) {
  const totalPaid = (booking?.transactions || []).reduce((s, t) => s + Number(t.total), 0);
  const outstanding = booking ? Math.max(0, Number(booking.hallRate || 0) - totalPaid) : null;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  return {
    '{{name}}':              devotee?.name || '',
    '{{phone}}':             devotee?.phone || '',
    '{{altPhone}}':          devotee?.altPhone || '',
    '{{icNumber}}':          devotee?.icNumber || '',
    '{{email}}':             devotee?.email || '',
    '{{address}}':           devotee?.address || '',
    '{{bookingNo}}':         booking?.bookingNo || '',
    '{{eventDate}}':         fmtDate(booking?.eventDate),
    '{{eventType}}':         eventTypeName || '',
    '{{hallRate}}':          booking?.hallRate != null ? `RM ${Number(booking.hallRate).toFixed(2)}` : '',
    '{{outstanding}}':       outstanding != null ? `RM ${outstanding.toFixed(2)}` : '',
    '{{balanceDueAt}}':      fmtDate(booking?.balanceDueAt),
    '{{membershipPlan}}':    devotee?.membershipTypeLabel || '',
    '{{membershipFee}}':     devotee?.membershipPrice != null ? `RM ${Number(devotee.membershipPrice).toFixed(2)}` : '',
    '{{membershipStart}}':   fmtDate(devotee?.membershipStartDate),
    '{{membershipEnd}}':     fmtDate(devotee?.membershipEndDate),
    '{{membershipPaidVia}}': devotee?.membershipPaidVia || '',
  };
}

export function fillTemplate(body, ctx) {
  return (body || '').replace(/\{\{[^}]+\}\}/g, (m) => (ctx[m] !== undefined ? ctx[m] : m));
}

function getMissing(body, ctx) {
  const all = [...(body || '').matchAll(/(\{\{[^}]+\}\})/g)].map((m) => m[1]);
  return [...new Set(all)].filter((p) => !ctx[p]);
}

export default function SendMessageModal({ open, onClose, devotee, booking, eventTypeName }) {
  const { settings, lookups } = useApp();
  const templates = Array.isArray(settings['message.templates']) ? settings['message.templates'] : [];

  const [tplId, setTplId] = useState('');
  const [devoteeBookings, setDevoteeBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedBookingFull, setSelectedBookingFull] = useState(null);

  const eventTypes = lookups.HALL_EVENT?.values || [];
  const getEventTypeName = (id) => eventTypes.find((t) => t.id === id)?.nameEn || '';

  // Load devotee bookings if no booking provided
  useEffect(() => {
    if (!open || booking || !devotee?.id) { setDevoteeBookings([]); setSelectedBookingId(''); setSelectedBookingFull(null); return; }
    api(`/bookings${qs({ devoteeId: devotee.id, pageSize: 50, sortBy: 'eventDate', sortOrder: 'desc' })}`)
      .then((d) => setDevoteeBookings(d.rows || []))
      .catch(() => {});
  }, [open, devotee, booking]);

  // Load full booking when selected
  useEffect(() => {
    if (!selectedBookingId) { setSelectedBookingFull(null); return; }
    api(`/bookings/${selectedBookingId}`).then(setSelectedBookingFull).catch(() => {});
  }, [selectedBookingId]);

  // Reset on open
  useEffect(() => {
    if (open) { setTplId(templates[0]?.id || ''); setSelectedBookingId(''); setSelectedBookingFull(null); }
  }, [open]);

  // Clear booking selection when switching to a template that doesn't use booking fields
  useEffect(() => {
    const t = templates.find((x) => x.id === tplId);
    if (!tplUsesBookingFields(t?.body)) { setSelectedBookingId(''); setSelectedBookingFull(null); }
  }, [tplId]);

  if (!open) return null;

  const isMember = devotee?.memberType === 'MEMBER';
  const visibleTemplates = templates.filter((t) => !tplUsesMembershipFields(t.body) || isMember);

  const tpl = visibleTemplates.find((t) => t.id === tplId) || null;
  const usesBooking = tplUsesBookingFields(tpl?.body);

  const activeBooking = booking || selectedBookingFull || null;
  const activeEventTypeName = eventTypeName || (activeBooking ? getEventTypeName(activeBooking.eventTypeId) : '');
  const ctx = buildCtx(devotee, activeBooking, activeEventTypeName);

  const filledBody = tpl ? fillTemplate(tpl.body, ctx) : '';
  const missing = tpl ? getMissing(tpl.body, ctx) : [];
  const canSend = tpl && missing.length === 0 && !!normalizePhone(devotee?.phone);

  const send = () => {
    if (!canSend) return;
    const phone = normalizePhone(devotee.phone);
    window.location.href = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(filledBody)}`;
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gold-300/50">
          <MessageSquare size={18} className="text-maroon-700" />
          <h2 className="font-display text-maroon-900 text-base flex-1">Send WhatsApp Message</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Devotee info */}
          <div className="bg-cream-50 border border-gold-300/50 rounded-lg px-4 py-3 text-sm">
            <span className="font-semibold text-maroon-900">{devotee?.name || '—'}</span>
            <span className="text-ink-600 ml-2">{devotee?.phone || <span className="text-kumkum-600">No phone</span>}</span>
          </div>

          {/* Booking selector — only when template uses booking fields and no booking pre-provided */}
          {!booking && usesBooking && (
            <div>
              <label className="label">Booking (optional)</label>
              {devoteeBookings.length === 0 ? (
                <p className="text-xs text-ink-500">No bookings found for this devotee</p>
              ) : (
                <select
                  className="input"
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {devoteeBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bookingNo} · {new Date(b.eventDate).toLocaleDateString('en-MY')} · {b.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Membership context card — shown when template uses membership fields */}
          {isMember && tpl && tplUsesMembershipFields(tpl.body) && (
            <div className="bg-gold-50 border border-gold-300/60 rounded-lg px-4 py-3 text-sm">
              <p className="text-xs font-semibold text-maroon-900 uppercase tracking-wide mb-2">Membership Being Used</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-ink-500">Plan</span><span className="font-medium">{devotee.membershipTypeLabel || '—'}</span>
                <span className="text-ink-500">Fee</span><span className="font-medium">{devotee.membershipPrice != null ? `RM ${Number(devotee.membershipPrice).toFixed(2)}` : '—'}</span>
                <span className="text-ink-500">Paid Via</span><span className="font-medium">{devotee.membershipPaidVia || '—'}</span>
                <span className="text-ink-500">Valid Until</span><span className="font-medium">{devotee.membershipEndDate ? new Date(devotee.membershipEndDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
              </div>
            </div>
          )}

          {/* Template selector */}
          {templates.length === 0 ? (
            <div className="bg-saffron-50 border border-saffron-200 rounded-lg p-3 text-sm text-saffron-700">
              No message templates set up yet. Go to <b>Settings → Message Templates</b> to create one.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="label">Template</label>
              <select className="input" value={tplId} onChange={(e) => setTplId(e.target.value)}>
                <option value="">— Select a template —</option>
                {visibleTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {isMember && (
                <p className="text-xs text-ink-500">
                  Membership placeholders available: <span className="font-mono">{'{{membershipPlan}}'}</span>, <span className="font-mono">{'{{membershipFee}}'}</span>, <span className="font-mono">{'{{membershipStart}}'}</span>, <span className="font-mono">{'{{membershipEnd}}'}</span>, <span className="font-mono">{'{{membershipPaidVia}}'}</span>
                </p>
              )}
            </div>
          )}

          {/* Missing fields warning */}
          {tpl && missing.length > 0 && (
            <div className="flex gap-2 bg-kumkum-50 border border-kumkum-200 rounded-lg p-3">
              <AlertTriangle size={16} className="text-kumkum-600 shrink-0 mt-0.5" />
              <div className="text-sm text-kumkum-700">
                <p className="font-semibold mb-1">Cannot send — missing fields:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {missing.map((p) => {
                    const label = PLACEHOLDERS.find((x) => x.key === p)?.label || p;
                    return <li key={p}>{label} <span className="text-xs opacity-70">({p})</span></li>;
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* Preview */}
          {tpl && (
            <div>
              <label className="label">Preview</label>
              <div className="bg-leaf-50 border border-leaf-200 rounded-lg px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-ink-900" style={{ fontFamily: 'monospace', minHeight: 80 }}>
                {filledBody || <span className="text-ink-400 italic">Select a template above</span>}
              </div>
            </div>
          )}

          {!devotee?.phone && (
            <p className="text-xs text-kumkum-600 flex items-center gap-1.5"><AlertTriangle size={13} /> Devotee has no phone number — cannot send WhatsApp message.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gold-300/50">
          <button className="btn-outline" onClick={onClose}>Close</button>
          <button
            className="btn-primary flex items-center gap-2"
            disabled={!canSend}
            onClick={send}
          >
            <Send size={14} /> Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
