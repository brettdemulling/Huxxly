import { NextRequest, NextResponse } from 'next/server';
import { getStoresByZip } from '@/lib/stores/getStoresByZip';

// GET /api/stores?zip=37067 — return grocery stores near a ZIP code
export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get('zip') ?? '';

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Invalid ZIP code' }, { status: 400 });
  }

  const stores = getStoresByZip(zip);
  return NextResponse.json({ stores });
}
