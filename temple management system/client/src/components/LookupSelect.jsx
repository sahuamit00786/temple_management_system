import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';
import SearchableSelect from './SearchableSelect.jsx';

export default function LookupSelect({ typeCode, value, onChange, parentId, topLevelOnly, allowAdd = true, placeholder = 'Select...', showPrice }) {
  const { lookups, can, refreshMasterData } = useApp();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  let values = lookups[typeCode]?.values?.filter((v) => v.isActive) || [];
  if (parentId != null) values = values.filter((v) => v.parentId === Number(parentId));
  else if (topLevelOnly) values = values.filter((v) => !v.parentId);

  const options = values.map((v) => ({
    value: String(v.id),
    label: v.nameEn + (showPrice && v.price != null ? ` — RM ${Number(v.price).toFixed(2)}` : ''),
  }));

  const quickAdd = async () => {
    setBusy(true); setErr('');
    try {
      const created = await api(`/lookups/${typeCode}/values`, {
        method: 'POST',
        body: { nameEn: name, price: price || null, parentId: parentId || null },
      });
      await refreshMasterData();
      onChange?.(String(created.id));
      setAdding(false); setName(''); setPrice('');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex gap-1.5">
      <SearchableSelect
        className="flex-1"
        options={options}
        value={value}
        onChange={(v) => onChange?.(v)}
        placeholder={placeholder}
      />
      {allowAdd && can('lookups', 'create') && (
        <button type="button" className="btn-outline !px-2.5" title={`Add new ${lookups[typeCode]?.name || 'value'}`} onClick={() => setAdding(true)}>
          <Plus size={16} />
        </button>
      )}
      <Modal title={`Add to ${lookups[typeCode]?.name || typeCode}`} open={adding} onClose={() => setAdding(false)}>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Ganesh Archanai" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {typeCode !== 'PAYMENT_MODE' && typeCode !== 'BOOKING_PAYMENT_MODE' && typeCode !== 'NATCHATHIRAM' && (
            <div>
              <label className="label">Price (RM) — optional</label>
              <input className="input" type="number" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          )}
          {err && <p className="text-sm text-kumkum-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary" disabled={!name.trim() || busy} onClick={quickAdd}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
