import { wearableAdapter } from '../wearables/wearableAdapter';
import { db } from '../database/server';
import { PassiveSignal } from '../types';
import { callGeminiJson } from '../ai/gemini';
import { caregiverAlertAgent } from './caregiverAlertAgent';

interface HealthAnalysis {
  risk_level: 'low' | 'medium' | 'high' | 'urgent';
  message: string;
  reasons: string[];
}

export const passiveSignalRetrievalAgent = {
  name: 'Passive Signal Retrieval Agent',

  async retrieveSignals(elderlyUserId: string, scenario?: 'normal_day' | 'watch_day' | 'concern_day'): Promise<PassiveSignal> {
    console.log(`[Passive Signal Agent] Retrieving signals for user ${elderlyUserId} with scenario ${scenario || 'default'}`);

    // Load mock signals from the wearable adapter
    const mockData = await wearableAdapter.getSignals(elderlyUserId, scenario);

    // Create the passive signal database entry
    const signal = await db.createPassiveSignal({
      ...mockData,
      signal_date: new Date().toISOString().split('T')[0]
    });

    // Save action log
    await db.createAgentActionLog({
      agent_name: this.name,
      input_json: { elderlyUserId, scenario },
      output_json: signal,
      safety_status: 'not_required',
    });

    // Analyze health metrics and alert caregiver if metrics are very bad
    if (signal.change_level === 'concern') {
      console.log(`[Passive Signal Agent] Biometrics show CONCERN. Analyzing metrics...`);

      const system = `You are the CareLoop Health Analyst Agent.
Your job is to analyze biometric wearable signals from an elderly user (Aino) and write a clear, concise alert message to the caregiver (Saara) explaining why these metrics are highly concerning, compared to her usual baselines.
Be specific but calm. Do not make medical diagnoses, but point out the key deviations (e.g. low sleep, low recovery, elevated heart rate, skin temp elevation, or low oxygen).

Provide a response in JSON format matching:
{
  "risk_level": "high" | "urgent",
  "message": "A summary message of the health concern for the caregiver",
  "reasons": ["A list of specific biometric deviations parsed from the inputs"]
}`;

      const prompt = `Abnormal Wearable Biometrics Detected:
Current Metrics:
- Sleep Score: ${signal.sleep_score}/100 (Baseline: ${signal.baseline_sleep_score})
- Sleep Duration: ${signal.sleep_duration_hours} hours
- Recovery Score: ${signal.recovery_score}/100 (Baseline: ${signal.baseline_recovery_score})
- Resting Heart Rate: ${signal.resting_heart_rate} bpm (Baseline: ${signal.baseline_resting_heart_rate})
- Skin Temp Deviation: ${signal.skin_temperature_delta}°C
- Blood Oxygen (SpO2): ${signal.blood_oxygen}%
- HRV: ${signal.heart_rate_variability} ms (Baseline: ${signal.baseline_heart_rate_variability} ms)

Summary: ${signal.summary}`;

      const fallback: HealthAnalysis = {
        risk_level: 'high',
        message: `Abnormal health metrics detected for Aino: Sleep is abnormally low (${signal.sleep_score}/100) and recovery is low (${signal.recovery_score}/100).`,
        reasons: [
          `Sleep score: ${signal.sleep_score}/100 (Baseline: ${signal.baseline_sleep_score})`,
          `Recovery score: ${signal.recovery_score}/100 (Baseline: ${signal.baseline_recovery_score})`,
          `Resting heart rate: ${signal.resting_heart_rate} bpm (Baseline: ${signal.baseline_resting_heart_rate})`,
          `Skin temperature deviation: ${signal.skin_temperature_delta}°C`
        ]
      };

      try {
        const analysis = await callGeminiJson<HealthAnalysis>({
          system,
          prompt,
          schemaName: 'health_analysis',
          fallback
        });

        // Fetch caregiver details to link the alert correctly
        const caregiver = await db.getUserByRole('caregiver');
        const caregiverUserId = caregiver?.id || '';

        await caregiverAlertAgent.createAlert({
          elderlyUserId,
          caregiverUserId,
          riskLevel: analysis.risk_level,
          message: analysis.message,
          reason: analysis.reasons,
          triggerCall: false
        });
      } catch (err) {
        console.error('Health metrics analysis failed:', err);
      }
    }

    return signal;
  }
};
