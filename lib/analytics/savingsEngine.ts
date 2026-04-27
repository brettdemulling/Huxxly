import type { CartCanonical, SavingsData } from '@/lib/core/canonicalModels';
import type { EventPayload } from '@/lib/types/events';
import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/events/eventLogger';
import { recordSavings } from '@/lib/analytics/savingsDashboard';

export function computeOrderSavings(
  optimizedCart: CartCanonical,
  alternativeCarts: CartCanonical[],
): { savingsCents: number; savingsPercent: number } {
  if (!alternativeCarts.length) return { savingsCents: 0, savingsPercent: 0 };

  const maxCost = alternativeCarts.reduce(
    (max, c) => Math.max(max, c.estimatedTotalCents),
    optimizedCart.estimatedTotalCents,
  );

  const savingsCents = Math.max(maxCost - optimizedCart.estimatedTotalCents, 0);
  const savingsPercent =
    maxCost > 0 ? parseFloat(((savingsCents / maxCost) * 100).toFixed(1)) : 0;

  return { savingsCents, savingsPercent };
}

export async function buildSavingsData(
  userId: string,
  optimizedCart: CartCanonical,
  alternativeCarts: CartCanonical[],
  zip: string,
): Promise<SavingsData> {
  const { savingsCents, savingsPercent } = computeOrderSavings(optimizedCart, alternativeCarts);

  const lifetimeSavings = await computeLifetimeSavings(userId);
  const averagePct = await computeAverageSavingsPct(userId, savingsPercent);

  await logEvent('cart_built', userId, {
    type: 'savings_computed',
    savingsCents,
    savingsPercent,
    lifetimeSavings,
  }, zip);

  recordSavings({
    userId,
    orderId: optimizedCart.id,
    originalCost: (alternativeCarts[0]?.estimatedTotalCents ?? optimizedCart.estimatedTotalCents) / 100,
    optimizedCost: optimizedCart.estimatedTotalCents / 100,
    savings: savingsCents / 100,
    timestamp: Date.now(),
  });

  return {
    thisOrderSavings: parseFloat((savingsCents / 100).toFixed(2)),
    thisOrderSavingsPercent: `${savingsPercent}%`,
    averageUserSavings: `${averagePct}%`,
    lifetimeSavings: parseFloat((lifetimeSavings / 100).toFixed(2)),
  };
}

async function computeLifetimeSavings(userId: string): Promise<number> {
  try {
    const events = await prisma.event.findMany({
      where: {
        userId,
        type: 'cart_built',
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return events.reduce((total: number, e: any) => {
      const p = e.payload as EventPayload;
      return total + (typeof p.savingsCents === 'number' ? p.savingsCents : 0);
    }, 0);
  } catch {
    return 0;
  }
}

async function computeAverageSavingsPct(userId: string, currentPct: number): Promise<string> {
  try {
    const events = await prisma.event.findMany({
      where: { userId, type: 'cart_built' },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    const pcts = events
      .map((e) => {
        const p = e.payload as EventPayload;
        return typeof p.savingsPercent === 'number' ? p.savingsPercent : null;
      })
      .filter((v): v is number => v !== null);

    pcts.push(currentPct);
    const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length;
    return avg.toFixed(1);
  } catch {
    return currentPct.toFixed(1);
  }
}
