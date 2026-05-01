import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
import { VideoSummary } from './summarize.js';

const base   = process.env.TRACKER_BASE_URL ?? '';
const secret = process.env.TRACKER_SECRET   ?? '';

export function trackingUrl(v: VideoSummary): string {
  if (!base || !secret) return v.url;
  const params = new URLSearchParams({
    v:   v.videoId,
    ch:  v.channelId,
    ct:  v.channelTitle,
    vt:  v.title,
    url: v.url,
    sig: secret,
  });
  return `${base}/track.php?${params}`;
}

export function logDeliveries(videos: VideoSummary[]): void {
  if (!base || !secret) return;

  const payload = JSON.stringify(
    videos.map((v) => ({
      videoId:      v.videoId,
      channelId:    v.channelId,
      channelTitle: v.channelTitle,
      videoTitle:   v.title,
    })),
  );

  const url = new URL(`${base}/log.php`);
  const isHttps = url.protocol === 'https:';
  const mod = isHttps ? request : httpRequest;

  const req = mod(
    {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      agent:    false,
      headers:  {
        'Content-Type':          'application/json',
        'Content-Length':        Buffer.byteLength(payload),
        'X-Tracker-Secret':      secret,
      },
    },
    (res) => { res.resume(); },
  );

  req.on('error', (err) => console.warn('  Tracker log failed (non-fatal):', err.message));
  req.write(payload);
  req.end();
}
