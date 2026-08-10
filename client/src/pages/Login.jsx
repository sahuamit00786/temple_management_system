import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';

export default function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await login(email, password); nav('/'); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-maroon-900" style={{ backgroundImage: 'var(--kolam)' }}>
      <div className="card w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <img src="/icons/diya.svg" alt="" className="w-16 h-16 mx-auto mb-3" />
          <h1 className="text-2xl text-maroon-900">TMADJ Temple</h1>
          <p className="text-sm text-ink-600 mt-1">Sign in to the counter</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Email or Name</label>
            <input className="input" placeholder="Email or your name" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input className="input !pr-10" type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
              <button type="button" tabIndex={-1} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-800" onClick={() => setShowPw((v) => !v)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {err && <p className="text-sm text-kumkum-600">{err}</p>}
          <button className="btn-primary w-full justify-center" disabled={busy || !email || !password} onClick={submit}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="text-center">
            <Link to="/forgot-password" className="text-sm text-maroon-700 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
