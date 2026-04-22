import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CACHE_PATH = join(process.cwd(), '.channel-cache.json');

export interface ChannelRecord {
  lastVideoAt: string | null; // ISO date of most recent video we saw
  lastCheckedAt: string;      // ISO date of last time we checked this channel
}

type Cache = Record<string, ChannelRecord>;

export function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveCache(cache: Cache): void {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

export function shouldCheck(
  record: ChannelRecord | undefined,
  inactiveThresholdDays: number,
  recheckDays: number,
): boolean {
  if (!record) return true; // never seen before — always check

  const now = Date.now();
  const lastCheckedMs = new Date(record.lastCheckedAt).getTime();
  const daysSinceChecked = (now - lastCheckedMs) / 86_400_000;

  // Always re-check after recheckDays regardless of activity
  if (daysSinceChecked >= recheckDays) return true;

  // If the channel posted recently, keep checking it daily
  if (record.lastVideoAt) {
    const daysSinceVideo = (now - new Date(record.lastVideoAt).getTime()) / 86_400_000;
    if (daysSinceVideo <= inactiveThresholdDays) return true;
  }

  return false; // inactive and checked recently — skip
}

/** True when a channel is only being checked because the recheck window elapsed
 *  (i.e. it was inactive and we're doing the periodic sweep). */
export function isRecheckOfInactive(
  record: ChannelRecord | undefined,
  inactiveThresholdDays: number,
  recheckDays: number,
): boolean {
  if (!record) return false; // brand-new channel, not a returning one

  const now = Date.now();
  const daysSinceChecked = (now - new Date(record.lastCheckedAt).getTime()) / 86_400_000;
  if (daysSinceChecked < recheckDays) return false; // checked recently — not a recheck sweep

  if (!record.lastVideoAt) return true; // never posted before, now they are
  const daysSinceVideo = (now - new Date(record.lastVideoAt).getTime()) / 86_400_000;
  return daysSinceVideo > inactiveThresholdDays;
}
