import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { voiceReminderAgent } from '@/lib/agents/voiceReminderAgent';
import { caregiverAlertAgent } from '@/lib/agents/caregiverAlertAgent';
import { escalationConfig } from '@/lib/config/escalation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { task_id, forced_result } = body;

    if (!task_id) {
      return NextResponse.json({ ok: false, error: 'Task ID is required' }, { status: 400 });
    }

    const task = await db.getTaskById(task_id);
    if (!task) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
    }

    // Determine attempt number
    const calls = await db.getVoiceCalls();
    const previousAttempts = calls.filter(c => c.task_id === task_id && c.caller_type === 'reminder_to_elderly').length;
    const attemptNumber = previousAttempts + 1;

    // Call Aino
    const callResult = await voiceReminderAgent.callAino(task, forced_result, attemptNumber);

    // If no answer, handle retry or escalation
    if (callResult.result === 'no_answer') {
      const maxAttempts = escalationConfig.max_aino_call_attempts; // 2
      
      if (attemptNumber < maxAttempts) {
        // Set task status to retry_queued
        await db.updateTask(task_id, {
          status: 'retry_queued'
        });
      } else {
        // Escalate to Saara
        const escalatedTask = await db.updateTask(task_id, {
          status: 'escalated_to_saara'
        });

        // Trigger caregiver alert
        const alertMsg = `Aino missed her medication task "${task.title}" and did not answer reminder calls. Please check in.`;
        const alert = await caregiverAlertAgent.createAlert({
          task: escalatedTask,
          riskLevel: 'high',
          message: alertMsg,
          reason: ['Medication task is overdue.', `Aino did not answer call attempt ${attemptNumber} of ${maxAttempts}.`],
          triggerCall: true // Call Saara
        });

        return NextResponse.json({
          ok: true,
          status: 'escalated_to_saara',
          call: callResult.voiceCall,
          task: escalatedTask,
          alert
        });
      }
    } else if (callResult.result === 'needs_help') {
      // Create urgent alert immediately
      const alertMsg = `Aino asked for help with "${task.title}". CareLoop recommends that Saara checks in now.`;
      const alert = await caregiverAlertAgent.createAlert({
        task: callResult.task,
        riskLevel: 'urgent',
        message: alertMsg,
        reason: ['Aino said "I need help" during the reminder call.'],
        triggerCall: true
      });

      return NextResponse.json({
        ok: true,
        status: 'needs_help',
        call: callResult.voiceCall,
        task: callResult.task,
        alert
      });
    }

    return NextResponse.json({
      ok: true,
      status: callResult.result,
      call: callResult.voiceCall,
      task: callResult.task
    });
  } catch (error: any) {
    console.error('Error calling Aino:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
