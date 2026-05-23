import { VoiceCallResult } from './voiceAdapter';

export const simulatedVoiceAdapter = {
  async callAino(input: {
    taskId: string;
    recipientPhone?: string;
    script: string;
    forcedResult?: VoiceCallResult;
    attemptNumber: number;
  }): Promise<{
    provider: 'simulated';
    status: VoiceCallResult;
    responseText?: string;
  }> {
    // Default to 'no_answer' so the real auto-flow triggers retry and escalation logic.
    // Demo simulation buttons always pass a forcedResult explicitly.
    const status = input.forcedResult || 'no_answer';
    
    let responseText: string | undefined = undefined;
    if (status === 'completed') {
      responseText = 'Yes, I took it.';
    } else if (status === 'remind_later') {
      responseText = 'Can you call back in a little while? I am a bit busy.';
    } else if (status === 'needs_help') {
      responseText = 'I need help, can you notify my daughter?';
    }

    return {
      provider: 'simulated',
      status,
      responseText,
    };
  },

  async callSaara(input: {
    alertId: string;
    recipientPhone?: string;
    script: string;
  }): Promise<{
    provider: 'simulated';
    status: 'completed' | 'failed';
  }> {
    void input;

    return {
      provider: 'simulated',
      status: 'completed',
    };
  }
};
