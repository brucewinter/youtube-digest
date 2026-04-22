import 'dotenv/config';
import { getAuthClient } from './auth.js';
import { getSubscriptions, getNewVideos } from './youtube.js';
import { fetchTranscript } from './transcript.js';
import { summarizeVideos } from './summarize.js';
import { sendDigest } from './email.js';
import { loadCache, saveCache, shouldCheck, isRecheckOfInactive } from './cache.js';

async function main() {
  const flagIdx = process.argv.indexOf('--hours');
  const lookbackHours =
    flagIdx !== -1 ? Number(process.argv[flagIdx + 1]) : Number(process.env.LOOKBACK_HOURS ?? 24);
  if (isNaN(lookbackHours) || lookbackHours <= 0) {
    console.error('Invalid --hours value. Usage: npm run digest -- --hours 48');
    process.exit(1);
  }
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  console.log(`[${new Date().toISOString()}] Starting digest (last ${lookbackHours}h)`);

  const auth = await getAuthClient();

  const inactiveDays = Number(process.env.INACTIVE_THRESHOLD_DAYS ?? 30);
  const recheckDays  = Number(process.env.RECHECK_DAYS ?? 7);

  process.stdout.write('Fetching subscriptions... ');
  const subscriptions = await getSubscriptions(auth);
  console.log(`${subscriptions.length} channels`);

  const cache = loadCache();
  const toCheck = subscriptions.filter((c) => shouldCheck(cache[c.channelId], inactiveDays, recheckDays));
  const skipped = subscriptions.length - toCheck.length;
  console.log(`Checking ${toCheck.length} channels (${skipped} inactive/skipped)`);

  const returningChannelIds = new Set(
    toCheck
      .filter((c) => isRecheckOfInactive(cache[c.channelId], inactiveDays, recheckDays))
      .map((c) => c.channelId),
  );

  process.stdout.write('Checking for new videos... ');
  const { videos, latestPerChannel } = await getNewVideos(auth, toCheck, since, returningChannelIds);
  console.log(`${videos.length} new video(s)`);

  // Update cache for every channel we actually checked
  const now = new Date().toISOString();
  for (const channel of toCheck) {
    const latest = latestPerChannel.get(channel.channelId);
    const prev = cache[channel.channelId];
    cache[channel.channelId] = {
      lastCheckedAt: now,
      lastVideoAt: latest !== undefined ? latest : (prev?.lastVideoAt ?? null),
    };
  }
  saveCache(cache);

  if (videos.length === 0) {
    console.log('Nothing new — skipping digest.');
    return;
  }

  console.log('Fetching transcripts...');
  const transcripts = new Map<string, string | null>();
  for (const video of videos) {
    const transcript = await fetchTranscript(video.videoId);
    transcripts.set(video.videoId, transcript);
    const status = transcript ? '✓' : '–';
    console.log(`  ${status} ${video.channelTitle}: ${video.title.slice(0, 60)}`);
  }

  const summaries = await summarizeVideos(videos, transcripts);

  process.stdout.write('Sending digest email... ');
  await sendDigest(summaries, new Date());
  console.log('sent!');

  const channels = new Set(videos.map((v) => v.channelTitle)).size;
  console.log(`\nDigest delivered: ${videos.length} videos from ${channels} channels.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
