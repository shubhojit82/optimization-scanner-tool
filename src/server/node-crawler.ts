import type {Crawler, PageSnapshot} from '../core/contracts';

export type BlockFlag = {code: string; message: string};

export type SitemapInfo = {
    fetched: boolean;
    url: string;
    status: number | null;
    urlCount: number;
    hasLastmod: boolean;
    lastmodDates: string[];          // up to 5 most-recent lastmod values
    hasImageSitemap: boolean;
    hasVideoSitemap: boolean;
    hasNewsSitemap: boolean;
    sitemapIndexUrls: string[];      // child sitemaps if this is a sitemap index
    declaredInRobots: boolean;       // was the sitemap declared in robots.txt?
    error?: string;
};

export type ScanSnapshot = PageSnapshot & {flags: BlockFlag[]; aiBotAccess?: AiBotAccess; sitemapInfo?: SitemapInfo; renderedHtml?: string};

export type AiBotAccess = {
    fetched: boolean;
    bots: {name: string; userAgent: string; status: 'allowed' | 'blocked' | 'unknown'}[];
};

const AI_BOTS = [
    {name: 'GPTBot',         userAgent: 'GPTBot'},
    {name: 'Google-Extended', userAgent: 'Google-Extended'},
    {name: 'ClaudeBot',      userAgent: 'ClaudeBot'},
    {name: 'PerplexityBot',  userAgent: 'PerplexityBot'},
    {name: 'Applebot-Extended', userAgent: 'Applebot-Extended'},
    {name: 'Bytespider',     userAgent: 'Bytespider'},
] as const;

type RobotsResult = {generalBlock: BlockFlag | null; aiBotAccess: AiBotAccess; declaredSitemaps: string[]};

/** Checks robots.txt for disallow rules (general + AI-specific bots). */
async function checkRobots(baseUrl: string, path: string, timeout: number): Promise<RobotsResult> {
    const result: RobotsResult = {generalBlock: null, aiBotAccess: {fetched: false, bots: AI_BOTS.map(b => ({name: b.name, userAgent: b.userAgent, status: 'unknown' as const}))}, declaredSitemaps: []};
    try {
        const url = new URL('/robots.txt', baseUrl).href;
        const res = await fetch(url, {signal: AbortSignal.timeout(timeout), headers: {'User-Agent': 'GEOWorkbench/1.0'}});
        if (!res.ok) return result;
        const text = await res.text();
        result.aiBotAccess.fetched = true;

        // Build agent→rules map
        const agentRules: Record<string, {disallow: string[]; allow: string[]}> = {};
        let currentAgents: string[] = [];
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith('#')) { if (line === '' || !line) currentAgents = []; continue; }
            if (/^user-agent\s*:/i.test(line)) {
                const agent = line.replace(/^user-agent\s*:\s*/i, '').trim().toLowerCase();
                currentAgents.push(agent);
                if (!agentRules[agent]) agentRules[agent] = {disallow: [], allow: []};
            } else if (/^disallow\s*:/i.test(line)) {
                const rule = line.replace(/^disallow\s*:\s*/i, '').trim();
                if (rule) currentAgents.forEach(a => { if (agentRules[a]) agentRules[a].disallow.push(rule); });
            } else if (/^allow\s*:/i.test(line)) {
                const rule = line.replace(/^allow\s*:\s*/i, '').trim();
                if (rule) currentAgents.forEach(a => { if (agentRules[a]) agentRules[a].allow.push(rule); });
            }
        }

        // General wildcard block check
        const wildcard = agentRules['*'];
        if (wildcard) {
            for (const rule of wildcard.disallow) {
                if (rule === '/' || path.startsWith(rule)) {
                    result.generalBlock = {code: 'ROBOTS_DISALLOW', message: `robots.txt disallows "${rule}" for all crawlers.`};
                    break;
                }
            }
        }

        // Per-bot checks
        result.aiBotAccess.bots = AI_BOTS.map(b => {
            const rules = agentRules[b.userAgent.toLowerCase()];
            if (!rules) {
                // Fall back to wildcard
                const wc = agentRules['*'];
                if (wc?.disallow.some(r => r === '/' || path.startsWith(r))) return {name: b.name, userAgent: b.userAgent, status: 'blocked' as const};
                return {name: b.name, userAgent: b.userAgent, status: 'allowed' as const};
            }
            const blocked = rules.disallow.some(r => r === '/' || path.startsWith(r)) &&
                !rules.allow.some(r => r === '/' || path.startsWith(r));
            return {name: b.name, userAgent: b.userAgent, status: blocked ? 'blocked' as const : 'allowed' as const};
        });

        // Collect Sitemap: directives
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (/^sitemap\s*:/i.test(line)) {
                const sitemapUrl = line.replace(/^sitemap\s*:\s*/i, '').trim();
                if (sitemapUrl) result.declaredSitemaps.push(sitemapUrl);
            }
        }

        return result;
    } catch {
        return result;
    }
}

