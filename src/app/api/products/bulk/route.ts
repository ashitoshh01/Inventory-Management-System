import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ProductService } from '@/services/product.service';
import { productSchema } from '@/lib/validators/product.schema';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected an array of products' }, { status: 400 });
    }

    const createdProducts = [];
    const errors = [];

    // Process sequentially or use Promise.all. 
    // Sequential might be better to avoid overwhelming connections and handle constraint errors gracefully.
    for (const item of body) {
      try {
        const validatedData = productSchema.parse(item);
        const product = await ProductService.createProduct(session, validatedData);
        createdProducts.push(product);
      } catch (err: any) {
        errors.push({ sku: item.sku, error: err.message || 'Validation or creation error' });
      }
    }

    return NextResponse.json({
      success: true,
      created: createdProducts.length,
      errors
    }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
