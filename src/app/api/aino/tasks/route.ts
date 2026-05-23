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
    const filtered = allTasks.filter(t => t.category !== 'Finance');

    const isComplete = (s: string) => s === 'completed' || s === 'resolved';

    // Incomplete tasks first (newest created_at first), completed tasks at bottom
    const tasks = filtered.sort((a, b) => {
      const aComplete = isComplete(a.status);
      const bComplete = isComplete(b.status);
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({ ok: true, tasks });
  } catch (error: any) {
    console.error('Error fetching Aino tasks:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
