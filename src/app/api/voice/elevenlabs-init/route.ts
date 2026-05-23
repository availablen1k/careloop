import { NextResponse } from 'next/server';
import { db } from '@/lib/database/server';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('[ElevenLabs Init Webhook] Received payload:', payload);

    // Identify recipient number (called number for outbound, caller id for inbound)
    const recipientPhone = payload.called_number || payload.caller_id || '';
    
    // Find matching elderly user in the database
    const users = await db.getUsers();
    const elderlyUser = users.find(
      u => u.phone === recipientPhone && u.role === 'elderly'
    );

    let taskTitle = 'take care of your daily activities';
    let userName = 'Aino';

    if (elderlyUser) {
      userName = elderlyUser.name;
      // Get tasks and find the active/pending/overdue one
      const tasks = await db.getTasks(elderlyUser.id);
      const activeTask = tasks.find(
        t => t.status !== 'completed' && t.status !== 'resolved'
      );
      if (activeTask) {
        taskTitle = activeTask.title;
      }
    }

    console.log(`[ElevenLabs Init Webhook] Injecting variables: user_name="${userName}", task_title="${taskTitle}"`);

    // Return the initialization parameters to the ElevenLabs voice stream
    return NextResponse.json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        user_name: userName,
        task_title: taskTitle
      },
      conversation_config_override: {
        agent: {
          first_message: `Hello ${userName}, this is CareLoop. I’m calling to remind you to ${taskTitle}. Have you completed it yet?`
        }
      }
    });
  } catch (error: any) {
    console.error('[ElevenLabs Init Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
