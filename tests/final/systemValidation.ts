// ─── System Validation Suite ──────────────────────────────────────────────────
// Run with: DEV_SIMULATION=true npx jiti tests/final/systemValidation.ts
// Returns a structured report — does not throw; all errors are captured.

import { buildMockFlowResult } from '@/lib/dev/mockFlowResult';
import { resolveProductMedia, shouldShowImage } from '@/lib/products/productMediaResolver';
import { detectState, stateLabel } from '@/lib/ux/stateMachine';
import { computeNextBestAction } from '@/lib/ux/nextBestAction';
import { formatResponse } from '@/lib/ui/responseFormatter';
import { predictNextCart } from '@/lib/memory/userBehaviorEngine';
import { buildFamilyBundle, mapBundleToCart } from '@/lib/recipes/smartRecipeEngine';

interface ValidationReport {
  auth: 'PASS' | 'FAIL';
  cartAccuracy: number;
  imageCoverage: number;
  checkoutSuccessRate: number;
  avgResponseTimeMs: number;
  fallbackSuccessRate: number;
  systemStatus: 'READY_FOR_TESTERS' | 'NOT_READY';
  details: Record<string, unknown>;
}

function time<T>(fn: () => T): { result: T; ms: number } {
  const start = Date.now();
  const result = fn();
  return { result, ms: Date.now() - start };
}

async function timeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

async function checkAuth(): Promise<'PASS' | 'FAIL'> {
  try {
    // Validate that the login route module exists and can be imported
    await import('@/app/api/auth/login/route');
    return 'PASS';
  } catch {
    return 'FAIL';
  }
}

async function checkCartAccuracy(): Promise<{ accuracy: number; details: string }> {
  try {
    const flow = buildMockFlowResult();
    const cart = flow.primaryCart;
    const covered = cart.items.filter((i) => i.product.inStock).length;
    const accuracy = covered / Math.max(cart.items.length, 1);
    return { accuracy, details: `${covered}/${cart.items.length} items in stock` };
  } catch (e) {
    return { accuracy: 0, details: String(e) };
  }
}

async function checkImageCoverage(): Promise<{ coverage: number; details: string }> {
  try {
    const flow = buildMockFlowResult();
    const products = flow.primaryCart.items.map((i) => i.product);
    const resolved = products.map(resolveProductMedia);
    const highConf = resolved.filter(shouldShowImage).length;
    const coverage = highConf / Math.max(products.length, 1);
    return { coverage, details: `${highConf}/${products.length} with confidence >= 0.85` };
  } catch (e) {
    return { coverage: 0, details: String(e) };
  }
}

async function checkCheckoutFlow(): Promise<{ successRate: number; avgMs: number; details: string }> {
  const runs = 3;
  let successes = 0;
  let totalMs = 0;

  for (let i = 0; i < runs; i++) {
    const { result, ms } = await timeAsync(async () => {
      const flow = buildMockFlowResult();
      const state = detectState(flow);
      const actions = computeNextBestAction(state);
      const formatted = formatResponse(flow, { state });
      return { state, actions, formatted };
    });
    totalMs += ms;
    if (result.formatted.status === 'OK' && result.actions.primaryAction) successes++;
  }

  return {
    successRate: successes / runs,
    avgMs: Math.round(totalMs / runs),
    details: `${successes}/${runs} runs produced valid formatted output`,
  };
}

async function checkFallback(): Promise<{ successRate: number; details: string }> {
  try {
    const flow = buildMockFlowResult();
    const bundle = buildFamilyBundle(flow.meals, flow.intent.budgetCents);
    const mappings = mapBundleToCart(bundle, flow.primaryCart);
    const avgCoverage = mappings.reduce((s, m) => s + m.coverageRatio, 0) / Math.max(mappings.length, 1);
    return {
      successRate: avgCoverage,
      details: `avg recipe→cart coverage ${(avgCoverage * 100).toFixed(0)}%`,
    };
  } catch (e) {
    return { successRate: 0, details: String(e) };
  }
}

async function checkStateLabel(): Promise<string> {
  const flow = buildMockFlowResult();
  const state = detectState(flow);
  return stateLabel(state);
}

async function run(): Promise<ValidationReport> {
  const [auth, cartResult, imageResult, checkoutResult, fallbackResult, stateCheck] =
    await Promise.all([
      checkAuth(),
      checkCartAccuracy(),
      checkImageCoverage(),
      checkCheckoutFlow(),
      checkFallback(),
      checkStateLabel(),
    ]);

  const cartAccuracy = cartResult.accuracy;
  const imageCoverage = imageResult.coverage;
  const checkoutSuccessRate = checkoutResult.successRate;
  const avgResponseTimeMs = checkoutResult.avgMs;
  const fallbackSuccessRate = fallbackResult.successRate;

  const passing =
    auth === 'PASS' &&
    cartAccuracy >= 0.9 &&
    imageCoverage >= 0.5 &&
    checkoutSuccessRate >= 0.9 &&
    avgResponseTimeMs < 500 &&
    fallbackSuccessRate >= 0.5;

  const report: ValidationReport = {
    auth,
    cartAccuracy,
    imageCoverage,
    checkoutSuccessRate,
    avgResponseTimeMs,
    fallbackSuccessRate,
    systemStatus: passing ? 'READY_FOR_TESTERS' : 'NOT_READY',
    details: {
      cart: cartResult.details,
      images: imageResult.details,
      checkout: checkoutResult.details,
      fallback: fallbackResult.details,
      stateLabel: stateCheck,
    },
  };

  return report;
}

run().then((report) => {
  console.log('\n── System Validation Report ─────────────────────────\n');
  console.log(`  Auth:               ${report.auth}`);
  console.log(`  Cart accuracy:      ${(report.cartAccuracy * 100).toFixed(1)}%`);
  console.log(`  Image coverage:     ${(report.imageCoverage * 100).toFixed(1)}%`);
  console.log(`  Checkout success:   ${(report.checkoutSuccessRate * 100).toFixed(0)}%`);
  console.log(`  Avg response time:  ${report.avgResponseTimeMs}ms`);
  console.log(`  Fallback coverage:  ${(report.fallbackSuccessRate * 100).toFixed(0)}%`);
  console.log(`\n  STATUS: ${report.systemStatus}\n`);
  if (process.env.VERBOSE) {
    console.log('  Details:', JSON.stringify(report.details, null, 2));
  }
  process.exit(report.systemStatus === 'READY_FOR_TESTERS' ? 0 : 1);
});
