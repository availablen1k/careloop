import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';

export async function PATCH(
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

    const nowStr = new Date().toISOString();

    // 1. Update task to completed
    const updatedTask = await db.updateTask(id, {
      status: 'completed',
      completed_at: nowStr,
    });

    // 2. Resolve related alerts if any
    const alert = await db.getAlertByTaskId(id);
    if (alert && alert.status !== 'resolved') {
      await db.updateAlert(alert.id, {
        status: 'resolved',
        resolved_at: nowStr,
      });
      
      // Log Caregiver Alert Agent resolving the alert
      await db.createAgentActionLog({
        agent_name: 'Caregiver Alert Agent',
        task_id: id,
        alert_id: alert.id,
        input_json: { action: 'resolve_alert_on_task_completion', taskId: id },
        output_json: { status: 'success', alertId: alert.id },
        safety_status: 'not_required',
      });
    }

    // 3. Log Care Coordinator action
    await db.createAgentActionLog({
      agent_name: 'Care Coordinator Agent',
      task_id: id,
      input_json: { action: 'complete_task', taskId: id },
      output_json: { status: 'success', taskStatus: 'completed' },
      safety_status: 'not_required',
    });

    return NextResponse.json({ ok: true, task_status: 'completed', task: updatedTask });
  } catch (error: any) {
    console.error('Error completing task:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
