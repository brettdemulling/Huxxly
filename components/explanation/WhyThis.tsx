'use client';

import type { AutopilotExplanation } from '@/lib/core/canonicalModels';

interface Props {
  explanation: AutopilotExplanation;
}

function Reason({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-semibold text-[#0F172A] mb-0.5">{title}</p>
        <p className="text-xs text-[#64748B] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export function WhyThis({ explanation }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex flex-col gap-4">
      <span className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">
        Why this plan
      </span>
      <Reason icon="🎯" title="The plan" body={explanation.whyThisPlan} />
      <Reason icon="🍽" title="These meals" body={explanation.whyTheseMeals} />
      <Reason icon="🏪" title="This store" body={explanation.whyThisStore} />
    </div>
  );
}
