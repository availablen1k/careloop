import { NextResponse } from 'next/server';
import net from 'net';

function sendSMTPMail(from: string, to: string, subject: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(1025, '127.0.0.1');
    let step = 0;
    
    socket.on('connect', () => {
      // Connected, wait for banner
    });

    socket.on('data', (data) => {
      const response = data.toString();
      
      if (step === 0 && response.startsWith('220')) {
        socket.write('EHLO localhost\r\n');
        step++;
      } else if (step === 1 && response.includes('250')) {
        socket.write(`MAIL FROM:<${from}>\r\n`);
        step++;
      } else if (step === 2 && response.startsWith('250')) {
        socket.write(`RCPT TO:<${to}>\r\n`);
        step++;
      } else if (step === 3 && response.startsWith('250')) {
        socket.write('DATA\r\n');
        step++;
      } else if (step === 4 && response.startsWith('354')) {
        socket.write(`From: ${from}\r\n`);
        socket.write(`To: ${to}\r\n`);
        socket.write(`Subject: ${subject}\r\n`);
        socket.write('Content-Type: text/plain; charset=utf-8\r\n');
        socket.write('\r\n');
        socket.write(`${body}\r\n`);
        socket.write('.\r\n');
        step++;
      } else if (step === 5 && response.startsWith('250')) {
        socket.write('QUIT\r\n');
        step++;
      } else if (step === 6 && response.startsWith('221')) {
        socket.end();
        resolve();
      }
    });

    socket.on('error', (err) => {
      reject(err);
    });

    socket.on('close', () => {
      if (step < 6) {
        reject(new Error('SMTP Connection closed prematurely'));
      }
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type || 'bill';

    if (type === 'bill') {
      await sendSMTPMail(
        'nordic@electric.com',
        'aino@careloop.com',
        'Nordic Electric March Invoice',
        'Dear Aino,\n\nYour Nordic Electric statement for March 2026 is ready.\nTotal due: 85.50 EUR.\nPlease pay by 2026-03-31 to avoid late fees.'
      );
    } else if (type === 'appointment') {
      await sendSMTPMail(
        'clinic@kamppi-health.fi',
        'aino@careloop.com',
        'Appointment Reminder: Check-up Tomorrow at 10:30 AM',
        'Dear Aino,\n\nThis is a reminder that you have a scheduled check-up appointment at Kamppi Health Center tomorrow at 10:30 AM.\n\nPlease remember to bring your current medication list and arrive 15 minutes early.\n\nIf you need to reschedule, please call us at 09-123-4567.\n\nBest regards,\nKamppi Health Center'
      );
    } else {
      await sendSMTPMail(
        'neighbor@domain.com',
        'aino@careloop.com',
        'Please check your mailbox today',
        'Hi Aino,\n\nCould you please check your mailbox? The mail carrier dropped off a package for you earlier today.'
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('SMTP send error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
