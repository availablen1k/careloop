import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { impactMeasurementAgent } from '@/lib/agents/impactMeasurementAgent';

export async function GET() {
  try {
    const logs = await db.getAgentActionLogs();
    const impactMetrics = await impactMeasurementAgent.calculateMetrics();
    return NextResponse.json({ ok: true, logs, impactMetrics });
  } catch (error: any) {
    console.error('Error fetching agent logs:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
