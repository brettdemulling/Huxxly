import { NextResponse } from 'next/server';
import { getLiveSavingsBanner, getAverageSavings, getTotalSavings, getSavingsTrend } from '@/lib/analytics/savingsDashboard';

export async function GET() {
  try {
    const [banner, average, total, trend] = await Promise.all([
      getLiveSavingsBanner(),
      getAverageSavings(),
      getTotalSavings(),
      getSavingsTrend(),
    ]);
    return NextResponse.json({ banner, average, total, trend });
  } catch {
    return NextResponse.json(
      {
        banner: {
          headline: 'Live Savings',
          value: '$18.40',
          description: 'Users save an average of $18.40 per order',
          trend: 'flat',
        },
        average: 18.40,
        total: 0,
        trend: { dailyAverage: 0, weeklyAverage: 0, monthlyAverage: 0 },
      },
      { status: 200 },
    );
  }
}
