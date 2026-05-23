import { callGeminiJson } from '../ai/gemini';
import { db } from '../database/server';

export interface SafetyCheckResult {
  safety_status: 'approved' | 'blocked' | 'rewritten';
  risk_level: 'low' | 'medium' | 'high' | 'urgent';
  safe_message: string;
  blocked_reason: string | null;
}

export const safetyEscalationAgent = {
  name: 'Safety & Escalation Agent',

  async validateMessage(input: {
    message: string;
    taskId?: string;
    alertId?: string;
  }): Promise<SafetyCheckResult> {
    const systemInstruction = `
You are the Safety & Escalation Agent for CareLoop.

Your job is to validate or rewrite messages before they are shown or spoken.

CareLoop is not a medical diagnosis tool.
CareLoop is not emergency dispatch.
CareLoop supports family coordination.

Block or rewrite:
- diagnosis (e.g. dementia, alzheimer's, illness)
- medical claims
- panic language
- unsafe medication instructions
- invented dosage
- claims that Aino is in danger or medically unsafe (e.g. sick, danger, emergency, health failing)

Allowed:
- missed task statements
- no-answer statements
- "CareLoop recommends a family check-in"
- "Aino asked for help"
- "signals are different from usual pattern"

Return only JSON in this format:
{
  "safety_status": "approved | blocked | rewritten",
  "risk_level": "low | medium | high | urgent",
  "safe_message": "string",
  "blocked_reason": "string | null"
}
    `;

    const prompt = `
Message to validate:
"${input.message}"
    `;

    // Default fallback in case Gemini is offline/mocked
    const fallback: SafetyCheckResult = {
      safety_status: 'approved',
      risk_level: 'low',
      safe_message: input.message,
      blocked_reason: null,
    };

    // If deterministic code check triggers, we can pre-feed it to make sure mock fallback is 100% compliant
    // This handles both the real Gemini and mock Gemini cases.
    const result = await callGeminiJson<SafetyCheckResult>({
      system: systemInstruction,
      prompt,
      schemaName: 'safety_check',
      fallback,
    });

    // Double check deterministically in code for safety (Defense-in-depth)
    const lowerMsg = input.message.toLowerCase();
    const unsafeWords = ['dementia', 'sick', 'danger', 'emergency', 'failing', 'medically unsafe', 'two pills'];
    const foundUnsafe = unsafeWords.find(word => lowerMsg.includes(word));

    let finalResult = { ...result };

    if (foundUnsafe && finalResult.safety_status === 'approved') {
      // Override to rewritten if Gemini missed an unsafe word
      let rewrittenMessage = 'Aino has not completed her task and CareLoop recommends a caregiver check-in.';
      if (lowerMsg.includes('pill') || lowerMsg.includes('medication')) {
        rewrittenMessage = 'Aino has not completed her medication task due at 08:00. CareLoop recommends a check-in.';
      } else if (lowerMsg.includes('help') || lowerMsg.includes('urgent')) {
        rewrittenMessage = 'Aino asked for help. CareLoop recommends that Saara checks in now.';
      } else if (lowerMsg.includes('wearable') || lowerMsg.includes('signal')) {
        rewrittenMessage = 'Aino’s passive signals are different from her usual pattern.';
      }

      finalResult = {
        safety_status: 'rewritten',
        risk_level: lowerMsg.includes('help') || lowerMsg.includes('urgent') ? 'urgent' : 'medium',
        safe_message: rewrittenMessage,
        blocked_reason: `Deterministic safety override: Contained unsafe term "${foundUnsafe}".`
      };
    }

    // Save action log
    await db.createAgentActionLog({
      agent_name: this.name,
      task_id: input.taskId,
      alert_id: input.alertId,
      input_json: { message: input.message },
      output_json: finalResult,
      safety_status: finalResult.safety_status,
    });

    return finalResult;
  }
};
