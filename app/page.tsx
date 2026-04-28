'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SavingsBanner } from '@/components/analytics/SavingsBanner';
import { Microcopy } from '@/lib/branding/microcopy';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recipe {
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

interface CartData {
  items: { name: string; estimatedCost: number }[];
  totalCost: number;
  recipeCount: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;
const PLACEHOLDER = (name: string) =>
  `https://placehold.co/400x300/F8FAFC/CBD5E1?text=${encodeURIComponent(name.slice(0, 2))}`;
const SEARCH_HINTS = [
  'Find meals for 5 people under $100',
  'High protein meals under $50',
  'Family dinner for 4, kid-friendly',
  'Quick weeknight meals under $30',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  // AI planner state (existing — unchanged)
  const [input, setInput] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  // Recipe search state
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStarted, setSearchStarted] = useState(false);

  // Cart + meal plan state
  const [cart, setCart] = useState<CartData | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [swapping, setSwapping] = useState<string | null>(null);

  const hintRef = useRef(0);
  const [hint, setHint] = useState(SEARCH_HINTS[0]);

  // Rotate hint placeholder
  useEffect(() => {
    const id = setInterval(() => {
      hintRef.current = (hintRef.current + 1) % SEARCH_HINTS.length;
      setHint(SEARCH_HINTS[hintRef.current]);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }, []);

  // ── Recipe search ──────────────────────────────────────────────────────────

  const fetchRecipes = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/recipes?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) { setRecipes([]); return; }
      const data = await res.json() as { recipes: Recipe[] };
      setRecipes(data.recipes ?? []);
    } catch {
      setRecipes([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchStarted) return;
    const t = setTimeout(() => { void fetchRecipes(searchQuery); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchStarted, fetchRecipes]);

  function handleSearchFocus() {
    if (!searchStarted) {
      setSearchStarted(true);
      void fetchRecipes('');
    }
  }

  // ── Save / Swap ────────────────────────────────────────────────────────────

  async function toggleSave(recipe: Recipe) {
    const wasSaved = recipe.isSaved;
    setRecipes((prev) => prev.map((r) => r.id === recipe.id ? { ...r, isSaved: !wasSaved } : r));

    const res = await fetch('/api/recipes/save', {
      method: wasSaved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId: recipe.id }),
    });

    if (!res.ok) {
      setRecipes((prev) => prev.map((r) => r.id === recipe.id ? { ...r, isSaved: wasSaved } : r));
      toast('Sign in to save recipes.');
    } else {
      toast(wasSaved ? 'Recipe removed.' : 'Recipe saved!');
    }
  }

  async function handleSwap(recipe: Recipe) {
    const target = recipes.find((r) => r.isSaved && r.id !== recipe.id);
    if (!target) { toast('Save another recipe first, then swap.'); return; }
    setSwapping(recipe.id);
    try {
      await fetch('/api/recipes/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromRecipeId: target.id, toRecipeId: recipe.id }),
      });
      await fetchRecipes(searchQuery);
      toast(`Swapped to ${recipe.title}`);
    } finally {
      setSwapping(null);
    }
  }

  // ── Cart ───────────────────────────────────────────────────────────────────

  async function generateCart() {
    setCartLoading(true);
    setCart(null);
    setPlan(null);
    try {
      const res = await fetch('/api/recipes/cart');
      if (res.status === 401) { toast('Sign in to generate a cart.'); return; }
      const data = await res.json() as CartData;
      if (!data.items?.length) { toast('Save recipes first.'); return; }
      setCart(data);
      setCartOpen(true);
      setPlanOpen(false);
    } finally {
      setCartLoading(false);
    }
  }

  // ── Meal plan ──────────────────────────────────────────────────────────────

  async function generatePlan() {
    setPlanLoading(true);
    setPlan(null);
    setCart(null);
    try {
      const res = await fetch('/api/mealplan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 401) { toast('Sign in to create a plan.'); return; }
      if (res.status === 400) { toast('Save recipes first.'); return; }
      const data = await res.json() as { plan: MealPlan };
      setPlan(data.plan);
      setPlanOpen(true);
      setCartOpen(false);
    } finally {
      setPlanLoading(false);
    }
  }

  // ── AI planner (original — unchanged) ─────────────────────────────────────

  async function pollJob(jobId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to check job status');
      const data = await res.json() as { status: string; result?: unknown; error?: string };
      if (data.status === 'completed') {
        sessionStorage.setItem('ag_flow', JSON.stringify(data.result));
        router.push('/meals');
        return;
      }
      if (data.status === 'failed') throw new Error(data.error ?? 'Planning failed. Please try again.');
      if (data.status === 'running') setStatusText('Preparing your meals');
    }
    throw new Error('Request timed out. Please try again.');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setStatusText('');
    if (!input.trim() || !zip.trim()) { setError('Please describe your needs and enter your ZIP code.'); return; }
    if (!/^\d{5}$/.test(zip)) { setError('ZIP code must be exactly 5 digits.'); return; }
    setLoading(true);
    setStatusText('Preparing your plan');
    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), zipCode: zip.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Something went wrong');
      }
      const { jobId } = await res.json() as { jobId: string };
      setStatusText('Analyzing your request');
      await pollJob(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed. Try again.');
    } finally {
      setLoading(false);
      setStatusText('');
    }
  }

  const savedCount = recipes.filter((r) => r.isSaved).length;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-lg transition-opacity"
          style={{ background: 'var(--color-primary)' }}
        >
          {toastMsg}
        </div>
      )}

      {/* ── Brand header ──────────────────────────────────────────────────── */}
      <div className="pt-2">
        <p className="text-xs font-medium tracking-widest uppercase mb-3" style={{ color: 'var(--color-accent)' }}>
          Huxxly
        </p>
        <h1 className="text-3xl font-medium leading-tight tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
          What does your family need this week?
        </h1>
        <p className="mt-2 text-sm font-light leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Search recipes or describe your needs below.
        </p>
      </div>

      {/* ── Recipe search bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className="w-full rounded-xl pl-10 pr-4 py-3.5 text-sm font-light outline-none transition-all duration-150"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1.5px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
            placeholder={hint}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleSearchFocus}
          />
        </div>

        {/* Action bar — shown once user has saved recipes */}
        {savedCount > 0 && (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3 gap-3"
            style={{ background: 'var(--color-primary-light)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--color-primary-pressed)' }}>
              {savedCount} recipe{savedCount !== 1 ? 's' : ''} saved
            </span>
            <div className="flex gap-2">
              <button
                onClick={generateCart}
                disabled={cartLoading}
                className="text-xs font-medium rounded-lg px-3 py-1.5 transition-colors duration-150"
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  opacity: cartLoading ? 0.55 : 1,
                }}
              >
                {cartLoading ? 'Building…' : 'Grocery Cart'}
              </button>
              <button
                onClick={generatePlan}
                disabled={planLoading}
                className="text-xs font-medium rounded-lg px-3 py-1.5 transition-colors duration-150"
                style={{
                  background: '#fff',
                  color: 'var(--color-primary-pressed)',
                  border: '1px solid var(--color-primary)',
                  opacity: planLoading ? 0.55 : 1,
                }}
              >
                {planLoading ? 'Planning…' : 'Meal Plan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cart result panel ─────────────────────────────────────────────── */}
      {cartOpen && cart && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Grocery Cart · {cart.recipeCount} recipes · ${cart.totalCost.toFixed(2)} est.
            </p>
            <button
              onClick={() => setCartOpen(false)}
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {cart.items.map((item, i) => (
              <li key={i} className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span>{item.name}</span>
                <span className="font-medium" style={{ color: 'var(--color-primary)' }}>
                  ${item.estimatedCost.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Meal plan result panel ────────────────────────────────────────── */}
      {planOpen && plan && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {plan.name}
            </p>
            <button
              onClick={() => setPlanOpen(false)}
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {plan.items.map((item) => (
              <li key={item.day} className="flex items-baseline gap-2 text-xs">
                <span className="font-medium w-24 shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                  {item.day}
                </span>
                <span className="flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.recipe.name}
                </span>
                <span className="font-medium" style={{ color: 'var(--color-primary)' }}>
                  ${item.recipe.price.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recipe results ────────────────────────────────────────────────── */}
      {searchStarted && (
        <div className="flex flex-col gap-3">
          {searchLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-5 w-5" style={{ color: 'var(--color-text-muted)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No results — try{' '}
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  &ldquo;family dinner under $80&rdquo;
                </span>
              </p>
            </div>
          ) : (
            recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                swapping={swapping === recipe.id}
                onSave={() => toggleSave(recipe)}
                onSwap={() => handleSwap(recipe)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--color-border-light)' }} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>or let AI plan for you</span>
        <div className="flex-1 h-px" style={{ background: 'var(--color-border-light)' }} />
      </div>

      {/* ── AI planner form (existing — logic unchanged) ──────────────────── */}
      <div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g. "Feed my family of 4 for $120, kid-friendly, no nuts"'
            rows={3}
            maxLength={500}
            className="w-full rounded-xl px-4 py-3 text-sm font-light resize-none outline-none transition-colors duration-150"
            style={{
              border: '1.5px solid var(--color-border-light)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-light)')}
          />

          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="ZIP code"
            maxLength={5}
            className="w-full rounded-xl px-4 py-3 text-sm font-light outline-none transition-colors duration-150"
            style={{
              border: '1.5px solid var(--color-border-light)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-light)')}
          />

          {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-6 py-4 text-white font-medium text-sm transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: loading ? 'var(--color-primary)' : 'var(--color-primary)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--color-primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
            onMouseDown={(e) => (e.currentTarget.style.background = 'var(--color-primary-pressed)')}
            onMouseUp={(e) => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="font-light">{statusText || Microcopy.processing}</span>
              </span>
            ) : (
              Microcopy.orderNow
            )}
          </button>
        </form>
      </div>

      <SavingsBanner />

      <p className="text-xs text-center font-light" style={{ color: 'var(--color-border-strong)' }}>
        Powered by Claude · Instacart · Kroger · Walmart
      </p>
    </div>
  );
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecipeCard({
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
            {(recipe.displayServings ?? recipe.servings)
              ? ` · Serves ${recipe.displayServings ?? recipe.servings}`
              : ''}
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-primary)' }}>
            ${(recipe.adjustedPrice ?? recipe.price).toFixed(2)}
            {recipe.adjustedPrice !== undefined && recipe.adjustedPrice !== recipe.price && (
              <span className="text-xs font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
                adj.
              </span>
            )}
          </p>
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

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-1">
          {recipe.tags.slice(0, 4).map((tag) => (
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
