'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MealCanonical, FlowResult } from '@/lib/core/canonicalModels';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';
import { Microcopy } from '@/lib/branding/microcopy';

interface FlowData extends FlowResult {
  ok: boolean;
}

export default function MealsPage() {
  const router = useRouter();
  const [flow, setFlow] = useState<FlowData | null>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('ag_flow');
    if (!raw) { router.push('/'); return; }
    try {
      setFlow(JSON.parse(raw));
      setTimeout(() => setVisible(true), 50);
    } catch { router.push('/'); }
  }, [router]);

  async function handleApprove() {
    if (!flow) return;
    setApproving(true);
    setError('');
    try {
      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: flow.intent.id, meals: flow.meals }),
      });
      // 100ms delay for perceived polish before navigation
      await new Promise((r) => setTimeout(r, 100));
      router.push('/cart');
    } catch {
      setError('Something went wrong. Please try again.');
      setApproving(false);
    }
  }

  if (!flow) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-5 w-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  const { meals, intent, primaryCart, failoverApplied } = flow;
  const budget = (intent.budgetCents / 100).toFixed(2);
  const totalCost = (primaryCart.estimatedTotalCents / 100).toFixed(2);

  return (
    <div
      className="transition-opacity duration-250"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-xs text-[#94A3B8] hover:text-[#64748B] mb-5 flex items-center gap-1 transition-colors duration-150"
        >
          ← Start over
        </button>
        <p className="text-xs font-medium tracking-widest text-[#2563EB] uppercase mb-2">
          Your meal plan
        </p>
        <h1 className="text-2xl font-medium text-[#0F172A] tracking-tight">
          {meals.length} meals prepared
        </h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-sm text-[#64748B] font-light">
            Budget <span className="text-[#0F172A]">${budget}</span>
          </span>
          <span className="text-sm text-[#64748B] font-light">
            Est. total <span className="text-[#22C55E]">${totalCost}</span>
          </span>
          {flow.confidenceScore != null && (
            <ConfidenceBadge score={flow.confidenceScore} />
          )}
          {failoverApplied && (
            <span className="text-xs text-[#94A3B8]">{Microcopy.fallback}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        {meals.map((meal: MealCanonical, idx: number) => (
          <MealCard key={meal.id} meal={meal} index={idx + 1} />
        ))}
      </div>

      {error && <p className="text-[#EF4444] text-xs mb-4">{error}</p>}

      <div className="sticky bottom-4">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="w-full rounded-xl bg-[#0F172A] px-6 py-4 text-white font-medium text-sm hover:bg-[#1e293b] active:bg-[#020617] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {approving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="font-light">{Microcopy.processing}</span>
            </span>
          ) : (
            Microcopy.orderNow
          )}
        </button>
      </div>
    </div>
  );
}

function MealCard({ meal, index }: { meal: MealCanonical; index: number }) {
  const [open, setOpen] = useState(false);
  const cost = (meal.estimatedCostCents / 100).toFixed(2);

  return (
    <div className="bg-white rounded-xl overflow-hidden transition-all duration-150">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-xs text-[#94A3B8] w-4">{index}</span>
            <span className="font-medium text-[#0F172A] text-sm">{meal.name}</span>
          </div>
          <div className="flex items-center gap-3 ml-7">
            <span className="text-xs text-[#94A3B8]">${cost}</span>
            <span className="text-xs text-[#94A3B8]">{meal.prepTimeMinutes + meal.cookTimeMinutes} min</span>
            <span className="text-xs text-[#94A3B8]">{meal.servings} servings</span>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-[#CBD5E1] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-50">
          <p className="text-xs text-[#64748B] font-light mt-3 mb-3 leading-relaxed">{meal.description}</p>
          <div className="flex flex-wrap gap-1 mb-4">
            {meal.dietaryFlags.map((f: string) => (
              <span key={f} className="text-xs text-[#94A3B8] bg-[#F8FAFC] px-2 py-0.5 rounded-full">
                {f.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <p className="text-xs text-[#64748B] mb-2">Ingredients</p>
          <ul className="flex flex-col gap-1.5">
            {meal.ingredients.map((ing) => (
              <li key={ing.id} className="flex items-center justify-between text-xs text-[#64748B] font-light">
                <span>{ing.quantity} {ing.unit} {ing.name}</span>
                <span className="text-[#94A3B8]">${(ing.estimatedCostCents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
