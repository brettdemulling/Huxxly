// ─── Dietary Types ────────────────────────────────────────────────────────────
// NEVER expose medical language in UI. Use preference/alignment terminology.

export enum DietaryType {
  ALLERGY = 'ALLERGY',         // NEVER VIOLATE
  AUTOIMMUNE = 'AUTOIMMUNE',   // NEVER VIOLATE
  INTOLERANCE = 'INTOLERANCE', // avoid if possible
  OPTIMIZATION = 'OPTIMIZATION', // best effort
}

// Priority: ALLERGY > AUTOIMMUNE > INTOLERANCE > OPTIMIZATION
export const DIETARY_PRIORITY: Record<DietaryType, number> = {
  [DietaryType.ALLERGY]: 4,
  [DietaryType.AUTOIMMUNE]: 3,
  [DietaryType.INTOLERANCE]: 2,
  [DietaryType.OPTIMIZATION]: 1,
};

export type Allergen =
  | 'peanut'
  | 'tree_nut'
  | 'dairy'
  | 'egg'
  | 'soy'
  | 'wheat'
  | 'fish'
  | 'shellfish'
  | 'sesame'
  | 'gluten';

export type AutoimmuneProfile =
  | 'celiac_safe'
  | 'crohns_safe'
  | 'lupus_safe'
  | 'hashimotos_safe'
  | 'ibs_safe';

export type Intolerance =
  | 'gluten'
  | 'lactose'
  | 'fodmap'
  | 'histamine'
  | 'fructose'
  | 'nightshade';

export type Optimization =
  | 'low_sodium'
  | 'heart_healthy'
  | 'diabetic_friendly'
  | 'keto'
  | 'paleo'
  | 'low_carb'
  | 'high_protein';

export interface DietaryConstraint {
  type: DietaryType;
  value: Allergen | AutoimmuneProfile | Intolerance | Optimization;
  label: string;
}

export interface DietaryProfile {
  constraints: DietaryConstraint[];
}

export interface DietaryComplianceOutput {
  dietaryComplianceScore: number; // 0–1
  violationsPrevented: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface DietaryResult {
  approvedItems: string[];     // product IDs that passed
  removedItems: string[];      // product IDs removed (protected_removal)
  substitutions: Record<string, string>; // productId → substitute productId
  partialCartOnly: boolean;    // true when ALLERGY/AUTOIMMUNE conflict found
  compliance: DietaryComplianceOutput;
  messages: string[];          // preference-language messages for UI
}

// Allergen keyword map — used for name-based heuristic detection
export const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  peanut:    ['peanut', 'peanuts', 'groundnut'],
  tree_nut:  ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut'],
  dairy:     ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'lactose'],
  egg:       ['egg', 'eggs', 'mayonnaise', 'mayo'],
  soy:       ['soy', 'soya', 'tofu', 'edamame', 'miso', 'tempeh'],
  wheat:     ['wheat', 'bread', 'flour', 'pasta', 'semolina', 'spelt', 'farro', 'bulgur'],
  fish:      ['salmon', 'tuna', 'cod', 'tilapia', 'sardine', 'anchovy', 'halibut', 'trout'],
  shellfish: ['shrimp', 'lobster', 'crab', 'clam', 'oyster', 'scallop', 'mussel'],
  sesame:    ['sesame', 'tahini', 'hummus'],
  gluten:    ['gluten', 'wheat', 'barley', 'rye', 'malt', 'triticale'],
};

// Autoimmune protocol — maps to excluded allergen groups
export const AUTOIMMUNE_EXCLUSIONS: Record<AutoimmuneProfile, Allergen[]> = {
  celiac_safe:     ['gluten', 'wheat'],
  crohns_safe:     ['dairy', 'gluten', 'soy'],
  lupus_safe:      ['gluten', 'dairy'],
  hashimotos_safe: ['gluten', 'soy'],
  ibs_safe:        ['gluten', 'dairy'],
};
