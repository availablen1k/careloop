import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { caregiverAlertAgent } from '@/lib/agents/caregiverAlertAgent';

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

    // 1. Update task status to needs_help
    const updatedTask = await db.updateTask(id, {
      status: 'needs_help'
    });

    // 2. Trigger Caregiver Alert Agent to create an urgent alert
    const alertMsg = `Aino asked for help with "${task.title}". CareLoop recommends that Saara checks in now.`;
    const reason = ['Aino clicked "I need help" on her dashboard.'];

    const alert = await caregiverAlertAgent.createAlert({
      task: updatedTask,
      riskLevel: 'urgent',
      message: alertMsg,
      reason,
      triggerCall: true, // Urgently call Saara
    });

    // 3. Log Care Coordinator action
    await db.createAgentActionLog({
      agent_name: 'Care Coordinator Agent',
      task_id: id,
      alert_id: alert.id,
      input_json: { action: 'mark_needs_help', taskId: id },
      output_json: { status: 'success', taskStatus: 'needs_help', alertId: alert.id },
      safety_status: 'not_required',
    });

    return NextResponse.json({
      ok: true,
      task_status: 'needs_help',
      alert_risk: 'urgent',
      task: updatedTask,
      alert
    });
  } catch (error: any) {
    console.error('Error marking task as needing help:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
