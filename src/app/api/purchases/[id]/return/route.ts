import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PurchaseService } from '@/services/purchase.service';
import { returnGoodsSchema } from '@/lib/validators/purchase.schema';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const body = await req.json();
    
    const validatedData = returnGoodsSchema.parse(body);
    const result = await PurchaseService.returnGoods(session, params.id, validatedData);
    
    return NextResponse.json({ success: result });
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
