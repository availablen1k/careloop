import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { seedDemoData } from '@/lib/demo/seed';
import { emailRetrievalAgent } from '@/lib/agents/emailRetrievalAgent';

export async function POST() {
  try {
    let aino = await db.getUserByRole('elderly');
    let saara = await db.getUserByRole('caregiver');

    if (!aino || !saara) {
      const seeded = await seedDemoData();
      aino = seeded.aino;
      saara = seeded.saara;
    }

    const processed = await emailRetrievalAgent.processEmails(aino.id, saara.id);

    return NextResponse.json({ ok: true, processed });
  } catch (error: any) {
    console.error('Error processing emails:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
