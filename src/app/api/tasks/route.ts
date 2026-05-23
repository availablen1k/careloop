import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';
import { seedDemoData } from '@/lib/demo/seed';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, category, due_time, priority, voice_reminder_enabled, escalation_enabled } = body;

    if (!title || !category || !due_time) {
      return NextResponse.json({ ok: false, error: 'Missing required fields: title, category, due_time' }, { status: 400 });
    }

    // Get default caregiver and elderly loved one, seed if missing
    let aino = await db.getUserByRole('elderly');
    let saara = await db.getUserByRole('caregiver');

    if (!aino || !saara) {
      const seeded = await seedDemoData();
      aino = seeded.aino;
      saara = seeded.saara;
    }

    const task = await db.createTask({
      elderly_user_id: aino.id,
      caregiver_user_id: saara.id,
      title,
      description: description || '',
      category,
      due_time,
      priority: priority || 'medium',
      status: 'pending',
      created_by: 'caregiver',
      escalation_enabled: escalation_enabled ?? true,
      voice_reminder_enabled: voice_reminder_enabled ?? true,
    });

    // Create an agent log to record that the task was created
    await db.createAgentActionLog({
      agent_name: 'Care Coordinator Agent',
      task_id: task.id,
      input_json: { action: 'create_task', title, due_time },
      output_json: { status: 'success', taskId: task.id },
      safety_status: 'not_required',
    });

    return NextResponse.json({ ok: true, task });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
