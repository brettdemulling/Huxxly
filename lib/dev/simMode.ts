// Simulation mode is active when DEV_SIMULATION=true OR when credentials are placeholders.
// In sim mode: no DB, no Redis, no QStash, no Anthropic API calls.

export const IS_SIM_MODE =
  process.env.DEV_SIMULATION === 'true' ||
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('USER:PASSWORD') ||
  process.env.DATABASE_URL.includes('dev:dev@localhost');

if (IS_SIM_MODE && process.env.NODE_ENV === 'development') {
  console.info('[huxxly] Running in simulation mode — all external APIs are mocked.');
}
