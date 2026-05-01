export const DIETARY_TAGS = [
  { key: 'vegetarian',   label: 'Vegetarian',    emoji: '🥦' },
  { key: 'vegan',        label: 'Vegan',          emoji: '🌱' },
  { key: 'gluten-free',  label: 'Gluten-Free',    emoji: '🌾' },
  { key: 'dairy-free',   label: 'Dairy-Free',     emoji: '🥛' },
  { key: 'keto',         label: 'Keto',           emoji: '🥩' },
  { key: 'paleo',        label: 'Paleo',          emoji: '🦴' },
  { key: 'low-carb',     label: 'Low-Carb',       emoji: '🥗' },
  { key: 'nut-free',     label: 'Nut-Free',       emoji: '🥜' },
  { key: 'high-protein', label: 'High-Protein',   emoji: '💪' },
  { key: 'kid-friendly', label: 'Kid-Friendly',   emoji: '👶' },
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number]['key'];

export const DIETARY_LABEL: Record<DietaryTag, string> = Object.fromEntries(
  DIETARY_TAGS.map((t) => [t.key, t.label]),
) as Record<DietaryTag, string>;

export const DIETARY_EMOJI: Record<DietaryTag, string> = Object.fromEntries(
  DIETARY_TAGS.map((t) => [t.key, t.emoji]),
) as Record<DietaryTag, string>;

export function matchesDietaryFilter(recipeTags: string[], filters: DietaryTag[]): boolean {
  if (filters.length === 0) return true;
  const lower = recipeTags.map((t) => t.toLowerCase());
  return filters.every((f) => lower.some((t) => t.includes(f)));
}

export function buildDietaryQuery(baseQuery: string, filters: DietaryTag[]): string {
  if (filters.length === 0) return baseQuery;
  const tagString = filters.join(', ');
  return baseQuery ? `${baseQuery}, ${tagString}` : tagString;
}
