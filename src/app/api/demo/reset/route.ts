import { NextResponse } from 'next/server';
import { seedDemoData } from '@/lib/demo/seed';

export async function POST() {
  try {
    const data = await seedDemoData();
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error('Error resetting demo:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
