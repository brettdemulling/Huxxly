'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SavingsBanner } from '@/components/analytics/SavingsBanner';

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

const PLACEHOLDER = (name: string) =>
  `https://placehold.co/400x300/F8FAFC/CBD5E1?text=${encodeURIComponent(name.slice(0, 2))}`;

const SEARCH_HINTS = [
  'Find meals for 5 people under $100',
  'High protein meals under $50',
  'Family dinner for 4, kid-friendly',
  'Quick weeknight meals under $30',
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
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // Recipe search state
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStarted, setSearchStarted] = useState(false);

  // Cart + meal plan state
  const [cart, setCart] = useState<CartData | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
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

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }, []);

  // ── Recipe search ──────────────────────────────────────────────────────────

  const fetchRecipes = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/recipes?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) { setRecipes([]); setSearchMeta(null); return; }
      const data = await res.json() as { recipes: Recipe[]; meta: SearchMeta | null };
      console.log('[INTENT]', data.meta);
      console.log('[SEARCH_META]', { ...data.meta, resultsCount: (data.recipes ?? []).length });
      setRecipes(data.recipes ?? []);
      setSearchMeta(data.meta ?? null);
    } catch {
      setRecipes([]);
      setSearchMeta(null);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Clear stale results and meta immediately when query changes so old cards don't show during debounce
  useEffect(() => {
    if (!searchStarted) return;
    setRecipes([]);
    setSearchMeta(null);
  }, [searchQuery, searchStarted]);

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

  // preserveOpen: true when switching stores (avoids panel flash during re-fetch)
  async function generateCart(opts?: { zipCode?: string; storeId?: string; preserveOpen?: boolean }) {
    setCartLoading(true);
    if (!opts?.preserveOpen) {
      setCart(null);
      setPlan(null);
    }
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
    } finally {
      setCartLoading(false);
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
      const avgSearchPrice = recipes.reduce((s, r) => s + (r.adjustedPrice ?? r.price), 0) / recipes.length;
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
            onFocus={handleSearchFocus}
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
                disabled={cartLoading}
                className="text-xs font-medium rounded-lg px-3 py-1.5 transition-colors duration-150"
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  opacity: cartLoading ? 0.55 : 1,
                }}
              >
                {cartLoading ? 'Building…' : 'Generate Instant Cart'}
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
                disabled={cartLoading}
                className="w-full text-xs rounded-lg px-3 py-1.5 outline-none transition-colors duration-150"
                style={{
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  opacity: cartLoading ? 0.6 : 1,
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

      {/* ── Search summary strip — always rendered once searchStarted ─────── */}
      {searchStarted && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1"
          style={{ minHeight: '20px' }}
        >
          {(searchLoading || !searchMeta) ? (
            <span className="text-xs skeleton-pulse" style={{ color: 'var(--color-text-muted)' }}>
              — servings &nbsp;·&nbsp; calculating budget… &nbsp;·&nbsp; estimating total…
            </span>
          ) : (
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
          )}
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
