import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StockService } from '@/services/stock.service';

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const warehouseId = searchParams.get('warehouseId') || undefined;
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = parseInt(searchParams.get('take') || '10', 10);

    const result = await StockService.getStockLevels(session, { search, warehouseId, skip, take });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
