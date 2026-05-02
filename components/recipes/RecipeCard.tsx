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
  cookTimeMinutes?: number;
  cuisine?: string;
  calories?: number;
}

const PLACEHOLDER = (name: string) =>
  `https://placehold.co/480x200/F1F5F9/94A3B8?text=${encodeURIComponent(name.slice(0, 2))}`;

function ClockIcon() {
  return (
    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8 8 8 12 12 14c-1-3 1-5 3-6-1 4 2 6 2 10a6 6 0 0 1-12 0c0-5 4-8 5-12 1 3 2 5 2 8z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

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
      className="rounded-2xl overflow-hidden transition-shadow duration-150"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Hero image */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: '180px', background: 'var(--color-bg-secondary)' }}
      >
        <img
          src={imgSrc}
          alt={recipe.title}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setImgSrc(placeholder)}
        />
        {/* Category chip */}
        <div className="absolute top-3 left-3">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
            style={{
              background: 'rgba(0,0,0,0.52)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
            }}
          >
            {recipe.category}
          </span>
        </div>
        {/* Save button overlay */}
        <div className="absolute top-3 right-3">
          <button
            onClick={onSave}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
            style={recipe.isSaved ? {
              background: 'var(--color-primary)',
              color: '#fff',
            } : {
              background: 'rgba(255,255,255,0.92)',
              color: 'var(--color-primary)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {recipe.isSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-4">
        {/* Title */}
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {recipe.title}
        </p>

        {/* Meta row: cuisine · cook time · servings · calories */}
        <div
          className="flex items-center gap-2.5 mt-1.5 flex-wrap"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {recipe.cuisine && (
            <span className="text-xs">{recipe.cuisine}</span>
          )}
          {recipe.cookTimeMinutes && (
            <span className="flex items-center gap-0.5 text-xs">
              <ClockIcon />{recipe.cookTimeMinutes}m
            </span>
          )}
          {servings && (
            <span className="flex items-center gap-0.5 text-xs">
              <PeopleIcon />Serves {servings}
            </span>
          )}
          {recipe.calories && (
            <span className="flex items-center gap-0.5 text-xs">
              <FlameIcon />{recipe.calories} cal
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>
              ${displayPrice.toFixed(2)}
            </span>
            {priceAdjusted && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>adj.</span>
            )}
            {perServing !== null && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                · ${perServing}/serving
              </span>
            )}
          </div>
          {recipe.isSaved && (
            <button
              onClick={onSwap}
              disabled={swapping}
              className="text-xs px-3 py-1 rounded-lg transition-all duration-150"
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

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {recipe.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
