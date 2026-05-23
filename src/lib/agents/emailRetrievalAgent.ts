import { db } from '../database/server';
import { callGeminiJson } from '../ai/gemini';

export const emailRetrievalAgent = {
  async processEmails(ainoId: string, saaraId: string): Promise<number> {
    try {
      // 1. Fetch messages from MailHog (cache: no-store prevents Next.js from serving stale responses)
      const res = await fetch('http://localhost:8025/api/v2/messages', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to fetch emails from MailHog: ${res.statusText}`);
      }
      const data = await res.json();
      const items = data.items || [];
      let count = 0;

      for (const item of items) {
        const id = item.ID;
        const subject = item.Content.Headers.Subject ? item.Content.Headers.Subject[0] : '';
        const body = item.Content.Body || '';
        const from = item.Content.Headers.From ? item.Content.Headers.From[0] : '';
        const to = item.Content.Headers.To ? item.Content.Headers.To[0] : '';

        // 2. Classify using Gemini
        const systemPrompt = `You are the CareLoop Email Dispatcher & Task Agent. Your job is to classify incoming emails for an elderly person (Aino).
Based on the subject and body of the email, you must decide what action to take:
- If it is a bill, invoice, payment request, or financial notification: classify as action "send_to_saara".
- If it is a request, appointment, task, check-in, or instruction: classify as action "create_task".
- Otherwise (spam, personal chat, unrelevant): classify as "ignore".

Evaluate risk_level based on urgency and content:
- "low": routine, no immediate action needed (e.g. a bill due in weeks, a check-in from a neighbor)
- "medium": needs attention within a few days (e.g. a bill due soon, an appointment next week)
- "high": important and time-sensitive (e.g. a bill overdue or due tomorrow, an appointment tomorrow or within 2 days)
- "urgent": requires immediate family awareness (e.g. a medical emergency notice, same-day appointment)

You must respond ONLY with a valid JSON object matching the following structure:
{
  "action": "send_to_saara" | "create_task" | "ignore",
  "priority": "low" | "medium" | "high",
  "risk_level": "low" | "medium" | "high" | "urgent",
  "category": "Medication" | "Meal" | "Healthcare" | "Social Contact" | "Physical Activity" | "Other",
  "title": "A short, user-friendly task title or alert title",
  "description": "A description summarizing the email details, sender, and action needed",
  "due_time": "Estimated due time, format 'HH:MM AM' or 'HH:MM PM' (default '12:00 PM' if unknown)",
  "metadata": {
    "is_bill": boolean,
    "vendor": "string - Name of the billing company if applicable",
    "amount": "string - Extracted amount with currency (e.g. '85.50 EUR') if applicable",
    "due_date": "string - Extracted due date in YYYY-MM-DD format if applicable"
  }
}`;

        const promptText = `Email Details:
From: ${from}
To: ${to}
Subject: ${subject}
Body: ${body}`;

        // Call Gemini
        let classification: any = {
          action: 'ignore',
          priority: 'low',
          risk_level: 'low',
          category: 'Other',
          title: '',
          description: '',
          due_time: '12:00 PM'
        };

        try {
          classification = await callGeminiJson({
            system: systemPrompt,
            prompt: promptText,
            schemaName: 'EmailClassificationSchema',
            fallback: classification
          });
        } catch (e) {
          console.error('[Email Agent] Gemini classification failed, using regex fallback:', e);
          // Regex fallback
          const text = `${subject} ${body}`.toLowerCase();
          if (text.includes('bill') || text.includes('invoice') || text.includes('pay') || text.includes('electric') || text.includes('nordic')) {
            classification = {
              action: 'send_to_saara',
              priority: 'medium',
              risk_level: 'medium',
              category: 'Other',
              title: `Invoice received from ${from.split('<')[0].trim() || 'Nordic Electric'}`,
              description: `A bill was sent to Aino's inbox: "${subject}". Summary: ${body.substring(0, 150)}...`,
              due_time: '05:00 PM'
            };
          } else if (text.includes('appointment') || text.includes('clinic') || text.includes('doctor') || text.includes('check-up')) {
            classification = {
              action: 'create_task',
              priority: 'high',
              risk_level: 'high',
              category: 'Social Contact',
              title: subject || 'Doctor Appointment',
              description: `Appointment from email: ${body.substring(0, 150)}...`,
              due_time: '10:00 AM'
            };
          } else if (text.includes('task') || text.includes('check') || text.includes('mailbox') || text.includes('neighbor') || text.includes('help') || text.includes('medicine')) {
            classification = {
              action: 'create_task',
              priority: 'medium',
              risk_level: 'low',
              category: 'Other',
              title: subject || 'New Care Task',
              description: `Task from email: ${body.substring(0, 150)}...`,
              due_time: '12:00 PM'
            };
          }
        }

        // 3. Process action
        let createdTaskId: string | undefined = undefined;
        let createdAlertId: string | undefined = undefined;

        if (classification.action === 'send_to_saara') {
          // Parse due date or use tomorrow as default for task scheduling
          let dueTimeStr = new Date().toISOString();
          if (classification.metadata?.due_date) {
            try {
              const d = new Date(classification.metadata.due_date);
              // Set to 5:00 PM on due date
              d.setHours(17, 0, 0, 0);
              dueTimeStr = d.toISOString();
            } catch {
              // Keep default
            }
          } else {
            // Default: 3 days from now at 5:00 PM
            const d = new Date();
            d.setDate(d.getDate() + 3);
            d.setHours(17, 0, 0, 0);
            dueTimeStr = d.toISOString();
          }

          // Create a Caregiver/Agent Finance Task so it appears in the daily tasks checklist
          const task = await db.createTask({
            elderly_user_id: ainoId,
            caregiver_user_id: saaraId,
            title: `Pay invoice from ${classification.metadata?.vendor || 'vendor'}`,
            description: `Amount: ${classification.metadata?.amount || 'Pending'}. Due Date: ${classification.metadata?.due_date || 'Pending'}. Details: ${classification.description}`,
            category: 'Finance',
            due_time: dueTimeStr,
            priority: classification.priority || 'medium',
            status: 'pending',
            created_by: 'agent',
            escalation_enabled: false,
            voice_reminder_enabled: false
          });
          createdTaskId = task.id;

          const reasons = [
            'Received bill in Aino\'s email inbox',
            `Sender: ${from}`
          ];
          if (classification.metadata?.vendor) {
            reasons.push(`Vendor: ${classification.metadata.vendor}`);
          }
          if (classification.metadata?.amount) {
            reasons.push(`Amount: ${classification.metadata.amount}`);
          }
          if (classification.metadata?.due_date) {
            reasons.push(`Due Date: ${classification.metadata.due_date}`);
          }

          const alert = await db.createAlert({
            elderly_user_id: ainoId,
            caregiver_user_id: saaraId,
            task_id: task.id,
            risk_level: classification.risk_level || (classification.priority === 'high' ? 'high' : 'medium'),
            message: `${classification.title}: ${classification.description}`,
            reason_json: reasons,
            status: 'open'
          });
          createdAlertId = alert.id;
          count++;
        } else if (classification.action === 'create_task') {
          // Calculate due_time date (e.g. today or tomorrow at the specified HH:MM AM/PM)
          let dueTimeStr = new Date().toISOString();
          try {
            const timeMatch = classification.due_time.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1]);
              const minutes = parseInt(timeMatch[2]);
              const ampm = timeMatch[3].toUpperCase();
              if (ampm === 'PM' && hours < 12) hours += 12;
              if (ampm === 'AM' && hours === 12) hours = 0;
              const d = new Date();
              
              // Check if email text refers to "tomorrow"
              const lowerBody = body.toLowerCase();
              const lowerSubject = subject.toLowerCase();
              if (lowerBody.includes('tomorrow') || lowerSubject.includes('tomorrow')) {
                d.setDate(d.getDate() + 1);
              }
              
              d.setHours(hours, minutes, 0, 0);
              dueTimeStr = d.toISOString();
            }
          } catch {
            // Keep default
          }

          const task = await db.createTask({
            elderly_user_id: ainoId,
            caregiver_user_id: saaraId,
            title: classification.title,
            description: classification.description,
            category: classification.category || 'Other',
            due_time: dueTimeStr,
            priority: classification.priority || 'medium',
            status: 'pending',
            created_by: 'agent',
            escalation_enabled: true,
            voice_reminder_enabled: true
          });
          createdTaskId = task.id;

          // Also create an alert for Saara so she is notified immediately on her dashboard
          const alert = await db.createAlert({
            elderly_user_id: ainoId,
            caregiver_user_id: saaraId,
            task_id: task.id,
            risk_level: classification.risk_level || (classification.priority === 'high' ? 'high' : 'medium'),
            message: `New task/appointment scheduled for Aino: ${classification.title}. Notes: ${classification.description}`,
            reason_json: ['Received scheduling/actionable email in Aino\'s inbox', `Sender: ${from}`],
            status: 'open'
          });
          createdAlertId = alert.id;
          count++;
        }

        // 4. Log in agent_action_logs
        await db.createAgentActionLog({
          agent_name: 'Email Dispatcher & Task Agent',
          task_id: createdTaskId,
          alert_id: createdAlertId,
          input_json: { from, to, subject, body },
          output_json: classification,
          safety_status: classification.action !== 'ignore' ? 'approved' : 'not_required'
        });

        // 5. Delete from MailHog
        try {
          await fetch(`http://localhost:8025/api/v1/messages/${id}`, { method: 'DELETE' });
        } catch (e) {
          console.error(`[Email Agent] Failed to delete message ${id}:`, e);
        }
      }

      return count;
    } catch (err) {
      console.error('[Email Agent] Error processing emails:', err);
      return 0;
    }
  }
};
