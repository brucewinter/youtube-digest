import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

console.log('FROM:', process.env.RESEND_FROM_EMAIL);
console.log('TO:  ', process.env.DIGEST_TO_EMAIL);

const { data, error } = await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL!,
  to: process.env.DIGEST_TO_EMAIL!,
  subject: 'YouTube Digest — test',
  html: '<p>Test email from YouTube Digest setup.</p>',
});

if (error) {
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
} else {
  console.log('Sent! ID:', data?.id);
}
