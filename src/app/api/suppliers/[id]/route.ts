import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SupplierService } from '@/services/supplier.service';
import { supplierSchema } from '@/lib/validators/supplier.schema';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const supplier = await SupplierService.getSupplier(session, params.id);
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }
    return NextResponse.json(supplier);
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const body = await req.json();
    
    const validatedData = supplierSchema.parse(body);
    const supplier = await SupplierService.updateSupplier(session, params.id, validatedData);
    
    return NextResponse.json(supplier);
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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    await SupplierService.deleteSupplier(session, params.id);
    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.message?.includes('Cannot delete')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
