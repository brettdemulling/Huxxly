// ─── Dietary Engine (Backend Only) ───────────────────────────────────────────
// Enforces dietary constraints against cart items via name-based heuristics.
// Real-world integration: swap detectConflicts() for a product ingredients API.
// NEVER surfaces medical language — all output uses preference terminology.

import type { CartCanonical, CartItem } from '@/lib/core/canonicalModels';
import {
  DietaryType,
  DIETARY_PRIORITY,
  ALLERGEN_KEYWORDS,
  AUTOIMMUNE_EXCLUSIONS,
  type DietaryProfile,
  type DietaryConstraint,
  type DietaryResult,
  type DietaryComplianceOutput,
  type Allergen,
  type AutoimmuneProfile,
} from './dietaryTypes';

// ─── Heuristic conflict detection ────────────────────────────────────────────

function productNameContains(item: CartItem, keywords: string[]): boolean {
  const haystack = `${item.product.name} ${item.product.brand ?? ''}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

function getAllergenKeywords(allergen: Allergen): string[] {
  return ALLERGEN_KEYWORDS[allergen] ?? [];
}

function getAutoimmunKeywords(profile: AutoimmuneProfile): string[] {
  const allergens = AUTOIMMUNE_EXCLUSIONS[profile] ?? [];
  return allergens.flatMap(getAllergenKeywords);
}

function itemConflictsWithConstraint(item: CartItem, constraint: DietaryConstraint): boolean {
  if (constraint.type === DietaryType.ALLERGY) {
    return productNameContains(item, getAllergenKeywords(constraint.value as Allergen));
  }
  if (constraint.type === DietaryType.AUTOIMMUNE) {
    return productNameContains(item, getAutoimmunKeywords(constraint.value as AutoimmuneProfile));
  }
  if (constraint.type === DietaryType.INTOLERANCE) {
    return productNameContains(item, getAllergenKeywords(constraint.value as Allergen));
  }
  return false;
}

// ─── Constraint sorting ───────────────────────────────────────────────────────

function sortedConstraints(constraints: DietaryConstraint[]): DietaryConstraint[] {
  return [...constraints].sort(
    (a, b) => DIETARY_PRIORITY[b.type] - DIETARY_PRIORITY[a.type],
  );
}

// ─── Compliance scoring ───────────────────────────────────────────────────────

function buildCompliance(
  totalItems: number,
  removedCount: number,
  hadHardViolation: boolean,
): DietaryComplianceOutput {
  const violationsPrevented = removedCount;
  const complianceScore = totalItems > 0
    ? parseFloat(((totalItems - removedCount) / totalItems).toFixed(4))
    : 1;
  const riskLevel = hadHardViolation
    ? removedCount > 0 ? 'medium' : 'high'
    : removedCount > 0 ? 'low' : 'none';

  return { dietaryComplianceScore: complianceScore, violationsPrevented, riskLevel };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function applyDietaryConstraints(
  cart: CartCanonical,
  profile: DietaryProfile,
): DietaryResult {
  if (!profile.constraints.length) {
    return {
      approvedItems: cart.items.map((i) => i.product.id),
      removedItems: [],
      substitutions: {},
      partialCartOnly: false,
      compliance: { dietaryComplianceScore: 1, violationsPrevented: 0, riskLevel: 'none' },
      messages: [],
    };
  }

  const constraints = sortedConstraints(profile.constraints);
  const hardConstraints = constraints.filter(
    (c) => c.type === DietaryType.ALLERGY || c.type === DietaryType.AUTOIMMUNE,
  );

  const approved: string[] = [];
  const removed: string[] = [];
  const messages: string[] = [];
  let hadHardViolation = false;

  for (const item of cart.items) {
    let rejected = false;

    for (const constraint of constraints) {
      if (!itemConflictsWithConstraint(item, constraint)) continue;

      if (
        constraint.type === DietaryType.ALLERGY ||
        constraint.type === DietaryType.AUTOIMMUNE
      ) {
        rejected = true;
        hadHardViolation = true;
        removed.push(item.product.id);
        messages.push(`${item.product.name} excluded based on your preferences.`);
        break;
      }

      if (constraint.type === DietaryType.INTOLERANCE) {
        rejected = true;
        removed.push(item.product.id);
        messages.push(`${item.product.name} adjusted based on your preferences.`);
        break;
      }
      // OPTIMIZATION: allow through — just note it
    }

    if (!rejected) approved.push(item.product.id);
  }

  const partialCartOnly = hadHardViolation && hardConstraints.length > 0;

  return {
    approvedItems: approved,
    removedItems: removed,
    substitutions: {},
    partialCartOnly,
    compliance: buildCompliance(cart.items.length, removed.length, hadHardViolation),
    messages,
  };
}

export function computeDietaryCompliance(
  cart: CartCanonical,
  profile: DietaryProfile,
): DietaryComplianceOutput {
  const result = applyDietaryConstraints(cart, profile);
  return result.compliance;
}
