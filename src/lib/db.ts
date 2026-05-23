import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'localDb.json');

function readLocalDb() {
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

function saveLocalDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Local DB] Error writing to file', e);
  }
}

export async function initDb() {
  // Ensure the DB file exists
  if (!fs.existsSync(DB_FILE)) {
    saveLocalDb({
      users: [],
      care_pairs: [],
      tasks: [],
      alerts: [],
      passive_signals: [],
      morning_briefs: [],
      voice_calls: [],
      agent_action_logs: []
    });
    console.log('[Local DB] Created fresh database file.');
  }
  return Promise.resolve();
}

export async function query(sqlText: string, params: any[] = []) {
  const data = readLocalDb();
  const sql = sqlText.trim().toLowerCase();

  if (sql.startsWith('delete from passive_signals')) {
    data.passive_signals = [];
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('delete from morning_briefs')) {
    data.morning_briefs = [];
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('select * from voice_calls where task_id = $1') || sql.includes('from voice_calls where task_id = $1')) {
    const taskId = params[0];
    const rows = data.voice_calls.filter((c: any) => c.task_id === taskId);
    if (sql.includes('order by created_at asc')) {
      rows.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sql.includes('order by created_at desc')) {
      rows.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return { rows };
  }

  if (sql.startsWith('update passive_signals set created_at = $1 where id = $2')) {
    const [createdAt, id] = params;
    const item = data.passive_signals.find((x: any) => x.id === id);
    if (item) item.created_at = createdAt;
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('update morning_briefs set created_at = $1 where id = $2')) {
    const [createdAt, id] = params;
    const item = data.morning_briefs.find((x: any) => x.id === id);
    if (item) item.created_at = createdAt;
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('update agent_action_logs set created_at = $1 where id = $2')) {
    const [createdAt, id] = params;
    const item = data.agent_action_logs.find((x: any) => x.id === id);
    if (item) item.created_at = createdAt;
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('update voice_calls set created_at = $1 where id = $2')) {
    const [createdAt, id] = params;
    const item = data.voice_calls.find((x: any) => x.id === id);
    if (item) item.created_at = createdAt;
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('update voice_calls set created_at = $1, started_at = $1, completed_at = $2 where id = $3')) {
    const [createdAt, completedAt, id] = params;
    const item = data.voice_calls.find((x: any) => x.id === id);
    if (item) {
      item.created_at = createdAt;
      item.started_at = createdAt;
      item.completed_at = completedAt;
    }
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('update voice_calls set created_at = $1, started_at = $1, completed_at = $1 where id = $2')) {
    const [createdAt, id] = params;
    const item = data.voice_calls.find((x: any) => x.id === id);
    if (item) {
      item.created_at = createdAt;
      item.started_at = createdAt;
      item.completed_at = createdAt;
    }
    saveLocalDb(data);
    return { rows: [] };
  }

  if (sql.startsWith('update alerts set created_at = $1 where id = $2')) {
    const [createdAt, id] = params;
    const item = data.alerts.find((x: any) => x.id === id);
    if (item) item.created_at = createdAt;
    saveLocalDb(data);
    return { rows: [] };
  }

  console.warn(`[Local DB] Warning: Query not explicitly parsed: "${sqlText}". Returning empty.`);
  return { rows: [] };
}

export async function getClient() {
  return {
    query: async (text: string, params?: any[]) => query(text, params),
    release: () => {}
  };
}
