'use client';

interface Props {
  score: number;
  label?: string;
}

export function ConfidenceBadge({ score, label = 'Confidence' }: Props) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 85 ? { bg: '#22C55E10', text: '#22C55E', border: '#22C55E30' }
    : pct >= 70 ? { bg: '#F59E0B10', text: '#F59E0B', border: '#F59E0B30' }
    : { bg: '#EF444410', text: '#EF4444', border: '#EF444430' };

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ backgroundColor: color.bg, color: color.text, borderColor: color.border }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color.text }}
      />
      {label}: {pct}%
    </span>
  );
}
