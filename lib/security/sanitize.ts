import { z } from 'zod';

const ALLOWED_CHARS = /^[\w\s,.$%-]+$/;
const MAX_INPUT_LENGTH = 500;
const REQUEST_SIZE_LIMIT_BYTES = 50_000;

export function sanitizeUserInput(input: string): string {
  if (input.length > MAX_INPUT_LENGTH) {
    throw new Error(`Input too long (max ${MAX_INPUT_LENGTH} chars)`);
  }
  return input.trim().replace(/[<>"'&;]/g, '').slice(0, MAX_INPUT_LENGTH);
}

export function sanitizeAiOutput(text: string): string {
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

export function validateRequestSize(body: string): boolean {
  return new TextEncoder().encode(body).length <= REQUEST_SIZE_LIMIT_BYTES;
}

export function validateZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

export function validateAndParse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Validation failed: ${issues}`);
  }
  return result.data;
}
