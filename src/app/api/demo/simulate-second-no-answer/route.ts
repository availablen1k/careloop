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

    // Guard: Call 1 must have already happened
    const { query } = await import('@/lib/db');
    const existingCalls = await query('SELECT * FROM voice_calls WHERE task_id = $1 ORDER BY created_at ASC', [medTask.id]);
    if (existingCalls.rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Run "Call 1: Aino No Answer" first before escalating.' }, { status: 400 });
    }

    // Update task to calling_aino
    const task = await db.updateTask(medTask.id, {
      status: 'calling_aino'
    });

    // Make second call (attempt 2) with forced no_answer
    const callResult = await voiceReminderAgent.callAino(task, 'no_answer', 2);

    // Update task to escalated_to_saara
    const escalatedTask = await db.updateTask(medTask.id, {
      status: 'escalated_to_saara'
    });

    // Trigger caregiver alert
    const alertMsg = `Aino missed her medication task "${medTask.title}" and did not answer reminder calls. Please check in.`;
    const alert = await caregiverAlertAgent.createAlert({
      task: escalatedTask,
      riskLevel: 'high',
      message: alertMsg,
      reason: ['Medication task is overdue.', 'Aino did not answer call attempt 2 of 2.'],
      triggerCall: true // Call Saara
    });

    return NextResponse.json({ ok: true, task: escalatedTask, call: callResult.voiceCall, alert });
  } catch (error: any) {
    console.error('Error simulating second no answer:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
