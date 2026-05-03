// ─── Core Entities (persistence layer contracts) ──────────────────────────────

export interface RecipeEntity {
  id: string;
  name: string;
  price: number;
  category: string;
  tags: string[];
  imageUrl: string | null;
  servings: number | null;
}

export interface StoreEntity {
  id: string;
  name: string;
  type: 'walmart' | 'kroger' | 'target' | 'local';
  address: string;
  priceMultiplier: number;
}

export interface SavedRecipeEntity {
  id: string;
  userId: string;
  recipeId: string;
  recipe: RecipeEntity;
}

export interface MealPlanEntity {
  id: string;
  name: string;
  userId: string;
  items: MealPlanItemEntity[];
}

export interface MealPlanItemEntity {
  id: string;
  day: string;
  recipe: Pick<RecipeEntity, 'name' | 'price'>;
}

// ─── Search Contracts ─────────────────────────────────────────────────────────

export interface SearchIntent {
  query: string;
  servings?: number;
  budgetTotal?: number;
  dietTags: string[];
  intentFlags: string[];
  ingredients: string[];
}

export interface RecipeSearchResult {
  id: string;
  type: 'meal';
  title: string;
  price: number;
  adjustedPrice: number;
  description: string;
  score: number;
  imageUrl?: string;
  servings?: number;
  displayServings?: number;
  category: string;
  tags: string[];
  source?: 'db' | 'ai' | 'fallback';
}

export interface SearchMeta {
  servings: number | null;
  budgetTotal: number | null;
  estimatedTotal: number;
  isServingQuery: boolean;
  isBudgeted: boolean;
  dietTags: string[];
  intentFlags: string[];
  dbCount: number;
  mealdbCount?: number;
  aiCount: number;
  realApiCount?: number;
  fallbackUsed: boolean;
  totalCount: number;
}

export interface SearchResponse {
  results: RecipeSearchResult[];
  meta: SearchMeta;
}

// ─── Cart Contracts ───────────────────────────────────────────────────────────

export interface CartItem {
  name: string;
  estimatedCost: number;
}

export interface StoreCart {
  storeId: string;
  storeName: string;
  priceMultiplier: number;
  items: { name: string; adjustedCost: number }[];
  totalCost: number;
}

export interface CartResult {
  items: CartItem[];
  totalCost: number;
  recipeCount: number;
  storeId?: string;
  storeName?: string;
  stores?: StoreCart[];
}

// ─── Pricing Contracts ────────────────────────────────────────────────────────

export interface PricedItem {
  name: string;
  basePrice: number;
  adjustedCost: number;
}

export interface SavingsResult {
  saved: number;
  pct: string;
  label: string;
}

// ─── Meal Plan Contracts ──────────────────────────────────────────────────────

export interface MealPlanIntent {
  userId: string;
  servings?: number;
  budgetTotal?: number;
  dietTags?: string[];
  days?: number;
}

export interface MealPlanResult {
  id: string;
  name: string;
  items: Array<{ day: string; recipe: { name: string; price: number } }>;
}

// ─── Provider Contracts ───────────────────────────────────────────────────────

export interface AIGenerationInput {
  query: string;
  intent: Omit<SearchIntent, 'query'>;
  count: number;
}

export interface IStoreProvider {
  getStores(zip: string): Promise<StoreEntity[]>;
  getPricing(items: string[], storeId: string): Promise<Record<string, number>>;
}

export interface IAIProvider {
  generateRecipes(input: AIGenerationInput): Promise<RecipeSearchResult[]>;
}

// ─── Repository Contracts ─────────────────────────────────────────────────────

export interface IRecipeRepository {
  findAll(): Promise<RecipeEntity[]>;
  findById(id: string): Promise<RecipeEntity | null>;
  upsert(recipe: Omit<RecipeEntity, 'createdAt'>): Promise<RecipeEntity>;
}

export interface IStoreRepository {
  findByZip(zip: string): Promise<StoreEntity[]>;
  findById(id: string): Promise<StoreEntity | null>;
}

export interface ICartRepository {
  getSavedRecipes(userId: string): Promise<SavedRecipeEntity[]>;
}

export interface IMealPlanRepository {
  create(plan: Omit<MealPlanEntity, 'id'>): Promise<MealPlanEntity>;
  findLatestByUser(userId: string): Promise<MealPlanEntity | null>;
}

export interface IUserRepository {
  findById(id: string): Promise<{ id: string; email: string } | null>;
}

export interface ISearchAnalyticsRepository {
  record(entry: { query: string; resultCount: number; fallbackUsed: boolean }): Promise<void>;
}

// ─── Telemetry Contracts ──────────────────────────────────────────────────────

export interface SearchDiagnostics {
  query: string;
  dbCount: number;
  aiCount: number;
  fallbackUsed: boolean;
  finalCount: number;
  durationMs: number;
}

export interface PricingDiagnostics {
  storeId: string;
  itemCount: number;
  totalCost: number;
  durationMs: number;
}

export interface CacheEvent {
  key: string;
  hit: boolean;
  layer: 'search' | 'pricing' | 'store' | 'mealPlan';
}
