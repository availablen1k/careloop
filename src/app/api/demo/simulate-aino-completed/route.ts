import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';

export async function POST() {
  try {
    const tasks = await db.getTasks();
    const medTask = tasks.find(t => t.category === 'Medication');

    if (!medTask) {
      return NextResponse.json({ ok: false, error: 'Medication task not found' }, { status: 404 });
    }

    const nowStr = new Date().toISOString();

    // 1. Complete Task
    const task = await db.updateTask(medTask.id, {
      status: 'completed',
      completed_at: nowStr,
    });

    // 2. Resolve Alert
    const alert = await db.getAlertByTaskId(medTask.id);
    if (alert) {
      await db.updateAlert(alert.id, {
        status: 'resolved',
        resolved_at: nowStr,
      });
    }

    // 3. Log agent action
    await db.createAgentActionLog({
      agent_name: 'Care Coordinator Agent',
      task_id: medTask.id,
      input_json: { action: 'simulate_completed' },
      output_json: { status: 'success' },
      safety_status: 'not_required',
    });

    return NextResponse.json({ ok: true, task });
  } catch (error: any) {
    console.error('Error simulating completed task:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
