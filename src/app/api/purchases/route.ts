import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PurchaseService } from '@/services/purchase.service';
import { purchaseOrderSchema } from '@/lib/validators/purchase.schema';

import { PurchaseOrderStatus } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const session = await auth();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as PurchaseOrderStatus | undefined;
    
    const pos = await PurchaseService.getPurchaseOrders(session, status);
    return NextResponse.json(pos);
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    
    const validatedData = purchaseOrderSchema.parse(body);
    const po = await PurchaseService.createPurchaseOrder(session, validatedData);
    
    return NextResponse.json(po, { status: 201 });
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