/** Parse a sitemap XML string and return structured info. */
function parseSitemapXml(xml: string, sitemapUrl: string, declaredInRobots: boolean): SitemapInfo {
    const isSitemapIndex = /<sitemapindex\b/i.test(xml);
    const urlCount = isSitemapIndex ? 0 : (xml.match(/<url\b/gi) ?? []).length;
    // Child sitemaps (sitemap index entries)
    const sitemapIndexUrls: string[] = [];
    if (isSitemapIndex) {
        for (const m of xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)) sitemapIndexUrls.push(m[1]);
    }
    // lastmod values
    const lastmods: string[] = [];
    for (const m of xml.matchAll(/<lastmod>\s*(.*?)\s*<\/lastmod>/gi)) lastmods.push(m[1]);
    const sortedLastmods = [...lastmods].sort().reverse().slice(0, 5);
    // Specialised sitemaps
    const hasImageSitemap = /<image:image\b/i.test(xml) || /xmlns:image=/i.test(xml);
    const hasVideoSitemap = /<video:video\b/i.test(xml) || /xmlns:video=/i.test(xml);
    const hasNewsSitemap = /<news:news\b/i.test(xml) || /xmlns:news=/i.test(xml);
    return {
        fetched: true,
        url: sitemapUrl,
        status: 200,
        urlCount,
        hasLastmod: lastmods.length > 0,
        lastmodDates: sortedLastmods,
        hasImageSitemap,
        hasVideoSitemap,
        hasNewsSitemap,
        sitemapIndexUrls,
        declaredInRobots,
    };
}

/** Fetch and analyse the sitemap for the given origin. */
async function checkSitemap(baseUrl: string, declaredSitemaps: string[], timeout: number): Promise<SitemapInfo> {
    const candidates = declaredSitemaps.length > 0
        ? declaredSitemaps.slice(0, 3)
        : [new URL('/sitemap.xml', baseUrl).href];
    const sitemapUrl = candidates[0];
    const declaredInRobots = declaredSitemaps.length > 0;
    try {
        const res = await fetch(sitemapUrl, {signal: AbortSignal.timeout(timeout), headers: {'User-Agent': 'GEOWorkbench/1.0', 'Accept': 'application/xml,text/xml,*/*'}});
        if (!res.ok) {
            return {fetched: false, url: sitemapUrl, status: res.status, urlCount: 0, hasLastmod: false, lastmodDates: [], hasImageSitemap: false, hasVideoSitemap: false, hasNewsSitemap: false, sitemapIndexUrls: [], declaredInRobots, error: `HTTP ${res.status}`};
        }
        const xml = await res.text();
        return parseSitemapXml(xml, sitemapUrl, declaredInRobots);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return {fetched: false, url: sitemapUrl, status: null, urlCount: 0, hasLastmod: false, lastmodDates: [], hasImageSitemap: false, hasVideoSitemap: false, hasNewsSitemap: false, sitemapIndexUrls: [], declaredInRobots, error: msg};
    }
}

