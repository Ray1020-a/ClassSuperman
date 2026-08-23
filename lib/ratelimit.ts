import "server-only";

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRl = globalThis as unknown as {
  __classsupermanRl?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  globalForRl.__classsupermanRl ??= new Map();
  return globalForRl.__classsupermanRl;
}

/** 固定時間窗限流。回傳 { allowed, retryAfterSec } */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const s = store();
  if (s.size > 10_000) {
    for (const [k, b] of s) if (b.resetAt <= now) s.delete(k);
  }
  let bucket = s.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    s.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
