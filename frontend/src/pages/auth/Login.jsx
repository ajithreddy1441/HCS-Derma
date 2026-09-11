import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const role = await login(username, password);
      navigate(role === 'telecaller' || role === 'accountant' || role === 'admin' ? '/' : '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/70">HCS DERMA</p>
          <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight">CRM for sales, payments and delivery.</h1>
        </div>
        <p className="max-w-sm text-sm text-slate-400">Lead → Customer → Order → Payment approval → Inventory → Shiprocket → Reorder. One connected system.</p>
      </div>
      <div className="flex items-center justify-center bg-[#f4f6fb] p-6">
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your employee username or email.</p>
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <label className="mt-6 block text-sm font-medium">Username / Email</label>
          <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-500" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="mt-4 block text-sm font-medium">Password</label>
          <input type="password" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-500" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="mt-6 w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? 'Signing in…' : 'Login'}
          </button>
          <p className="mt-4 text-xs text-slate-400">Demo: admin / Admin@123 · telecaller / Tele@123 · accountant / Acct@123</p>
        </form>
      </div>
    </div>
  );
}
