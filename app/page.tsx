'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { SavingsBanner } from '@/components/analytics/SavingsBanner';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import type { RecipeViewModel } from '@/lib/view-models/recipeViewModel';
import { DietaryFilterBar } from '@/components/recipes/DietaryFilterBar';
import { type SearchState } from '@/lib/state/searchStateMachine';
import { type CartState, cartTransition } from '@/lib/state/cartStateMachine';
import { type DietaryTag, buildDietaryQuery } from '@/lib/domains/dietary';
import { SERVING_OPTIONS, type ServingCount } from '@/lib/domains/servings';

interface CartData {
  items: { name: string; estimatedCost: number }[];
  totalCost: number;
  recipeCount: number;
  // Multi-store fields (present when zipCode + storeId params are sent)
  storeId?: string;
  storeName?: string;
  stores?: {
    storeId: string;
    storeName: string;
    priceMultiplier: number;
    items: { name: string; adjustedCost: number }[];
    totalCost: number;
  }[];
}

interface StoreOption {
  id: string;
  name: string;
  type: string;
  address: string;
  priceMultiplier: number;
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

const SEARCH_HINTS = [
  'Find meals for 5 people under $100',
  'High protein meals under $50',
  'Family dinner for 4, kid-friendly',
  'Quick weeknight meals under $30',
];

const CATEGORY_SHORTCUTS = [
  { label: 'Chicken', emoji: '🍗', query: 'chicken' },
  { label: 'Pasta',   emoji: '🍝', query: 'pasta' },
  { label: 'Beef',    emoji: '🥩', query: 'beef' },
  { label: 'Seafood', emoji: '🦐', query: 'seafood' },
  { label: 'Vegan',   emoji: '🥗', query: 'vegan' },
  { label: 'Breakfast', emoji: '🍳', query: 'breakfast' },
];

// ─── Backend-provided search meta ────────────────────────────────────────────

interface SearchMeta {
  servings: number | null;
  budgetTotal: number | null;
  estimatedTotal: number;
  isServingQuery: boolean;
  isBudgeted: boolean;
  dietTags: string[];
  intentFlags: string[];
  dbCount?: number;
  aiCount?: number;
  fallbackUsed?: boolean;
  totalCount?: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // Recipe search state
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState<RecipeViewModel[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('IDLE');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selectedDiets, setSelectedDiets] = useState<DietaryTag[]>([]);
  const [globalServings, setGlobalServings] = useState<ServingCount | null>(null);

