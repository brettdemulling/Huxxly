'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SavingsBanner } from '@/components/analytics/SavingsBanner';
import { Microcopy } from '@/lib/branding/microcopy';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  async function pollJob(jobId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to check job status');
      const data = await res.json() as { status: string; result?: unknown; error?: string };

      if (data.status === 'completed') {
        sessionStorage.setItem('ag_flow', JSON.stringify(data.result));
        router.push('/meals');
        return;
      }
      if (data.status === 'failed') {
        throw new Error(data.error ?? 'Planning failed. Please try again.');
      }
      if (data.status === 'running') {
        setStatusText('Preparing your meals');
      }
    }
    throw new Error('Request timed out. Please try again.');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setStatusText('');

    if (!input.trim() || !zip.trim()) {
      setError('Please describe your needs and enter your ZIP code.');
      return;
    }
    if (!/^\d{5}$/.test(zip)) {
      setError('ZIP code must be exactly 5 digits.');
      return;
    }

    setLoading(true);
    setStatusText('Preparing your plan');
    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), zipCode: zip.trim() }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Something went wrong');
      }

      const { jobId } = await res.json() as { jobId: string };
      setStatusText('Analyzing your request');
      await pollJob(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed. Try again.');
    } finally {
      setLoading(false);
      setStatusText('');
    }
  }

  return (
    <div
      className="flex flex-col min-h-[80vh] justify-center transition-opacity duration-200"
      style={{ opacity: 1 }}
    >
      <div className="mb-10">
        <p className="text-xs font-medium tracking-widest text-[#2563EB] uppercase mb-3">
          Huxxly
        </p>
        <h1 className="text-3xl font-medium text-[#0F172A] leading-tight tracking-tight">
          What does your family need this week?
        </h1>
        <p className="mt-3 text-[#64748B] text-sm font-light leading-relaxed">
          Describe your needs. We handle the rest.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "Feed my family of 4 for $120, kid-friendly, no nuts"'
          rows={4}
          maxLength={500}
          className="w-full rounded-xl border border-gray-100 bg-white px-4 py-3 text-[#0F172A] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/10 resize-none text-sm font-light transition-colors duration-150"
        />

        <input
          type="text"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="ZIP code"
          maxLength={5}
          className="w-full rounded-xl border border-gray-100 bg-white px-4 py-3 text-[#0F172A] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/10 text-sm font-light transition-colors duration-150"
        />

        {error && (
          <p className="text-[#EF4444] text-xs">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#0F172A] px-6 py-4 text-white font-medium text-sm hover:bg-[#1e293b] active:bg-[#020617] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="font-light">{statusText || Microcopy.processing}</span>
            </span>
          ) : (
            Microcopy.orderNow
          )}
        </button>
      </form>

      <div className="mt-8">
        <SavingsBanner />
      </div>

      <p className="mt-6 text-xs text-[#CBD5E1] text-center font-light">
        Powered by Claude · Instacart · Kroger · Walmart
      </p>
    </div>
  );
}
