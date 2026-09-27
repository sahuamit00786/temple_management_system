import { useState, useEffect } from 'react';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';
import LookupSelect from './LookupSelect.jsx';

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDuration = (dateStr, unit, qty) => {
  const [y, mo, dy] = dateStr.split('-').map(Number);
  const d = new Date(y, mo - 1, dy); // local time — no UTC shift
  const n = Number(qty);
  if (unit === 'day') d.setDate(d.getDate() + n);
  else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// devoteeId    — which devotee
// membershipId — if set, editing that specific record (PUT); if null, adding new (POST)
// initialData  — pre-populate form (devotee or membership record)
export default function MembershipModal({ devoteeId, membershipId, initialData, open, onClose, onSaved }) {
  const { lookups } = useApp();
  const allPayModes = [
    ...(lookups['PAYMENT_MODE']?.values || []),
    ...(lookups['BOOKING_PAYMENT_MODE']?.values || []),
  ];

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    if (membershipId && initialData) {
      // editing existing record — pre-fill with that record's data
      const rec = initialData;
      const memType = lookups['MEMBERSHIP_TYPE']?.values?.find((v) => v.id === rec.membershipTypeId);
      const unit = rec.membershipUnit || memType?.meta?.unit || 'month';
      const qty = rec.membershipMonths || memType?.meta?.quantity || memType?.meta?.months || '';
      const payViaId = allPayModes.find((v) => v.nameEn === rec.membershipPaidVia)?.id;
      setForm({
        membershipTypeId: rec.membershipTypeId || null,
        membershipTypeLabel: rec.membershipTypeLabel || '',
        membershipPrice: rec.membershipPrice != null ? Number(rec.membershipPrice) : null,
        membershipMonths: rec.membershipMonths || null,
        membershipUnit: unit,
        membershipQty: qty,
        membershipStartDate: rec.membershipStartDate ? rec.membershipStartDate.slice(0, 10) : todayIso(),
        membershipEndDate: rec.membershipEndDate ? rec.membershipEndDate.slice(0, 10) : '',
        membershipPaidVia: rec.membershipPaidVia || '',
        membershipPaidViaId: payViaId ? String(payViaId) : '',
      });
    } else {
      // new membership — start fresh with today's date
      setForm({
        membershipTypeId: null,
        membershipTypeLabel: '',
        membershipPrice: null,
        membershipMonths: null,
        membershipUnit: 'month',
        membershipQty: '',
        membershipStartDate: todayIso(),
        membershipEndDate: '',
        membershipPaidVia: '',
        membershipPaidViaId: '',
      });
    }
  }, [open, membershipId, initialData]);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (membershipId) {
        await api(`/devotees/${devoteeId}/memberships/${membershipId}`, { method: 'PUT', body: form });
      } else {
        await api(`/devotees/${devoteeId}/memberships`, { method: 'POST', body: form });
      }
      onSaved?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={membershipId ? 'Edit Membership' : 'Add Membership'}
      open={open}
      onClose={onClose}
    >
      {form && (
        <div className="space-y-3">
          <div>
            <label className="label">Membership Type</label>
            <LookupSelect
              typeCode="MEMBERSHIP_TYPE"
              value={form.membershipTypeId ? String(form.membershipTypeId) : ''}
              showPrice
              onChange={(id) => {
                const lv = lookups['MEMBERSHIP_TYPE']?.values?.find((v) => String(v.id) === id);
                const unit = lv?.meta?.unit || 'month';
                const qty = lv?.meta?.quantity || lv?.meta?.months || null;
                setForm((prev) => ({
                  ...prev,
                  membershipTypeId: id ? Number(id) : null,
                  membershipTypeLabel: lv?.nameEn || '',
                  membershipPrice: lv?.price != null ? Number(lv.price) : null,
                  membershipMonths: qty || null,
                  membershipUnit: unit,
                  membershipQty: qty,
                  membershipEndDate: qty ? addDuration(prev.membershipStartDate || todayIso(), unit, qty) : '',
                }));
              }}
              allowAdd={false}
            />
          </div>

          {form.membershipPrice != null && (
            <p className="text-sm text-ink-700">Fee: <span className="font-semibold">RM {Number(form.membershipPrice).toFixed(2)}</span></p>
          )}

          <div>
            <label className="label">Paid Via</label>
            <LookupSelect
              typeCode="PAYMENT_MODE"
              value={form.membershipPaidViaId || ''}
              onChange={(id) => {
                const lv = allPayModes.find((v) => String(v.id) === id);
                setForm((prev) => ({ ...prev, membershipPaidViaId: id || '', membershipPaidVia: lv?.nameEn || '' }));
              }}
              allowAdd={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input"
                value={form.membershipStartDate || todayIso()}
                onChange={(e) => {
                  const start = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    membershipStartDate: start,
                    membershipEndDate: (prev.membershipQty || prev.membershipMonths)
                      ? addDuration(start, prev.membershipUnit || 'month', prev.membershipQty || prev.membershipMonths)
                      : prev.membershipEndDate,
                  }));
                }}
              />
            </div>
            <div>
              <label className="label">End Date <span className="text-xs text-ink-400 font-normal">(auto)</span></label>
              <input type="date" className="input !bg-cream-100 cursor-not-allowed" readOnly value={form.membershipEndDate || ''} />
            </div>
          </div>

          {err && <p className="text-sm text-kumkum-600">{err}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={busy || !form.membershipTypeId} onClick={save}>
              {busy ? 'Saving…' : membershipId ? 'Save Changes' : 'Add Membership'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
