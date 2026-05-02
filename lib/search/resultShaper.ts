/**
 * Result shaping engine.
 * Enforces diversity, deduplication, and ranking before results reach the API.
 */
import { resolveImage } from '@/lib/media/imageResolver';

export interface ShapedResult {
  id: string;
  title: string;
  price: number;
  adjustedPrice: number;
  category: string;
  tags: string[];
  imageUrl: string;       // guaranteed non-null after shaping
  servings?: number;
  displayServings?: number;
  score: number;
  source?: 'db' | 'ai' | 'fallback';
  cookTimeMinutes?: number;
  cuisine?: string;
  calories?: number;
  type: 'meal';
  description: string;
}

// ─── Ingredient group config ──────────────────────────────────────────────────

const INGREDIENT_GROUPS: [string, RegExp][] = [
  ['chicken',    /\b(chicken|poultry|hen)\b/i],
  ['beef',       /\b(beef|steak|burger|brisket|mince)\b/i],
  ['pork',       /\b(pork|bacon|ham|sausage|ribs|pulled)\b/i],
  ['seafood',    /\b(salmon|fish|shrimp|prawn|tuna|cod|seafood|mussel|crab|lobster)\b/i],
  ['pasta',      /\b(pasta|spaghetti|fettuccine|linguine|penne|carbonara|bolognese)\b/i],
  ['noodles',    /\b(noodle|ramen|udon|pad thai|pho|lo mein)\b/i],
  ['rice',       /\b(rice|risotto|pilaf|fried rice)\b/i],
  ['lamb',       /\b(lamb|mutton|goat)\b/i],
  ['vegetarian', /\b(tofu|tempeh|seitan|lentil|chickpea)\b/i],
  ['salad',      /\b(salad|slaw|tabbouleh)\b/i],
  ['soup',       /\b(soup|stew|chili|chowder|broth|bisque)\b/i],
  ['pizza',      /\b(pizza|flatbread|calzone)\b/i],
];

const MAX_PER_CUISINE = 2;
const MAX_PER_INGREDIENT_GROUP = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function titlesAreSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  // One is a substring of the other (e.g. "Chicken Curry" vs "Easy Chicken Curry")
  if (na.includes(nb) || nb.includes(na)) return true;
  // Shared word ratio: if >70% of the shorter title's words appear in the longer
  const wa = new Set(na.split(' ').filter((w) => w.length > 3));
  const wb = new Set(nb.split(' ').filter((w) => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return false;
  const shorter = wa.size < wb.size ? wa : wb;
  const longer = wa.size < wb.size ? wb : wa;
  let shared = 0;
  for (const w of shorter) { if (longer.has(w)) shared++; }
  return shared / shorter.size > 0.7;
}

function getIngredientGroup(title: string, tags: string[], category: string): string | null {
  const text = `${title} ${tags.join(' ')} ${category}`;
  for (const [group, rx] of INGREDIENT_GROUPS) {
    if (rx.test(text)) return group;
  }
  return null;
}

// ─── Main shaper ──────────────────────────────────────────────────────────────

export function shapeResults<T extends {
  id: string;
  title: string;
  price: number;
  adjustedPrice: number;
  category: string;
  tags: string[];
  imageUrl?: string;
  servings?: number;
  displayServings?: number;
  score: number;
  source?: 'db' | 'ai' | 'fallback';
  cookTimeMinutes?: number;
  cuisine?: string;
  calories?: number;
  type: 'meal';
  description: string;
}>(results: T[], limit: number): (T & { imageUrl: string })[] {
  // Step 1: Resolve images so no result can have a null image
  const withImages = results.map((r) => ({
    ...r,
    imageUrl: resolveImage({
      imageUrl: r.imageUrl,
      tags: r.tags,
      category: r.category,
      cuisine: r.cuisine,
      title: r.title,
    }),
  }));

  // Step 2: Deduplicate by title similarity
  const deduped: (T & { imageUrl: string })[] = [];
  for (const r of withImages) {
    const isDupe = deduped.some((kept) => titlesAreSimilar(kept.title, r.title));
    if (!isDupe) deduped.push(r);
  }

  // Step 3: Sort by score DESC before diversity pass (so we keep higher-scored items)
  deduped.sort((a, b) => b.score - a.score || a.adjustedPrice - b.adjustedPrice);

  // Step 4: Diversity pass — enforce cuisine + ingredient group caps
  const cuisineCounts: Record<string, number> = {};
  const groupCounts: Record<string, number> = {};
  const shaped: (T & { imageUrl: string })[] = [];

  for (const r of deduped) {
    if (shaped.length >= limit) break;

    const cuisine = (r.cuisine ?? r.category ?? 'other').toLowerCase();
    const group = getIngredientGroup(r.title, r.tags, r.category);

    // Apply diversity caps — prefer enforcing when we have plenty of results
    if (deduped.length > limit) {
      if ((cuisineCounts[cuisine] ?? 0) >= MAX_PER_CUISINE) continue;
      if (group && (groupCounts[group] ?? 0) >= MAX_PER_INGREDIENT_GROUP) continue;
    }

    cuisineCounts[cuisine] = (cuisineCounts[cuisine] ?? 0) + 1;
    if (group) groupCounts[group] = (groupCounts[group] ?? 0) + 1;

    shaped.push(r);
  }

  // Step 5: If diversity pass left us short, fill from deduped overflow (no caps)
  if (shaped.length < limit) {
    const shapedIds = new Set(shaped.map((r) => r.id));
    for (const r of deduped) {
      if (shaped.length >= limit) break;
      if (!shapedIds.has(r.id)) shaped.push(r);
    }
  }

  return shaped;
}
