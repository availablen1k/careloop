export interface User {
  id: string;
  name: string;
  role: 'elderly' | 'caregiver';
  phone?: string;
  relationship?: string;
  created_at: string;
}

export interface CarePair {
  id: string;
  elderly_user_id: string;
  caregiver_user_id: string;
  consent_status: 'active' | 'pending' | 'revoked';
  created_at: string;
}

export type TaskStatus =
  | 'pending'
  | 'completed'
  | 'overdue'
  | 'reminder_queued'
  | 'calling_aino'
  | 'no_answer'
  | 'retry_queued'
  | 'escalated_to_saara'
  | 'acknowledged'
  | 'resolved'
  | 'needs_help';

export interface Task {
  id: string;
  elderly_user_id: string;
  caregiver_user_id: string;
  title: string;
  description?: string;
  category: string;
  due_time: string;
  priority: 'low' | 'medium' | 'high';
  status: TaskStatus;
  created_by: 'caregiver' | 'agent';
  escalation_enabled: boolean;
  voice_reminder_enabled: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  task_id?: string;
  elderly_user_id: string;
  caregiver_user_id: string;
  risk_level: 'low' | 'medium' | 'high' | 'urgent';
  message: string;
  reason_json: any;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface VoiceCall {
  id: string;
  task_id?: string;
  alert_id?: string;
  caller_type: 'reminder_to_elderly' | 'alert_to_caregiver';
  recipient_user_id: string;
  provider: 'elevenlabs' | 'simulated' | string;
  status: 'queued' | 'calling' | 'answered' | 'completed' | 'no_answer' | 'failed' | 'needs_help' | 'remind_later';
  script: string;
  response_text?: string;
  response_type?: 'completed' | 'remind_later' | 'needs_help' | 'no_answer' | 'failed';
  attempt_number: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface AgentActionLog {
  id: string;
  agent_name: string;
  task_id?: string;
  alert_id?: string;
  input_json: any;
  output_json: any;
  safety_status: 'approved' | 'blocked' | 'rewritten' | 'not_required';
  created_at: string;
}

export interface PassiveSignal {
  id: string;
  elderly_user_id: string;
  source: 'wearable' | 'other';
  device_label: string;
  sleep_score?: number;
  sleep_duration_hours?: number;
  recovery_score?: number;
  resting_heart_rate?: number;
  heart_rate_variability?: number;
  blood_oxygen?: number;
  skin_temperature_delta?: number;
  activity_level?: 'very_low' | 'low' | 'normal' | 'high';
  steps?: number;
  strain?: number;
  active_minutes?: number;
  signal_date: string;
  baseline_sleep_score?: number;
  baseline_recovery_score?: number;
  baseline_resting_heart_rate?: number;
  baseline_heart_rate_variability?: number;
  change_level: 'normal' | 'watch' | 'concern';
  summary: string;
  raw_payload_json: any;
  created_at: string;
}

export interface MorningBrief {
  id: string;
  elderly_user_id: string;
  caregiver_user_id: string;
  signal_summary: string;
  task_summary: string;
  recommendation: string;
  risk_level: 'low' | 'medium' | 'high';
  created_at: string;
}
