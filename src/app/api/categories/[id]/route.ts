import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CategoryService } from '@/services/category.service';
import { categorySchema } from '@/lib/validators/category.schema';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const category = await CategoryService.getCategory(session, params.id);
    if (!category) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    return NextResponse.json(category);
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
    
    const validatedData = categorySchema.parse(body);
    const category = await CategoryService.updateCategory(session, params.id, validatedData);
    
    return NextResponse.json(category);
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.message === 'Category cannot be its own parent') {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    await CategoryService.deleteCategory(session, params.id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const error = e as { message?: string, name?: string, errors?: unknown };
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error.message === 'Category not found') {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    if (error.message?.startsWith('Cannot delete')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
