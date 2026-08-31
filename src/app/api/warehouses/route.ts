import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { WarehouseService } from '@/services/warehouse.service';
import { warehouseSchema } from '@/lib/validators/warehouse.schema';

export async function GET() {
  try {
    const session = await auth();
    const warehouses = await WarehouseService.getWarehouses(session);
    return NextResponse.json(warehouses);
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
    
    const validatedData = warehouseSchema.parse(body);
    const warehouse = await WarehouseService.createWarehouse(session, validatedData);
    
    return NextResponse.json(warehouse, { status: 201 });
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    }
    if (error.message === 'Warehouse with this code already exists') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
