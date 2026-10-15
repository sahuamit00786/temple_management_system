import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import PasswordInput from '../components/PasswordInput.jsx';

async function post(path, body) {
  return api(`/auth${path}`, { method: 'POST', body });
}

// ── Step 1: Email input ──
function StepEmail({ onNext }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email) return;
    setBusy(true); setErr('');
    try {
      await post('/forgot-password', { email: email.toLowerCase().trim() });
      onNext(email.toLowerCase().trim());
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🔑</div>
        <h2 className="text-xl font-semibold text-maroon-900">Forgot Password?</h2>
        <p className="text-sm text-ink-600 mt-1">Enter your email and we'll send a 6-digit OTP</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input
            className="input" type="email" placeholder="you@example.com" autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        {err && <p className="text-sm text-kumkum-600">{err}</p>}
        <button className="btn-primary w-full justify-center" disabled={busy || !email} onClick={submit}>
          {busy ? 'Sending OTP…' : 'Send OTP'}
        </button>
        <div className="text-center">
          <Link to="/login" className="text-sm text-maroon-700 hover:underline">Back to Sign in</Link>
        </div>
      </div>
    </>
  );
}

// ── Step 2: OTP verification ──
function StepOtp({ email, onNext, onBack }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const otp = digits.join('');

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs[i + 1].current?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus();
    if (e.key === 'Enter' && otp.length === 6) verify();
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      refs[5].current?.focus();
    }
    e.preventDefault();
  };

  const verify = async () => {
    if (otp.length < 6) return;
    setBusy(true); setErr('');
    try {
      const { resetToken } = await post('/verify-otp', { email, otp });
      onNext(resetToken);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setResendBusy(true); setErr(''); setResent(false);
    try {
      await post('/forgot-password', { email });
      setResent(true);
      setDigits(['', '', '', '', '', '']);
      refs[0].current?.focus();
    } catch (e) { setErr(e.message); }
    finally { setResendBusy(false); }
  };

  return (
    <>
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">📨</div>
        <h2 className="text-xl font-semibold text-maroon-900">Check your email</h2>
        <p className="text-sm text-ink-600 mt-1">
          OTP sent to <strong>{email}</strong><br />
          Valid for 10 minutes
        </p>
      </div>
      <div className="space-y-5">
        <div>
          <label className="label text-center block mb-3">Enter 6-digit OTP</label>
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i} ref={refs[i]} maxLength={1}
                className="w-11 h-12 text-center text-xl font-bold border-2 border-cream-300 rounded-lg focus:border-maroon-600 focus:outline-none bg-cream-50 text-maroon-900"
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKey(i, e)}
              />
            ))}
          </div>
        </div>
        {err && <p className="text-sm text-kumkum-600 text-center">{err}</p>}
        {resent && <p className="text-sm text-leaf-700 text-center">New OTP sent!</p>}
        <button className="btn-primary w-full justify-center" disabled={busy || otp.length < 6} onClick={verify}>
          {busy ? 'Verifying…' : 'Verify OTP'}
        </button>
        <div className="flex justify-between text-sm">
          <button className="text-ink-600 hover:underline" onClick={onBack}>← Change email</button>
          <button className="text-maroon-700 hover:underline" disabled={resendBusy} onClick={resend}>
            {resendBusy ? 'Sending…' : 'Resend OTP'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Step 3: New password ──
function StepNewPassword({ resetToken, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const mismatch = confirm && password !== confirm;
  const weak = password && password.length < 8;

  const submit = async () => {
    if (password !== confirm || password.length < 8) return;
    setBusy(true); setErr('');
    try {
      await post('/reset-password', { resetToken, password });
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-xl font-semibold text-maroon-900">Set new password</h2>
        <p className="text-sm text-ink-600 mt-1">Choose a strong password (min. 8 characters)</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">New password</label>
          <PasswordInput
            placeholder="Min. 8 characters" autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {weak && <p className="text-xs text-kumkum-600 mt-1">At least 8 characters required</p>}
        </div>
        <div>
          <label className="label">Confirm password</label>
          <PasswordInput
            placeholder="Re-enter password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {mismatch && <p className="text-xs text-kumkum-600 mt-1">Passwords do not match</p>}
        </div>
        {err && <p className="text-sm text-kumkum-600">{err}</p>}
        <button
          className="btn-primary w-full justify-center"
          disabled={busy || !password || !confirm || mismatch || weak}
          onClick={submit}
        >
          {busy ? 'Saving…' : 'Reset password'}
        </button>
      </div>
    </>
  );
}

// ── Step 4: Success ──
function StepSuccess() {
  const nav = useNavigate();
  return (
    <div className="text-center space-y-4">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-semibold text-maroon-900">Password reset!</h2>
      <p className="text-sm text-ink-600">Your password has been updated. Sign in with your new password.</p>
      <button className="btn-primary w-full justify-center" onClick={() => nav('/login')}>
        Go to Sign in
      </button>
    </div>
  );
}

// ── Main component ──
export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-maroon-900" style={{ backgroundImage: 'var(--kolam)' }}>
      <div className="card w-full max-w-sm p-8">
        {/* Progress dots */}
        {step < 4 && (
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-2 rounded-full transition-all ${n === step ? 'w-6 bg-maroon-700' : n < step ? 'w-2 bg-maroon-400' : 'w-2 bg-cream-300'}`} />
            ))}
          </div>
        )}

        {step === 1 && <StepEmail onNext={(e) => { setEmail(e); setStep(2); }} />}
        {step === 2 && <StepOtp email={email} onNext={(t) => { setResetToken(t); setStep(3); }} onBack={() => setStep(1)} />}
        {step === 3 && <StepNewPassword resetToken={resetToken} onDone={() => setStep(4)} />}
        {step === 4 && <StepSuccess />}
      </div>
    </div>
  );
}
