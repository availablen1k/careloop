// Deterministic mock responder matching the Gemini Agent prompts
export function mockGeminiCall<T>(system: string, prompt: string, schemaName: string, fallback: T): T {
  const promptLower = prompt.toLowerCase();
  const systemLower = system.toLowerCase();

  // 1. Care Coordinator Agent
  if (systemLower.includes('care coordinator') || promptLower.includes('coordinator')) {
    let riskLevel = 'low';
    let action = 'no_action';
    let reason = ['All daily tasks are currently in order.'];
    let msg = 'Aino’s care tasks are up to date.';

    if (promptLower.includes('needs_help') || promptLower.includes('need help')) {
      riskLevel = 'urgent';
      action = 'mark_needs_help';
      reason = ['Aino clicked "I need help" on her dashboard.', 'Aino requested family assistance.'];
      msg = 'Aino asked for help with her task. CareLoop recommends that Saara checks in now.';
    } else if (promptLower.includes('no_answer') || promptLower.includes('escalate')) {
      riskLevel = 'high';
      action = 'escalate_to_caregiver';
      reason = ['Medication task is overdue.', 'Aino did not answer repeated reminder calls.'];
      msg = 'Aino missed her medication task and did not answer reminder calls. Please check in.';
    } else if (promptLower.includes('overdue') || promptLower.includes('reminder_queued')) {
      riskLevel = 'medium';
      action = 'trigger_voice_reminder';
      reason = ['Medication task is overdue.', 'Aino has not confirmed completion.'];
      msg = 'Aino has not completed her medication task due at 08:00. CareLoop will send a gentle reminder call.';
    } else if (promptLower.includes('completed')) {
      riskLevel = 'low';
      action = 'no_action';
      reason = ['Task completed normally.'];
      msg = 'Aino has completed her medication task.';
    } else if (promptLower.includes('watch')) {
      riskLevel = 'low';
      action = 'no_action';
      reason = ['Wearable signal is indicating watch, but tasks are not yet late.'];
      msg = 'Aino’s passive signals are lower than usual. CareLoop will monitor today’s care tasks.';
    }

    return {
      risk_level: riskLevel,
      action: action,
      reason: reason,
      message_to_caregiver: msg,
      agent_reasoning: `Care Coordinator evaluated task. Since status is "${promptLower.includes('needs_help') ? 'needs_help' : 'overdue'}" and wearable status is "${promptLower.includes('concern') ? 'concern' : (promptLower.includes('watch') ? 'watch' : 'normal')}", decided to action: "${action}" with risk: "${riskLevel}".`
    } as unknown as T;
  }

  // 2. Morning Briefing Agent
  if (systemLower.includes('morning briefing') || promptLower.includes('morning brief')) {
    let riskLevel = 'low';
    let signalSummary = 'Aino’s passive signals look close to her usual baseline.';
    const taskSummary = 'Aino has a medication task due at 08:00, lunch at 12:00, and a social check-in at 18:00.';
    let recommendation = 'No action is needed yet. CareLoop will monitor today’s care tasks.';

    if (promptLower.includes('watch') || promptLower.includes('lower than usual')) {
      riskLevel = 'low';
      signalSummary = 'Aino’s sleep and recovery signals are lower than usual today.';
      recommendation = 'No action is needed yet. CareLoop will monitor today’s care tasks and notify you if something is missed.';
    } else if (promptLower.includes('concern')) {
      riskLevel = 'medium';
      signalSummary = 'Aino’s sleep and recovery are significantly lower than her baseline.';
      recommendation = 'CareLoop recommends keeping a close eye on tasks today. A gentle check-in call later today is suggested.';
    }

    return {
      risk_level: riskLevel,
      signal_summary: signalSummary,
      task_summary: taskSummary,
      recommendation: recommendation,
      agent_reasoning: `Morning Briefing Agent analyzed 3 scheduled tasks and wearable change level: "${promptLower.includes('concern') ? 'concern' : (promptLower.includes('watch') ? 'watch' : 'normal')}". Generated calm summary for caregiver.`
    } as unknown as T;
  }

  // 3. Safety & Escalation Agent
  if (systemLower.includes('safety & escalation') || promptLower.includes('safety')) {
    // Scan prompt for unsafe words
    const unsafeWords = ['dementia', 'sick', 'danger', 'emergency', 'failing', 'medically unsafe', 'two pills'];
    const foundUnsafe = unsafeWords.find(word => promptLower.includes(word));

    if (foundUnsafe) {
      // Rewrite unsafe messages into allowed ones
      let rewrittenMessage = 'Aino has not completed her task and CareLoop recommends a caregiver check-in.';
      if (promptLower.includes('pill') || promptLower.includes('medication')) {
        rewrittenMessage = 'Aino has not completed her medication task due at 08:00. CareLoop recommends a check-in.';
      } else if (promptLower.includes('help') || promptLower.includes('urgent')) {
        rewrittenMessage = 'Aino asked for help. CareLoop recommends that Saara checks in now.';
      } else if (promptLower.includes('wearable') || promptLower.includes('signal')) {
        rewrittenMessage = 'Aino’s passive signals are different from her usual pattern.';
      }

      return {
        safety_status: 'rewritten',
        risk_level: promptLower.includes('help') || promptLower.includes('urgent') ? 'urgent' : 'medium',
        safe_message: rewrittenMessage,
        blocked_reason: `Contained unsafe/medical term: "${foundUnsafe}". Automated safety rewrite triggered.`
      } as unknown as T;
    }

    // Default approved
    // Extract message from prompt if possible
    let msg = 'CareLoop reminder: Please check Aino’s tasks.';
    const msgMatch = prompt.match(/"message"\s*:\s*"([^"]+)"/) || prompt.match(/"safe_message"\s*:\s*"([^"]+)"/) || prompt.match(/message to validate:\s*(.*)/i);
    if (msgMatch && msgMatch[1]) {
      msg = msgMatch[1];
    } else {
      // Just check if we passed a string
      const lines = prompt.split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine && lastLine.length > 10 && !lastLine.includes('{')) {
        msg = lastLine.trim();
      }
    }

    return {
      safety_status: 'approved',
      risk_level: promptLower.includes('help') || promptLower.includes('urgent') ? 'urgent' : (promptLower.includes('overdue') ? 'medium' : 'low'),
      safe_message: msg,
      blocked_reason: null
    } as unknown as T;
  }

  // 4. Email Dispatcher & Task Agent
  if (systemLower.includes('email') || promptLower.includes('email') || systemLower.includes('mailhog')) {
    // Extract headers from prompt
    const subjectMatch = prompt.match(/Subject:\s*(.*)/i);
    const bodyMatch = prompt.match(/Body:\s*([\s\S]*)/i);
    const fromMatch = prompt.match(/From:\s*(.*)/i);

    const emailSubject = subjectMatch ? subjectMatch[1].trim() : '';
    const emailBody = bodyMatch ? bodyMatch[1].trim() : '';
    const emailFrom = fromMatch ? fromMatch[1].trim() : '';

    const text = `${emailSubject} ${emailBody}`.toLowerCase();

    if (text.includes('bill') || text.includes('invoice') || text.includes('pay') || text.includes('electric') || text.includes('nordic')) {
      let amount = '85.50 EUR';
      const amountMatch = emailBody.match(/(\d+(?:\.\d+)?)\s*(?:EUR|USD|\$|€)/i) || emailBody.match(/(?:EUR|USD|\$|€)\s*(\d+(?:\.\d+)?)/i);
      if (amountMatch) {
        amount = amountMatch[0].trim();
      }

      let dueDate = '2026-03-31';
      const dateMatch = emailBody.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        dueDate = dateMatch[0].trim();
      }

      let vendor = 'Nordic Electric';
      if (emailFrom.toLowerCase().includes('electric') || emailSubject.toLowerCase().includes('electric')) {
        vendor = 'Nordic Electric';
      } else if (emailFrom) {
        vendor = emailFrom.split('<')[0].replace(/"/g, '').trim() || 'Billing Department';
      }

      return {
        action: 'send_to_saara',
        priority: 'medium',
        risk_level: 'medium',
        category: 'Other',
        title: `Invoice received from ${vendor}`,
        description: `Invoice from ${vendor} total: ${amount} due by ${dueDate}.`,
        due_time: '05:00 PM',
        metadata: {
          is_bill: true,
          vendor,
          amount,
          due_date: dueDate
        }
      } as unknown as T;
    }

    if (text.includes('appointment') || text.includes('clinic') || text.includes('doctor') || text.includes('check-up') || text.includes('dentist')) {
      let title = emailSubject || 'Doctor Appointment';
      let dueTime = '10:00 AM';
      const timeMatch = emailBody.match(/(\d{1,2}:\d{2})\s*(?:AM|PM|am|pm)?/);
      if (timeMatch) {
        dueTime = timeMatch[0].trim();
      }

      return {
        action: 'create_task',
        priority: 'high',
        risk_level: 'high',
        category: 'Healthcare',
        title: title,
        description: emailBody || 'Appointment details in email.',
        due_time: dueTime,
        metadata: {
          is_bill: false,
          appointment_time: dueTime
        }
      } as unknown as T;
    }

    if (text.includes('mailbox') || text.includes('package') || text.includes('neighbor')) {
      return {
        action: 'create_task',
        priority: 'medium',
        risk_level: 'low',
        category: 'Other',
        title: emailSubject || 'Please check your mailbox today',
        description: emailBody || 'Your neighbor sent an email asking you to check the mailbox.',
        due_time: '12:00 PM',
        metadata: {
          is_bill: false
        }
      } as unknown as T;
    }

    return {
      action: 'ignore',
      priority: 'low',
      category: 'Other',
      title: '',
      description: '',
      due_time: ''
    } as unknown as T;
  }

  // 5. Health Analyst Agent
  if (systemLower.includes('health analyst') || systemLower.includes('biometric')) {
    const sleepMatch = prompt.match(/Sleep Score:\s*(\d+)/i);
    const recoveryMatch = prompt.match(/Recovery Score:\s*(\d+)/i);
    const rhrMatch = prompt.match(/Resting Heart Rate:\s*(\d+)/i);
    const tempMatch = prompt.match(/Skin Temp Deviation:\s*([+-]?\d+(?:\.\d+)?)/i);
    const oxygenMatch = prompt.match(/Blood Oxygen \(SpO2\):\s*(\d+)/i);

    const sleep = sleepMatch ? sleepMatch[1] : '31';
    const recovery = recoveryMatch ? recoveryMatch[1] : '28';
    const rhr = rhrMatch ? rhrMatch[1] : '79';
    const temp = tempMatch ? tempMatch[1] : '+0.8';
    const oxygen = oxygenMatch ? oxygenMatch[1] : '95';

    const reasons = [
      `Sleep score is low at ${sleep}/100`,
      `Recovery score is low at ${recovery}/100`,
      `Resting heart rate has deviated to ${rhr} bpm`,
      `Skin temperature deviation is ${temp}°C`,
      `Blood oxygen is ${oxygen}%`
    ];

    return {
      risk_level: 'high',
      message: `Abnormal health metrics detected for Aino. Sleep is abnormally low (${sleep}/100) and resting heart rate has risen to ${rhr} bpm. Skin temperature shows a ${temp}°C deviation.`,
      reasons: reasons
    } as unknown as T;
  }

  // Generic Fallback
  return fallback;
}
