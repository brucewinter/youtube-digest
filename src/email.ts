import nodemailer from 'nodemailer';
import { VideoSummary } from './summarize.js';

// Resend SMTP — avoids fetch/undici connection pool issues from prior API calls
function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: process.env.RESEND_API_KEY!,
    },
  });
}

function videoCard(v: VideoSummary): string {
  const d = new Date(v.publishedAt);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const thumb = v.thumbnailUrl
    ? `<a href="${v.url}" style="flex-shrink:0;display:block;">
         <img src="${v.thumbnailUrl}" alt="" width="160" height="90"
              style="border-radius:6px;object-fit:cover;display:block;">
       </a>`
    : '';

  return `
    <div style="margin-bottom:16px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
      <div style="display:flex;gap:16px;align-items:flex-start;">
        ${thumb}
        <div style="flex:1;min-width:0;">
          <a href="${v.url}"
             style="font-size:15px;font-weight:600;color:#111827;text-decoration:none;display:block;margin-bottom:4px;"
          >${v.title}</a>
          <div style="font-size:12px;color:#9ca3af;">${date}</div>
          <p style="font-size:14px;color:#374151;margin:8px 0 0;line-height:1.55;">${v.summary}</p>
        </div>
      </div>
    </div>`;
}

function channelSection(title: string, videos: VideoSummary[]): string {
  const count = videos.length;
  return `
    <div style="margin-bottom:32px;">
      <h2 style="font-size:17px;font-weight:700;color:#111827;margin:0 0 12px;
                 padding-bottom:10px;border-bottom:2px solid #f3f4f6;">
        ${title}
        <span style="font-size:13px;font-weight:400;color:#6b7280;">
          — ${count} new video${count > 1 ? 's' : ''}
        </span>
      </h2>
      ${videos.map(videoCard).join('')}
    </div>`;
}

export function buildDigestHtml(videos: VideoSummary[], date: Date): string {
  const grouped = new Map<string, VideoSummary[]>();
  for (const v of videos) {
    const list = grouped.get(v.channelTitle) ?? [];
    list.push(v);
    grouped.set(v.channelTitle, list);
  }

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sections = [...grouped.entries()]
    .map(([ch, vids]) => {
      const sorted = [...vids].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
      return { ch, sorted, newestAt: new Date(sorted[0].publishedAt).getTime() };
    })
    .sort((a, b) => b.newestAt - a.newestAt)
    .map(({ ch, sorted }) => channelSection(ch, sorted))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>YouTube Digest</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">

    <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08);">

      <!-- Header -->
      <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:6px;">
          YouTube Digest
        </div>
        <h1 style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">${dateStr}</h1>
        <div style="font-size:14px;color:#6b7280;">
          ${videos.length} new video${videos.length !== 1 ? 's' : ''}
          from ${grouped.size} channel${grouped.size !== 1 ? 's' : ''}
        </div>
      </div>

      <!-- Channel sections -->
      ${sections}

    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:16px;">
      <a href="https://youtube.com/feed/subscriptions" style="color:#9ca3af;">View all subscriptions on YouTube</a>
    </p>

  </div>
</body>
</html>`;
}

export async function sendDigest(videos: VideoSummary[], date: Date): Promise<void> {
  const html = buildDigestHtml(videos, date);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const transporter = createTransport();
  await transporter.sendMail({
    from: process.env.RESEND_FROM_EMAIL!,
    to: process.env.DIGEST_TO_EMAIL!,
    subject: `YouTube Digest — ${videos.length} new video${videos.length !== 1 ? 's' : ''} · ${dateStr}`,
    html,
  });
  transporter.close();
}
