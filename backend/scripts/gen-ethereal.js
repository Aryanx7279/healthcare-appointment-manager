// Script to generate an Ethereal test email account
const nodemailer = require('nodemailer');

async function main() {
  const account = await nodemailer.createTestAccount();
  console.log('\n✅ Ethereal test account created!\n');
  console.log('# Add these to your backend/.env:');
  console.log(`SMTP_HOST=smtp.ethereal.email`);
  console.log(`SMTP_PORT=587`);
  console.log(`SMTP_SECURE=false`);
  console.log(`SMTP_USER=${account.user}`);
  console.log(`SMTP_PASS=${account.pass}`);
  console.log(`SMTP_FROM="CareFlow <${account.user}>"`);
  console.log(`\n# View sent emails at: https://ethereal.email/messages`);
  console.log(`# Login: ${account.user} / ${account.pass}`);
}

main().catch(console.error);
