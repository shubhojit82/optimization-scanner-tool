import {analyzeHtml, aggregate, subScores, RUBRIC_VERSION, applyIndustryProfile} from '../core/scoring';
import type {Audit, Client} from '../core/contracts';
import type {AiBotAccess, BlockFlag, ScanSnapshot, SitemapInfo} from '../server/node-crawler';
import {detectTechStack} from '../core/tech-detect';
import type {TechStack} from '../core/tech-detect';
import {scorePassage, isYmyl, rgpsExtractText} from '../core/rgps';
import type {RgpsResult} from '../core/rgps';

export type RawVsRenderedDelta = {
    /** Character count of raw server HTML body text */
    rawTextLen: number;
    /** Character count of JS-rendered HTML body text */
    renderedTextLen: number;
    /** True if rendered content is substantially larger (>20% more chars) — JS-injected content */
    jsOnlyContent: boolean;
    /** Headings only found in rendered DOM, not in raw */
    headingsOnlyInRendered: string[];
    /** Schema.org types present in rendered but absent from raw */
    schemaOnlyInRendered: string[];
    /** Heading tag order issues (e.g. H1 not first meaningful heading) */
    headingOrderIssues: string[];
};

export type ScanResult = {
    url: string;
    fetchedAt: string;
    status: number;
    flags: BlockFlag[];
    aiBotAccess?: AiBotAccess;
    sitemapInfo?: SitemapInfo;
    audit: Audit | null;
    techStack?: TechStack;
    rgps?: RgpsResult;
    rawVsRendered?: RawVsRenderedDelta;
};

export function buildScanResult(snap: ScanSnapshot, client: Client): ScanResult {
    let audit: Audit | null = null;
    if (snap.html) {
        const dimensions = applyIndustryProfile(analyzeHtml(snap.html, client), client);
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
    const techStack = snap.html ? detectTechStack(snap.html, snap.headers) : undefined;
    const rgps = snap.html ? scorePassage(snap.html, isYmyl(snap.url, rgpsExtractText(snap.html))) : undefined;
    const rawVsRendered = (snap.html && snap.renderedHtml)
        ? computeRawVsRendered(snap.html, snap.renderedHtml)
        : undefined;
    return {url: snap.url, fetchedAt: snap.fetchedAt, status: snap.status, flags: snap.flags, aiBotAccess: snap.aiBotAccess, sitemapInfo: snap.sitemapInfo, audit, techStack, rgps, rawVsRendered};
}

function extractHeadings(html: string): string[] {
    const results: string[] = [];
    for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
        results.push(`H${m[1]}:${m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)}`);
    }
    return results;
}

function extractSchemaTypes(html: string): Set<string> {
    const types = new Set<string>();
    for (const m of html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.add(m[1]);
    for (const m of html.matchAll(/itemtype=["']https?:\/\/schema\.org\/([^"']+)["']/gi)) types.add(m[1]);
    return types;
}

function checkHeadingOrder(html: string): string[] {
    const issues: string[] = [];
    const headings: {level: number; text: string}[] = [];
    for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
        headings.push({level: parseInt(m[1]), text: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)});
    }
    if (!headings.length) return issues;
    // H1 should be first or at most preceded by navigation headings (heuristic: within first 3)
    const h1Idx = headings.findIndex(h => h.level === 1);
    if (h1Idx < 0) {
        issues.push('No H1 found on page');
    } else if (h1Idx > 3) {
        issues.push(`H1 appears at position ${h1Idx + 1} (behind ${h1Idx} other headings)`);
    }
    // Check for skipped levels (e.g. H1 → H3)
    for (let i = 1; i < headings.length; i++) {
        if (headings[i].level - headings[i-1].level > 1) {
            issues.push(`Heading level skipped: H${headings[i-1].level} → H${headings[i].level} ("${headings[i].text}")`);
        }
    }
    // Multiple H1s
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count > 1) issues.push(`${h1Count} H1 elements found — should be exactly one`);
    return issues;
}

export function computeRawVsRendered(rawHtml: string, renderedHtml: string): RawVsRenderedDelta {
    const rawText = rgpsExtractText(rawHtml);
    const renderedText = rgpsExtractText(renderedHtml);
    const rawLen = rawText.length;
    const rendLen = renderedText.length;
    const jsOnlyContent = rendLen > rawLen * 1.2;

    const rawHeadings = new Set(extractHeadings(rawHtml));
    const rendHeadings = extractHeadings(renderedHtml);
    const headingsOnlyInRendered = rendHeadings.filter(h => !rawHeadings.has(h));

    const rawSchema = extractSchemaTypes(rawHtml);
    const rendSchema = extractSchemaTypes(renderedHtml);
    const schemaOnlyInRendered = [...rendSchema].filter(t => !rawSchema.has(t));

    const headingOrderIssues = checkHeadingOrder(rawHtml);

    return {rawTextLen: rawLen, renderedTextLen: rendLen, jsOnlyContent, headingsOnlyInRendered, schemaOnlyInRendered, headingOrderIssues};
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