function headersFlags(headers: Record<string, string>): BlockFlag[] {
    const flags: BlockFlag[] = [];
    const robots = headers['x-robots-tag'] || '';
    if (/\bnoindex\b/i.test(robots)) flags.push({code: 'HEADER_NOINDEX', message: 'X-Robots-Tag: noindex — page is excluded from indexing.'});
    if (/\bnofollow\b/i.test(robots)) flags.push({code: 'HEADER_NOFOLLOW', message: 'X-Robots-Tag: nofollow — links on this page will not be followed.'});
    const csp = headers['content-security-policy'] || '';
    if (/frame-ancestors\s+['"]none['"]/i.test(csp)) flags.push({code: 'CSP_FRAME_ANCESTORS_NONE', message: 'CSP frame-ancestors none — page cannot be embedded.'});
    return flags;
}

function statusFlag(status: number, url: string): BlockFlag | null {
    if (status === 403) return {code: 'HTTP_403', message: `Server returned 403 Forbidden for ${url}. A WAF or auth wall may be blocking crawlers.`};
    if (status === 401) return {code: 'HTTP_401', message: `Server returned 401 Unauthorized for ${url}. Authentication is required.`};
    if (status === 429) return {code: 'HTTP_429', message: `Server returned 429 Too Many Requests for ${url}. Rate limiting is active.`};
    if (status >= 500) return {code: `HTTP_${status}`, message: `Server error ${status} for ${url}. The page may be temporarily unavailable.`};
    if (status >= 400) return {code: `HTTP_${status}`, message: `Client error ${status} for ${url}.`};
    return null;
}

function wafFlag(html: string): BlockFlag | null {
    // Common WAF/bot-challenge fingerprints in response body
    const patterns = [
        [/cloudflare.*?checking your browser/i, 'CLOUDFLARE_CHALLENGE', 'Cloudflare browser challenge detected — crawler was blocked.'],
        [/access denied.*?incapsula/i, 'INCAPSULA_BLOCK', 'Incapsula/Imperva WAF blocked the request.'],
        [/__cf_chl_opt/i, 'CLOUDFLARE_CAPTCHA', 'Cloudflare CAPTCHA challenge page detected.'],
        [/px-captcha|perimeterx/i, 'PERIMETERX_BLOCK', 'PerimeterX bot protection detected.'],
        [/datadome/i, 'DATADOME_BLOCK', 'DataDome bot protection detected.'],
    ] as [RegExp, string, string][];
    for (const [re, code, message] of patterns) {
        if (re.test(html)) return {code, message};
    }
    return null;
}

export class NodeCrawler implements Crawler {
    constructor(private timeoutMs = 15000) {}

    async capture(url: string): Promise<PageSnapshot> {
        // Use captureWithFlags but return only the PageSnapshot shape
        const snap = await this.captureWithFlags(url);
        return {url: snap.url, html: snap.html, fetchedAt: snap.fetchedAt, status: snap.status, headers: snap.headers};
    }

    async captureWithFlags(url: string): Promise<ScanSnapshot> {
        const flags: BlockFlag[] = [];
        const fetchedAt = new Date().toISOString();

        const parsedUrl = new URL(url);

        // Fetch robots.txt, page, and sitemap all in parallel.
        // Sitemap uses declared URLs from robots.txt when available, so we start it
        // with an empty list first and let it fall back to /sitemap.xml; if robots
        // finishes first with declared URLs we already have the right candidates.
        const [robotsResult, pageResult, sitemapInfo] = await Promise.all([
            checkRobots(parsedUrl.origin, parsedUrl.pathname || '/', this.timeoutMs),
            fetch(url, {
                signal: AbortSignal.timeout(this.timeoutMs),
                headers: {
                    'User-Agent': 'GEOWorkbench/1.0 (+https://github.com/geo-workbench)',
                    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                redirect: 'follow',
            }).then(r => ({ok: true as const, res: r})).catch((e: unknown) => ({ok: false as const, error: e instanceof Error ? e.message : String(e)})),
            checkSitemap(parsedUrl.origin, [], Math.min(this.timeoutMs, 8000)),
        ]);

        if (robotsResult.generalBlock) flags.push(robotsResult.generalBlock);

        if (!pageResult.ok) {
            flags.push({code: 'FETCH_ERROR', message: `Could not reach ${url}: ${pageResult.error}`});
            return {url, html: '', fetchedAt, status: 0, headers: {}, flags, aiBotAccess: robotsResult.aiBotAccess, sitemapInfo};
        }

        const res = pageResult.res;
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

        const statusF = statusFlag(res.status, url);
        if (statusF) flags.push(statusF);
        flags.push(...headersFlags(headers));

        const html = res.ok ? await res.text() : '';
        if (html) {
            const waf = wafFlag(html);
            if (waf) flags.push(waf);
        }

        return {url, html, fetchedAt, status: res.status, headers, flags, aiBotAccess: robotsResult.aiBotAccess, sitemapInfo};
    }
}
