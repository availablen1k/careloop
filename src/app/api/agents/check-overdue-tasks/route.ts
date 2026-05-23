import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { query } from '@/lib/db';
import { careCoordinatorAgent } from '@/lib/agents/careCoordinatorAgent';
import { voiceReminderAgent } from '@/lib/agents/voiceReminderAgent';
import { caregiverAlertAgent } from '@/lib/agents/caregiverAlertAgent';
import { escalationConfig } from '@/lib/config/escalation';
import { emailRetrievalAgent } from '@/lib/agents/emailRetrievalAgent';

export async function POST(request: Request) {
  try {
    let forcedResult: any = undefined;
    try {
      const body = await request.json();
      if (body.forcedResult) {
        forcedResult = body.forcedResult;
      }
    } catch {
      // Body empty or unparseable
    }

    const aino = await db.getUserByRole('elderly');
    const saara = await db.getUserByRole('caregiver');

    // Process incoming emails from Mailhog
    let emailError: string | null = null;
    if (aino && saara) {
      try {
        await emailRetrievalAgent.processEmails(aino.id, saara.id);
      } catch (err: any) {
        emailError = err?.message || 'Email processing failed';
        console.error('Error processing emails:', err);
      }
    }

    const allTasks = await db.getTasks();
    const now = new Date();
    const graceMs = escalationConfig.grace_period_minutes * 60 * 1000;

    // Filters active tasks that require monitoring
    const activeTasks = allTasks.filter(task => {
      if (['completed', 'resolved', 'acknowledged', 'escalated_to_saara'].includes(task.status)) {
        return false;
      }

      // If pending, it must be past the due time + grace period to become active
      if (task.status === 'pending') {
        const dueTime = new Date(task.due_time);
        return dueTime.getTime() + graceMs <= now.getTime();
      }

      // If overdue, retry_queued, needs_help, or no_answer, it is already active
      return true;
    });

    const processed = [];

    // Get latest passive signal for context
    const signals = aino ? await db.getPassiveSignals(aino.id) : [];
    const latestSignal = signals[0] || undefined;

    for (const task of activeTasks) {
      let currentTask = task;
      if (currentTask.status === 'pending') {
        currentTask = await db.updateTask(task.id, { status: 'overdue' });
      }

      // Fetch calls count for this task
      const callsRes = await query(
        'SELECT * FROM voice_calls WHERE task_id = $1 ORDER BY created_at DESC',
        [currentTask.id]
      );
      const voiceCalls = callsRes.rows;
      const totalAttempts = voiceCalls.length;

      // Run Care Coordinator Agent
      const coordination = await careCoordinatorAgent.coordinateTask(currentTask, latestSignal);

      if (coordination.action === 'trigger_voice_reminder') {
        if (totalAttempts === 0) {
          // Trigger voice reminder call (Attempt 1)
          const callOutcome = await voiceReminderAgent.callAino(currentTask, forcedResult, 1);
          processed.push({
            taskId: task.id,
            taskTitle: task.title,
            action: 'trigger_voice_reminder_1',
            coordination,
            callOutcome: callOutcome.result,
            attempt: 1
          });
        } else if (totalAttempts === 1) {
          // Check retry delay
          const lastCall = voiceCalls[0];
          const lastCallTime = new Date(lastCall.created_at).getTime();
          const timeDiffMins = (Date.now() - lastCallTime) / (60 * 1000);

          if (timeDiffMins >= escalationConfig.retry_delay_minutes) {
            // Trigger voice reminder call (Attempt 2)
            const callOutcome = await voiceReminderAgent.callAino(currentTask, forcedResult, 2);
            processed.push({
              taskId: task.id,
              taskTitle: task.title,
              action: 'trigger_voice_reminder_2',
              coordination,
              callOutcome: callOutcome.result,
              attempt: 2
            });
          } else {
            processed.push({
              taskId: task.id,
              taskTitle: task.title,
              action: 'waiting_retry_delay',
              coordination,
              timeElapsedMins: timeDiffMins
            });
          }
        } else {
          // 2 or more calls placed, Coordinator should typically transition to escalate,
          // but if it recommended call anyway, we block redundant calls here as guard rail
          processed.push({
            taskId: task.id,
            taskTitle: task.title,
            action: 'max_calls_reached_guard_rail',
            coordination
          });
        }
      } else if (
        coordination.action === 'escalate_to_caregiver' ||
        coordination.action === 'create_alert' ||
        coordination.action === 'mark_needs_help'
      ) {
        // Create caregiver alert
        const alert = await caregiverAlertAgent.createAlert({
          task: currentTask,
          riskLevel: coordination.risk_level,
          message: coordination.message_to_caregiver,
          reason: coordination.reason,
          triggerCall: true
        });

        // Set task status to escalated_to_saara
        await db.updateTask(currentTask.id, { status: 'escalated_to_saara' });

        processed.push({
          taskId: task.id,
          taskTitle: task.title,
          action: coordination.action,
          coordination,
          alertId: alert.id
        });
      } else {
        processed.push({
          taskId: task.id,
          taskTitle: task.title,
          action: 'no_action',
          coordination
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processedCount: activeTasks.length,
      actions: processed,
      ...(emailError ? { emailError } : {})
    });
  } catch (error: any) {
    console.error('Error in overdue task checker:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
