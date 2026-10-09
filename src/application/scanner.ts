import {analyzeHtml, aggregate, subScores, RUBRIC_VERSION} from '../core/scoring';
import type {Audit, Client} from '../core/contracts';
import type {AiBotAccess, BlockFlag, ScanSnapshot, SitemapInfo} from '../server/node-crawler';

export type ScanResult = {
    url: string;
    fetchedAt: string;
    status: number;
    flags: BlockFlag[];
    aiBotAccess?: AiBotAccess;
    sitemapInfo?: SitemapInfo;
    audit: Audit | null;
};

export function buildScanResult(snap: ScanSnapshot, client: Client): ScanResult {
    let audit: Audit | null = null;
    if (snap.html) {
        const dimensions = analyzeHtml(snap.html, client);
        // Mark crawl dimension: if flags are present that block access, score 0; clean crawl = 100
        const crawlBlocking = snap.flags.filter(f =>
            ['ROBOTS_DISALLOW','HTTP_403','HTTP_401','HTTP_429','CLOUDFLARE_CHALLENGE','CLOUDFLARE_CAPTCHA','INCAPSULA_BLOCK','PERIMETERX_BLOCK','DATADOME_BLOCK','FETCH_ERROR'].includes(f.code)
        );
        const crawlDim = dimensions.find(d => d.id === 'crawl');
        if (crawlDim) {
            // Compute crawl score: blocked = 0; clean + good sitemap = 100; clean + no sitemap = 70
            const si = snap.sitemapInfo;
            const sitemapOk = si?.fetched && si.urlCount > 0;
            crawlDim.score = crawlBlocking.length ? 0 : sitemapOk ? 100 : 70;

            const botSummary = snap.aiBotAccess?.bots
                .map(b => `${b.name}: ${b.status}`)
                .join(', ');
            const sitemapSummary = si
                ? si.fetched
                    ? `Sitemap found (${si.urlCount} URLs${si.hasLastmod ? ', lastmod present' : ', no lastmod'}${si.hasImageSitemap ? ', image' : ''}${si.hasVideoSitemap ? ', video' : ''}).`
                    : `Sitemap not found at ${si.url} (${si.error ?? `HTTP ${si.status}`}).`
                : '';
            crawlDim.evidence = crawlBlocking.length
                ? `Crawler was blocked: ${crawlBlocking.map(f => f.message).join(' ')}`
                : `Page fetched (HTTP ${snap.status}). robots.txt accessible.${botSummary ? ` AI bots — ${botSummary}.` : ''} ${sitemapSummary}`.trim();

            // Enrich details table with sitemap rows
            if (crawlDim.details && si) {
                crawlDim.details.found = [
                    ...crawlDim.details.found,
                    ...(si.fetched ? [`Sitemap found: ${si.url} (${si.urlCount} URLs)`] : []),
                    ...(si.hasLastmod ? [`lastmod present — ${si.lastmodDates[0] ?? ''}`] : []),
                    ...(si.hasImageSitemap ? ['Image sitemap namespace detected'] : []),
                    ...(si.hasVideoSitemap ? ['Video sitemap namespace detected'] : []),
                    ...(si.declaredInRobots ? ['Sitemap declared in robots.txt'] : []),
                ];
                crawlDim.details.missing = [
                    ...crawlDim.details.missing,
                    ...(!si.fetched ? [`Sitemap missing at ${si.url} — create /sitemap.xml and declare it in robots.txt`] : []),
                    ...(si.fetched && !si.hasLastmod ? ['lastmod missing from sitemap — add <lastmod> to every <url> entry'] : []),
                    ...(si.fetched && !si.declaredInRobots ? ['Sitemap not declared in robots.txt — add "Sitemap: https://your-site.com/sitemap.xml"'] : []),
                ];
                crawlDim.details.items = [
                    ...crawlDim.details.items,
                    {label: 'Sitemap', value: si.fetched ? `Found (${si.urlCount} URLs)` : `Not found — ${si.error ?? 'no response'}`, status: si.fetched ? 'ok' : 'fail'},
                    ...(si.fetched ? [{label: 'lastmod', value: si.hasLastmod ? si.lastmodDates[0] ?? 'present' : 'Missing', status: si.hasLastmod ? 'ok' as const : 'warn' as const}] : []),
                    ...(si.fetched ? [{label: 'Declared in robots.txt', value: si.declaredInRobots ? 'Yes' : 'No', status: si.declaredInRobots ? 'ok' as const : 'warn' as const}] : []),
                    ...(si.hasImageSitemap ? [{label: 'Image sitemap', value: 'Detected', status: 'ok' as const}] : []),
                    ...(si.hasVideoSitemap ? [{label: 'Video sitemap', value: 'Detected', status: 'ok' as const}] : []),
                    ...(si.sitemapIndexUrls.length > 0 ? [{label: 'Sitemap index', value: `${si.sitemapIndexUrls.length} child sitemaps`, status: 'info' as const}] : []),
                ];
                if (crawlDim.details.table) {
                    crawlDim.details.table.rows.push(
                        ['Sitemap', si.fetched ? `${si.url} (${si.urlCount} URLs)` : 'Not found', si.fetched ? 'Pass' : 'Fail'],
                        ...(si.fetched ? [
                            ['Sitemap lastmod', si.hasLastmod ? si.lastmodDates[0] ?? 'Present' : 'Missing', si.hasLastmod ? 'Pass' : 'Warning'],
                            ['Declared in robots.txt', si.declaredInRobots ? 'Yes' : 'No', si.declaredInRobots ? 'Pass' : 'Warning'],
                            ...(si.hasImageSitemap ? [['Image sitemap', 'Detected', 'Pass']] as string[][] : []),
                            ...(si.hasVideoSitemap ? [['Video sitemap', 'Detected', 'Pass']] as string[][] : []),
                        ] : [])
                    );
                }
            }
        }
        const {score, coverage} = aggregate(dimensions);
        const hash = simpleHash(snap.html);
        audit = {
            id: crypto.randomUUID(),
            clientId: client.id,
            url: snap.url,
            created: snap.fetchedAt,
            version: RUBRIC_VERSION,
            source: 'html-import',
            hash,
            score,
            coverage,
            dimensions,
            subScores: subScores(dimensions),
        };
    }
    return {url: snap.url, fetchedAt: snap.fetchedAt, status: snap.status, flags: snap.flags, aiBotAccess: snap.aiBotAccess, sitemapInfo: snap.sitemapInfo, audit};
}

function simpleHash(s: string): string {
    // FNV-1a 32-bit as a lightweight hash (no crypto.subtle needed synchronously)
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h * 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}
