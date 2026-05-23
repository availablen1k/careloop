import { voiceAdapter } from '../voice/voiceAdapter';
import { db } from '../database/server';
import { safetyEscalationAgent } from './safetyEscalationAgent';
import { Task, Alert } from '../types';

export const caregiverAlertAgent = {
  name: 'Caregiver Alert Agent',

  async createAlert(input: {
    task?: Task;
    elderlyUserId?: string;
    caregiverUserId?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'urgent';
    message: string;
    reason: string[];
    triggerCall?: boolean;
  }): Promise<Alert> {
    const elderlyId = input.task?.elderly_user_id || input.elderlyUserId;
    const caregiverId = input.task?.caregiver_user_id || input.caregiverUserId;

    if (!elderlyId || !caregiverId) {
      throw new Error('elderlyUserId and caregiverUserId are required when task is not provided');
    }

    console.log(`[Caregiver Alert Agent] Creating alert for user ${elderlyId} with risk ${input.riskLevel}`);

    // 1. Validate safety of the alert message
    const safetyCheck = await safetyEscalationAgent.validateMessage({
      message: input.message,
      taskId: input.task?.id,
    });

    const safeMessage = safetyCheck.safe_message;

    // 2. Insert alert record
    const alert = await db.createAlert({
      task_id: input.task?.id,
      elderly_user_id: elderlyId,
      caregiver_user_id: caregiverId,
      risk_level: input.riskLevel,
      message: safeMessage,
      reason_json: input.reason,
      status: 'open',
    });

    // 3. Trigger voice call to caregiver if needed (e.g. for high or urgent alerts)
    let callRecord = null;
    if (input.triggerCall || input.riskLevel === 'high' || input.riskLevel === 'urgent') {
      const script = `Hello Saara. This is CareLoop. Alert status update: ${safeMessage} Please check in with Aino when possible.`;
      
      const caregiver = await db.getUserById(caregiverId);
      const recipientPhone = caregiver?.phone || '+358000000002';

      // Call caregiver
      const callResult = await voiceAdapter.callSaara({
        alertId: alert.id,
        recipientPhone,
        script,
      });

      // Save voice call row
      callRecord = await db.createVoiceCall({
        task_id: input.task?.id,
        alert_id: alert.id,
        caller_type: 'alert_to_caregiver',
        recipient_user_id: caregiverId,
        provider: callResult.provider,
        status: callResult.status === 'completed' ? 'completed' : 'failed',
        script,
        response_text: callResult.status === 'completed' ? 'Call answered and notification delivered.' : 'Call failed.',
        attempt_number: 1
      });

      // Update started/completed timestamps
      await db.updateVoiceCall(callRecord.id, {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
    }

    // 4. Log Agent Action
    await db.createAgentActionLog({
      agent_name: this.name,
      task_id: input.task?.id,
      alert_id: alert.id,
      input_json: { riskLevel: input.riskLevel, message: input.message, reason: input.reason },
      output_json: { alertId: alert.id, voiceCallId: callRecord?.id || null },
      safety_status: safetyCheck.safety_status,
    });

    return alert;
  }
};
