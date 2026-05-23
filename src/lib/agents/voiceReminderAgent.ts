import { voiceAdapter, VoiceCallResult } from '../voice/voiceAdapter';
import { db } from '../database/server';
import { safetyEscalationAgent } from './safetyEscalationAgent';
import { Task } from '../types';

export const voiceReminderAgent = {
  name: 'Voice Reminder Agent',

  async callAino(task: Task, forcedResult?: VoiceCallResult, attemptNumber: number = 1) {
    console.log(`[Voice Reminder Agent] Simulating call to Aino for task: "${task.title}" (Attempt ${attemptNumber})`);

    // 1. Generate call script
    const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon';
    const script = `${greeting} Aino. This is CareLoop. I’m calling to remind you about your task: ${task.title}. Have you completed it? You can say: yes, I took it; remind me later; or I need help.`;

    // 2. Validate script safety
    const safetyCheck = await safetyEscalationAgent.validateMessage({
      message: script,
      taskId: task.id,
    });

    const safeScript = safetyCheck.safe_message;

    // 3. Initiate call via voice adapter
    // Retrieve Aino's phone number
    const ainoUser = await db.getUserById(task.elderly_user_id);
    const recipientPhone = ainoUser?.phone || '+358000000001';

    // Real Outbound Call via ElevenLabs Conversational AI + Twilio
    const elAgentId = process.env.ELEVENLABS_AGENT_ID;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_PHONE;

    let realCallSid: string | null = null;
    if (elAgentId && twilioSid && twilioToken && twilioFrom) {
      try {
        console.log(`[Voice Reminder Agent] Initiating REAL voice reminder via Twilio + ElevenLabs to Aino (${recipientPhone})`);
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: recipientPhone,
              From: twilioFrom,
              Url: `https://api.elevenlabs.io/v1/convai/webhooks/twilio?agent_id=${elAgentId}`
            }).toString()
          }
        );
        const resJson: any = await response.json();
        if (resJson.sid) {
          realCallSid = resJson.sid;
          console.log(`[Voice Reminder Agent] Real Call SID initiated: ${realCallSid}`);
        } else {
          console.error('[Voice Reminder Agent] Twilio API Error response:', resJson);
        }
      } catch (err) {
        console.error('[Voice Reminder Agent] Failed to place Twilio + ElevenLabs API call:', err);
      }
    }

    // Call voice adapter (mock simulation continues to run to update task state in the UI for the caregiver)
    const callResult = await voiceAdapter.callAino({
      taskId: task.id,
      recipientPhone,
      script: safeScript,
      forcedResult,
      attemptNumber,
    });

    // 4. Create Voice Call database record
    const voiceCall = await db.createVoiceCall({
      task_id: task.id,
      alert_id: undefined,
      caller_type: 'reminder_to_elderly',
      recipient_user_id: task.elderly_user_id,
      provider: realCallSid ? `elevenlabs_twilio:${realCallSid}` : callResult.provider,
      status: callResult.status === 'no_answer' ? 'no_answer' : (callResult.status === 'failed' ? 'failed' : 'completed'),
      script: safeScript,
      response_text: callResult.responseText || undefined,
      response_type: callResult.status,
      attempt_number: attemptNumber
    });

    // Update started/completed timestamps on the call
    await db.updateVoiceCall(voiceCall.id, {
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });

    // 5. Update Task Status based on call outcome
    let updatedStatus = task.status;
    let completedAt: string | undefined = undefined;

    if (callResult.status === 'completed') {
      updatedStatus = 'completed';
      completedAt = new Date().toISOString();
    } else if (callResult.status === 'needs_help') {
      updatedStatus = 'needs_help';
    } else if (callResult.status === 'remind_later') {
      updatedStatus = 'retry_queued';
    } else if (callResult.status === 'no_answer') {
      // Set to retry_queued so the coordinator's fallback logic picks it up on the next cycle
      updatedStatus = 'retry_queued';
    } else {
      updatedStatus = 'retry_queued';
    }

    const updatedTask = await db.updateTask(task.id, {
      status: updatedStatus,
      completed_at: completedAt,
    });

    // 6. Log Agent Action
    await db.createAgentActionLog({
      agent_name: this.name,
      task_id: task.id,
      input_json: { script: safeScript, attemptNumber, forcedResult },
      output_json: { callId: voiceCall.id, status: callResult.status, newStatus: updatedStatus },
      safety_status: safetyCheck.safety_status,
    });

    return {
      voiceCall,
      task: updatedTask,
      result: callResult.status,
    };
  }
};
