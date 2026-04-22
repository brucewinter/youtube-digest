import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface ChannelInfo {
  channelId: string;
  channelTitle: string;
}

export interface VideoInfo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  url: string;
  duration: string;    // formatted as m:ss or h:mm:ss
  isReturning: boolean; // true when from a channel returning after inactivity
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] ?? '0');
  const min = parseInt(m[2] ?? '0');
  const sec = parseInt(m[3] ?? '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(min).padStart(2, '0')}:${ss}` : `${min}:${ss}`;
}

export async function getSubscriptions(auth: OAuth2Client): Promise<ChannelInfo[]> {
  const yt = google.youtube({ version: 'v3', auth });
  const channels: ChannelInfo[] = [];
  let pageToken: string | undefined;

  do {
    const res = await yt.subscriptions.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
      pageToken,
    });

    for (const item of res.data.items ?? []) {
      const id = item.snippet?.resourceId?.channelId;
      const title = item.snippet?.title;
      if (id && title) channels.push({ channelId: id, channelTitle: title });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return channels;
}

export interface VideoResult {
  videos: VideoInfo[];
  /** Most recent video date seen per channel (for all checked channels) */
  latestPerChannel: Map<string, string | null>;
}

export async function getNewVideos(
  auth: OAuth2Client,
  channels: ChannelInfo[],
  since: Date,
  returningChannelIds: Set<string> = new Set(),
): Promise<VideoResult> {
  const yt = google.youtube({ version: 'v3', auth });
  const videos: VideoInfo[] = [];
  const latestPerChannel = new Map<string, string | null>();

  // Batch channel lookups (50 per request) to get uploads playlist IDs
  for (let i = 0; i < channels.length; i += 50) {
    const batch = channels.slice(i, i + 50);

    const channelRes = await yt.channels.list({
      part: ['contentDetails'],
      id: batch.map((c) => c.channelId),
      maxResults: 50,
    });

    const playlistMap = new Map<string, string>(); // channelId → uploadsPlaylistId
    for (const item of channelRes.data.items ?? []) {
      const playlistId = item.contentDetails?.relatedPlaylists?.uploads;
      if (item.id && playlistId) playlistMap.set(item.id, playlistId);
    }

    // Check each channel's uploads playlist for new videos
    for (const channel of batch) {
      const playlistId = playlistMap.get(channel.channelId);
      if (!playlistId) continue;

      let itemsRes;
      try {
        itemsRes = await yt.playlistItems.list({
          part: ['snippet'],
          playlistId,
          maxResults: 10,
        });
      } catch {
        continue; // skip channels with private/deleted upload playlists
      }

      const items = itemsRes.data.items ?? [];

      // Track the most recent video date for this channel (first item = newest)
      const newestDate = items[0]?.snippet?.publishedAt ?? null;
      latestPerChannel.set(channel.channelId, newestDate);

      for (const item of items) {
        const snippet = item.snippet;
        const publishedAt = snippet?.publishedAt;
        if (!publishedAt || new Date(publishedAt) <= since) continue;

        const videoId = snippet?.resourceId?.videoId;
        if (!videoId || !snippet?.title) continue;

        videos.push({
          videoId,
          title: snippet.title,
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          description: (snippet.description ?? '').slice(0, 600),
          publishedAt,
          thumbnailUrl:
            snippet.thumbnails?.medium?.url ??
            snippet.thumbnails?.default?.url ??
            '',
          url: `https://youtube.com/watch?v=${videoId}`,
          duration: '',
          isReturning: returningChannelIds.has(channel.channelId),
        });
      }
    }
  }

  // Batch-fetch durations (50 per request)
  for (let i = 0; i < videos.length; i += 50) {
    const batch = videos.slice(i, i + 50);
    const detailRes = await yt.videos.list({
      part: ['contentDetails'],
      id: batch.map((v) => v.videoId),
      maxResults: 50,
    });
    for (const item of detailRes.data.items ?? []) {
      const video = batch.find((v) => v.videoId === item.id);
      if (video && item.contentDetails?.duration) {
        video.duration = parseDuration(item.contentDetails.duration);
      }
    }
  }

  return { videos, latestPerChannel };
}
