import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { can } from '@/lib/permissions';
import { z } from 'zod';

const batchSchema = z.object({
  batchNumber: z.string().min(1),
  serialNumber: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  quantity: z.number().int().min(1),
  warehouseId: z.string().min(1)
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!can(session, 'update', 'products')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const body = await req.json();
    const validatedData = batchSchema.parse(body);
    
    const batch = await prisma.batch.create({
      data: {
        productId: params.id,
        batchNumber: validatedData.batchNumber,
        serialNumber: validatedData.serialNumber || null,
        expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
        quantity: validatedData.quantity,
        warehouseId: validatedData.warehouseId,
      }
    });
    
    // Create an audit log or stock movement?
    // Since this is just a manual phase 3 prep, we don't necessarily need a full stock movement
    // but the prompt says "populate automatically by purchasing in Phase 3" so just the batch is fine.
    
    return NextResponse.json(batch, { status: 201 });
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
