/**
 * Tiny in-memory LRU cache for scan snapshots and competitor results.
 * Avoids redundant HTTP fetches when the same URL is scanned repeatedly
 * within a short window (e.g. scan → save → re-render, or competitor re-runs).
 *
 * Not shared across processes; intentionally lightweight — no dependencies.
 */

type CacheEntry<T> = {value: T; expiresAt: number};

export class ScanCache<T> {
    private readonly map = new Map<string, CacheEntry<T>>();
    constructor(private readonly ttlMs: number, private readonly maxSize: number) {}

    get(key: string): T | undefined {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {this.map.delete(key); return undefined;}
        // LRU: move to end
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key: string, value: T): void {
        // Evict oldest if at capacity
        if (this.map.size >= this.maxSize) {
            const oldest = this.map.keys().next().value;
            if (oldest !== undefined) this.map.delete(oldest);
        }
        this.map.set(key, {value, expiresAt: Date.now() + this.ttlMs});
    }

    /** Evict all expired entries. Call periodically to prevent memory growth. */
    evictExpired(): void {
        const now = Date.now();
        for (const [k, v] of this.map) if (now > v.expiresAt) this.map.delete(k);
    }

    get size(): number {return this.map.size;}
}
