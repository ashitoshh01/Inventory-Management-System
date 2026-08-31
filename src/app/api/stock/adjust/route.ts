import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StockService } from '@/services/stock.service';
import { adjustStockSchema } from '@/lib/validators/stock.schema';
import { can } from '@/lib/permissions';
import { StockMovementType } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const session = await auth();
    
    // Restrict this action to MANAGER and ADMIN roles via permissions.ts
    if (!can(session, 'adjust', 'stock')) {
      return NextResponse.json({ error: 'Unauthorized: Only Managers and Admins can adjust stock' }, { status: 403 });
    }

    const body = await req.json();
    const validatedData = adjustStockSchema.parse(body);

    const movement = await StockService.recordMovement({
      type: StockMovementType.ADJUSTMENT,
      productId: validatedData.productId,
      quantity: validatedData.quantity,
      // For ADJUSTMENT, if quantity is negative, we decrement from warehouse. If positive, we increment to warehouse.
      // Wait, the logic in StockService says: 
      // if fromWarehouseId is passed, it takes abs(quantity) and decrements it.
      // if toWarehouseId is passed, it takes raw quantity (if no fromWarehouseId) and increments it.
      // So we can just use `toWarehouseId` for adjustments and pass the signed quantity!
      // Example: quantity = -5 (reduce stock). `toWarehouseId` increments by -5 (meaning decrements by 5).
      toWarehouseId: validatedData.warehouseId,
      reasonCode: validatedData.reasonCode,
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
