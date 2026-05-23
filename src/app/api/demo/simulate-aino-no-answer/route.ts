import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { voiceReminderAgent } from '@/lib/agents/voiceReminderAgent';

export async function POST() {
  try {
    const tasks = await db.getTasks();
    const medTask = tasks.find(t => t.category === 'Medication');

    if (!medTask) {
      return NextResponse.json({ ok: false, error: 'Medication task not found' }, { status: 404 });
    }

    // Set due time in past and status to overdue
    const overdueTask = await db.updateTask(medTask.id, {
      due_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      status: 'overdue'
    });

    // Make first call (attempt 1) with forced no_answer
    const callResult = await voiceReminderAgent.callAino(overdueTask, 'no_answer', 1);

    // Update task to retry_queued
    const task = await db.updateTask(medTask.id, {
      status: 'retry_queued'
    });

    return NextResponse.json({ ok: true, task, call: callResult.voiceCall });
  } catch (error: any) {
    console.error('Error simulating no answer:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
