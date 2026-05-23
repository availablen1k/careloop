import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { passiveSignalRetrievalAgent } from '@/lib/agents/passiveSignalRetrievalAgent';
import { morningBriefingAgent } from '@/lib/agents/morningBriefingAgent';
import { seedDemoData } from '@/lib/demo/seed';

export async function POST(request: Request) {
  try {
    let scenario: 'normal_day' | 'watch_day' | 'concern_day' = 'watch_day';
    try {
      const body = await request.json();
      if (body.scenario) {
        scenario = body.scenario;
      }
    } catch {
      // Body empty or unparseable, default to watch_day
    }

    let aino = await db.getUserByRole('elderly');
    let saara = await db.getUserByRole('caregiver');

    if (!aino || !saara) {
      const seeded = await seedDemoData();
      aino = seeded.aino;
      saara = seeded.saara;
    }

    // 1. Retrieve passive signals
    const signal = await passiveSignalRetrievalAgent.retrieveSignals(aino.id, scenario);

    // 2. Fetch today's tasks
    const tasks = await db.getTasks(aino.id);

    // 3. Generate morning briefing
    const brief = await morningBriefingAgent.generateBrief(aino.id, saara.id, tasks, signal);

    return NextResponse.json({ ok: true, brief, signal });
  } catch (error: any) {
    console.error('Error generating morning brief:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
