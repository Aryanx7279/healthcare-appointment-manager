const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_GROQ_API_KEY_HERE',
  baseURL: 'https://api.groq.com/openai/v1',
});

async function main() {
  try {
    console.log('Sending test request to Groq API...');
    const response = await client.chat.completions.create({
      model: 'groq/compound',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    console.log('✅ Groq Response:', response.choices[0].message.content);
  } catch (err) {
    console.error('❌ Groq Error:', err.message);
    if (err.status) console.error('HTTP Status:', err.status);
  }
}

main();
