import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { seedDemoData } from '@/lib/demo/seed';

export async function GET() {
  try {
    let aino = await db.getUserByRole('elderly');
    if (!aino) {
      const seeded = await seedDemoData();
      aino = seeded.aino;
    }

    const allTasks = await db.getTasks(aino.id);
    // Bills are routed to Saara only — exclude Finance tasks from Aino's view
    const tasks = allTasks.filter(t => t.category !== 'Finance');
    return NextResponse.json({ ok: true, tasks });
  } catch (error: any) {
    console.error('Error fetching Aino tasks:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
