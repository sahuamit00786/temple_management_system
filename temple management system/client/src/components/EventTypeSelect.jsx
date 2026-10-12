import { useApp } from '../auth/AppContext.jsx';
import SearchableSelect from './SearchableSelect.jsx';

// Hall/event type dropdown. Types are managed in Temple Config (own table, not a lookup).
export default function EventTypeSelect({ value, onChange, placeholder = 'Select...', showPrice }) {
  const { eventTypes } = useApp();
  const options = eventTypes
    .filter((t) => t.isActive)
    .map((t) => ({
      value: String(t.id),
      label: t.nameEn + (showPrice && t.price != null ? ` — RM ${Number(t.price).toFixed(2)}` : ''),
    }));
  return <SearchableSelect className="flex-1" options={options} value={value} onChange={(v) => onChange?.(v)} placeholder={placeholder} />;
}
