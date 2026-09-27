import { useState, useEffect, useCallback } from 'react';
import { WifiOff } from 'lucide-react';

export function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm pointer-events-none">
      <WifiOff size={15} className="text-amber-400 shrink-0" />
      {message}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState('');
  const show = useCallback((m) => setMsg(m), []);
  const clear = useCallback(() => setMsg(''), []);
  return { msg, show, clear };
}
