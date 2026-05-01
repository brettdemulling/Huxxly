'use client';

import { DIETARY_TAGS, type DietaryTag } from '@/lib/domains/dietary';

export function DietaryFilterBar({
  selected,
  onToggle,
}: {
  selected: DietaryTag[];
  onToggle: (tag: DietaryTag) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {DIETARY_TAGS.map((t) => {
        const active = selected.includes(t.key);
        return (
          <button
            key={t.key}
            onClick={() => onToggle(t.key)}
            className="shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-150"
            style={active ? {
              background: 'var(--color-primary)',
              color: '#fff',
              border: '1px solid var(--color-primary)',
            } : {
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-light)',
            }}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
