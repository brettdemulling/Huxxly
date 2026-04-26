'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) {
          router.replace('/');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST' });
      if (!res.ok) throw new Error('Could not create session.');
      router.replace('/');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-xs flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Huxxly</h1>
          <p className="text-sm text-slate-500">Intelligent grocery planning, effortlessly done.</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0F172A] text-white text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {loading ? 'One moment…' : 'Continue'}
          </button>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <p className="text-xs text-slate-400 text-center leading-relaxed">
            No account required. Your session is private and local.
          </p>
        </div>
      </div>
    </main>
  );
}
