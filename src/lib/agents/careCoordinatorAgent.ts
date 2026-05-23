import { callGeminiJson } from '../ai/gemini';
import { db } from '../database/server';
import { query } from '../db';
import { safetyEscalationAgent } from './safetyEscalationAgent';
import { escalationConfig } from '../config/escalation';
import { Task, PassiveSignal } from '../types';

export interface CoordinatorResponse {
  risk_level: 'low' | 'medium' | 'high' | 'urgent';
  action: 'no_action' | 'create_alert' | 'trigger_voice_reminder' | 'escalate_to_caregiver' | 'mark_completed' | 'mark_needs_help';
  reason: string[];
  message_to_caregiver: string;
  agent_reasoning: string;
}

export const careCoordinatorAgent = {
  name: 'Care Coordinator Agent',

  async coordinateTask(task: Task, signal?: PassiveSignal): Promise<CoordinatorResponse> {
    console.log(`[Care Coordinator Agent] Coordinating task ${task.id} (${task.title})`);

    // Fetch call history for this task
    const callsRes = await query(
      'SELECT * FROM voice_calls WHERE task_id = $1 ORDER BY created_at ASC',
      [task.id]
    );
    const voiceCalls = callsRes.rows;

    const callHistoryText = voiceCalls.length === 0
      ? 'No reminder calls have been placed yet for this task.'
      : voiceCalls.map((c: any) => {
          return `- Call Attempt ${c.attempt_number}: Status "${c.status}", response transcript "${c.response_text || 'None'}", time "${c.created_at}"`;
        }).join('\n');

    const systemInstruction = `
You are the Care Coordinator Agent for CareLoop.
CareLoop helps families coordinate daily care tasks for elderly loved ones living alone.

You do not diagnose.
You do not give medical advice.
You do not replace doctors, nurses, emergency services, or caregivers.

Your job:
1. Review the task details (due time, priority, current status).
2. Review the call history attempts (number of calls placed, outcome, transcripts).
3. Review the lightweight passive wearable context.
4. Decide on the appropriate action and explain your thought process in "agent_reasoning".

State Transition Rules:
- If task status is "needs_help": Aino has requested help. Set action to "escalate_to_caregiver" and risk_level to "urgent".
- If the task is overdue (current time is past due_time + grace_period):
  - If 0 calls have been placed: Aino needs a reminder. Suggest "trigger_voice_reminder" (Call 1) and risk_level "medium" (or "high" if wearable concern is present).
  - If 1 call has been placed and it failed (no_answer or failed):
    - Has it been at least 5 minutes since the last call?
    - If yes: Aino needs a second reminder. Suggest "trigger_voice_reminder" (Call 2) and risk_level "medium" (or "high" if wearable concern is present).
    - If no: We must wait for the retry delay. Suggest "no_action".
  - If 2 calls have been placed and both were unanswered (no_answer):
    - Aino did not answer repeated checks. Suggest "escalate_to_caregiver" (dispatches alert to Saara) and set risk_level to "high".
- If the task status is "completed" or "resolved": No action is needed. Suggest "no_action" and risk_level "low".

Return only JSON in this format:
{
  "risk_level": "low | medium | high | urgent",
  "action": "no_action | create_alert | trigger_voice_reminder | escalate_to_caregiver | mark_completed | mark_needs_help",
  "reason": ["string"],
  "message_to_caregiver": "string",
  "agent_reasoning": "Detailed agent thought process explaining why this action was selected based on task status, wearables, and call history."
}
    `;

    const prompt = `
Task Details:
Title: "${task.title}"
Description: "${task.description || 'No description'}"
Category: "${task.category}"
Due Time: "${task.due_time}"
Priority: "${task.priority}"
Current Status: "${task.status}"
Voice Reminder Enabled: ${task.voice_reminder_enabled}
Escalation Enabled: ${task.escalation_enabled}

Passive Wearable Context:
Change level: "${signal?.change_level || 'normal'}"
Summary: "${signal?.summary || 'No wearable data available.'}"

Call History for this task:
${callHistoryText}
    `;

    // Local rule-based fallback logic (highly deterministic, perfectly matching the state machine rules!)
    let fallbackAction: CoordinatorResponse['action'] = 'no_action';
    let fallbackRisk: CoordinatorResponse['risk_level'] = 'low';
    let fallbackReason = ['Task is pending and not late.'];
    let fallbackMsg = `Task "${task.title}" is scheduled and pending.`;
    let fallbackReasoning = 'Task is in pending state and current time is within normal window. No action is required.';

    const totalCallsCount = voiceCalls.length;
    const lastCall = voiceCalls[voiceCalls.length - 1];

    if (task.status === 'needs_help') {
      fallbackRisk = 'urgent';
      fallbackAction = 'mark_needs_help';
      fallbackReason = ['Aino requested assistance with this task.'];
      fallbackMsg = `Aino asked for help with "${task.title}". CareLoop recommends checking in.`;
      fallbackReasoning = 'Aino clicked help button or call response indicates assistance requested. Immediate escalation suggested.';
    } else if (task.status === 'escalated_to_saara') {
      fallbackRisk = 'high';
      fallbackAction = 'escalate_to_caregiver';
      fallbackReason = ['Task is overdue and Aino did not answer repeated reminder calls.'];
      fallbackMsg = `Aino missed "${task.title}" and reminder calls went unanswered. Please check in.`;
      fallbackReasoning = 'Both reminder calls went unanswered. Escalating alert directly to caregiver dashboard and triggering phone notification.';
    } else if (task.status === 'overdue' || task.status === 'reminder_queued' || task.status === 'retry_queued') {
      if (totalCallsCount === 0) {
        fallbackRisk = signal?.change_level === 'concern' ? 'high' : 'medium';
        fallbackAction = task.voice_reminder_enabled ? 'trigger_voice_reminder' : 'create_alert';
        fallbackReason = ['Task is overdue and no reminders have been sent yet.'];
        fallbackMsg = `Aino has not confirmed completion of "${task.title}". CareLoop will check in.`;
        fallbackReasoning = 'Overdue task with zero reminder calls placed. Dispatching voice reminder 1.';
      } else if (totalCallsCount === 1) {
        // Check retry delay (5 mins)
        const lastCallTime = new Date(lastCall.created_at).getTime();
        const timeDiffMins = (Date.now() - lastCallTime) / (60 * 1000);
        if (timeDiffMins >= escalationConfig.retry_delay_minutes) {
          fallbackRisk = signal?.change_level === 'concern' ? 'high' : 'medium';
          fallbackAction = 'trigger_voice_reminder';
          fallbackReason = ['Task is overdue, call 1 failed with no answer, and retry window has elapsed.'];
          fallbackMsg = `Aino did not answer the first reminder. Sending call attempt 2.`;
          fallbackReasoning = 'Overdue task with 1 failed call. Wait period of 5 minutes has elapsed. Dispatching voice reminder 2.';
        } else {
          fallbackRisk = 'low';
          fallbackAction = 'no_action';
          fallbackReason = ['Waiting for retry delay window to elapse.'];
          fallbackMsg = `Waiting to retry call reminder.`;
          fallbackReasoning = `First call failed. Waiting for 5 minutes grace period before attempt 2. Only ${timeDiffMins.toFixed(1)} minutes elapsed.`;
        }
      } else if (totalCallsCount >= 2) {
        fallbackRisk = 'high';
        fallbackAction = 'escalate_to_caregiver';
        fallbackReason = ['Medication task is overdue.', 'Aino did not answer call attempt 2 of 2.'];
        fallbackMsg = `Aino missed her medication task and did not answer reminder calls. Please check in.`;
        fallbackReasoning = 'Two reminder call attempts completed with no answer. Escalation triggered according to caregiver configurations.';
      }
    }

    const fallback: CoordinatorResponse = {
      risk_level: fallbackRisk,
      action: fallbackAction,
      reason: fallbackReason,
      message_to_caregiver: fallbackMsg,
      agent_reasoning: fallbackReasoning
    };

    const coordData = await callGeminiJson<CoordinatorResponse>({
      system: systemInstruction,
      prompt,
      schemaName: 'care_coordinator',
      fallback,
    });

    // Run Safety & Escalation Agent check on the generated caregiver message
    const safetyCheck = await safetyEscalationAgent.validateMessage({
      message: coordData.message_to_caregiver,
      taskId: task.id,
    });

    const safeMessage = safetyCheck.safe_message;

    const finalResponse: CoordinatorResponse = {
      ...coordData,
      message_to_caregiver: safeMessage,
      risk_level: safetyCheck.risk_level as CoordinatorResponse['risk_level'],
    };

    // Save action log
    await db.createAgentActionLog({
      agent_name: this.name,
      task_id: task.id,
      input_json: { taskStatus: task.status, signalChangeLevel: signal?.change_level, callsCount: totalCallsCount },
      output_json: finalResponse,
      safety_status: safetyCheck.safety_status,
    });

    return finalResponse;
  }
};
