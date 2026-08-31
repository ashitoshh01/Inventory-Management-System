import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StockService } from '@/services/stock.service';
import { stockCountSchema } from '@/lib/validators/stock.schema';
import { StockMovementType } from '@prisma/client';
import { can } from '@/lib/permissions';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId');
    if (!warehouseId) {
      return NextResponse.json({ error: 'warehouseId is required' }, { status: 400 });
    }
    const list = await StockService.getStockCountList(warehouseId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    // Re-using the 'adjust' permission since this performs adjustments
    if (!can(session, 'adjust', 'stock')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validatedData = stockCountSchema.parse(body);

    const results = [];
    for (const correction of validatedData.corrections) {
      if (correction.delta !== 0) {
        const movement = await StockService.recordMovement({
          type: StockMovementType.ADJUSTMENT,
          productId: correction.productId,
          quantity: correction.delta, // positive adds, negative removes
          toWarehouseId: validatedData.warehouseId,
          reasonCode: 'COUNT_CORRECTION',
          userId: session?.user?.id || 'system',
        });
        results.push(movement);
      }
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
