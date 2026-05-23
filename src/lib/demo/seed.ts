import { db } from '../database/server';
import { morningBriefingAgent } from '../agents/morningBriefingAgent';

export async function seedDemoData() {
  console.log('Seeding demo data...');

  // 1. Clear existing database tables
  await db.clearAllData();

  // 2. Create Users
  const aino = await db.createUser({
    name: 'Aino',
    role: 'elderly',
    phone: '+358000000001',
    relationship: 'elderly loved one',
  });

  const saara = await db.createUser({
    name: 'Saara',
    role: 'caregiver',
    phone: '+358000000002',
    relationship: 'daughter',
  });

  console.log(`Seeded users Aino (${aino.id}) and Saara (${saara.id})`);

  // 3. Create Care Pair
  await db.createCarePair({
    elderly_user_id: aino.id,
    caregiver_user_id: saara.id,
    consent_status: 'active',
  });

  // 4. Create Today's Tasks
  const today = new Date();
  
  const due08 = new Date(today);
  due08.setHours(8, 0, 0, 0);
  
  const due12 = new Date(today);
  due12.setHours(12, 0, 0, 0);

  const due18 = new Date(today);
  due18.setHours(18, 0, 0, 0);

  const task1 = await db.createTask({
    elderly_user_id: aino.id,
    caregiver_user_id: saara.id,
    title: 'Take tonsillitis medication',
    description: 'Morning medication task created by Saara.',
    category: 'Medication',
    due_time: due08.toISOString(),
    priority: 'high',
    status: 'pending',
    created_by: 'caregiver',
    escalation_enabled: true,
    voice_reminder_enabled: true,
  });

  const task2 = await db.createTask({
    elderly_user_id: aino.id,
    caregiver_user_id: saara.id,
    title: 'Eat lunch',
    description: 'A simple meal reminder.',
    category: 'Meal',
    due_time: due12.toISOString(),
    priority: 'medium',
    status: 'pending',
    created_by: 'caregiver',
    escalation_enabled: true,
    voice_reminder_enabled: false,
  });

  const task3 = await db.createTask({
    elderly_user_id: aino.id,
    caregiver_user_id: saara.id,
    title: 'Call or message Saara',
    description: 'Daily social check-in.',
    category: 'Social contact',
    due_time: due18.toISOString(),
    priority: 'low',
    status: 'pending',
    created_by: 'caregiver',
    escalation_enabled: true,
    voice_reminder_enabled: true,
  });

  console.log('Seeded today\'s tasks.');

  // 5. Create default mock passive signal (watch_day)
  await db.createPassiveSignal({
    elderly_user_id: aino.id,
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
    signal_date: today.toISOString().split('T')[0],
    baseline_sleep_score: 72,
    baseline_recovery_score: 68,
    baseline_resting_heart_rate: 63,
    baseline_heart_rate_variability: 50,
    change_level: 'watch',
    summary: 'Aino’s sleep and recovery are lower than her usual baseline, and activity is lower than normal.',
    raw_payload_json: {
      sleep_hours: 5.1,
      deep_sleep_pct: 12,
      rmssd: 35
    }
  });

  console.log('Seeded mock passive signals.');

  // 6. Generate morning brief from seeded data so dashboard shows one immediately after reset
  try {
    const signal = await db.getPassiveSignals(aino.id);
    if (signal[0]) {
      await morningBriefingAgent.generateBrief(aino.id, saara.id, [task1, task2, task3], signal[0]);
      console.log('Seeded morning brief.');
    }
  } catch (err) {
    console.error('Failed to seed morning brief (non-fatal):', err);
  }

  console.log('Demo database seeded successfully.');
  return { aino, saara, tasks: [task1, task2, task3] };
}
