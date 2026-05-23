import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { seedDemoData } from '@/lib/demo/seed';
import { emailRetrievalAgent } from '@/lib/agents/emailRetrievalAgent';

export async function GET() {
  try {
    // 1. Get users, seed if missing
    let aino = await db.getUserByRole('elderly');
    let saara = await db.getUserByRole('caregiver');

    if (!aino || !saara) {
      const seeded = await seedDemoData();
      aino = seeded.aino;
      saara = seeded.saara;
    }

    // Automatically check and process new emails from Mailhog
    try {
      await emailRetrievalAgent.processEmails(aino.id, saara.id);
    } catch (err) {
      console.error('Error processing emails in dashboard GET:', err);
    }

    // 2. Fetch all related tables
    const tasks = await db.getTasks(aino.id);
    const alerts = await db.getAlerts(saara.id);
    const briefs = await db.getMorningBriefs(saara.id);
    const voiceCalls = await db.getVoiceCalls();
    const passiveSignals = await db.getPassiveSignals(aino.id);

    const latestSignal = passiveSignals[0] || null;
    const latestBrief = briefs[0] || null;

    // 3. Calculate current care status concern level
    // Logic from the prompt:
    // Normal signals + tasks completed = Low concern
    // Abnormal signals + all tasks completed = Watch
    // Abnormal signals + medication missed = Medium concern
    // Abnormal signals + medication missed + Aino does not answer call = High concern
    // Aino says “I need help” = Urgent
    let concernLevel: 'Low concern' | 'Watch' | 'Medium concern' | 'High concern' | 'Urgent' = 'Low concern';
    
    const isAbnormalSignal = latestSignal && (latestSignal.change_level === 'watch' || latestSignal.change_level === 'concern');
    const hasNeedsHelp = tasks.some(t => t.status === 'needs_help');
    const hasEscalated = tasks.some(t => t.status === 'escalated_to_saara');
    const hasOverdueMeds = tasks.some(t => t.category === 'Medication' && (t.status === 'overdue' || t.status === 'reminder_queued' || t.status === 'calling_aino'));
    const hasNoAnswerMeds = tasks.some(t => t.category === 'Medication' && (t.status === 'no_answer' || t.status === 'retry_queued'));

    if (hasNeedsHelp) {
      concernLevel = 'Urgent';
    } else if (hasEscalated || (isAbnormalSignal && hasNoAnswerMeds)) {
      concernLevel = 'High concern';
    } else if (isAbnormalSignal && hasOverdueMeds) {
      concernLevel = 'Medium concern';
    } else if (tasks.some(t => t.status === 'overdue' || t.status === 'reminder_queued')) {
      concernLevel = 'Medium concern';
    } else if (isAbnormalSignal) {
      concernLevel = 'Watch';
    }

    // 4. Calculate metrics
    // family response time: time from alert creation to Saara acknowledgement
    let avgResponseTimeMinutes = 0;
    let acknowledgedAlertsCount = 0;

    alerts.forEach(alert => {
      if (alert.acknowledged_at) {
        const diffMs = new Date(alert.acknowledged_at).getTime() - new Date(alert.created_at).getTime();
        avgResponseTimeMinutes += diffMs / (1000 * 60);
        acknowledgedAlertsCount++;
      }
    });

    const responseTimeDisplay = acknowledgedAlertsCount > 0 
      ? `${(avgResponseTimeMinutes / acknowledgedAlertsCount).toFixed(0)} mins`
      : 'Under 2 hours';

    const missedTasksThisWeek = tasks.filter(t => t.status === 'overdue' || t.status === 'escalated_to_saara').length;

    // 5. Compile timeline
    // Timeline contains key events: alert creations, voice calls, task completions, and manual caregiver actions
    const timelineEvents: any[] = [];

    alerts.forEach(a => {
      timelineEvents.push({
        id: `alert-${a.id}`,
        type: 'alert',
        title: `${a.risk_level.toUpperCase()} Alert: ${a.status.toUpperCase()}`,
        description: a.message,
        timestamp: a.created_at,
        metadata: { status: a.status, risk: a.risk_level }
      });
      if (a.acknowledged_at) {
        timelineEvents.push({
          id: `alert-ack-${a.id}`,
          type: 'action',
          title: 'Alert Acknowledged',
          description: `Saara acknowledged the alert.`,
          timestamp: a.acknowledged_at,
        });
      }
      if (a.resolved_at) {
        timelineEvents.push({
          id: `alert-res-${a.id}`,
          type: 'action',
          title: 'Alert Resolved',
          description: `Saara resolved the alert.`,
          timestamp: a.resolved_at,
        });
      }
    });

    voiceCalls.forEach(vc => {
      timelineEvents.push({
        id: `call-${vc.id}`,
        type: 'call',
        title: vc.caller_type === 'reminder_to_elderly' ? 'Reminder Call to Aino' : 'Alert Call to Saara',
        description: `Status: ${vc.status}. Transcript: "${vc.script}"${vc.response_text ? ` Response: "${vc.response_text}"` : ''}`,
        timestamp: vc.created_at,
        metadata: { status: vc.status, provider: vc.provider }
      });
    });

    tasks.forEach(t => {
      if (t.completed_at) {
        timelineEvents.push({
          id: `task-comp-${t.id}`,
          type: 'task',
          title: 'Task Completed',
          description: `Aino completed: "${t.title}"`,
          timestamp: t.completed_at,
        });
      }
    });

    timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      ok: true,
      concernLevel,
      morningBrief: latestBrief,
      tasks,
      alerts,
      passiveSignals,
      timeline: timelineEvents.slice(0, 30),
      metrics: {
        responseTime: responseTimeDisplay,
        missedTasks: `${missedTasksThisWeek} per week`,
        visibility: '95% of tasks mapped'
      }
    });
  } catch (error: any) {
    console.error('Error fetching Saara dashboard data:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
