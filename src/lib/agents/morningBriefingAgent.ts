import { callGeminiJson } from '../ai/gemini';
import { db } from '../database/server';
import { safetyEscalationAgent } from './safetyEscalationAgent';
import { MorningBrief, Task, PassiveSignal } from '../types';

interface BriefResponse {
  risk_level: 'low' | 'medium' | 'high';
  signal_summary: string;
  task_summary: string;
  recommendation: string;
  agent_reasoning: string;
}

export const morningBriefingAgent = {
  name: 'Morning Briefing Agent',

  async generateBrief(elderlyUserId: string, caregiverUserId: string, tasks: Task[], signal: PassiveSignal): Promise<MorningBrief> {
    console.log(`[Morning Brief Agent] Generating brief for caregiver ${caregiverUserId}`);

    const systemInstruction = `
You are the Morning Briefing Agent for CareLoop.

Your job is to write a calm morning summary for Saara, the caregiver.

Use:
- today's care tasks
- synthetic passive wearable context
- recent unresolved alerts

Rules:
- Do not diagnose.
- Do not say Aino is sick.
- Do not say Aino is in danger.
- Do not create panic.
- Say "signals are different from usual pattern" instead of medical claims.
- Keep the summary practical and family-friendly.

Return only JSON in this format:
{
  "risk_level": "low | medium | high",
  "signal_summary": "string",
  "task_summary": "string",
  "recommendation": "string",
  "agent_reasoning": "Explain your analysis of wearable metrics relative to baseline and task schedules."
}
    `;

    const prompt = `
Tasks for today:
${tasks.map(t => `- ${t.title} (${t.category}) due at ${t.due_time.split('T')[1].substring(0, 5)}`).join('\n')}

Passive wearable context:
Sleep Score: ${signal.sleep_score}/100 (Baseline: ${signal.baseline_sleep_score})
Recovery Score: ${signal.recovery_score}/100 (Baseline: ${signal.baseline_recovery_score})
Resting Heart Rate: ${signal.resting_heart_rate} bpm (Baseline: ${signal.baseline_resting_heart_rate})
Change level: ${signal.change_level}
Summary: ${signal.summary}
    `;

    // Fallback response
    const fallback: BriefResponse = {
      risk_level: signal.change_level === 'concern' ? 'medium' : 'low',
      signal_summary: `Aino’s passive signals are ${signal.change_level} today.`,
      task_summary: `Aino has ${tasks.length} tasks scheduled for today.`,
      recommendation: 'CareLoop will monitor today’s tasks and remind Aino as needed.',
      agent_reasoning: `Synthesizing baseline wearable change level of "${signal.change_level}" alongside ${tasks.length} active tasks.`
    };

    const briefData = await callGeminiJson<BriefResponse>({
      system: systemInstruction,
      prompt,
      schemaName: 'morning_brief',
      fallback,
    });

    // Run Safety & Escalation Agent check on the generated briefing recommendation
    const safetyCheck = await safetyEscalationAgent.validateMessage({
      message: briefData.recommendation,
    });

    const safeRecommendation = safetyCheck.safe_message;

    // Save morning brief row
    const brief = await db.createMorningBrief({
      elderly_user_id: elderlyUserId,
      caregiver_user_id: caregiverUserId,
      signal_summary: briefData.signal_summary,
      task_summary: briefData.task_summary,
      recommendation: safeRecommendation,
      risk_level: briefData.risk_level,
    });

    // Save action log
    await db.createAgentActionLog({
      agent_name: this.name,
      input_json: { tasksCount: tasks.length, signalChangeLevel: signal.change_level },
      output_json: {
        ...brief,
        agent_reasoning: briefData.agent_reasoning || 'No agent thoughts logged.'
      },
      safety_status: safetyCheck.safety_status,
    });

    return brief;
  }
};
