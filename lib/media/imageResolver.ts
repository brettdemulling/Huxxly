/**
 * Guaranteed image resolution.
 * Every recipe must have a non-null image — this module enforces that contract.
 * Resolution order: DB image → ingredient match → cuisine match → category match → brand placeholder
 */

const INGREDIENT_IMAGES: Record<string, string> = {
  chicken:    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&w=480&h=200&fit=crop&q=80',
  beef:       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&w=480&h=200&fit=crop&q=80',
  steak:      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&w=480&h=200&fit=crop&q=80',
  pork:       'https://images.unsplash.com/photo-1544025162-d76538dc82e9?auto=format&w=480&h=200&fit=crop&q=80',
  bacon:      'https://images.unsplash.com/photo-1544025162-d76538dc82e9?auto=format&w=480&h=200&fit=crop&q=80',
  salmon:     'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&w=480&h=200&fit=crop&q=80',
  fish:       'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&w=480&h=200&fit=crop&q=80',
  shrimp:     'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&w=480&h=200&fit=crop&q=80',
  pasta:      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&w=480&h=200&fit=crop&q=80',
  noodle:     'https://images.unsplash.com/photo-1571167530149-c1105da4c285?auto=format&w=480&h=200&fit=crop&q=80',
  rice:       'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&w=480&h=200&fit=crop&q=80',
  egg:        'https://images.unsplash.com/photo-1525351484163-7529414f2005?auto=format&w=480&h=200&fit=crop&q=80',
  avocado:    'https://images.unsplash.com/photo-1525351484163-7529414f2005?auto=format&w=480&h=200&fit=crop&q=80',
  mushroom:   'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&w=480&h=200&fit=crop&q=80',
  tomato:     'https://images.unsplash.com/photo-1515516969354-50de00cda48c?auto=format&w=480&h=200&fit=crop&q=80',
  lamb:       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&w=480&h=200&fit=crop&q=80',
  tuna:       'https://images.unsplash.com/photo-1584776851497-51438b804e6f?auto=format&w=480&h=200&fit=crop&q=80',
};

const CUISINE_IMAGES: Record<string, string> = {
  italian:      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&w=480&h=200&fit=crop&q=80',
  japanese:     'https://images.unsplash.com/photo-1571167530149-c1105da4c285?auto=format&w=480&h=200&fit=crop&q=80',
  mexican:      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&w=480&h=200&fit=crop&q=80',
  thai:         'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&w=480&h=200&fit=crop&q=80',
  greek:        'https://images.unsplash.com/photo-1515516969354-50de00cda48c?auto=format&w=480&h=200&fit=crop&q=80',
  american:     'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&w=480&h=200&fit=crop&q=80',
  chinese:      'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&w=480&h=200&fit=crop&q=80',
  indian:       'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&w=480&h=200&fit=crop&q=80',
  mediterranean:'https://images.unsplash.com/photo-1515516969354-50de00cda48c?auto=format&w=480&h=200&fit=crop&q=80',
  french:       'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&w=480&h=200&fit=crop&q=80',
  hawaiian:     'https://images.unsplash.com/photo-1584776851497-51438b804e6f?auto=format&w=480&h=200&fit=crop&q=80',
};

const CATEGORY_IMAGES: Record<string, string> = {
  chicken:    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&w=480&h=200&fit=crop&q=80',
  beef:       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&w=480&h=200&fit=crop&q=80',
  pork:       'https://images.unsplash.com/photo-1544025162-d76538dc82e9?auto=format&w=480&h=200&fit=crop&q=80',
  seafood:    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&w=480&h=200&fit=crop&q=80',
  pasta:      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&w=480&h=200&fit=crop&q=80',
  soup:       'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&w=480&h=200&fit=crop&q=80',
  salad:      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&w=480&h=200&fit=crop&q=80',
  breakfast:  'https://images.unsplash.com/photo-1525351484163-7529414f2005?auto=format&w=480&h=200&fit=crop&q=80',
  dessert:    'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&w=480&h=200&fit=crop&q=80',
  asian:      'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&w=480&h=200&fit=crop&q=80',
  italian:    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&w=480&h=200&fit=crop&q=80',
  japanese:   'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&w=480&h=200&fit=crop&q=80',
  mexican:    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&w=480&h=200&fit=crop&q=80',
  bbq:        'https://images.unsplash.com/photo-1544025162-d76538dc82e9?auto=format&w=480&h=200&fit=crop&q=80',
  american:   'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&w=480&h=200&fit=crop&q=80',
  hawaiian:   'https://images.unsplash.com/photo-1584776851497-51438b804e6f?auto=format&w=480&h=200&fit=crop&q=80',
  pizza:      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&w=480&h=200&fit=crop&q=80',
  vegan:      'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&w=480&h=200&fit=crop&q=80',
  vegetarian: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&w=480&h=200&fit=crop&q=80',
};

const BRAND_PLACEHOLDER = 'https://placehold.co/480x200/059669/FFFFFF?text=Recipe';

interface ImageResolveParams {
  imageUrl?: string | null;
  tags?: string[];
  category?: string | null;
  cuisine?: string | null;
  title?: string;
}

export function resolveImage(params: ImageResolveParams): string {
  // 1. Use existing image if present
  if (params.imageUrl) return params.imageUrl;

  const title = (params.title ?? '').toLowerCase();
  const category = (params.category ?? '').toLowerCase();
  const cuisine = (params.cuisine ?? '').toLowerCase();
  const tags = (params.tags ?? []).map((t) => t.toLowerCase());
  const fullText = `${title} ${category} ${tags.join(' ')}`;

  // 2. Match by ingredient keywords in title/tags
  for (const [ingredient, url] of Object.entries(INGREDIENT_IMAGES)) {
    if (fullText.includes(ingredient)) return url;
  }

  // 3. Match by cuisine
  for (const [cuis, url] of Object.entries(CUISINE_IMAGES)) {
    if (cuisine.includes(cuis) || fullText.includes(cuis)) return url;
  }

  // 4. Match by category
  for (const [cat, url] of Object.entries(CATEGORY_IMAGES)) {
    if (category.includes(cat)) return url;
  }

  // 5. Brand placeholder — never null
  return BRAND_PLACEHOLDER;
}
