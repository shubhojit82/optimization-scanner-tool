import {NodeCrawler} from './node-crawler';
import {buildScanResult} from '../application/scanner';
import type {ScanResult} from '../application/scanner';
import type {Client} from '../core/contracts';

export type PageCrawlResult = ScanResult & {depth: number; linkedFrom: string | null};

export type DimensionAggregate = {
    id: string;
    name: string;
    weight: number;
    avgScore: number | null;
    minScore: number | null;
    maxScore: number | null;
    pagesScored: number;
    pagesBelow70: number;   // pages where score < 70 — actionable gap
};

export type SiteScanResult = {
    startUrl: string;
    crawledAt: string;
    pagesAttempted: number;
    pagesScored: number;
    avgScore: number | null;
    avgCoverage: number | null;
    avgSubScores: {seoScore: number | null; aeoScore: number | null; geoScore: number | null};
    dimensionAggregates: DimensionAggregate[];   // scr-3: site-wide per-dimension averages
    commonGaps: {name: string; count: number; weight: number}[];
    topPage: {url: string; score: number} | null;
    bottomPage: {url: string; score: number} | null;
    pages: PageCrawlResult[];
};

const MAX_PAGES = 50;
const MAX_DEPTH = 3;
const PAGE_TIMEOUT_MS = 12000;
const CONCURRENCY = 1;        // Fix 2: sequential — avoids triggering rate limiters
const INTER_REQUEST_DELAY = 600; // Fix 1: ms pause between each page fetch
const MAX_RETRY_AFTER_S = 30;   // Fix 3: honour Retry-After up to this many seconds

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Extract internal links from HTML, normalised to absolute URLs on the same origin. */
function extractLinks(html: string, pageUrl: string, origin: string): string[] {
    const seen = new Set<string>();
    const results: string[] = [];
    for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#?]+)[^"']*["']/gi)) {
        try {
            const abs = new URL(m[1], pageUrl);
            if (abs.origin !== origin) continue;
            // Skip non-HTML resources
            const ext = abs.pathname.split('.').pop()?.toLowerCase() ?? '';
            if (['pdf','jpg','jpeg','png','gif','svg','webp','mp4','zip','css','js','woff','woff2','ico'].includes(ext)) continue;
            const clean = abs.origin + abs.pathname; // drop query + hash for dedup
            if (!seen.has(clean)) { seen.add(clean); results.push(clean); }
        } catch { /* invalid URL */ }
    }
    return results;
}

