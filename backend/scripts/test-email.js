// Quick test: send a test email via Resend SMTP
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 587,
  secure: false,
  auth: {
    user: 'resend',
    pass: process.env.SMTP_PASS,
  },
});

async function main() {
  try {
    const info = await transporter.sendMail({
      from: 'CareFlow <onboarding@resend.dev>',
      to: 'mystique.aryan@gmail.com',
      subject: 'CareFlow Test Email',
      html: '<h1>Test</h1><p>If you see this, email is working!</p>',
    });
    console.log('✅ Email sent! Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) console.error('SMTP Response:', err.response);
  }
}

main();
