'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FlowResult, CartItem } from '@/lib/core/canonicalModels';
import { TrustBar } from '@/components/trust/TrustBar';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';
import { PriceBreakdown } from '@/components/pricing/PriceBreakdown';
import { WhyThis } from '@/components/explanation/WhyThis';
import { CheckoutSuccess } from '@/components/checkout/CheckoutSuccess';
import { Microcopy } from '@/lib/branding/microcopy';
import type { TrustResult } from '@/lib/trust/trustEngine';

type CheckoutPhase = 'idle' | 'preparing' | 'ready' | 'redirecting' | 'success';

interface FlowData extends FlowResult {
  ok: boolean;
}

export default function CartPage() {
  const router = useRouter();
  const [flow, setFlow] = useState<FlowData | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [degradationNote, setDegradationNote] = useState('');
  const [error, setError] = useState('');
  const [undone, setUndone] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('ag_flow');
    if (!raw) { router.push('/'); return; }
    try {
      setFlow(JSON.parse(raw));
      setTimeout(() => setVisible(true), 50);
    } catch { router.push('/'); }
  }, [router]);

  async function handleCheckout() {
    if (!flow) return;
    setPhase('preparing');
    setError('');
    try {
      const cart = flow.primaryCart;
      let url = cart.checkoutUrl ?? '';

      if (!url) {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartId: cart.id, intentId: flow.intent.id, cart }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? 'Checkout failed');
        }
        const data = await res.json() as { checkoutUrl: string; degradationMode?: string; partial?: boolean };
        url = data.checkoutUrl;

        if (data.degradationMode === 'LITE_CHECKOUT') setDegradationNote(Microcopy.liteMode);
        else if (data.partial) setDegradationNote(Microcopy.fallback);
      }

      setCheckoutUrl(url);
      // Brief pause — perceived polish
      await new Promise((r) => setTimeout(r, 150));
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('idle');
    }
  }

  async function handleContinue() {
    setPhase('redirecting');
    await new Promise((r) => setTimeout(r, 120));
    window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    setPhase('success');
  }

  async function handleUndo() {
    if (!flow?.undoToken) { router.push('/'); return; }
    try {
      await fetch(`/api/undo/${flow.undoToken}`, { method: 'DELETE' });
    } catch { /* best-effort */ }
    sessionStorage.removeItem('ag_flow');
    setUndone(true);
    setTimeout(() => router.push('/'), 600);
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

  if (undone) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[#94A3B8] font-light">Order cancelled.</p>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <CheckoutSuccess
        onStartOver={() => { sessionStorage.removeItem('ag_flow'); router.push('/'); }}
      />
    );
  }

  const cart = flow.primaryCart;
  const subtotal = (cart.subtotalCents / 100).toFixed(2);
  const delivery = (cart.estimatedDeliveryFee / 100).toFixed(2);
  const total = (cart.estimatedTotalCents / 100).toFixed(2);
  const coverage = Math.round(cart.coverageScore * 100);

  const trustResult: TrustResult | null = flow.trustScore != null ? {
    trustScore: flow.trustScore,
    apiReliabilityScore: flow.trustScore,
    checkoutSuccessProbability: flow.trustScore * cart.coverageScore,
    storeTrustRanking: [],
  } : null;

  // Confirmation state — order ready
  if (phase === 'ready' || phase === 'redirecting') {
    return (
      <div className="flex flex-col min-h-[70vh] justify-center gap-6 transition-opacity duration-200">
        <div>
          <p className="text-2xl font-medium text-[#0F172A] tracking-tight mb-1">
            {Microcopy.checkoutReady}
          </p>
          <p className="text-sm text-[#64748B] font-light">{cart.storeName}</p>
        </div>

        <div className="flex flex-col gap-2 py-4 border-t border-b border-gray-100">
          <div className="flex justify-between text-sm text-[#64748B] font-light">
            <span>Subtotal</span><span>${subtotal}</span>
          </div>
          {cart.estimatedDeliveryFee > 0 && (
            <div className="flex justify-between text-sm text-[#64748B] font-light">
              <span>Est. delivery</span><span>${delivery}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-medium text-[#0F172A] pt-2">
            <span>Total</span><span>${total}</span>
          </div>
          {flow.savingsData && (
            <p className="text-xs text-[#22C55E] font-light mt-1">
              {Microcopy.savingsMessage(flow.savingsData.thisOrderSavingsPercent)}
            </p>
          )}
        </div>

        {degradationNote && (
          <p className="text-xs text-[#94A3B8]">{degradationNote}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={phase === 'redirecting'}
          className="w-full rounded-xl bg-[#0F172A] px-6 py-4 text-white font-medium text-sm hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {phase === 'redirecting' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="font-light">{Microcopy.finalizing}</span>
            </span>
          ) : (
            Microcopy.orderNow
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-5 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="mb-1">
        <button
          onClick={() => router.push('/meals')}
          className="text-xs text-[#94A3B8] hover:text-[#64748B] mb-5 flex items-center gap-1 transition-colors duration-150"
        >
          ← Back
        </button>
        <p className="text-xs font-medium tracking-widest text-[#2563EB] uppercase mb-2">
          Your order
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-medium text-[#0F172A] tracking-tight">{cart.storeName}</h1>
          {flow.confidenceScore != null && (
            <ConfidenceBadge score={flow.confidenceScore} />
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs text-[#94A3B8] capitalize">{cart.provider}</span>
          <span className="text-xs text-[#22C55E]">{coverage}% coverage</span>
          {cart.missingIngredients.length > 0 && (
            <span className="text-xs text-[#F59E0B]">{cart.missingIngredients.length} substituted</span>
          )}
          {flow.failoverApplied && (
            <span className="text-xs text-[#94A3B8]">{Microcopy.fallback}</span>
          )}
        </div>
      </div>

      {flow.priceBreakdown && <PriceBreakdown breakdown={flow.priceBreakdown} />}
      {trustResult && <TrustBar trust={trustResult} />}
      {flow.autopilotExplanation && <WhyThis explanation={flow.autopilotExplanation} />}

      {flow.savingsData && (
        <div className="bg-[#F0FDF4] rounded-xl px-5 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-[#22C55E]">{Microcopy.savingsLabel}</p>
            <p className="text-xs text-[#94A3B8] font-light mt-0.5">
              Lifetime ${flow.savingsData.lifetimeSavings.toFixed(2)}
            </p>
          </div>
          <span className="text-lg font-medium text-[#22C55E]">
            {flow.savingsData.thisOrderSavingsPercent}
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <span className="text-xs text-[#94A3B8]">{cart.items.length} items</span>
        </div>
        <ul className="divide-y divide-gray-50">
          {cart.items.map((item: CartItem, idx: number) => (
            <OrderItemRow key={idx} item={item} />
          ))}
        </ul>
      </div>

      {cart.missingIngredients.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-xs text-[#94A3B8] mb-2">Substitutes applied</p>
          <ul className="flex flex-col gap-1">
            {cart.missingIngredients.map((name: string) => (
              <li key={name} className="text-xs text-[#94A3B8] font-light">· {name}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl px-5 py-4 flex flex-col gap-2">
        <div className="flex justify-between text-sm text-[#64748B] font-light">
          <span>Subtotal</span><span>${subtotal}</span>
        </div>
        <div className="flex justify-between text-sm text-[#64748B] font-light">
          <span>Est. delivery</span>
          <span>{cart.estimatedDeliveryFee === 0 ? <span className="text-[#22C55E]">Free</span> : `$${delivery}`}</span>
        </div>
        <div className="flex justify-between font-medium text-[#0F172A] text-base border-t border-gray-50 pt-3">
          <span>Total</span><span>${total}</span>
        </div>
      </div>

      {error && <p className="text-[#EF4444] text-xs">{error}</p>}

      <div className="flex flex-col gap-3 sticky bottom-4">
        <button
          onClick={handleCheckout}
          disabled={phase === 'preparing'}
          className="w-full rounded-xl bg-[#0F172A] px-6 py-4 text-white font-medium text-sm hover:bg-[#1e293b] active:bg-[#020617] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {phase === 'preparing' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="font-light">{Microcopy.processing}</span>
            </span>
          ) : (
            `${Microcopy.orderNow} — $${total}`
          )}
        </button>
        {flow.undoToken && phase === 'idle' && (
          <button
            onClick={handleUndo}
            className="w-full rounded-xl px-6 py-3 text-[#94A3B8] font-light text-sm hover:text-[#64748B] transition-colors duration-150"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
}

function OrderItemRow({ item }: { item: CartItem }) {
  const price = (item.lineTotal / 100).toFixed(2);
  const imageUrl = item.product.imageUrl;
  const placeholderUrl = `https://placehold.co/56x56/F8FAFC/CBD5E1?text=${encodeURIComponent(item.product.name.slice(0, 2))}`;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {/* Product image loads first — trust layer */}
      <div className="shrink-0 w-14 h-14 rounded-lg bg-[#F8FAFC] overflow-hidden flex items-center justify-center">
        <img
          src={imageUrl ?? placeholderUrl}
          alt={item.product.name}
          width={56}
          height={56}
          loading="lazy"
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = placeholderUrl;
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0F172A] font-light leading-snug truncate">{item.product.name}</p>
        {item.product.brand && (
          <p className="text-xs text-[#94A3B8]">{item.product.brand}</p>
        )}
        <p className="text-xs text-[#94A3B8]">qty {item.quantity}</p>
      </div>

      <span className="text-sm text-[#0F172A] shrink-0">${price}</span>
    </li>
  );
}
