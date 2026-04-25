'use client';

import { useEffect, useState } from 'react';
import { Microcopy } from '@/lib/branding/microcopy';

interface CheckoutSuccessProps {
  onStartOver?: () => void;
}

export function CheckoutSuccess({ onStartOver }: CheckoutSuccessProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="flex flex-col gap-2">
        <p className="text-2xl font-medium text-[#0F172A] tracking-tight">
          {Microcopy.checkoutSuccess}
        </p>
        <p className="text-sm text-[#64748B]">
          {Microcopy.thankYou}
        </p>
      </div>

      <p className="text-xs text-[#94A3B8]">Ready again anytime.</p>

      {onStartOver && (
        <button
          onClick={onStartOver}
          className="mt-4 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          Start a new order
        </button>
      )}
    </div>
  );
}
