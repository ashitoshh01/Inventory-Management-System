import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ProductService } from '@/services/product.service';
import { productSchema } from '@/lib/validators/product.schema';

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = parseInt(searchParams.get('take') || '50', 10);

    const result = await ProductService.getProducts(session, {
      search,
      categoryId,
      isActive,
      skip,
      take
    });
    
    return NextResponse.json(result);
  } catch (e: unknown) {
    const error = e as { message?: string };
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
    
    const validatedData = productSchema.parse(body);
    const product = await ProductService.createProduct(session, validatedData);
    
    return NextResponse.json(product, { status: 201 });
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
