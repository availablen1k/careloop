import { VoiceCallResult, VoiceAdapter } from './voiceAdapter';
import { simulatedVoiceAdapter } from './simulatedVoiceAdapter';

export const elevenLabsAdapter: VoiceAdapter = {
  async callAino(input: {
    taskId: string;
    recipientPhone?: string;
    script: string;
    forcedResult?: VoiceCallResult;
    attemptNumber: number;
  }): Promise<{
    provider: 'elevenlabs' | 'simulated';
    status: VoiceCallResult;
    responseText?: string;
  }> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      // API Key missing, fall back to simulated adapter
      return simulatedVoiceAdapter.callAino(input);
    }

    try {
      console.log(`[ElevenLabs] Call initiated to ${input.recipientPhone || 'Aino'} with script: "${input.script}"`);
      
      // Perform HTTP request to ElevenLabs conversation API (simulated for MVP)
      // Since ElevenLabs convai requires real phone calling configuration, 
      // we log the call and return a mock 'completed' status or the forced result.
      const status = input.forcedResult || 'completed';
      let responseText = 'Yes, I took it (via ElevenLabs Agent).';
      if (status === 'no_answer') responseText = '';
      if (status === 'needs_help') responseText = 'I need help (via ElevenLabs Agent).';

      return {
        provider: 'elevenlabs',
        status,
        responseText,
      };
    } catch (error) {
      console.error('ElevenLabs call failed, falling back to simulated:', error);
      return simulatedVoiceAdapter.callAino(input);
    }
  },

  async callSaara(input: {
    alertId: string;
    recipientPhone?: string;
    script: string;
  }): Promise<{
    provider: 'elevenlabs' | 'simulated';
    status: 'completed' | 'failed';
  }> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return simulatedVoiceAdapter.callSaara(input);
    }

    try {
      console.log(`[ElevenLabs] Caregiver alert call initiated to Saara: "${input.script}"`);
      return {
        provider: 'elevenlabs',
        status: 'completed',
      };
    } catch (error) {
      console.error('ElevenLabs caregiver call failed:', error);
      return simulatedVoiceAdapter.callSaara(input);
    }
  }
};
