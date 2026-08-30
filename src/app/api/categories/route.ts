import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CategoryService } from '@/services/category.service';
import { categorySchema } from '@/lib/validators/category.schema';

export async function GET() {
  try {
    const session = await auth();
    const categories = await CategoryService.getCategories(session);
    return NextResponse.json(categories);
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
    
    const validatedData = categorySchema.parse(body);
    const category = await CategoryService.createCategory(session, validatedData);
    
    return NextResponse.json(category, { status: 201 });
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
