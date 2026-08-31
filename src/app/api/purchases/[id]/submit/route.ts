import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PurchaseService } from '@/services/purchase.service';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const po = await PurchaseService.submitForApproval(session, params.id);
    return NextResponse.json(po);
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.message === 'Purchase order not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (error.message === 'Only DRAFT purchase orders can be submitted for approval') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
