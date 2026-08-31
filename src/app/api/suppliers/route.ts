import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SupplierService } from '@/services/supplier.service';
import { supplierSchema } from '@/lib/validators/supplier.schema';

export async function GET() {
  try {
    const session = await auth();
    const suppliers = await SupplierService.getSuppliers(session);
    return NextResponse.json(suppliers);
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
    
    const validatedData = supplierSchema.parse(body);
    const supplier = await SupplierService.createSupplier(session, validatedData);
    
    return NextResponse.json(supplier, { status: 201 });
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