export async function crawlSite(
    startUrl: string,
    client: Client,
    onProgress?: (done: number, total: number, url: string) => void
): Promise<SiteScanResult> {
    const crawler = new NodeCrawler(PAGE_TIMEOUT_MS);
    const origin = new URL(startUrl).origin;
    const crawledAt = new Date().toISOString();

    // BFS queue: {url, depth, linkedFrom}
    type QueueItem = {url: string; depth: number; linkedFrom: string | null};
    const queue: QueueItem[] = [{url: startUrl, depth: 0, linkedFrom: null}];
    const visited = new Set<string>();
    const pages: PageCrawlResult[] = [];

    // Fetch robots.txt once for the whole site
    let robotsText = '';
    try {
        const r = await fetch(new URL('/robots.txt', origin).href, {signal: AbortSignal.timeout(5000), headers:{'User-Agent':'GEOWorkbench/1.0'}});
        if (r.ok) robotsText = await r.text();
    } catch { /* ignore */ }

    function isRobotsAllowed(path: string): boolean {
        if (!robotsText) return true;
        let inBlock = false;
        for (const raw of robotsText.split(/\r?\n/)) {
            const line = raw.trim();
            if (/^user-agent\s*:/i.test(line)) { inBlock = /:\s*\*/i.test(line); continue; }
            if (inBlock && /^disallow\s*:/i.test(line)) {
                const rule = line.replace(/^disallow\s*:\s*/i, '').trim();
                if (rule && (rule === '/' || path.startsWith(rule))) return false;
            }
        }
        return true;
    }

    let firstPage = true;
    while (queue.length > 0 && pages.length < MAX_PAGES) {
        // Pull next item (CONCURRENCY=1 means one at a time)
        const batch: QueueItem[] = [];
        while (queue.length > 0 && batch.length < CONCURRENCY && pages.length + batch.length < MAX_PAGES) {
            const item = queue.shift()!;
            const normUrl = new URL(item.url).origin + new URL(item.url).pathname;
            if (visited.has(normUrl)) continue;
            if (!isRobotsAllowed(new URL(item.url).pathname)) continue;
            visited.add(normUrl);
            batch.push(item);
        }
        if (batch.length === 0) break;

        // Fix 1: polite delay between requests (skip before very first page)
        if (!firstPage) await sleep(INTER_REQUEST_DELAY);
        firstPage = false;

        const results = await Promise.all(batch.map(async item => {
            let snap = await crawler.captureWithFlags(item.url);

            // Fix 3: if 429, read Retry-After and retry once
            if (snap.status === 429) {
                const retryAfterHeader = snap.headers['retry-after'];
                let waitMs = 3000; // default 3s if no header
                if (retryAfterHeader) {
                    const secs = parseInt(retryAfterHeader, 10);
                    if (!isNaN(secs) && secs > 0 && secs <= MAX_RETRY_AFTER_S) {
                        waitMs = secs * 1000;
                    }
                }
                await sleep(waitMs);
                snap = await crawler.captureWithFlags(item.url);
            }

            const result = buildScanResult(snap, client);
            onProgress?.(pages.length + 1, Math.min(MAX_PAGES, pages.length + queue.length + 1), item.url);
            return {result, item, html: snap.html};
        }));

        for (const {result, item, html} of results) {
            pages.push({...result, depth: item.depth, linkedFrom: item.linkedFrom});
            // Discover new links if within depth limit and page loaded
            if (item.depth < MAX_DEPTH && html && result.status >= 200 && result.status < 300) {
                for (const link of extractLinks(html, item.url, origin)) {
                    const norm = new URL(link).origin + new URL(link).pathname;
                    if (!visited.has(norm) && pages.length + queue.length < MAX_PAGES) {
                        queue.push({url: link, depth: item.depth + 1, linkedFrom: item.url});
                    }
                }
            }
        }
    }

    // Aggregate
    const scored = pages.filter(p => p.audit !== null);
    const avgScore = scored.length ? Math.round(scored.reduce((s, p) => s + p.audit!.score, 0) / scored.length) : null;
    const avgCoverage = scored.length ? Math.round(scored.reduce((s, p) => s + p.audit!.coverage, 0) / scored.length) : null;

    // Sub-score averages (scr-3)
    const seoScores = scored.map(p => p.audit!.subScores.seoScore).filter((v): v is number => v !== null);
    const aeoScores = scored.map(p => p.audit!.subScores.aeoScore).filter((v): v is number => v !== null);
    const geoScores = scored.map(p => p.audit!.subScores.geoScore).filter((v): v is number => v !== null);
    const avgSubScores = {
        seoScore: seoScores.length ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length) : null,
        aeoScore: aeoScores.length ? Math.round(aeoScores.reduce((a, b) => a + b, 0) / aeoScores.length) : null,
        geoScore: geoScores.length ? Math.round(geoScores.reduce((a, b) => a + b, 0) / geoScores.length) : null,
    };

    // Per-dimension site-wide aggregates (scr-3)
    const dimMap = new Map<string, {name: string; weight: number; scores: number[]}>();
    for (const p of scored) {
        for (const d of p.audit!.dimensions) {
            if (d.score === null) continue;
            const ex = dimMap.get(d.id);
            if (ex) ex.scores.push(d.score);
            else dimMap.set(d.id, {name: d.name, weight: d.weight, scores: [d.score]});
        }
    }
    const dimensionAggregates: DimensionAggregate[] = [...dimMap.entries()].map(([id, {name, weight, scores}]) => ({
        id, name, weight,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        pagesScored: scores.length,
        pagesBelow70: scores.filter(s => s < 70).length,
    })).sort((a, b) => b.weight - a.weight);

    // Common gaps: dimensions scoring < 100 across all pages
    const gapMap = new Map<string, {name: string; count: number; weight: number}>();
    for (const p of scored) {
        for (const d of p.audit!.dimensions) {
            if (d.score !== null && d.score < 100) {
                const ex = gapMap.get(d.id);
                if (ex) ex.count++;
                else gapMap.set(d.id, {name: d.name, count: 1, weight: d.weight});
            }
        }
    }
    const commonGaps = [...gapMap.values()].sort((a, b) => b.count - a.count || b.weight - a.weight);

    // Top and bottom pages (scr-3)
    const scoredByScore = [...scored].sort((a, b) => b.audit!.score - a.audit!.score);
    const topPage = scoredByScore[0] ? {url: scoredByScore[0].url, score: scoredByScore[0].audit!.score} : null;
    const bottomPage = scoredByScore[scoredByScore.length - 1] ? {url: scoredByScore[scoredByScore.length - 1].url, score: scoredByScore[scoredByScore.length - 1].audit!.score} : null;

    return {
        startUrl,
        crawledAt,
        pagesAttempted: pages.length,
        pagesScored: scored.length,
        avgScore,
        avgCoverage,
        avgSubScores,
        dimensionAggregates,
        commonGaps,
        topPage,
        bottomPage,
        pages,
    };
}
