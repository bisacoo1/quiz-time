/**
 * Tiny in-memory fixed-window rate limiter.
 *
 * Each Next.js serverless instance gets its own map, so this is a soft
 * limit — plenty for keeping casual scrapers off the (billable) Gemini
 * endpoint. For a hard limit across instances, put it behind Cloudflare
 * or a Redis-backed limiter.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 10;
const MAX_TRACKED_KEYS = 10_000;

const buckets = new Map<string, Bucket>();

/** Returns true when `key` (usually a client IP) has exceeded its budget. */
export function isRateLimited(key: string): boolean {
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  // Keep the map bounded: prune expired buckets when it grows large.
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }

  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
