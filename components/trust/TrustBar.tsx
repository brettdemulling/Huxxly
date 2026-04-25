'use client';

import type { TrustResult } from '@/lib/trust/trustEngine';

interface Props {
  trust: TrustResult;
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? '#22C55E' : pct >= 75 ? '#F59E0B' : '#EF4444';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-[#64748B]">{label}</span>
        <span className="text-xs font-semibold text-[#0F172A]">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function TrustBar({ trust }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">
          Store Reliability
        </span>
        <span className="text-xs font-bold text-[#2563EB]">
          {Math.round(trust.trustScore * 100)}% trusted
        </span>
      </div>
      <Bar label="API uptime" value={trust.apiReliabilityScore} />
      <Bar label="Checkout success" value={trust.checkoutSuccessProbability} />
    </div>
  );
}
