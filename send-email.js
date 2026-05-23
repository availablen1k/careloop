const net = require('net');

const [,, from, to, subject, body] = process.argv;

if (!from || !to || !subject || !body) {
  console.log('Usage: node send-email.js <from> <to> <subject> <body>');
  console.log('Example: node send-email.js "billing@company.com" "aino@careloop.com" "Invoice #123" "Please pay 50 EUR by tomorrow."');
  process.exit(1);
}

const socket = net.createConnection(1025, '127.0.0.1');
let step = 0;

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
    console.log('✓ Email successfully delivered to MailHog SMTP port 1025.');
    socket.end();
  }
});

socket.on('error', (err) => {
  console.error('SMTP Connection Error:', err);
  process.exit(1);
});

socket.on('close', () => {
  if (step < 6) {
    console.error('SMTP connection closed prematurely.');
    process.exit(1);
  }
});
