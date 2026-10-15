import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ className = 'input', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} className={`${className} !pr-10`} type={show ? 'text' : 'password'} />
      <button
        type="button"
        tabIndex={-1}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-800"
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
