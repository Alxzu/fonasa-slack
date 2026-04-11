interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const entry = this.store.get(key) || { timestamps: [] };

    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      return {
        allowed: false,
        retryAfterMs: this.windowMs - (now - oldestInWindow),
      };
    }

    entry.timestamps.push(now);
    this.store.set(key, entry);
    return { allowed: true };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter(
        (t) => now - t < this.windowMs,
      );
      if (entry.timestamps.length === 0) this.store.delete(key);
    }
  }
}
