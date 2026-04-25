import { z } from 'zod';
import { sanitizeAiOutput } from '@/lib/security/sanitize';

export type PromptName = 'intent_parse' | 'meal_generation';
export type PromptVersion = `v${number}`;

interface PromptDefinition {
  version: PromptVersion;
  model: string;
  maxTokens: number;
  system?: string;
  template: (vars: Record<string, unknown>) => string;
  responseSchema: z.ZodTypeAny;
  deprecated?: boolean;
}

// ─── Prompt Definitions ───────────────────────────────────────────────────────

const INTENT_PARSE_V1: PromptDefinition = {
  version: 'v1',
  model: 'claude-sonnet-4-6',
  maxTokens: 512,
  system: `You extract structured meal planning intent from user input. Return ONLY valid JSON matching this exact shape:
{
  "budgetCents": number,
  "servings": number,
  "mealCount": number,
  "dietaryFlags": string[]
}
dietaryFlags values: gluten_free, dairy_free, vegetarian, vegan, nut_free, low_sodium, kid_friendly, halal, kosher`,
  template: ({ input }: Record<string, unknown>) => String(input),
  responseSchema: z.object({
    budgetCents: z.number().positive().default(12000),
    servings: z.number().positive().default(4),
    mealCount: z.number().positive().default(5),
    dietaryFlags: z.array(z.string()).default([]),
  }),
};

const MEAL_GENERATION_V1: PromptDefinition = {
  version: 'v1',
  model: 'claude-sonnet-4-6',
  maxTokens: 4096,
  template: ({ mealCount, budgetCents, servings, dietaryFlags, zipCode, memoryContext }: Record<string, unknown>) =>
    `Generate exactly ${mealCount} family meals for a weekly meal plan.

Budget: $${(Number(budgetCents) / 100).toFixed(2)}
Servings per meal: ${servings}
Dietary requirements: ${String(dietaryFlags) || 'none'}
ZIP: ${zipCode}

${memoryContext ? `Household history:\n${memoryContext}` : ''}

Rules:
- Reuse ingredients across meals to reduce waste and cost
- Keep ingredient list concrete and shoppable
- Estimate realistic grocery store prices
- Return ONLY valid JSON array, no markdown

Return a JSON array of ${mealCount} meals with this shape:
[{
  "name": string,
  "description": string,
  "servings": number,
  "prepTimeMinutes": number,
  "cookTimeMinutes": number,
  "dietaryFlags": string[],
  "estimatedCostCents": number,
  "ingredients": [{
    "name": string,
    "category": string,
    "quantity": number,
    "unit": string,
    "estimatedCostCents": number,
    "substitutes": string[]
  }]
}]`,
  responseSchema: z.array(z.object({
    name: z.string(),
    description: z.string().default(''),
    servings: z.number().positive(),
    prepTimeMinutes: z.number().nonnegative(),
    cookTimeMinutes: z.number().nonnegative(),
    dietaryFlags: z.array(z.string()).default([]),
    estimatedCostCents: z.number().nonnegative(),
    ingredients: z.array(z.object({
      name: z.string(),
      category: z.string().default('other'),
      quantity: z.number().positive(),
      unit: z.string(),
      estimatedCostCents: z.number().nonnegative(),
      substitutes: z.array(z.string()).default([]),
    })).default([]),
  })),
};

// Registry: name → version → definition
const REGISTRY: Record<PromptName, Record<string, PromptDefinition>> = {
  intent_parse: { v1: INTENT_PARSE_V1 },
  meal_generation: { v1: MEAL_GENERATION_V1 },
};

// Active versions per prompt — change to roll back
const ACTIVE_VERSIONS: Record<PromptName, PromptVersion> = {
  intent_parse: 'v1',
  meal_generation: 'v1',
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPrompt(name: PromptName, version?: PromptVersion): PromptDefinition {
  const v = version ?? ACTIVE_VERSIONS[name];
  const prompt = REGISTRY[name]?.[v];
  if (!prompt) throw new Error(`Prompt not found: ${name}@${v}`);
  if (prompt.deprecated) {
    console.warn(`[promptRegistry] ${name}@${v} is deprecated — consider upgrading`);
  }
  return prompt;
}

export function getActiveVersion(name: PromptName): PromptVersion {
  return ACTIVE_VERSIONS[name];
}

/** Builds the user message from the prompt template */
export function buildPromptMessage(name: PromptName, vars: Record<string, unknown>, version?: PromptVersion): string {
  const prompt = getPrompt(name, version);
  return prompt.template(vars);
}

/**
 * Validates and parses an AI response against the prompt's schema.
 * Returns parsed data or a fallback if validation fails.
 */
export function validateResponse<T>(
  name: PromptName,
  rawText: string,
  fallback: T,
  version?: PromptVersion,
): T {
  const prompt = getPrompt(name, version);
  const sanitized = sanitizeAiOutput(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch {
    console.warn(`[promptRegistry] Failed to parse JSON for ${name}@${version ?? ACTIVE_VERSIONS[name]}`);
    return fallback;
  }

  const result = prompt.responseSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[promptRegistry] Schema validation failed for ${name}:`,
      result.error.issues.map((i) => i.message).join('; '),
    );
    return fallback;
  }

  return result.data as T;
}

/** Returns the model and maxTokens for building API call params */
export function getCallParams(name: PromptName, version?: PromptVersion) {
  const { model, maxTokens, system } = getPrompt(name, version);
  return { model, maxTokens, system };
}

/** Rollback: set active version (call from admin route or env override) */
export function setActiveVersion(name: PromptName, version: PromptVersion): void {
  if (!REGISTRY[name]?.[version]) throw new Error(`Version ${version} not found for ${name}`);
  ACTIVE_VERSIONS[name] = version;
  console.log(`[promptRegistry] ${name} active version set to ${version}`);
}
