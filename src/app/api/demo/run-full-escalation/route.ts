import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { query } from '@/lib/db';
import { seedDemoData } from '@/lib/demo/seed';

export async function POST() {
  try {
    // 1. Reset database to seed state
    const seeded = await seedDemoData();
    const { aino, saara, tasks } = seeded;
    const medTask = tasks.find(t => t.category === 'Medication')!;

    const today = new Date();
    const setTime = (hours: number, minutes: number) => {
      const d = new Date(today);
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    };

    // --- TIMELINE EVENTS CREATION ---

    // 07:00 - Passive Signal retrieved
    // Delete seed signal and re-add with exact timestamp
    await query('DELETE FROM passive_signals');
    const signalTime = setTime(7, 0);
    const signal = await db.createPassiveSignal({
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
      summary: 'Aino’s sleep and recovery are lower than usual. CareLoop will monitor today’s care tasks.',
      raw_payload_json: { sleep_hours: 5.1, deep_sleep_pct: 12, rmssd: 35 }
    });
    // Force signal creation timestamp
    await query('UPDATE passive_signals SET created_at = $1 WHERE id = $2', [signalTime, signal.id]);

    // 07:01 - Morning Briefing
    await query('DELETE FROM morning_briefs');
    const briefTime = setTime(7, 1);
    const brief = await db.createMorningBrief({
      elderly_user_id: aino.id,
      caregiver_user_id: saara.id,
      signal_summary: 'Aino’s sleep and recovery signals are lower than usual today.',
      task_summary: 'Aino has a medication task due at 08:00, lunch at 12:00, and a social check-in at 18:00.',
      recommendation: 'No action is needed yet. CareLoop will monitor today’s care tasks.',
      risk_level: 'low'
    });
    await query('UPDATE morning_briefs SET created_at = $1 WHERE id = $2', [briefTime, brief.id]);
    
    // Log morning brief agent action
    const briefLog = await db.createAgentActionLog({
      agent_name: 'Morning Briefing Agent',
      input_json: { tasksCount: tasks.length, signalChangeLevel: 'watch' },
      output_json: brief,
      safety_status: 'approved',
    });
    await query('UPDATE agent_action_logs SET created_at = $1 WHERE id = $2', [briefTime, briefLog.id]);

    // 08:00 - Medication task becomes overdue
    const taskOverdueTime = setTime(8, 0);
    await db.updateTask(medTask.id, {
      due_time: taskOverdueTime,
      status: 'overdue'
    });

    // 08:05 - Care Coordinator Agent detects overdue task
    const coordTime = setTime(8, 5);
    const coordResponse = {
      risk_level: 'medium',
      action: 'trigger_voice_reminder',
      reason: ['Medication task is overdue', 'Aino has not confirmed completion', 'Morning passive signal is lower than usual'],
      message_to_caregiver: 'Aino has not completed her medication task due at 08:00. CareLoop will send a gentle reminder call.'
    };
    const coordLog = await db.createAgentActionLog({
      agent_name: 'Care Coordinator Agent',
      task_id: medTask.id,
      input_json: { taskStatus: 'overdue', signalChangeLevel: 'watch' },
      output_json: coordResponse,
      safety_status: 'approved'
    });
    await query('UPDATE agent_action_logs SET created_at = $1 WHERE id = $2', [coordTime, coordLog.id]);

    // 08:06 - Safety & Escalation Agent approves reminder
    const safetyTime = setTime(8, 6);
    const safetyResponse = {
      safety_status: 'approved',
      risk_level: 'medium',
      safe_message: 'Good morning Aino. This is CareLoop. I’m calling to remind you about your task: Take tonsillitis medication. Have you taken it already?',
      blocked_reason: null
    };
    const safetyLog = await db.createAgentActionLog({
      agent_name: 'Safety & Escalation Agent',
      task_id: medTask.id,
      input_json: { message: 'Good morning Aino. This is CareLoop. I’m calling to remind you about your task...' },
      output_json: safetyResponse,
      safety_status: 'approved'
    });
    await query('UPDATE agent_action_logs SET created_at = $1 WHERE id = $2', [safetyTime, safetyLog.id]);

    // 08:07 - Call 1 (no answer)
    const call1Time = setTime(8, 7);
    const call1EndTime = setTime(8, 8);
    const call1 = await db.createVoiceCall({
      task_id: medTask.id,
      alert_id: undefined,
      caller_type: 'reminder_to_elderly',
      recipient_user_id: aino.id,
      provider: 'simulated',
      status: 'no_answer',
      script: safetyResponse.safe_message,
      attempt_number: 1
    });
    await query(
      'UPDATE voice_calls SET created_at = $1, started_at = $1, completed_at = $2 WHERE id = $3',
      [call1Time, call1EndTime, call1.id]
    );

    const reminderLog1 = await db.createAgentActionLog({
      agent_name: 'Voice Reminder Agent',
      task_id: medTask.id,
      input_json: { script: safetyResponse.safe_message, attemptNumber: 1 },
      output_json: { callId: call1.id, status: 'no_answer', newStatus: 'retry_queued' },
      safety_status: 'approved'
    });
    await query('UPDATE agent_action_logs SET created_at = $1 WHERE id = $2', [call1EndTime, reminderLog1.id]);

    // Update task to retry_queued
    await db.updateTask(medTask.id, { status: 'retry_queued' });

    // 08:13 - Call 2 (no answer)
    const call2Time = setTime(8, 13);
    const call2EndTime = setTime(8, 14);
    const call2 = await db.createVoiceCall({
      task_id: medTask.id,
      alert_id: undefined,
      caller_type: 'reminder_to_elderly',
      recipient_user_id: aino.id,
      provider: 'simulated',
      status: 'no_answer',
      script: safetyResponse.safe_message,
      attempt_number: 2
    });
    await query(
      'UPDATE voice_calls SET created_at = $1, started_at = $1, completed_at = $2 WHERE id = $3',
      [call2Time, call2EndTime, call2.id]
    );

    const reminderLog2 = await db.createAgentActionLog({
      agent_name: 'Voice Reminder Agent',
      task_id: medTask.id,
      input_json: { script: safetyResponse.safe_message, attemptNumber: 2 },
      output_json: { callId: call2.id, status: 'no_answer', newStatus: 'escalated_to_saara' },
      safety_status: 'approved'
    });
    await query('UPDATE agent_action_logs SET created_at = $1 WHERE id = $2', [call2EndTime, reminderLog2.id]);

    // Update task to escalated_to_saara
    const finalTask = await db.updateTask(medTask.id, { status: 'escalated_to_saara' });

    // 08:15 - Escalate to Saara
    const escalationTime = setTime(8, 15);
    const alertMsg = `Aino missed her medication task "${medTask.title}" and did not answer reminder calls. Please check in.`;
    const alert = await db.createAlert({
      task_id: medTask.id,
      elderly_user_id: aino.id,
      caregiver_user_id: saara.id,
      risk_level: 'high',
      message: alertMsg,
      reason_json: ['Medication task is overdue.', 'Aino did not answer call attempt 2 of 2.'],
      status: 'open'
    });
    await query('UPDATE alerts SET created_at = $1 WHERE id = $2', [escalationTime, alert.id]);

    const alertLog = await db.createAgentActionLog({
      agent_name: 'Caregiver Alert Agent',
      task_id: medTask.id,
      alert_id: alert.id,
      input_json: { riskLevel: 'high', message: alertMsg },
      output_json: { alertId: alert.id, voiceCallId: null },
      safety_status: 'approved'
    });
    await query('UPDATE agent_action_logs SET created_at = $1 WHERE id = $2', [escalationTime, alertLog.id]);

    // Trigger simulated voice call alert to Saara
    const saaraCallTime = setTime(8, 15);
    const saaraCall = await db.createVoiceCall({
      task_id: medTask.id,
      alert_id: alert.id,
      caller_type: 'alert_to_caregiver',
      recipient_user_id: saara.id,
      provider: 'simulated',
      status: 'completed',
      script: `Hello Saara. This is CareLoop. Alert status update: ${alertMsg} Please check in with Aino when possible.`,
      attempt_number: 1
    });
    await query(
      'UPDATE voice_calls SET created_at = $1, started_at = $1, completed_at = $1 WHERE id = $2',
      [saaraCallTime, saaraCall.id]
    );

    return NextResponse.json({
      ok: true,
      message: 'Full escalation timeline generated successfully.',
      task: finalTask,
      alert
    });
  } catch (error: any) {
    console.error('Error generating full escalation timeline:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
