/**
 * Ranking engine — scores search results against a query context.
 * Scores: +10 title match, +7 ingredient match, +6 category match,
 *         +5 dietary match, +3 tag match.
 */

export interface RankContext {
  tokens: string[];     // query terms, normalized lowercase, length ≥ 3
  dietTags: string[];   // dietary filter requirements
  ingredients: string[]; // known ingredient tokens extracted from query
}

export interface Rankable {
  title: string;
  category: string;
  tags: string[];
  score: number;
}

export function scoreResult(r: Rankable, ctx: RankContext): number {
  const title = r.title.toLowerCase();
  const category = r.category.toLowerCase();
  const tags = r.tags.map((t) => t.toLowerCase());

  let score = 0;

  for (const token of ctx.tokens) {
    if (token.length < 3) continue;
    if (title.includes(token))    score += 10; // Title match: highest signal
    if (category.includes(token)) score += 6;  // Category match
    if (tags.some((t) => t.includes(token))) score += 3; // Tag match
  }

  // Ingredient match (query tokens that are known ingredients): +7
  for (const ing of ctx.ingredients) {
    const text = `${title} ${category} ${tags.join(' ')}`;
    if (text.includes(ing)) score += 7;
  }

  // Dietary match: +5 per matching dietary tag
  for (const diet of ctx.dietTags) {
    const slug = diet.replace(/-/g, '');
    if (tags.some((t) => t === diet || t.replace(/-/g, '') === slug)) score += 5;
    if (title.includes(diet.replace('-', ' '))) score += 2;
  }

  return score;
}

export function rankResults<T extends Rankable>(
  results: T[],
  ctx: RankContext,
): T[] {
  return results
    .map((r) => ({ ...r, score: scoreResult(r, ctx) }))
    .sort((a, b) => b.score - a.score);
}
