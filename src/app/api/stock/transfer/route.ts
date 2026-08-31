import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StockService } from '@/services/stock.service';
import { transferStockSchema } from '@/lib/validators/stock.schema';
import { StockMovementType } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const session = await auth();
    // In a real scenario you would check permissions, e.g., can(session, 'update', 'stock')
    const body = await req.json();
    const validatedData = transferStockSchema.parse(body);

    if (validatedData.fromWarehouseId === validatedData.toWarehouseId) {
      return NextResponse.json({ error: 'Source and Destination warehouses cannot be the same' }, { status: 400 });
    }

    const movement = await StockService.recordMovement({
      type: StockMovementType.TRANSFER,
      productId: validatedData.productId,
      quantity: validatedData.quantity,
      fromWarehouseId: validatedData.fromWarehouseId,
      toWarehouseId: validatedData.toWarehouseId,
      userId: session?.user?.id || 'system',
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