  // Trending recipes — loaded on mount, shown in hero before first interaction
  const [trending, setTrending] = useState<RecipeViewModel[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Cart + meal plan state
  const [cart, setCart] = useState<CartData | null>(null);
  const [cartState, setCartState] = useState<CartState>('IDLE');
  const [cartOpen, setCartOpen] = useState(false);

  // Multi-store state
  const [cartZipInput, setCartZipInput] = useState('');
  const [cartZip, setCartZip] = useState('');
  const [availableStores, setAvailableStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [storesLoading, setStoresLoading] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  // Toast + swap
  const [toastMsg, setToastMsg] = useState('');
  const [swapping, setSwapping] = useState<string | null>(null);

  // Meta provided by the backend — single source of truth for intent
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);

  const hintRef = useRef(0);
  const [hint, setHint] = useState(SEARCH_HINTS[0]);

  useEffect(() => {
    const id = setInterval(() => {
      hintRef.current = (hintRef.current + 1) % SEARCH_HINTS.length;
      setHint(SEARCH_HINTS[hintRef.current]);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // Load trending on mount (empty query returns top results by createdAt)
  useEffect(() => {
    let cancelled = false;
    setTrendingLoading(true);
    fetch('/api/recipes?q=&limit=6')
      .then((r) => r.json())
      .then((data: { recipes: RecipeViewModel[] }) => {
        if (!cancelled) setTrending(data.recipes ?? []);
      })
      .catch(() => { /* silently fail — trending is optional */ })
      .finally(() => { if (!cancelled) setTrendingLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }, []);

  // ── Recipe search ──────────────────────────────────────────────────────────

  const fetchRecipes = useCallback(async (q: string, diets?: DietaryTag[]) => {
    setSearchState('LOADING');
    const effectiveQuery = buildDietaryQuery(q, diets ?? selectedDiets);
    try {
      const servingsParam = globalServings ? `&servings=${globalServings}` : '';
      const res = await fetch(`/api/recipes?q=${encodeURIComponent(effectiveQuery)}&limit=20${servingsParam}`);
      if (!res.ok) { setRecipes([]); setSearchMeta(null); setSearchState('ERROR'); return; }
      const data = await res.json() as { recipes: RecipeViewModel[]; meta: SearchMeta | null };
      console.log('[INTENT]', data.meta);
      console.log('[SEARCH_META]', { ...data.meta, resultsCount: (data.recipes ?? []).length });
      const fetched = data.recipes ?? [];
      setRecipes(fetched);
      setSearchMeta(data.meta ?? null);
      setSearchState(fetched.length > 0 ? 'SUCCESS' : 'EMPTY');
    } catch {
      setRecipes([]);
      setSearchMeta(null);
      setSearchState('ERROR');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiets, globalServings]);

  // Restore persisted store state from sessionStorage on mount
  useEffect(() => {
    try {
      const zip = sessionStorage.getItem('cartZip') ?? '';
      const storeId = sessionStorage.getItem('selectedStoreId') ?? '';
      const stores = sessionStorage.getItem('availableStores');
      if (zip) { setCartZip(zip); setCartZipInput(zip); }
      if (storeId) setSelectedStoreId(storeId);
      if (stores) setAvailableStores(JSON.parse(stores) as StoreOption[]);
    } catch { /* sessionStorage unavailable — silently skip */ }
  }, []);

  // Persist store state to sessionStorage whenever it changes
  useEffect(() => {
    try { sessionStorage.setItem('cartZip', cartZip); } catch { /* ignore */ }
  }, [cartZip]);
  useEffect(() => {
    try { sessionStorage.setItem('selectedStoreId', selectedStoreId); } catch { /* ignore */ }
  }, [selectedStoreId]);
  useEffect(() => {
    try { sessionStorage.setItem('availableStores', JSON.stringify(availableStores)); } catch { /* ignore */ }
  }, [availableStores]);

  // Clear stale results and transition to LOADING immediately when query or diets change
  useEffect(() => {
    if (!hasInteracted) return;
    setRecipes([]);
    setSearchMeta(null);
    setSearchState('LOADING');
  }, [searchQuery, selectedDiets, hasInteracted]);

  useEffect(() => {
    if (!hasInteracted) return;
    const t = setTimeout(() => { void fetchRecipes(searchQuery); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, selectedDiets, hasInteracted, fetchRecipes]);

  // ── Category shortcut ──────────────────────────────────────────────────────

  function handleCategoryShortcut(query: string) {
    setSearchQuery(query);
    setHasInteracted(true);
    void fetchRecipes(query);
  }

  // ── Dietary + servings ─────────────────────────────────────────────────────

  function toggleDiet(tag: DietaryTag) {
    setSelectedDiets((prev) =>
      prev.includes(tag) ? prev.filter((d) => d !== tag) : [...prev, tag],
    );
  }

  function handleServingsChange(s: ServingCount) {
    setGlobalServings((prev) => (prev === s ? null : s));
  }

  // ── Save / Swap ────────────────────────────────────────────────────────────

  async function toggleSave(recipe: RecipeViewModel) {
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

  async function handleSwap(recipe: RecipeViewModel) {
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

  // preserveOpen: true when switching stores (avoids panel flash during re-fetch)
  async function generateCart(opts?: { zipCode?: string; storeId?: string; preserveOpen?: boolean }) {
    setCartState(cartTransition(cartState, { type: opts?.preserveOpen ? 'SWITCH_STORE' : 'GENERATE_CART' }));
    if (!opts?.preserveOpen) { setCart(null); setPlan(null); }
    try {
      const params = new URLSearchParams();
      if (opts?.zipCode) params.set('zipCode', opts.zipCode);
      if (opts?.storeId) params.set('storeId', opts.storeId);
      const qs = params.toString();
      const res = await fetch(`/api/recipes/cart${qs ? '?' + qs : ''}`);
      if (res.status === 401) { toast('Sign in to generate a cart.'); return; }
      const data = await res.json() as CartData;
      if (!data.items?.length) { toast('Save recipes first.'); return; }
      setCart(data);
      setCartOpen(true);
      setPlanOpen(false);
      setCartState(cartTransition('LOADING', { type: 'CART_LOADED', itemCount: data.items.length }));
    } catch {
      setCartState(cartTransition('LOADING', { type: 'CART_ERROR' }));
    }
  }

  async function fetchStoresForZip(zip: string) {
    if (!/^\d{5}$/.test(zip)) { toast('Enter a valid 5-digit ZIP.'); return; }
    setStoresLoading(true);
    try {
      const res = await fetch(`/api/stores?zip=${zip}`);
      if (!res.ok) return;
      const data = await res.json() as { stores: StoreOption[] };
      setAvailableStores(data.stores);
      setCartZip(zip);
      if (data.stores.length > 0) {
        const first = data.stores[0].id;
        setSelectedStoreId(first);
        // Re-fetch cart with the first store applied
        void generateCart({ zipCode: zip, storeId: first, preserveOpen: true });
      }
    } finally {
      setStoresLoading(false);
    }
  }

  function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    void generateCart({ zipCode: cartZip, storeId, preserveOpen: true });
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

  // ── Savings intelligence (derived from existing totals — no fake values) ───

  const cartSavings = (() => {
    if (!cart || cart.totalCost <= 0) return null;
    // Budget comparison: user stated a budget and the cart came in under it
    if (searchMeta?.isBudgeted && searchMeta.budgetTotal !== null && searchMeta.budgetTotal > cart.totalCost) {
      const saved = searchMeta.budgetTotal - cart.totalCost;
      const pct = ((saved / searchMeta.budgetTotal) * 100).toFixed(0);
      return { saved, pct, label: 'under your stated budget' };
    }
    // Search-average comparison: compare cart cost to avg search result price × recipeCount
    if (recipes.length > 0 && cart.recipeCount > 0) {
      const avgSearchPrice = recipes.reduce((s, r) => s + r.totalPrice, 0) / recipes.length;
      const stdCost = avgSearchPrice * cart.recipeCount;
      const saved = stdCost - cart.totalCost;
      if (saved > 0.01) {
        const pct = ((saved / stdCost) * 100).toFixed(0);
        return { saved, pct, label: 'vs. average search basket' };
      }
    }
    return null;
  })();

  const savedCount = recipes.filter((r) => r.isSaved).length;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Animations */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .slide-in      { animation: slideDown 200ms ease-out forwards; }
        .skeleton-pulse { animation: skeletonPulse 1.4s ease-in-out infinite; }
      `}</style>

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
          Search recipes, save your favorites, then generate a grocery cart or meal plan.
        </p>
      </div>

      {/* ── Category shortcuts ────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {CATEGORY_SHORTCUTS.map(({ label, emoji, query }) => (
          <button
            key={query}
            onClick={() => handleCategoryShortcut(query)}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-all duration-150"
            style={{
              background: searchQuery === query ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
              color: searchQuery === query ? '#fff' : 'var(--color-text-secondary)',
              border: `1px solid ${searchQuery === query ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
            }}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Recipe search bar (single — connected to fetchRecipes) ────────── */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (!hasInteracted) setHasInteracted(true);
                void fetchRecipes(searchQuery);
              }
            }}
          />
        </div>

        {/* Action bar — appears once user has saved recipes */}
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
                onClick={() => generateCart()}
                disabled={cartState === 'LOADING' || cartState === 'STORE_SWITCHING'}
                className="text-xs font-medium rounded-lg px-3 py-1.5 transition-colors duration-150"
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  opacity: cartState === 'LOADING' || cartState === 'STORE_SWITCHING' ? 0.55 : 1,
                }}
              >
                {cartState === 'LOADING' || cartState === 'STORE_SWITCHING' ? 'Building…' : 'Generate Instant Cart'}
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
                {planLoading ? 'Planning…' : 'Auto-Generate Plan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cart result panel ─────────────────────────────────────────────── */}
      {cartOpen && cart && (
        <div
          key={`${cart.storeId ?? 'default'}-${cart.totalCost}`}
          className="slide-in rounded-xl p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Grocery Cart
              </p>
              {cart.storeName && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-pressed)' }}
                >
                  {cart.storeName}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {cart.recipeCount} recipe{cart.recipeCount !== 1 ? 's' : ''} · ${cart.totalCost.toFixed(2)} est.
              </span>
            </div>
            <button onClick={() => setCartOpen(false)} className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              ✕
            </button>
          </div>

          {/* ── Store switcher ─────────────────────────────────────────────── */}
          <div
            className="rounded-lg p-3 mb-3 flex flex-col gap-2"
            style={{ background: 'var(--color-bg-secondary)' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Compare prices at nearby stores
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="ZIP code"
                value={cartZipInput}
                maxLength={5}
                onChange={(e) => setCartZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onKeyDown={(e) => e.key === 'Enter' && void fetchStoresForZip(cartZipInput)}
                className="flex-1 text-xs rounded-lg px-3 py-1.5 outline-none transition-colors duration-150"
                style={{
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <button
                onClick={() => void fetchStoresForZip(cartZipInput)}
                disabled={storesLoading || cartZipInput.length !== 5}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150"
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  opacity: storesLoading || cartZipInput.length !== 5 ? 0.5 : 1,
                }}
              >
                {storesLoading ? '…' : 'Find'}
              </button>
            </div>

            {/* Store dropdown */}
            {availableStores.length > 0 && (
              <select
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
                disabled={cartState === 'LOADING' || cartState === 'STORE_SWITCHING'}
                className="w-full text-xs rounded-lg px-3 py-1.5 outline-none transition-colors duration-150"
                style={{
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  opacity: cartState === 'LOADING' || cartState === 'STORE_SWITCHING' ? 0.6 : 1,
                }}
              >
                {availableStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} {store.priceMultiplier > 1 ? `(+${Math.round((store.priceMultiplier - 1) * 100)}%)` : '(baseline)'}
                  </option>
                ))}
              </select>
            )}

            {/* Store price comparison strip */}
            {cart.stores && cart.stores.length > 1 && (
              <div className="flex flex-col gap-1 mt-1">
                {cart.stores.map((s) => (
                  <div
                    key={s.storeId}
                    className="flex justify-between items-center text-xs px-2 py-1 rounded-md transition-colors duration-150"
                    style={{
                      background: s.storeId === (cart.storeId ?? selectedStoreId)
                        ? 'var(--color-primary-light)'
                        : 'transparent',
                      color: s.storeId === (cart.storeId ?? selectedStoreId)
                        ? 'var(--color-primary-pressed)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    <span>{s.storeName}</span>
                    <span className="font-medium">${s.totalCost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart items */}
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

          {/* Savings intelligence — only rendered when real savings data exists */}
          {cartSavings && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                You saved ${cartSavings.saved.toFixed(2)} {cartSavings.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                This cart is {cartSavings.pct}% more affordable than standard
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Meal plan result panel ────────────────────────────────────────── */}
      {planOpen && plan && (
        <div
          key={plan.id}
          className="slide-in rounded-xl p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {plan.name}
            </p>
            <button onClick={() => setPlanOpen(false)} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {plan.items.map((item) => (
              <li
                key={item.day}
                className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5"
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                <span
                  className="font-medium shrink-0"
                  style={{ color: 'var(--color-text-primary)', minWidth: '80px' }}
                >
                  {item.day}
                </span>
                <span className="flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.recipe.name}
                </span>
                <span className="font-medium shrink-0" style={{ color: 'var(--color-primary)' }}>
                  ${item.recipe.price.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          {/* Auto-Generate Weekly Plan — re-runs generatePlan() inline */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
            <button
              onClick={generatePlan}
              disabled={planLoading}
              className="w-full text-xs font-medium py-2 rounded-lg transition-colors duration-150"
              style={{
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary-pressed)',
                opacity: planLoading ? 0.55 : 1,
              }}
            >
              {planLoading ? 'Generating…' : 'Auto-Generate Weekly Plan'}
            </button>
          </div>
        </div>
      )}

      {/* ── Trending section — shown before first search interaction ─────── */}
      {!hasInteracted && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            Trending this week
          </p>
          {trendingLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden skeleton-pulse"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-light)',
                    height: '80px',
                  }}
                />
              ))}
            </div>
          ) : trending.length > 0 ? (
            <div className="flex flex-col gap-3">
              {trending.map((recipe) => (
                <Link
                  key={recipe.id}
                  href={`/recipe/${recipe.id}`}
                  className="flex items-center gap-3 rounded-2xl overflow-hidden transition-shadow duration-150"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div
                    className="shrink-0 w-20 h-20 overflow-hidden"
                    style={{ background: 'var(--color-bg-secondary)' }}
                  >
                    <img
                      src={recipe.image}
                      alt={recipe.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 py-3 pr-4">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {recipe.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                        {recipe.cuisine}
                      </span>
                      {recipe.cookTime > 0 && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          · {recipe.cookTime}m
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-primary)' }}>
                      ${recipe.totalPrice.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Dietary filter bar — always visible once user has interacted ─── */}
      <DietaryFilterBar selected={selectedDiets} onToggle={toggleDiet} />

      {/* ── Serving size selector ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>Serves</span>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {SERVING_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleServingsChange(s)}
              className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-150"
              style={globalServings === s ? {
                background: 'var(--color-primary)',
                color: '#fff',
                border: '1px solid var(--color-primary)',
              } : {
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-light)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search summary strip — rendered after first search interaction ── */}
      {hasInteracted && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1"
          style={{ minHeight: '20px' }}
        >
          {searchState === 'LOADING' ? (
            <span className="text-xs skeleton-pulse" style={{ color: 'var(--color-text-muted)' }}>
              Searching…
            </span>
          ) : searchMeta ? (
            <>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {recipes.length} result{recipes.length !== 1 ? 's' : ''}
              </span>
              {searchMeta.isServingQuery && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  · Serves {searchMeta.servings}
                </span>
              )}
              {searchMeta.estimatedTotal > 0 && (
                <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                  Est. total ${searchMeta.estimatedTotal.toFixed(2)}
                </span>
              )}
              {searchMeta.isBudgeted && searchMeta.budgetTotal !== null && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  · Budget ${searchMeta.budgetTotal.toFixed(2)}
                </span>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── Recipe results ────────────────────────────────────────────────── */}
      {hasInteracted && (
        <div className="flex flex-col gap-3">
          {searchState === 'LOADING' ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-5 w-5" style={{ color: 'var(--color-text-muted)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : searchState === 'EMPTY' ? (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No matching results found
              </p>
            </div>
          ) : searchState === 'ERROR' ? (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Search unavailable — please try again
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

      <SavingsBanner />

      <p className="text-xs text-center font-light" style={{ color: 'var(--color-border-strong)' }}>
        Powered by Claude · Instacart · Kroger · Walmart
      </p>
    </div>
  );
}

