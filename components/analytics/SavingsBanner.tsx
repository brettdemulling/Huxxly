'use client';

import { useEffect, useState } from 'react';
import { Microcopy } from '@/lib/branding/microcopy';

interface BannerData {
  headline: string;
  value: string;
  description: string;
  trend: 'up' | 'down' | 'flat';
}

interface ApiResponse {
  banner: BannerData;
  average: number;
  trend: {
    dailyAverage: number;
    weeklyAverage: number;
  };
}

const FALLBACK: BannerData = {
  headline: Microcopy.savingsLabel,
  value: '$18.40',
  description: 'Average savings per order',
  trend: 'flat',
};

function TrendDot({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const color =
    trend === 'up' ? 'text-[#22C55E]' :
    trend === 'down' ? 'text-[#EF4444]' :
    'text-[#CBD5E1]';
  const symbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  return (
    <span className={`${color} text-xs`} aria-label={`trend ${trend}`}>{symbol}</span>
  );
}

export function SavingsBanner() {
  const [data, setData] = useState<BannerData>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/savings')
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((res) => {
        if (res?.banner) setData(res.banner);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 transition-opacity duration-250"
      style={{ opacity: loaded ? 1 : 0.6 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#94A3B8] font-light">{data.headline}</span>
        <TrendDot trend={data.trend} />
      </div>
      <div className="text-right">
        <p className="text-base font-medium text-[#0F172A]">{data.value}</p>
        <p className="text-xs text-[#CBD5E1] font-light">avg per order</p>
      </div>
    </div>
  );
}
