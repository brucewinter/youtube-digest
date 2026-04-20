import Anthropic from '@anthropic-ai/sdk';
import { VideoInfo } from './youtube.js';

export interface VideoSummary extends VideoInfo {
  summary: string;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      const wait = 2000 * 2 ** i;
      console.warn(`  Anthropic error, retrying in ${wait / 1000}s... (${err instanceof Error ? err.message : err})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error('unreachable');
}

const BATCH_SIZE = 5;

async function summarizeBatch(
  videos: VideoInfo[],
  transcripts: Map<string, string | null>,
  batchNum: number,
  totalBatches: number,
): Promise<VideoSummary[]> {
  const videoList = videos
    .map((v, i) => {
      const transcript = transcripts.get(v.videoId);
      const content = transcript
        ? `Transcript excerpt: ${transcript}`
        : `Description: ${v.description}`;
      return `[${i + 1}] Title: "${v.title}"\nChannel: ${v.channelTitle}\n${content}`;
    })
    .join('\n\n---\n\n');

  const client = new Anthropic();
  const response = await withRetry(() =>
    client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You summarize YouTube videos for a daily digest email. For each video, write 2-3 sentences capturing the key points. Be concise and informative. Focus on what the viewer would learn or find valuable.',
      messages: [
        {
          role: 'user',
          content: `Summarize each of these ${videos.length} YouTube video(s). Return ONLY a JSON array where each element has "index" (1-based integer) and "summary" (string) fields.\n\n${videoList}`,
        },
      ],
    }),
  );

  process.stdout.write(` ${batchNum}/${totalBatches}`);

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    return videos.map((v) => ({ ...v, summary: v.description.slice(0, 200) || v.title }));
  }

  const parsed: Array<{ index: number; summary: string }> = JSON.parse(jsonMatch[0]);
  return videos.map((v, i) => {
    const entry = parsed.find((s) => s.index === i + 1);
    return { ...v, summary: entry?.summary ?? v.description.slice(0, 200) };
  });
}

export async function summarizeVideos(
  videos: VideoInfo[],
  transcripts: Map<string, string | null>,
): Promise<VideoSummary[]> {
  if (videos.length === 0) return [];

  const batches: VideoInfo[][] = [];
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    batches.push(videos.slice(i, i + BATCH_SIZE));
  }

  const totalBatches = batches.length;
  process.stdout.write(`Summarizing with Claude (${videos.length} videos, ${totalBatches} batches)...`);

  const results: VideoSummary[] = [];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000));
    const batchResults = await summarizeBatch(batches[i], transcripts, i + 1, totalBatches);
    results.push(...batchResults);
  }

  console.log(' done');
  return results;
}
