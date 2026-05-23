import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await context.params;
    const id = params.id;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Task ID is required' }, { status: 400 });
    }

    const task = await db.getTaskById(id);
    if (!task) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
    }

    // Set due time to 10 minutes in the past
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const updatedTask = await db.updateTask(id, {
      due_time: tenMinsAgo,
      status: 'pending' // Set back to pending so overdue check handles it
    });

    return NextResponse.json({ ok: true, task: updatedTask });
  } catch (error: any) {
    console.error('Error making task overdue:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
