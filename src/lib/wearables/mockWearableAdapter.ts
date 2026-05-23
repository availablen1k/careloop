export interface WearableData {
  scenario: 'normal_day' | 'watch_day' | 'concern_day';
  source: 'wearable';
  device_label: string;
  sleep_score: number;
  sleep_duration_hours: number;
  recovery_score: number;
  resting_heart_rate: number;
  heart_rate_variability: number;
  blood_oxygen: number;
  skin_temperature_delta: number;
  activity_level: 'normal' | 'low' | 'very_low';
  steps: number;
  strain: number;
  active_minutes: number;
  baseline_sleep_score: number;
  baseline_recovery_score: number;
  baseline_resting_heart_rate: number;
  baseline_heart_rate_variability: number;
  change_level: 'normal' | 'watch' | 'concern';
  summary: string;
}

export const wearableScenarios: Record<string, Omit<WearableData, 'scenario'>> = {
  normal_day: {
    source: 'wearable',
    device_label: 'Passive Health Sensor',
    sleep_score: 76,
    sleep_duration_hours: 7.5,
    recovery_score: 71,
    resting_heart_rate: 63,
    heart_rate_variability: 52,
    blood_oxygen: 98,
    skin_temperature_delta: 0.0,
    activity_level: 'normal',
    steps: 3200,
    strain: 6.1,
    active_minutes: 35,
    baseline_sleep_score: 72,
    baseline_recovery_score: 68,
    baseline_resting_heart_rate: 63,
    baseline_heart_rate_variability: 50,
    change_level: 'normal',
    summary: 'Aino’s passive signals look close to her usual baseline.',
  },
  watch_day: {
    source: 'wearable',
    device_label: 'Passive Health Sensor',
    sleep_score: 48,
    sleep_duration_hours: 5.1,
    recovery_score: 41,
    resting_heart_rate: 72,
    heart_rate_variability: 35,
    blood_oxygen: 96,
    skin_temperature_delta: 0.3,
    activity_level: 'low',
    steps: 850,
    strain: 4.2,
    active_minutes: 10,
    baseline_sleep_score: 72,
    baseline_recovery_score: 68,
    baseline_resting_heart_rate: 63,
    baseline_heart_rate_variability: 50,
    change_level: 'watch',
    summary: 'Aino’s sleep and recovery are lower than usual. CareLoop will monitor today’s care tasks.',
  },
  concern_day: {
    source: 'wearable',
    device_label: 'Passive Health Sensor',
    sleep_score: 31,
    sleep_duration_hours: 4.0,
    recovery_score: 28,
    resting_heart_rate: 79,
    heart_rate_variability: 22,
    blood_oxygen: 95,
    skin_temperature_delta: 0.8,
    activity_level: 'very_low',
    steps: 210,
    strain: 1.2,
    active_minutes: 2,
    baseline_sleep_score: 72,
    baseline_recovery_score: 68,
    baseline_resting_heart_rate: 63,
    baseline_heart_rate_variability: 50,
    change_level: 'concern',
    summary: 'Aino’s passive signals are significantly different from her usual pattern. This is not a diagnosis, but it may be worth checking in if care tasks are missed.',
  },
};

export async function getMockWearableSignals(
  elderlyUserId: string,
  scenario: 'normal_day' | 'watch_day' | 'concern_day' = 'watch_day'
) {
  const data = wearableScenarios[scenario] || wearableScenarios.watch_day;
  return {
    elderly_user_id: elderlyUserId,
    ...data,
    raw_payload_json: { ...data }
  };
}
