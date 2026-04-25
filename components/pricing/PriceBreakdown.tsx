'use client';

import type { PriceBreakdown as PriceBreakdownType } from '@/lib/core/canonicalModels';

interface Props {
  breakdown: PriceBreakdownType;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#64748B]">{label}</span>
      <span className={`font-medium ${accent ?? 'text-[#0F172A]'}`}>{value}</span>
    </div>
  );
}

export function PriceBreakdown({ breakdown }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex flex-col gap-3">
      <span className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">
        Price Breakdown
      </span>

      <div className="flex flex-col gap-2">
        <Row label="Items" value={`$${breakdown.itemCost.toFixed(2)}`} />
        <Row label="Delivery" value={breakdown.deliveryFees === 0 ? 'Free' : `$${breakdown.deliveryFees.toFixed(2)}`} />
        <Row label="Service fee" value={`$${breakdown.serviceFees.toFixed(2)}`} />
        <div className="border-t border-gray-100 pt-2">
          <Row
            label="Optimized total"
            value={`$${breakdown.optimizedCost.toFixed(2)}`}
          />
        </div>
        {breakdown.savings > 0 && (
          <div className="bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-lg px-3 py-2 flex justify-between items-center">
            <span className="text-xs text-[#22C55E] font-semibold">You save</span>
            <span className="text-sm font-bold text-[#22C55E]">${breakdown.savings.toFixed(2)}</span>
          </div>
        )}
      </div>

      {breakdown.storeComparison.length > 1 && (
        <div>
          <span className="text-xs font-semibold text-[#64748B] block mb-2">Store comparison</span>
          <div className="flex flex-col gap-1">
            {breakdown.storeComparison.map((s, i) => (
              <div key={s.store} className="flex justify-between text-xs">
                <span className={i === 0 ? 'text-[#22C55E] font-semibold' : 'text-[#64748B]'}>
                  {i === 0 ? '✓ ' : ''}{s.store}
                </span>
                <span className={i === 0 ? 'text-[#22C55E] font-semibold' : 'text-[#64748B]'}>
                  ${s.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
