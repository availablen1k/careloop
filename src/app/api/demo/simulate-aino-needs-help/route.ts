import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { voiceReminderAgent } from '@/lib/agents/voiceReminderAgent';
import { caregiverAlertAgent } from '@/lib/agents/caregiverAlertAgent';

export async function POST() {
  try {
    const tasks = await db.getTasks();
    const medTask = tasks.find(t => t.category === 'Medication' && t.created_by === 'caregiver' && t.status !== 'completed')
      ?? tasks.find(t => t.category === 'Medication' && t.status !== 'completed');

    if (!medTask) {
      return NextResponse.json({ ok: false, error: 'Medication task not found' }, { status: 404 });
    }

    // Update task status to calling_aino
    const task = await db.updateTask(medTask.id, {
      status: 'calling_aino'
    });

    // Make call with forced needs_help
    const callResult = await voiceReminderAgent.callAino(task, 'needs_help', 1);

    // Update task to needs_help
    const helpTask = await db.updateTask(medTask.id, {
      status: 'needs_help'
    });

    // Trigger caregiver alert
    const alertMsg = `Aino asked for help with "${medTask.title}". CareLoop recommends that Saara checks in now.`;
    const alert = await caregiverAlertAgent.createAlert({
      task: helpTask,
      riskLevel: 'urgent',
      message: alertMsg,
      reason: ['Aino said "I need help" during the reminder call.'],
      triggerCall: true
    });

    return NextResponse.json({ ok: true, task: helpTask, call: callResult.voiceCall, alert });
  } catch (error: any) {
    console.error('Error simulating need help:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
