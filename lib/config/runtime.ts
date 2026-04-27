export const runtime = {
  isRedisEnabled: Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  ),
  isAIEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
  isQStashEnabled: Boolean(
    process.env.QSTASH_TOKEN && process.env.NEXT_PUBLIC_APP_URL,
  ),
  isDev: process.env.DEV_SIMULATION === 'true',
} as const;

if (!runtime.isRedisEnabled) {
  console.warn('[runtime] Redis disabled (production fallback mode): UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set.');
}
if (!runtime.isAIEnabled) {
  console.warn('[runtime] AI disabled (no API key): ANTHROPIC_API_KEY not set.');
}
if (!runtime.isQStashEnabled) {
  console.warn('[runtime] QStash disabled: QSTASH_TOKEN / NEXT_PUBLIC_APP_URL not set.');
}
