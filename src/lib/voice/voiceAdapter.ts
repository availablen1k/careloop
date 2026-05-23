import { elevenLabsAdapter } from './elevenLabsAdapter';
import { simulatedVoiceAdapter } from './simulatedVoiceAdapter';

export type VoiceCallResult =
  | 'completed'
  | 'remind_later'
  | 'needs_help'
  | 'no_answer'
  | 'failed';

export interface VoiceAdapter {
  callAino(input: {
    taskId: string;
    recipientPhone?: string;
    script: string;
    forcedResult?: VoiceCallResult;
    attemptNumber: number;
  }): Promise<{
    provider: 'elevenlabs' | 'simulated';
    status: VoiceCallResult;
    responseText?: string;
  }>;

  callSaara(input: {
    alertId: string;
    recipientPhone?: string;
    script: string;
  }): Promise<{
    provider: 'elevenlabs' | 'simulated';
    status: 'completed' | 'failed';
  }>;
}

// Select active voice adapter based on env
export const voiceAdapter: VoiceAdapter = process.env.ELEVENLABS_API_KEY ? elevenLabsAdapter : simulatedVoiceAdapter;
export { simulatedVoiceAdapter, elevenLabsAdapter };
