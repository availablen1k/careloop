'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Heart, AlertTriangle, ShieldCheck, CheckCircle2, Clock, PhoneCall,
  RefreshCw, Plus, FileText, Activity, AlertCircle, Sliders,
  Receipt, CreditCard
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  category: string;
  due_time: string;
  priority: string;
  status: string;
  description: string;
  voice_reminder_enabled: boolean;
  escalation_enabled: boolean;
}

interface Alert {
  id: string;
  risk_level: string;
  message: string;
  reason_json: string[];
  status: string;
  created_at: string;
}

interface MorningBrief {
  signal_summary: string;
  task_summary: string;
  recommendation: string;
  risk_level: string;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  type: 'alert' | 'call' | 'task' | 'action';
  title: string;
  description: string;
  timestamp: string;
}

interface PassiveSignal {
  sleep_score: number;
  sleep_duration_hours: number;
  recovery_score: number;
  resting_heart_rate: number;
  heart_rate_variability: number;
  blood_oxygen: number;
  skin_temperature_delta: number;
  activity_level: string;
  steps: number;
  strain: number;
  active_minutes: number;
  baseline_sleep_score: number;
  baseline_recovery_score: number;
  baseline_resting_heart_rate: number;
  baseline_heart_rate_variability: number;
  change_level: string;
  summary: string;
}

