import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';

export function DownloadMenu({ options, size = 'sm', disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={size === 'xs' ? 'btn-ghost !p-1.5 text-maroon-700 flex items-center gap-0.5' : 'btn-ghost !px-2 !py-1.5 flex items-center gap-1 text-maroon-700'}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title="Download"
      >
        <Download size={size === 'xs' ? 14 : 15} />
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gold-300/60 rounded-lg shadow-lg py-1 min-w-[100px]">
          {options.map(({ label, onClick, disabled: optDisabled }) => (
            <button
              key={label}
              className="w-full text-left px-3 py-1.5 text-sm text-ink-800 hover:bg-cream-100 disabled:opacity-40"
              disabled={optDisabled}
              onClick={() => { setOpen(false); onClick(); }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
