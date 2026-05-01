'use client';

import { useState, useEffect } from 'react';
import { costPerServing } from '@/lib/domains/servings';

export interface Recipe {
  id: string;
  title: string;
  price: number;
  adjustedPrice?: number;
  category: string;
  tags: string[];
  imageUrl?: string;
  servings?: number;
  displayServings?: number;
  isSaved: boolean;
}

const PLACEHOLDER = (name: string) =>
  `https://placehold.co/400x300/F8FAFC/CBD5E1?text=${encodeURIComponent(name.slice(0, 2))}`;

export function RecipeCard({
  recipe,
  swapping,
  onSave,
  onSwap,
}: {
  recipe: Recipe;
  swapping: boolean;
  onSave: () => void;
  onSwap: () => void;
}) {
  const placeholder = PLACEHOLDER(recipe.title);
  const [imgSrc, setImgSrc] = useState(recipe.imageUrl ?? placeholder);

  useEffect(() => {
    setImgSrc(recipe.imageUrl ?? placeholder);
  }, [recipe.imageUrl, placeholder]);

  const displayPrice = recipe.adjustedPrice ?? recipe.price;
  const servings = recipe.displayServings ?? recipe.servings;
  const perServing = servings && servings > 0 ? costPerServing(displayPrice, servings) : null;
  const priceAdjusted = recipe.adjustedPrice !== undefined && recipe.adjustedPrice !== recipe.price;

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow duration-150"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div className="flex gap-3 p-4">
        {/* Image */}
        <div
          className="shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden"
          style={{ background: 'var(--color-bg-secondary)' }}
        >
          <img
            src={imgSrc}
            alt={recipe.title}
            width={72}
            height={72}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgSrc(placeholder)}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--color-text-primary)' }}>
            {recipe.title}
          </p>
          <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--color-text-muted)' }}>
            {recipe.category}
            {servings ? ` · Serves ${servings}` : ''}
          </p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              ${displayPrice.toFixed(2)}
            </p>
            {priceAdjusted && (
              <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
                adj.
              </span>
            )}
            {perServing !== null && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                · ${perServing}/serving
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0 justify-center">
          <button
            onClick={onSave}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150"
            style={recipe.isSaved ? {
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary-pressed)',
              border: '1px solid var(--color-primary)',
            } : {
              background: 'var(--color-primary)',
              color: '#fff',
              border: '1px solid var(--color-primary)',
            }}
          >
            {recipe.isSaved ? '✓ Saved' : 'Save'}
          </button>
          {recipe.isSaved && (
            <button
              onClick={onSwap}
              disabled={swapping}
              className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150"
              style={{
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-light)',
                opacity: swapping ? 0.4 : 1,
              }}
            >
              {swapping ? '…' : 'Swap'}
            </button>
          )}
        </div>
      </div>

      {/* Tags — up to 5 */}
      {recipe.tags.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-1">
          {recipe.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
