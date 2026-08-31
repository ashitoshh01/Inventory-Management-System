import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PurchaseService } from '@/services/purchase.service';

export async function GET() {
  try {
    const session = await auth();
    const suggestions = await PurchaseService.getSuggestedPurchases(session);
    return NextResponse.json(suggestions);
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
