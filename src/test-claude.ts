import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const key = process.env.ANTHROPIC_API_KEY;
console.log('API key present:', !!key);
console.log('Key prefix:', key?.slice(0, 10));

const client = new Anthropic();

try {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Say "ok"' }],
  });
  console.log('Success:', res.content[0]);
} catch (err: any) {
  console.error('Error type:', err?.constructor?.name);
  console.error('Status:', err?.status);
  console.error('Message:', err?.message);
  console.error('Cause:', err?.cause);
}
