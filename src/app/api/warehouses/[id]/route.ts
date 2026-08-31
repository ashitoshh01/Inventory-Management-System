import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { WarehouseService } from '@/services/warehouse.service';
import { warehouseSchema } from '@/lib/validators/warehouse.schema';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const warehouse = await WarehouseService.getWarehouse(session, params.id);
    
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }
    
    return NextResponse.json(warehouse);
  } catch (e: unknown) {
    const error = e as { message?: string };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const body = await req.json();
    
    const validatedData = warehouseSchema.parse(body);
    const warehouse = await WarehouseService.updateWarehouse(session, params.id, validatedData);
    
    return NextResponse.json(warehouse);
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

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    await WarehouseService.deleteWarehouse(session, params.id);
    
    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    const error = e as { message?: string };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.message === 'Warehouse not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes('Cannot delete warehouse')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
