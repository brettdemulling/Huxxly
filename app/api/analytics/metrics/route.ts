import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutMetrics } from '@/lib/analytics/checkoutTelemetry';

export async function GET(request: NextRequest) {
  const hoursParam = request.nextUrl.searchParams.get('hours');
  const hours = hoursParam ? parseInt(hoursParam, 10) : 24;
  const safeHours = Number.isFinite(hours) && hours > 0 && hours <= 720 ? hours : 24;

  try {
    const metrics = await getCheckoutMetrics({ hours: safeHours });
    return NextResponse.json({ ok: true, timeRange: { hours: safeHours }, metrics });
  } catch {
    return NextResponse.json({ ok: false, error: 'Metrics unavailable' }, { status: 500 });
  }
}
