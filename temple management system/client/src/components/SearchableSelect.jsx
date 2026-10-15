import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

/**
 * Searchable drop-down — replaces every native <select> in the app.
 *
 * Props:
 *   options     : [{ value, label }]
 *   value       : string | number
 *   onChange    : (value) => void
 *   placeholder : string   (shown when nothing selected)
 *   clearable   : bool     (show × to clear selection)
 *   disabled    : bool
 *   className   : extra class on the trigger button
 */
export default function SearchableSelect({ options = [], value, onChange, placeholder = 'Select…', clearable = false, disabled = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value ?? ''));
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click / Escape
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc); };
  }, []);

  // Focus search on open
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 0); }, [open]);

  const pick = (o) => {
    onChange?.(o.value);
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange?.('');
    setQuery('');
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`input flex items-center justify-between gap-2 text-left cursor-pointer select-none
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-saffron-400'}
          ${open ? 'border-saffron-500 shadow-glow' : ''}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-ink-900' : 'text-ink-600/50'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-ink-600/60">
          {clearable && selected && (
            <X size={13} onClick={clear} className="hover:text-ink-900 cursor-pointer" />
          )}
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[9999] mt-1 left-0 min-w-[180px] bg-white border border-gold-300/60 rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-cream-200">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-2 text-ink-600/50 pointer-events-none" />
              <input
                ref={searchRef}
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-gold-300/50 rounded-md outline-none focus:border-saffron-400 bg-cream-50"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Options */}
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-600/60 text-center">No matches</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                    className={`w-full text-left px-3 py-2 text-sm transition
                      ${String(o.value) === String(value ?? '') ? 'bg-saffron-100 text-maroon-900 font-semibold' : 'hover:bg-cream-100 text-ink-900'}`}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
