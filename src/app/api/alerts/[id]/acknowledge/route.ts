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
      return NextResponse.json({ ok: false, error: 'Alert ID is required' }, { status: 400 });
    }

    const alert = await db.getAlertById(id);
    if (!alert) {
      return NextResponse.json({ ok: false, error: 'Alert not found' }, { status: 404 });
    }

    const nowStr = new Date().toISOString();

    // 1. Update Alert Status
    const updatedAlert = await db.updateAlert(id, {
      status: 'acknowledged',
      acknowledged_at: nowStr,
    });

    // 2. If there is an associated task, we can set its status to acknowledged
    if (alert.task_id) {
      await db.updateTask(alert.task_id, {
        status: 'acknowledged',
      });
    }

    // 3. Log caregiver action in agent logs
    await db.createAgentActionLog({
      agent_name: 'Caregiver Alert Agent',
      alert_id: id,
      task_id: alert.task_id || undefined,
      input_json: { action: 'acknowledge_alert', alertId: id },
      output_json: { status: 'success', alertStatus: 'acknowledged' },
      safety_status: 'not_required',
    });

    return NextResponse.json({ ok: true, alert: updatedAlert });
  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
