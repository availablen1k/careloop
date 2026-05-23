import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, CarePair, Task, Alert, VoiceCall, AgentActionLog, PassiveSignal, MorningBrief } from '../types';

const DB_FILE = path.join(process.cwd(), 'localDb.json');

interface LocalDbSchema {
  users: User[];
  care_pairs: CarePair[];
  tasks: Task[];
  alerts: Alert[];
  passive_signals: PassiveSignal[];
  morning_briefs: MorningBrief[];
  voice_calls: VoiceCall[];
  agent_action_logs: AgentActionLog[];
}

function readLocalDb(): LocalDbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('[Local DB] Error reading file, using empty schema', e);
  }
  return {
    users: [],
    care_pairs: [],
    tasks: [],
    alerts: [],
    passive_signals: [],
    morning_briefs: [],
    voice_calls: [],
    agent_action_logs: []
  };
}

function saveLocalDb(data: LocalDbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Local DB] Error writing to file', e);
  }
}

export const db = {
  // Users
  async getUsers(): Promise<User[]> {
    const data = readLocalDb();
    return [...data.users].sort((a, b) => a.name.localeCompare(b.name));
  },
  
  async getUserById(id: string): Promise<User | null> {
    const data = readLocalDb();
    return data.users.find(u => u.id === id) || null;
  },

  async getUserByRole(role: 'elderly' | 'caregiver'): Promise<User | null> {
    const data = readLocalDb();
    return data.users.find(u => u.role === role) || null;
  },

  async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const data = readLocalDb();
    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    data.users.push(newUser);
    saveLocalDb(data);
    return newUser;
  },

  // Care Pairs
  async getCarePairs(): Promise<CarePair[]> {
    const data = readLocalDb();
    return data.care_pairs;
  },

  async createCarePair(pair: Omit<CarePair, 'id' | 'created_at'>): Promise<CarePair> {
    const data = readLocalDb();
    const newPair: CarePair = {
      ...pair,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    data.care_pairs.push(newPair);
    saveLocalDb(data);
    return newPair;
  },

  // Tasks
  async getTasks(elderlyUserId?: string): Promise<Task[]> {
    const data = readLocalDb();
    let tasks = data.tasks;
    if (elderlyUserId) {
      tasks = tasks.filter(t => t.elderly_user_id === elderlyUserId);
    }
    return [...tasks].sort((a, b) => new Date(a.due_time).getTime() - new Date(b.due_time).getTime());
  },

  async getTaskById(id: string): Promise<Task | null> {
    const data = readLocalDb();
    return data.tasks.find(t => t.id === id) || null;
  },

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const data = readLocalDb();
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.tasks.push(newTask);
    saveLocalDb(data);
    return newTask;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const data = readLocalDb();
    const index = data.tasks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Task not found');
    const updated: Task = {
      ...data.tasks[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    data.tasks[index] = updated;
    saveLocalDb(data);
    return updated;
  },

  // Alerts
  async getAlerts(caregiverUserId?: string): Promise<Alert[]> {
    const data = readLocalDb();
    let alerts = data.alerts;
    if (caregiverUserId) {
      alerts = alerts.filter(a => a.caregiver_user_id === caregiverUserId);
    }
    return [...alerts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getAlertById(id: string): Promise<Alert | null> {
    const data = readLocalDb();
    return data.alerts.find(a => a.id === id) || null;
  },

  async getAlertByTaskId(taskId: string): Promise<Alert | null> {
    const data = readLocalDb();
    const matches = data.alerts.filter(a => a.task_id === taskId);
    if (matches.length === 0) return null;
    const sorted = [...matches].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted[0];
  },

  async createAlert(alert: Omit<Alert, 'id' | 'created_at' | 'acknowledged_at' | 'resolved_at'>): Promise<Alert> {
    const data = readLocalDb();
    const newAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      acknowledged_at: undefined,
      resolved_at: undefined,
      reason_json: alert.reason_json || []
    };
    data.alerts.push(newAlert);
    saveLocalDb(data);
    return newAlert;
  },

  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert> {
    const data = readLocalDb();
    const index = data.alerts.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Alert not found');
    const updated = {
      ...data.alerts[index],
      ...updates
    };
    data.alerts[index] = updated;
    saveLocalDb(data);
    return updated;
  },

  // Voice Calls
  async getVoiceCalls(recipientUserId?: string): Promise<VoiceCall[]> {
    const data = readLocalDb();
    let calls = data.voice_calls;
    if (recipientUserId) {
      calls = calls.filter(c => c.recipient_user_id === recipientUserId);
    }
    return [...calls].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createVoiceCall(call: Omit<VoiceCall, 'id' | 'created_at' | 'started_at' | 'completed_at'>): Promise<VoiceCall> {
    const data = readLocalDb();
    const newCall: VoiceCall = {
      ...call,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    };
    data.voice_calls.push(newCall);
    saveLocalDb(data);
    return newCall;
  },

  async updateVoiceCall(id: string, updates: Partial<VoiceCall>): Promise<VoiceCall> {
    const data = readLocalDb();
    const index = data.voice_calls.findIndex(c => c.id === id);
    if (index === -1) throw new Error('VoiceCall not found');
    const updated = {
      ...data.voice_calls[index],
      ...updates
    };
    data.voice_calls[index] = updated;
    saveLocalDb(data);
    return updated;
  },

  // Agent Action Logs
  async getAgentActionLogs(): Promise<AgentActionLog[]> {
    const data = readLocalDb();
    const sorted = [...data.agent_action_logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted.slice(0, 50);
  },

  async createAgentActionLog(log: Omit<AgentActionLog, 'id' | 'created_at'>): Promise<AgentActionLog> {
    const data = readLocalDb();
    const newLog: AgentActionLog = {
      ...log,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    data.agent_action_logs.push(newLog);
    saveLocalDb(data);
    return newLog;
  },

  // Passive Signals
  async getPassiveSignals(elderlyUserId?: string): Promise<PassiveSignal[]> {
    const data = readLocalDb();
    let signals = data.passive_signals;
    if (elderlyUserId) {
      signals = signals.filter(s => s.elderly_user_id === elderlyUserId);
    }
    return [...signals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createPassiveSignal(signal: Omit<PassiveSignal, 'id' | 'created_at'>): Promise<PassiveSignal> {
    const data = readLocalDb();
    const newSignal: PassiveSignal = {
      ...signal,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    data.passive_signals.push(newSignal);
    saveLocalDb(data);
    return newSignal;
  },

  // Morning Briefs
  async getMorningBriefs(caregiverUserId?: string): Promise<MorningBrief[]> {
    const data = readLocalDb();
    let briefs = data.morning_briefs;
    if (caregiverUserId) {
      briefs = briefs.filter(b => b.caregiver_user_id === caregiverUserId);
    }
    return [...briefs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createMorningBrief(brief: Omit<MorningBrief, 'id' | 'created_at'>): Promise<MorningBrief> {
    const data = readLocalDb();
    const newBrief: MorningBrief = {
      ...brief,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    data.morning_briefs.push(newBrief);
    saveLocalDb(data);
    return newBrief;
  },

  // Clear Database
  async clearAllData(): Promise<void> {
    const empty: LocalDbSchema = {
      users: [],
      care_pairs: [],
      tasks: [],
      alerts: [],
      passive_signals: [],
      morning_briefs: [],
      voice_calls: [],
      agent_action_logs: []
    };
    saveLocalDb(empty);
    console.log('[Local DB] Data cleared completely.');
  }
};