export default function SaaraDashboard() {
  const [data, setData] = useState<{
    concernLevel: string;
    morningBrief: MorningBrief | null;
    tasks: Task[];
    alerts: Alert[];
    passiveSignals: PassiveSignal[];
    timeline: TimelineEvent[];
    metrics: { responseTime: string; missedTasks: string; visibility: string };
    impactMetrics?: {
      averageResolutionTimeMinutes: number;
      safetyComplianceRate: number;
      outreachSuccessRate: number;
      totalAgentInterventions: number;
      responsibleAiLatencyMs: number;
    };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Task Form State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    category: 'Medication',
    due_time: '',
    priority: 'medium',
    description: '',
    voice_reminder_enabled: true,
    escalation_enabled: true
  });

  // Wearable State Sync
  const [selectedScenario, setSelectedScenario] = useState<'normal_day' | 'watch_day' | 'concern_day'>('watch_day');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/saara/dashboard');
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to load dashboard data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const silentCheckAndRefresh = async () => {
    try {
      await fetch('/api/agents/check-overdue-tasks', { method: 'POST' });
      const res = await fetch('/api/saara/dashboard');
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (e) {
      console.error('Silent background check failed:', e);
    }
  };

  useEffect(() => {
    loadDashboard();

    // Auto-poll agent check and dashboard refresh every 10 seconds to make it run live
    const interval = setInterval(() => {
      silentCheckAndRefresh();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // REST API Actions
  const handleResetDemo = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        triggerToast('Demo database reset to default state.');
        loadDashboard();
      }
    } catch {
      triggerToast('Reset failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncWearable = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/agents/morning-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenario })
      });
      const json = await res.json();
      if (json.ok) {
        triggerToast(`Wearable sync successful. Morning brief regenerated using scenario: ${selectedScenario}`);
        loadDashboard();
      }
    } catch {
      triggerToast('Sync failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOverdue = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/agents/check-overdue-tasks', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        triggerToast(`Overdue checker executed. Processed ${json.processedCount} tasks.`);
        loadDashboard();
      }
    } catch {
      triggerToast('Check failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        triggerToast('Alert marked as acknowledged.');
        loadDashboard();
      }
    } catch {
      triggerToast('Action failed.', 'error');
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        triggerToast('Alert marked as resolved.');
        loadDashboard();
      }
    } catch {
      triggerToast('Action failed.', 'error');
    }
  };

  const handleMakeTaskOverdue = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}/make-overdue`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        triggerToast('Task back-dated to trigger overdue alerts.');
        loadDashboard();
      }
    } catch {
      triggerToast('Action failed.', 'error');
    }
  };

  const handleManualReminder = async (id: string) => {
    try {
      const res = await fetch('/api/voice/call-aino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: id })
      });
      const json = await res.json();
      if (json.ok) {
        triggerToast(`Reminder call complete. Status: ${json.status}`);
        loadDashboard();
      }
    } catch {
      triggerToast('Call failed.', 'error');
    }
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.due_time) {
      triggerToast('Please fill in title and due time.', 'error');
      return;
    }

    try {
      // Set to today's date at specified hours/minutes
      const [hours, minutes] = newTask.due_time.split(':');
      const dueTimeObj = new Date();
      dueTimeObj.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          due_time: dueTimeObj.toISOString()
        })
      });
      const json = await res.json();
      if (json.ok) {
        triggerToast('Task created successfully!');
        setShowTaskForm(false);
        setNewTask({
          title: '',
          category: 'Medication',
          due_time: '',
          priority: 'medium',
          description: '',
          voice_reminder_enabled: true,
          escalation_enabled: true
        });
        loadDashboard();
      }
    } catch {
      triggerToast('Failed to create task.', 'error');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-800">Loading CareLoop Dashboard...</p>
        </div>
      </div>
    );
  }

  // Concern level styling helper
  const getConcernBadge = (level: string) => {
    switch (level) {
      case 'Urgent':
        return (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-xl font-black shadow-sm pulse-ring">
            <AlertCircle className="h-6 w-6 stroke-[2.5]" />
            <span>Care Level: URGENT — Aino requested immediate family assistance!</span>
          </div>
        );
      case 'High concern':
        return (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold">
            <AlertTriangle className="h-5 w-5" />
            <span>Care Level: High Concern — Overdue medication calls unanswered.</span>
          </div>
        );
      case 'Medium concern':
        return (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl font-bold">
            <AlertTriangle className="h-5 w-5" />
            <span>Care Level: Medium Concern — Task is overdue.</span>
          </div>
        );
      case 'Watch':
        return (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold">
            <Clock className="h-5 w-5" />
            <span>Care Level: Watch — Passive wearable signals are lower than baseline.</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold">
            <ShieldCheck className="h-5 w-5" />
            <span>Care Level: Low Concern — Everything is progressing normally.</span>
          </div>
        );
    }
  };

  const signal = data?.passiveSignals[0] || null;

  return (
    <div className="flex-1 bg-cream-100 flex flex-col md:flex-row min-h-screen">
      
      {/* LEFT SIDEBAR: Demo Controls */}
      <aside className="w-full md:w-80 bg-white border-r border-cream-300 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <Heart className="h-4 w-4 fill-current" />
            </div>
            <span className="text-xl font-extrabold text-slate-800">CareLoop Caregiver</span>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500">Demo Controller</span>
              <button 
                onClick={handleResetDemo}
                disabled={actionLoading}
                className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1"
                title="Reset Database to seed state"
              >
                <RefreshCw className={`h-3 w-3 ${actionLoading ? 'animate-spin' : ''}`} />
                Reset DB
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleCheckOverdue}
                disabled={actionLoading}
                className="w-full text-center px-3 py-2 rounded-lg border border-emerald-600 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                Run Overdue Checker
              </button>
            </div>
          </div>

          <div className="mb-6 pt-6 border-t border-cream-300">
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500 block mb-3">Active Wearable Scenario</span>
            <div className="flex gap-2 mb-3">
              <select 
                value={selectedScenario} 
                onChange={(e) => setSelectedScenario(e.target.value as any)}
                className="flex-1 bg-cream-50 border border-cream-300 rounded-lg p-2 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="normal_day">Normal signals</option>
                <option value="watch_day">Watch day (moderate sleep/recovery decline)</option>
                <option value="concern_day">Concern day (severe sleep/recovery decline)</option>
              </select>
            </div>
            <button
              onClick={handleSyncWearable}
              disabled={actionLoading}
              className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5"
            >
              <Activity className="h-3.5 w-3.5" />
              Sync &amp; Regenerate Brief
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-cream-300 text-xs text-slate-400">
          <Link href="/" className="hover:underline block mb-2 font-semibold">← Back to Portal Landing</Link>
          <Link href="/agents" className="hover:underline font-semibold block text-emerald-600">🛡️ Open Technical Agent Monitor</Link>
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-6xl mx-auto w-full">
        {/* Toast alert */}
        {toast && (
          <div className={`p-4 rounded-xl text-sm font-bold shadow-md border animate-fade-in flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Status indicator bar */}
        {data && getConcernBadge(data.concernLevel)}

        {/* TOP HALF: Morning Brief & Wearable Data */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Morning Brief Card */}
          <div className="bg-white rounded-2xl border border-cream-300 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <span className="text-xs uppercase font-extrabold px-2 py-1 rounded bg-cream-200 text-slate-600">AI Daily Brief</span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Aino’s Morning State Briefing
              </h2>
              {data?.morningBrief ? (
                <div className="flex flex-col gap-4 text-sm text-slate-700 leading-relaxed">
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-1 text-slate-500">Wellness Signals Summary</h3>
                    <p>{data.morningBrief.signal_summary}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-1 text-slate-500">Scheduled Tasks</h3>
                    <p>{data.morningBrief.task_summary}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <h3 className="font-bold text-emerald-900 text-xs uppercase tracking-wider mb-1">CareLoop Recommendation</h3>
                    <p className="font-medium text-emerald-800">{data.morningBrief.recommendation}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic py-4">No morning brief generated yet. Click &quot;Sync &amp; Regenerate Brief&quot; on the left panel to trigger the briefing agent.</p>
              )}
            </div>
            
            <div className="text-xs text-slate-400 mt-6 pt-3 border-t border-cream-100">
              Brief generation complies with safety rules: no medical diagnoses.
            </div>
          </div>

          {/* Passive wearable signals */}
          <div className="bg-white rounded-2xl border border-cream-300 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-600" />
              Lightweight Passive Health Context
            </h2>
            {signal ? (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-cream-50 p-3.5 rounded-xl border border-cream-200 text-center">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Sleep Score</span>
                    <span className="text-2xl font-black text-slate-800">{signal.sleep_score}</span>
                    <span className="text-2xs text-slate-400 block mt-0.5">Base: {signal.baseline_sleep_score}</span>
                  </div>
                  <div className="bg-cream-50 p-3.5 rounded-xl border border-cream-200 text-center">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Recovery Score</span>
                    <span className="text-2xl font-black text-slate-800">{signal.recovery_score}</span>
                    <span className="text-2xs text-slate-400 block mt-0.5">Base: {signal.baseline_recovery_score}</span>
                  </div>
                  <div className="bg-cream-50 p-3.5 rounded-xl border border-cream-200 text-center">
                    <span className="text-xs font-bold text-slate-500 block mb-1">RHR</span>
                    <span className="text-2xl font-black text-slate-800">{signal.resting_heart_rate} <span className="text-xs font-normal">bpm</span></span>
                    <span className="text-2xs text-slate-400 block mt-0.5">Base: {signal.baseline_resting_heart_rate}</span>
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-600 flex flex-col gap-2 bg-cream-50 p-4 rounded-xl border border-cream-200">
                  <div className="flex justify-between">
                    <span>Biometric Deviation State:</span>
                    <span className={`px-2 py-0.5 rounded font-black text-2xs uppercase ${
                      signal.change_level === 'concern' ? 'bg-red-100 text-red-800' : (signal.change_level === 'watch' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')
                    }`}>{signal.change_level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sleep Duration:</span>
                    <span className="text-slate-800 font-bold">{signal.sleep_duration_hours} hrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heart Rate Variability (HRV):</span>
                    <span className="text-slate-800 font-bold">{signal.heart_rate_variability} ms <span className="text-slate-400 font-normal text-3xs">({signal.baseline_heart_rate_variability} ms baseline)</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blood Oxygen (SpO2):</span>
                    <span className="text-slate-800 font-bold">{signal.blood_oxygen}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Skin Temperature:</span>
                    <span className="text-slate-800 font-bold">
                      {(36.5 + signal.skin_temperature_delta).toFixed(1)}°C{' '}
                      <span className="text-slate-400 font-normal text-3xs">
                        {signal.skin_temperature_delta === 0 
                          ? '(baseline)' 
                          : `(${signal.skin_temperature_delta > 0 ? '+' : ''}${signal.skin_temperature_delta}°C deviation)`}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Minutes / Strain:</span>
                    <span className="text-slate-800 font-bold">{signal.active_minutes} min / {signal.strain} strain</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Steps / Activity Class:</span>
                    <span className="text-slate-800 font-bold">{signal.steps} steps ({signal.activity_level})</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed italic bg-emerald-50/30 border border-emerald-100/50 p-3 rounded-lg">
                  {signal.summary}
                </p>
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic py-4">No wearable data loaded yet.</p>
            )}
          </div>
        </div>

        {/* ACTIVE ALERTS */}
        {data && data.alerts.filter(a => a.status !== 'resolved').length > 0 && (
          <div className="bg-red-50/20 rounded-2xl border border-red-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-red-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-700" />
              Active Caregiver Alerts Requiring Action
            </h2>
            <div className="flex flex-col gap-4">
              {data.alerts.filter(a => a.status !== 'resolved').map(alert => {
                const vendor = alert.reason_json.find(r => r.startsWith('Vendor: '))?.replace('Vendor: ', '');
                const amount = alert.reason_json.find(r => r.startsWith('Amount: '))?.replace('Amount: ', '');
                const dueDate = alert.reason_json.find(r => r.startsWith('Due Date: '))?.replace('Due Date: ', '');
                const isInvoice = !!vendor || alert.message.toLowerCase().includes('invoice') || alert.message.toLowerCase().includes('bill');

                if (isInvoice) {
                  return (
                    <div key={alert.id} className="w-full bg-cream-50/50 border-2 border-dashed border-cream-300 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex gap-4 items-start">
                        <div className="p-3 bg-amber-100/80 border border-amber-200 text-amber-700 rounded-xl">
                          <Receipt className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-amber-100 text-amber-800 uppercase tracking-wider">
                              Invoice Bill
                            </span>
                            <span className="text-2xs text-slate-400">
                              Received {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="text-slate-800 font-black text-sm">
                            {vendor || 'Incoming Invoice'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-md">
                            {alert.message.split(':').slice(1).join(':').trim() || alert.message}
                          </p>
                          
                          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
                            {dueDate && (
                              <span className="bg-white/80 border border-cream-200 px-2 py-1 rounded-lg">
                                📅 Due Date: <strong className="text-slate-800">{dueDate}</strong>
                              </span>
                            )}
                            <span className="bg-white/80 border border-cream-200 px-2 py-1 rounded-lg">
                              📬 Source: <strong className="text-slate-800">Email Inbox</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-end gap-3 w-full md:w-auto border-t md:border-t-0 border-cream-200 pt-3 md:pt-0">
                        {amount && (
                          <div className="text-right mb-1 mr-auto md:mr-0">
                            <span className="text-3xs uppercase font-extrabold text-slate-400 block tracking-wider">Total Due</span>
                            <span className="text-xl font-black text-emerald-700">{amount}</span>
                          </div>
                        )}
                        <div className="flex gap-2 w-full md:w-auto">
                          {alert.status === 'open' && (
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="flex-1 md:flex-none px-3.5 py-2 rounded-lg border border-cream-300 text-xs font-semibold hover:bg-cream-100 transition-colors text-slate-700"
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Pay &amp; Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={alert.id} className="bg-white border border-red-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-red-100 text-red-800 uppercase">
                          {alert.risk_level}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-800 font-bold text-sm mb-2">{alert.message}</p>
                      <div className="text-xs text-slate-500 flex flex-col gap-1">
                        <strong>Reasons analyzed:</strong>
                        {alert.reason_json.map((r, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-slate-600">• {r}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {alert.status === 'open' && (
                        <button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="px-3.5 py-2 rounded-lg border border-cream-300 text-xs font-semibold hover:bg-cream-100 transition-colors text-slate-700"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors"
                      >
                        Resolve Alert
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TASK MANAGER SECTION */}
        <div className="bg-white rounded-2xl border border-cream-300 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Daily Care Tasks &amp; Reminders
            </h2>
            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="flex items-center gap-1 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Add Care Task
            </button>
          </div>

          {/* New Task Form */}
          {showTaskForm && (
            <form onSubmit={handleCreateTaskSubmit} className="bg-cream-50 border border-cream-300 rounded-xl p-5 mb-6 flex flex-col gap-4 animate-slide-down">
              <h3 className="font-bold text-sm text-slate-800">Add New Daily Task for Aino</h3>
              <div className="grid sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-2xs font-bold text-slate-500 uppercase">Task Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Take tonsillitis medication"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="bg-white border border-cream-300 rounded-lg p-2.5 text-xs font-semibold outline-none text-slate-700"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-2xs font-bold text-slate-500 uppercase">Category</label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="bg-white border border-cream-300 rounded-lg p-2.5 text-xs font-semibold outline-none text-slate-700"
                  >
                    <option value="Medication">Medication</option>
                    <option value="Meal">Meal</option>
                    <option value="Social contact">Social contact</option>
                    <option value="Exercise">Exercise</option>
                    <option value="Hydration">Hydration</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-2xs font-bold text-slate-500 uppercase">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="bg-white border border-cream-300 rounded-lg p-2.5 text-xs font-semibold outline-none text-slate-700"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-2xs font-bold text-slate-500 uppercase">Due Time Today</label>
                  <input
                    type="time"
                    required
                    value={newTask.due_time}
                    onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                    className="bg-white border border-cream-300 rounded-lg p-2.5 text-xs font-semibold outline-none text-slate-700"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-2xs font-bold text-slate-500 uppercase">Task Note (Optional)</label>
                <textarea
                  placeholder="Additional details for Aino..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="bg-white border border-cream-300 rounded-lg p-2.5 text-xs font-semibold outline-none text-slate-700 h-16 resize-none"
                />
              </div>

              <div className="flex items-center gap-6 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTask.voice_reminder_enabled}
                    onChange={(e) => setNewTask({ ...newTask, voice_reminder_enabled: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 border-cream-300 rounded focus:ring-emerald-500"
                  />
                  Voice Reminder Enabled
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTask.escalation_enabled}
                    onChange={(e) => setNewTask({ ...newTask, escalation_enabled: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 border-cream-300 rounded focus:ring-emerald-500"
                  />
                  Escalation Enabled
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-cream-300 text-xs font-semibold text-slate-700 hover:bg-cream-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
                >
                  Create Task
                </button>
              </div>
            </form>
          )}

          {/* Tasks list */}
          {data && data.tasks.length === 0 ? (
            <p className="text-slate-500 text-sm italic text-center py-8">No tasks scheduled for today.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {data?.tasks.map(task => {
                const isCompleted = task.status === 'completed' || task.status === 'resolved';
                const isOverdue = task.status === 'overdue' || task.status === 'escalated_to_saara' || task.status === 'retry_queued';
                const isHelp = task.status === 'needs_help';

                const formattedTime = new Date(task.due_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div 
                    key={task.id} 
                    className={`border rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all ${
                      isCompleted ? 'border-emerald-100 bg-emerald-50/20 opacity-60' : 'border-cream-300 bg-cream-50/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-3xs uppercase font-extrabold tracking-wider bg-cream-200 text-slate-600 px-2 py-0.5 rounded">
                          {task.category}
                        </span>
                        <span className={`text-3xs uppercase font-extrabold px-2 py-0.5 rounded ${
                          task.priority === 'high' ? 'bg-red-100 text-red-800' : (task.priority === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')
                        }`}>
                          {task.priority} priority
                        </span>
                        <span className="text-slate-400 text-xs">due {formattedTime}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm">{task.title}</h3>
                      
                      <div className="flex items-center gap-4 mt-2 text-3xs font-semibold text-slate-400">
                        <span>Call Reminders: {task.voice_reminder_enabled ? 'ON' : 'OFF'}</span>
                        <span>•</span>
                        <span>Auto-Escalation: {task.escalation_enabled ? 'ON' : 'OFF'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status label */}
                      <span className={`px-2.5 py-1 rounded-full text-2xs font-extrabold uppercase ${
                        isCompleted ? 'bg-emerald-100 text-emerald-800' : (isHelp ? 'bg-red-100 text-red-800' : (isOverdue ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'))
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>

                      {/* Interactive simulator controls */}
                      {!isCompleted && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleManualReminder(task.id)}
                            className="px-2.5 py-1.5 rounded bg-cream-100 hover:bg-cream-200 text-xs font-bold text-slate-700 transition-colors flex items-center gap-1"
                            title="Simulate Aino's voice reminder call flow"
                          >
                            <PhoneCall className="h-3 w-3" />
                            Call Aino
                          </button>
                          
                          {task.status === 'pending' && (
                            <button
                              onClick={() => handleMakeTaskOverdue(task.id)}
                              className="px-2 py-1.5 rounded border border-cream-300 hover:bg-cream-100 text-2xs font-bold text-slate-600 transition-colors"
                              title="Make overdue manually"
                            >
                              Overdue
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AUDIT TIMELINE */}
        <div className="bg-white rounded-2xl border border-cream-300 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-600" />
            CareLoop AI Agent Audit Log &amp; Event History
          </h2>
          {data && data.timeline.length === 0 ? (
            <p className="text-slate-500 text-sm italic text-center py-8">No activity logs recorded yet.</p>
          ) : (
            <div className="relative border-l-2 border-cream-200 ml-4 pl-6 flex flex-col gap-6">
              {data?.timeline.map((event, i) => (
                <div key={i} className="relative">
                  {/* Circle dot on timeline */}
                  <span className="absolute -left-9 top-1.5 h-5.5 w-5.5 rounded-full border-2 border-white bg-cream-200 flex items-center justify-center text-slate-500 text-3xs font-bold shadow-2xs">
                    {event.type === 'alert' && '🚨'}
                    {event.type === 'call' && '📞'}
                    {event.type === 'task' && '✅'}
                    {event.type === 'action' && '⚙️'}
                  </span>

                  <div>
                    <span className="text-3xs font-bold text-slate-400 block mb-0.5">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(event.timestamp).toLocaleDateString()}
                    </span>
                    <h3 className="font-bold text-sm text-slate-800">{event.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
