import { useEffect, useRef, useState } from 'react';
import { Search, X, UserCheck, ChevronDown, WifiOff } from 'lucide-react';
import { api } from '../api/client.js';
import { readDevotees } from '../db/dexie.js';
import { useApp } from '../auth/AppContext.jsx';

function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function DevoteeSearch({ value = {}, onChange, compact = false, receipt = false }) {
  const { online } = useApp();
  const [query, setQuery] = useState(value.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const ref = useRef(null);
  const debouncedQuery = useDebounce(query);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (debouncedQuery === selected?.name) return;
    setLoading(true);
    const param = debouncedQuery.trim() ? `search=${encodeURIComponent(debouncedQuery)}&` : '';

    if (!online) {
      readDevotees(debouncedQuery, 10)
        .then((rows) => { setResults(rows); setFromCache(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
      return;
    }

    setFromCache(false);
    api(`/devotees?${param}pageSize=8`)
      .then((d) => { setResults(d.rows || []); setFromCache(false); })
      .catch(() => readDevotees(debouncedQuery, 10).then((rows) => { setResults(rows); setFromCache(true); }))
      .finally(() => setLoading(false));
  }, [debouncedQuery, selected, online]);

  const pick = (d) => {
    setSelected(d);
    setQuery(d.name);
    setOpen(false);
    onChange({ id: d.id, name: d.name, phone: d.phone || '', altPhone: d.altPhone || '', icNumber: d.icNumber || '', address: d.address || '', addressTa: d.addressTa || '' });
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    onChange({ name: '', phone: '', altPhone: '', icNumber: '', address: '', addressTa: '' });
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setSelected(null);
    setOpen(true);
    onChange({ ...value, name: v });
  };

  const handleFocus = () => setOpen(true);

  const CacheNote = () => fromCache ? (
    <span className="flex items-center gap-0.5 text-amber-600" title="Showing cached results — offline">
      <WifiOff size={9} /> <span style={{ fontSize: '8px' }}>cached</span>
    </span>
  ) : null;

  /* Receipt style */
  if (receipt) {
    return (
      <div ref={ref} className="relative mb-1">
        <div className="flex items-center gap-1 text-[12px]">
          <span className="shrink-0">Name / Phone :</span>
          <input
            className="flex-1 min-w-0 bg-transparent border-0 border-b border-dotted border-gray-400 outline-none text-[12px] font-mono px-0.5 placeholder-gray-400"
            placeholder="tap to search…"
            value={query}
            onChange={handleChange}
            onFocus={handleFocus}
            autoComplete="off"
          />
          {selected && (
            <button className="shrink-0 text-gray-400 hover:text-gray-700" onMouseDown={(e) => { e.preventDefault(); clear(); }} tabIndex={-1}>
              <X size={10} />
            </button>
          )}
          {selected && <UserCheck size={10} className="shrink-0 text-leaf-600" />}
        </div>
        {open && (
          <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gold-300/60 rounded-lg shadow-lg max-h-48 overflow-y-auto font-sans">
            {fromCache && (
              <li className="px-3 py-1 text-[9px] text-amber-600 flex items-center gap-1 bg-amber-50">
                <WifiOff size={9} /> Offline — showing cached results
              </li>
            )}
            {loading && <li className="px-3 py-2 text-xs text-ink-600/60 text-center">Searching…</li>}
            {!loading && results.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-600/60 text-center">
                {query.trim() ? 'No devotees found' : 'No devotees yet'}
              </li>
            )}
            {!loading && results.map((d) => (
              <li key={d.id}>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-cream-100 flex items-start gap-2"
                  onMouseDown={(e) => { e.preventDefault(); pick(d); }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-maroon-900 truncate">{d.name}</p>
                    <p className="text-xs text-ink-600 truncate">
                      {[d.phone, d.icNumber].filter(Boolean).join(' · ') || 'No contact on record'}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-600/50 pointer-events-none" />
          <input
            className={`input !pl-8 !pr-14 ${selected ? 'border-leaf-600/60 bg-leaf-600/5' : ''}`}
            placeholder="Search by name, phone or IC…"
            value={query}
            onChange={handleChange}
            onFocus={handleFocus}
            autoComplete="off"
          />
          <span className="absolute right-2 top-1.5 flex items-center gap-0.5">
            {fromCache && <CacheNote />}
            {selected
              ? <UserCheck size={14} className="text-leaf-600" />
              : query
                ? <button className="p-1 text-ink-600/50 hover:text-ink-900" onClick={clear} tabIndex={-1}><X size={13} /></button>
                : null}
            <button className="p-1 text-ink-600/50 hover:text-ink-900" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}>
              <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </span>
        </div>

        {open && (
          <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gold-300/60 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {fromCache && (
              <li className="px-3 py-1 text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50">
                <WifiOff size={10} /> Offline — showing cached results
              </li>
            )}
            {loading && <li className="px-3 py-2 text-xs text-ink-600/60 text-center">Searching…</li>}
            {!loading && results.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-600/60 text-center">
                {query.trim() ? 'No devotees found' : 'No devotees yet'}
              </li>
            )}
            {!loading && results.map((d) => (
              <li key={d.id}>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-cream-100 flex items-start gap-2"
                  onMouseDown={(e) => { e.preventDefault(); pick(d); }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-maroon-900 truncate">{d.name}</p>
                    <p className="text-xs text-ink-600 truncate">
                      {[d.phone, d.icNumber].filter(Boolean).join(' · ') || 'No contact on record'}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!compact && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="label">Contact</label>
            <input className="input" placeholder="Phone" value={value.phone || ''} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Secondary contact</label>
            <input className="input" placeholder="Alt phone" value={value.altPhone || ''} onChange={(e) => onChange({ ...value, altPhone: e.target.value })} />
          </div>
          <div>
            <label className="label">IC / Passport</label>
            <input className="input" placeholder="XXXXXX-XX-XXXX or Passport No" value={value.icNumber || ''} onChange={(e) => onChange({ ...value, icNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" placeholder="Address" value={value.address || ''} onChange={(e) => onChange({ ...value, address: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
