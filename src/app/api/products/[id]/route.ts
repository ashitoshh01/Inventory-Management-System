import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ProductService } from '@/services/product.service';
import { productSchema } from '@/lib/validators/product.schema';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const product = await ProductService.getProduct(session, params.id);
    if (!product) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (e: unknown) {
    const error = e as { message?: string };
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
    
    const validatedData = productSchema.parse(body);
    const product = await ProductService.updateProduct(session, params.id, validatedData);
    
    return NextResponse.json(product);
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown, code?: string, meta?: Record<string, unknown> };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    }
    // Prisma Unique Constraint Violation
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[];
      if (target?.includes('sku')) {
        return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 });
      }
      if (target?.includes('barcode')) {
        return NextResponse.json({ error: 'A product with this barcode already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'A unique constraint was violated.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    await ProductService.deleteProduct(session, params.id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const error = e as { message?: string };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.message === 'Not Found') {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    if (error.message?.startsWith('Cannot delete')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
