import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Modal({ title, open, onClose, children, wide, xl }) {
  if (!open) return null;
  const widthCls = xl ? 'max-w-5xl' : wide ? 'max-w-3xl' : 'max-w-lg';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-maroon-950/40 backdrop-blur-sm" onClick={onClose}>
      <div className={`card w-full ${widthCls} max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-cream-200">
          <h3 className="text-lg text-maroon-900">{title}</h3>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
