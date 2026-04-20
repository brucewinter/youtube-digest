import { fetchTranscript as ytFetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';

export async function fetchTranscript(videoId: string, maxChars = 1500): Promise<string | null> {
  try {
    const segments = await ytFetchTranscript(videoId);
    const text = segments
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, maxChars) || null;
  } catch {
    return null;
  }
}
