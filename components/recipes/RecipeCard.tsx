'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RecipeViewModel } from '@/lib/view-models/recipeViewModel';

const PLACEHOLDER = 'https://placehold.co/480x200/059669/FFFFFF?text=Recipe';

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
  recipe: RecipeViewModel;
  swapping: boolean;
  onSave: () => void;
  onSwap: () => void;
}) {
  const [imgSrc, setImgSrc] = useState(recipe.image);

  return (
    <Link
      href={`/recipe/${recipe.id}`}
      className="block rounded-2xl overflow-hidden transition-shadow duration-150"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        textDecoration: 'none',
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
          onError={() => setImgSrc(PLACEHOLDER)}
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
        {/* Save button — stops propagation so it doesn't navigate */}
        <div className="absolute top-3 right-3">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(); }}
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
        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
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
          {recipe.cookTime > 0 && (
            <span className="flex items-center gap-0.5 text-xs">
              <ClockIcon />{recipe.cookTime}m
            </span>
          )}
          {recipe.servings > 0 && (
            <span className="flex items-center gap-0.5 text-xs">
              <PeopleIcon />Serves {recipe.servings}
            </span>
          )}
          {recipe.calories !== null && (
            <span className="flex items-center gap-0.5 text-xs">
              <FlameIcon />{recipe.calories} cal
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>
              ${recipe.totalPrice.toFixed(2)}
            </span>
            {recipe.pricePerServing > 0 && recipe.pricePerServing !== recipe.totalPrice && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                · ${recipe.pricePerServing}/serving
              </span>
            )}
          </div>
          {recipe.isSaved && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSwap(); }}
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

        {/* Dietary tags */}
        {recipe.dietaryFlags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {recipe.dietaryFlags.slice(0, 5).map((tag) => (
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
    </Link>
  );
}
