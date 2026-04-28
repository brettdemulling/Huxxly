'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Recipe {
  id: string;
  title: string;
  price: number;
  category: string;
  tags: string[];
  imageUrl?: string;
  servings?: number;
  isSaved: boolean;
}

interface CartItem {
  name: string;
  estimatedCost: number;
}

interface MealPlanDay {
  day: string;
  recipe: { name: string; price: number };
}

interface MealPlan {
  id: string;
  name: string;
  items: MealPlanDay[];
}

const PLACEHOLDER = (name: string) =>
  `https://placehold.co/400x300/F8FAFC/CBD5E1?text=${encodeURIComponent(name.slice(0, 2))}`;

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ items: CartItem[]; totalCost: number } | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [swapping, setSwapping] = useState<string | null>(null);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchRecipes = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes?q=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json() as { recipes: Recipe[] };
      setRecipes(data.recipes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecipes('');
  }, [fetchRecipes]);

  useEffect(() => {
    const t = setTimeout(() => { void fetchRecipes(query); }, 300);
    return () => clearTimeout(t);
  }, [query, fetchRecipes]);

  async function toggleSave(recipe: Recipe) {
    const wasSaved = recipe.isSaved;
    setRecipes((prev) =>
      prev.map((r) => (r.id === recipe.id ? { ...r, isSaved: !wasSaved } : r)),
    );

    const method = wasSaved ? 'DELETE' : 'POST';
    const res = await fetch('/api/recipes/save', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId: recipe.id }),
    });

    if (!res.ok) {
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipe.id ? { ...r, isSaved: wasSaved } : r)),
      );
      toast('Please sign in to save recipes.');
    } else {
      toast(wasSaved ? 'Recipe removed.' : 'Recipe saved!');
    }
  }

  async function handleSwap(recipe: Recipe) {
    const unsaved = recipes.find((r) => r.isSaved && r.id !== recipe.id);
    if (!unsaved) { toast('Save another recipe first to swap.'); return; }

    setSwapping(recipe.id);
    try {
      await fetch('/api/recipes/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromRecipeId: unsaved.id, toRecipeId: recipe.id }),
      });
      await fetchRecipes(query);
      toast(`Swapped to ${recipe.title}`);
    } finally {
      setSwapping(null);
    }
  }

  async function generateCart() {
    setCartLoading(true);
    setCart(null);
    try {
      const res = await fetch('/api/recipes/cart');
      if (res.status === 401) { toast('Sign in to generate a cart.'); return; }
      const data = await res.json() as { items: CartItem[]; totalCost: number };
      setCart(data);
    } finally {
      setCartLoading(false);
    }
  }

  async function generatePlan() {
    setPlanLoading(true);
    setPlan(null);
    try {
      const res = await fetch('/api/mealplan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 401) { toast('Sign in to create a plan.'); return; }
      if (res.status === 400) { toast('Save some recipes first.'); return; }
      const data = await res.json() as { plan: MealPlan };
      setPlan(data.plan);
    } finally {
      setPlanLoading(false);
    }
  }

  const savedCount = recipes.filter((r) => r.isSaved).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-lg"
          style={{ background: 'var(--color-primary)' }}
        >
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/')}
          className="text-xs mb-4 flex items-center gap-1 transition-colors duration-150"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Back
        </button>
        <p className="text-xs font-medium tracking-widest uppercase mb-2" style={{ color: 'var(--color-accent)' }}>
          Recipe Library
        </p>
        <h1 className="text-2xl font-medium tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
          Browse Recipes
        </h1>
        <p className="text-sm font-light mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Save your favorites, then generate a grocery cart or weekly meal plan.
        </p>
      </div>

      {/* Search */}
      <input
        className="search-input"
        placeholder="Search recipes — pasta, chicken, vegan…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* AI Actions */}
      {savedCount > 0 && (
        <div className="ai-feature flex flex-col gap-3">
          <p className="text-xs font-medium" style={{ color: 'var(--color-primary-pressed)' }}>
            {savedCount} recipe{savedCount !== 1 ? 's' : ''} saved — ready to generate
          </p>
          <div className="flex gap-2">
            <button
              onClick={generateCart}
              disabled={cartLoading}
              className="flex-1 text-xs font-medium py-2 px-3 rounded-lg border transition-colors duration-150"
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                borderColor: 'var(--color-primary)',
                opacity: cartLoading ? 0.5 : 1,
              }}
            >
              {cartLoading ? 'Building…' : 'Generate Grocery Cart'}
            </button>
            <button
              onClick={generatePlan}
              disabled={planLoading}
              className="flex-1 text-xs font-medium py-2 px-3 rounded-lg border transition-colors duration-150"
              style={{
                background: 'transparent',
                color: 'var(--color-primary-pressed)',
                borderColor: 'var(--color-primary)',
                opacity: planLoading ? 0.5 : 1,
              }}
            >
              {planLoading ? 'Planning…' : 'Create Meal Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Generated Cart */}
      {cart && (
        <div className="rounded-xl p-4" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-border-light)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-success)' }}>
            Grocery Cart — ${cart.totalCost.toFixed(2)} est.
          </p>
          <ul className="flex flex-col gap-1">
            {cart.items.map((item, i) => (
              <li key={i} className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span>{item.name}</span>
                <span style={{ color: 'var(--color-primary)' }}>${item.estimatedCost.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generated Meal Plan */}
      {plan && (
        <div className="rounded-xl p-4" style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-border-light)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-primary-pressed)' }}>
            {plan.name}
          </p>
          <ul className="flex flex-col gap-1">
            {plan.items.map((item) => (
              <li key={item.day} className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium" style={{ color: 'var(--color-text-primary)', minWidth: '90px' }}>{item.day}</span>
                <span className="flex-1 truncate ml-2">{item.recipe.name}</span>
                <span className="ml-2" style={{ color: 'var(--color-primary)' }}>${item.recipe.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recipe Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <svg className="animate-spin h-5 w-5" style={{ color: 'var(--color-text-muted)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : recipes.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
          No recipes found.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onSave={() => toggleSave(recipe)}
              onSwap={() => handleSwap(recipe)}
              swapping={swapping === recipe.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  onSave,
  onSwap,
  swapping,
}: {
  recipe: Recipe;
  onSave: () => void;
  onSwap: () => void;
  swapping: boolean;
}) {
  const placeholder = PLACEHOLDER(recipe.title);

  return (
    <div className="recipe-card">
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-secondary)' }}>
          <img
            src={recipe.imageUrl ?? placeholder}
            alt={recipe.title}
            width={80}
            height={80}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = placeholder; }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--color-text-primary)' }}>
            {recipe.title}
          </p>
          <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--color-text-muted)' }}>
            {recipe.category}{recipe.servings ? ` · ${recipe.servings} servings` : ''}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-sm font-medium mt-1 price-text">
            ${recipe.price.toFixed(2)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0 justify-start items-end">
          <button
            onClick={onSave}
            className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors duration-150"
            style={recipe.isSaved ? {
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary-pressed)',
              borderColor: 'var(--color-primary)',
            } : {
              background: 'transparent',
              color: 'var(--color-text-muted)',
              borderColor: 'var(--color-border-light)',
            }}
          >
            {recipe.isSaved ? 'Saved' : 'Save'}
          </button>
          {recipe.isSaved && (
            <button
              onClick={onSwap}
              disabled={swapping}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150"
              style={{
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-border-light)',
                opacity: swapping ? 0.4 : 1,
              }}
            >
              {swapping ? '…' : 'Swap'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
