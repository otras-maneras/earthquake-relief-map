'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = '/admin';
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'No se pudo iniciar sesión.');
    }
  };

  return (
    <main className="min-h-[100dvh] bg-ap-bg font-sans flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-[360px] bg-ap-surface border border-ap-border rounded-agentos-lg shadow-agentos-md p-6">
        <h1 className="font-extrabold text-ap-primary font-outfit text-[18px]">Panel de carga</h1>
        <p className="text-[12px] text-ap-muted mb-5">Centros de Acopio · Ingreso</p>

        <label className="block mb-3">
          <span className="block text-[11px] font-bold text-ap-muted uppercase mb-1">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2.5 border border-ap-border rounded-lg text-[13px] bg-white text-ap-primary outline-none focus:border-ap-secondary" />
        </label>
        <label className="block mb-4">
          <span className="block text-[11px] font-bold text-ap-muted uppercase mb-1">Contraseña</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="w-full px-3 py-2.5 border border-ap-border rounded-lg text-[13px] bg-white text-ap-primary outline-none focus:border-ap-secondary" />
        </label>

        {error && <p className="text-[12px] text-ap-red font-semibold mb-3">{error}</p>}

        <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-ap-primary text-white font-bold text-[13px] disabled:opacity-50">
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
