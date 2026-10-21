import type { Client, Dimension, DimensionDetail, DimensionItem, Observation } from './contracts';
import {mentionsBrand} from './brand-matching';
export const RUBRIC_VERSION = 'readiness-cues/1.1.0';

// ── Industry scoring profiles (scr-5 / cnt-7) ─────────────────────────────────
// Each profile defines dimension weight multipliers (1.0 = no change).
// Multipliers > 1.0 raise a dimension's importance for that industry.
// Multipliers < 1.0 lower it. Missing dimensions inherit multiplier 1.0.
export type IndustryProfile = {
    label: string;
    /** Regex patterns matched against client.industry (case-insensitive) */
    match: RegExp[];
    /** per-dimension weight multiplier */
    weights: Partial<Record<string, number>>;
    /** industry-specific action hints appended to matching dimension findings */
    hints: Partial<Record<string, string>>;
};

export const INDUSTRY_PROFILES: IndustryProfile[] = [
    {
        label: 'Finance',
        match: [/financ/i, /insurance/i, /invest/i, /bank/i, /mortgage/i, /wealth/i, /trading/i, /fintech/i],
        weights: {
            evidence:    1.5,   // authoritative references critical for YMYL finance
            schema:      1.4,   // FinancialProduct, LoanOrCredit, BankOrCreditUnion schema
            freshness:   1.5,   // rates, regulations change; stale content = compliance risk
            'entity-links': 1.3, // SEC, FINRA, regulator links boost credibility
            content:     1.2,   // thin/duplicate content is YMYL risk
            technical:   1.2,
        },
        hints: {
            evidence:    'Finance: cite regulatory sources (SEC, FINRA, FCA, CFPB) and link to official rate disclosures.',
            schema:      'Finance: add FinancialProduct, LoanOrCredit, BankAccount, or BankOrCreditUnion JSON-LD with eligibility and rate fields.',
            freshness:   'Finance: rates and regulations change frequently — add dateModified and use <time> tags on all rate tables.',
            'entity-links': 'Finance: add sameAs links to your regulatory registrations, SEC/EDGAR filings, or FINRA BrokerCheck profile.',
        },
    },
    {
        label: 'Health',
        match: [/health/i, /medical/i, /clinic/i, /hospital/i, /pharma/i, /dental/i, /wellness/i, /therap/i, /nurs/i, /doctor/i],
        weights: {
            evidence:    1.6,   // medical claims require strong citations (E-E-A-T)
            schema:      1.5,   // MedicalCondition, Drug, Physician, Hospital schema
            freshness:   1.4,   // clinical guidelines update; outdated advice is YMYL risk
            content:     1.3,   // thin health content is dangerous
            'entity-links': 1.3, // links to PubMed, NHS, CDC, WHO
            technical:   1.1,
        },
        hints: {
            evidence:    'Health: cite peer-reviewed sources (PubMed, Cochrane, NHS, CDC, WHO). Author should be a named medical professional.',
            schema:      'Health: add Physician, MedicalClinic, MedicalCondition, or Drug JSON-LD. Include a physician name and license number.',
            freshness:   'Health: medical guidance changes — always show review date and last-reviewed-by author name.',
            'entity-links': 'Health: add sameAs links to your NPI registry, hospital accreditation bodies (JCI, CQC, TJC), or PubMed author profiles.',
        },
    },
    {
        label: 'Legal',
        match: [/legal/i, /law firm/i, /attorney/i, /solicitor/i, /barrister/i, /counsel/i],
        weights: {
            evidence:    1.5,
            schema:      1.4,   // LegalService, Attorney JSON-LD
            freshness:   1.4,
            'entity-links': 1.2,
        },
        hints: {
            evidence:    'Legal: cite case law, statutory references, and bar association guidelines. Author must be a named qualified solicitor or attorney.',
            schema:      'Legal: add LegalService or Attorney JSON-LD with bar membership number, jurisdictions, and practice areas.',
        },
    },
    {
        label: 'E-commerce / Retail',
        match: [/retail/i, /e-commerce/i, /ecommerce/i, /shop/i, /store/i, /product/i, /commerce/i],
        weights: {
            schema:      1.5,   // Product, Offer, AggregateRating schema crucial
            freshness:   1.4,   // pricing and availability change
            entity:      1.3,
            technical:   1.2,
            content:     1.1,
        },
        hints: {
            schema:      'Retail: add Product JSON-LD with offers, price, availability, sku, and aggregateRating. Use BreadcrumbList on category pages.',
            freshness:   'Retail: product prices and stock change daily — use priceValidUntil and availability fields in Product schema.',
            entity:      'Retail: add brand sameAs links to Google Merchant profile, Brand page on Wikidata, and manufacturer website.',
        },
    },
    {
        label: 'SaaS / Technology',
        match: [/software/i, /saas/i, /tech/i, /platform/i, /api\b/i, /cloud/i, /devops/i, /cybersec/i],
        weights: {
            schema:      1.3,   // SoftwareApplication, WebAPI schema
            content:     1.2,
            query:       1.3,   // high question intent for SaaS comparison queries
            'reasoning-cues': 1.3,
        },
        hints: {
            schema:      'SaaS: add SoftwareApplication JSON-LD with applicationCategory, operatingSystem, offers, and aggregateRating.',
            query:       'SaaS: structure H2/H3 headings as direct questions matching comparison and evaluation intent ("How does X compare to Y?").',
        },
    },
];

/** Detect which industry profile applies to a client (returns null if no match). */
export function detectIndustryProfile(client: Client): IndustryProfile | null {
    const industry = (client.industry || '').toLowerCase();
    return INDUSTRY_PROFILES.find(p => p.match.some(re => re.test(industry))) ?? null;
}

/** Apply industry-specific weight multipliers and append hints to dimension actions.
 *  Returns a new dimension array; does not mutate the input. */
export function applyIndustryProfile(dimensions: Dimension[], client: Client): Dimension[] {
    const profile = detectIndustryProfile(client);
    if (!profile) return dimensions;
    return dimensions.map(d => {
        const mult = profile.weights[d.id] ?? 1.0;
        const hint = profile.hints[d.id];
        return {
            ...d,
            weight: Math.round(d.weight * mult),
            action: hint ? `${d.action} [${profile.label}: ${hint}]` : d.action,
        };
    });
}
export function aggregate(dimensions: Dimension[]) { const known = dimensions.filter(d => d.score !== null); const coverage = known.reduce((n, d) => n + d.weight, 0); return { score: coverage ? Math.round(known.reduce((n, d) => n + d.weight * d.score!, 0) / coverage) : 0, coverage }; }
// SEO = crawl + technical + schema + freshness (technical crawlability signals)
// AEO = content + entity + evidence + query (answer engine signals from on-page content)
// GEO = measurement + authority (AI visibility signals — typically unassessed from HTML alone)
const SEO_IDS = ['crawl','technical','schema','freshness'];
const AEO_IDS = ['content','entity','evidence','query','reasoning-cues','passage-density','entity-links'];
const GEO_IDS = ['measurement','authority'];
export function subScores(dimensions: Dimension[]): {seoScore:number|null;aeoScore:number|null;geoScore:number|null} {
    function sub(ids: string[]) {
        const group = dimensions.filter(d => ids.includes(d.id) && d.score !== null);
        if (!group.length) return null;
        const w = group.reduce((n,d) => n+d.weight, 0);
        return w ? Math.round(group.reduce((n,d) => n+d.weight*d.score!, 0)/w) : null;
    }
    return {seoScore: sub(SEO_IDS), aeoScore: sub(AEO_IDS), geoScore: sub(GEO_IDS)};
}
function extractText(html: string): string {
    return html.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function innerText(html: string, tag: string): string {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (!m) return '';
    return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
function allInnerTexts(html: string, tag: string): string[] {
    const results: string[] = [];
    for (const m of html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))) {
        const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (t) results.push(t);
    }
    return results;
}
export function analyzeHtml(html: string, c: Client, probeRunCount = 0): Dimension[] {
    const clean = html.replace(/<!--[\s\S]*?-->/g, '');
    const visible = extractText(clean);
    const tags = Array.from(clean.matchAll(/<(meta|link)\b([^>]*)>/gi), m => ({ tag: m[1].toLowerCase(), attrs: Object.fromEntries(Array.from(m[2].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g), a => [a[1].toLowerCase(), a[2]])) }));

    // Extract actual content for rich evidence
    const titleText = innerText(clean, 'title');
    const h1Text = innerText(clean, 'h1');
    const h2Texts = allInnerTexts(clean, 'h2');
    const h3Texts = allInnerTexts(clean, 'h3');
    const descTag = tags.find(t => t.attrs.name?.toLowerCase() === 'description' && t.attrs.content?.trim());
    const canonicalTag = tags.find(t => t.tag === 'link' && t.attrs.rel?.toLowerCase().split(/\s+/).includes('canonical') && t.attrs.href);
    const noindexTag = tags.find(t => t.attrs.name?.toLowerCase() === 'robots' && /\bnoindex\b/i.test(t.attrs.content || ''));
    const title = !!titleText, h1 = !!h1Text;
    const desc = !!descTag, canonical = !!canonicalTag, noindex = !!noindexTag;

    // H2 texts with anchor IDs
    const h2Elements: {text: string; id: string}[] = [];
    for (const m of clean.matchAll(/<h2\b([^>]*?)>([\s\S]*?)<\/h2>/gi)) {
        const attrs = m[1];
        const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
        h2Elements.push({text, id: idMatch ? idMatch[1] : ''});
    }

    // H3 texts with anchor IDs
    const h3Elements: {text: string; id: string}[] = [];
    for (const m of clean.matchAll(/<h3\b([^>]*?)>([\s\S]*?)<\/h3>/gi)) {
        const attrs = m[1];
        const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
        h3Elements.push({text, id: idMatch ? idMatch[1] : ''});
    }

    // Extract images and inputs
    const extractedImages: {src: string; alt: string; hasAlt: boolean}[] = [];
    for (const m of clean.matchAll(/<img\b([^>]*?)>/gi)) {
        const attrs = m[1];
        const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
        const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
        extractedImages.push({
            src: srcMatch ? srcMatch[1] : '',
            alt: altMatch ? altMatch[1] : '',
            hasAlt: !!altMatch
        });
    }

    const extractedInputs: {id: string; type: string}[] = [];
    for (const m of clean.matchAll(/<input\b([^>]*?)>/gi)) {
        const attrs = m[1];
        const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
        const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
        extractedInputs.push({
            id: idMatch ? idMatch[1] : '',
            type: typeMatch ? typeMatch[1] : 'text'
        });
    }

    // Schema: extract types with completeness scoring
    const SCHEMA_REQUIRED: Record<string, string[]> = {
        'Article': ['headline','author','datePublished','publisher'],
        'NewsArticle': ['headline','author','datePublished','publisher'],
        'BlogPosting': ['headline','author','datePublished'],
        'Product': ['name','description','offers'],
        'FAQPage': ['mainEntity'],
        'HowTo': ['name','step'],
        'Organization': ['name','url'],
        'LocalBusiness': ['name','address','telephone'],
        'Person': ['name'],
        'WebPage': ['name','url'],
        'WebSite': ['name','url'],
        'BreadcrumbList': ['itemListElement'],
        'Event': ['name','startDate','location'],
        'JobPosting': ['title','description','hiringOrganization','datePosted'],
        'Review': ['reviewRating','author','itemReviewed'],
        'Service': ['name','provider'],
    };
    const SCHEMA_RECOMMENDED: Record<string, string[]> = {
        'Article': ['image','description','keywords','sameAs'],
        'NewsArticle': ['image','description','keywords'],
        'BlogPosting': ['image','description','keywords','sameAs'],
        'Product': ['image','sku','brand','aggregateRating','sameAs'],
        'FAQPage': [],
        'HowTo': ['description','image','totalTime'],
        'Organization': ['logo','description','sameAs','contactPoint'],
        'LocalBusiness': ['openingHours','image','geo','sameAs'],
        'Person': ['jobTitle','affiliation','sameAs','url'],
        'WebPage': ['description','breadcrumb'],
        'WebSite': ['description','sameAs'],
        'BreadcrumbList': [],
        'Event': ['endDate','description','image','offers'],
        'JobPosting': ['jobLocation','employmentType','baseSalary'],
        'Review': ['reviewBody'],
        'Service': ['description','areaServed','serviceType'],
    };
    const schemaTypes: string[] = [];
    const allSameAs: string[] = [];
    let invalid = 0;
    const jsonLdBlocks: {index: number; type: string; valid: boolean; completeness?: number; missing?: string[]}[] = [];
    let blockIndex = 1;
    const blockCompleteness: number[] = [];
    for (const m of clean.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            const j = JSON.parse(m[1]);
            const nodes = Array.isArray(j) ? j : [j, ...(Array.isArray(j?.['@graph']) ? j['@graph'] : [])];
            const typed = nodes.filter(n => n && typeof n === 'object' && n['@type']);
            const types: string[] = [];
            if (typed.length) {
                // Collect sameAs from all typed nodes
                for (const n of typed) {
                    const sa = n['sameAs'];
                    if (typeof sa === 'string') allSameAs.push(sa);
                    else if (Array.isArray(sa)) sa.forEach(s => typeof s === 'string' && allSameAs.push(s));
                }
                // Compute completeness across all typed nodes in this block
                let blockScoreSum = 0;
                const blockMissing: string[] = [];
                for (const n of typed) {
                    const t = String(n['@type']);
                    types.push(t);
                    schemaTypes.push(t);
                    const req = SCHEMA_REQUIRED[t] ?? [];
                    const rec = SCHEMA_RECOMMENDED[t] ?? [];
                    const maxScore = req.length * 2 + rec.length;
                    if (maxScore === 0) { blockScoreSum += 100; continue; }
                    let got = 0;
                    for (const p of req) { if (n[p] !== undefined) got += 2; else blockMissing.push(`${t}.${p} (required)`); }
                    for (const p of rec) { if (n[p] !== undefined) got += 1; else blockMissing.push(`${t}.${p} (recommended)`); }
                    blockScoreSum += Math.round(got / maxScore * 100);
                }
                const avgCompleteness = Math.round(blockScoreSum / typed.length);
                blockCompleteness.push(avgCompleteness);
                jsonLdBlocks.push({index: blockIndex++, type: types.join(', '), valid: true, completeness: avgCompleteness, missing: blockMissing.slice(0, 6)});
            } else {
                invalid++;
                jsonLdBlocks.push({index: blockIndex++, type: '(untyped block)', valid: false});
            }
        } catch {
            invalid++;
            jsonLdBlocks.push({index: blockIndex++, type: '(invalid JSON syntax)', valid: false});
        }
    }
    const valid = schemaTypes.length > 0 ? 1 : 0;
    const schemaCompletenessAvg = blockCompleteness.length ? Math.round(blockCompleteness.reduce((a,b) => a+b, 0) / blockCompleteness.length) : 0;
    // Entity links from sameAs
    const hasWikidata = allSameAs.some(u => /wikidata\.org/i.test(u));
    const hasWikipedia = allSameAs.some(u => /wikipedia\.org/i.test(u));
    const hasLinkedIn = allSameAs.some(u => /linkedin\.com/i.test(u));

    // External links: collect actual URLs and domains and texts
    const allLinks: {href: string; text: string; isExternal: boolean; domain: string}[] = [];
    for (const m of clean.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)) {
        const attrs = m[1];
        const anchorText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
        if (hrefMatch) {
            const href = hrefMatch[1];
            let isExternal = false;
            let domain = '';
            try {
                const urlObj = new URL(href);
                domain = urlObj.hostname;
                isExternal = domain !== new URL(c.domain).hostname;
            } catch {
                // local/relative
            }
            allLinks.push({href, text: anchorText || '(no text)', isExternal, domain});
        }
    }
    const extLinks = allLinks.filter(l => l.isExternal);
    const externalLinks = extLinks.map(l => l.href);

    const words = visible.split(/\s+/).filter(Boolean).length;
    const hasList = /<(ul|ol)\b/i.test(clean);
    const hasTable = /<table\b/i.test(clean);
    const brandFound = mentionsBrand(c, visible);

    // Query readiness detection
    const questionPatterns: string[] = [];
    for (const text of [...h2Texts, ...h3Texts]) {
        const trimmed = text.trim();
        if (trimmed.endsWith('?') || /^(how|what|why|when|which)\b/i.test(trimmed)) {
            questionPatterns.push(trimmed);
        }
    }
    const hasOl = /<ol\b/i.test(clean);
    const hasDl = /<dl\b/i.test(clean);

    // ── Authorship & credibility detection (cnt-5) ───────────────────────────
    // 1. Author in JSON-LD: look for 'author' property in Article/BlogPosting blocks
    let schemaAuthor = '';
    let schemaDatePublished = '';
    let schemaDateModified = '';
    for (const m of clean.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            const j = JSON.parse(m[1]);
            const nodes = Array.isArray(j) ? j : [j, ...(Array.isArray(j?.['@graph']) ? j['@graph'] : [])];
            for (const n of nodes) {
                if (!n || typeof n !== 'object') continue;
                const t = String(n['@type'] ?? '');
                if (/Article|BlogPosting|NewsArticle/.test(t)) {
                    const au = n['author'];
                    if (!schemaAuthor) {
                        if (typeof au === 'string') schemaAuthor = au;
                        else if (typeof au === 'object' && au?.name) schemaAuthor = String(au.name);
                        else if (Array.isArray(au) && au[0]?.name) schemaAuthor = String(au[0].name);
                    }
                    if (!schemaDatePublished && n['datePublished']) schemaDatePublished = String(n['datePublished']).slice(0, 10);
                    if (!schemaDateModified && n['dateModified']) schemaDateModified = String(n['dateModified']).slice(0, 10);
                }
            }
        } catch { /* ignore */ }
    }
    // 2. Meta tags: article:author, article:published_time
    const metaArticleAuthor = tags.find(t => t.attrs.property === 'article:author')?.attrs.content ?? '';
    const metaPublishedTime = tags.find(t => t.attrs.property === 'article:published_time')?.attrs.content?.slice(0, 10) ?? '';
    const metaModifiedTime = tags.find(t => t.attrs.property === 'article:modified_time')?.attrs.content?.slice(0, 10) ?? '';
    // 3. Visible byline heuristic: rel="author" link or common byline patterns
    const relAuthorLink = /<a\b[^>]*rel\s*=\s*["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(clean);
    const relAuthorText = relAuthorLink ? relAuthorLink[1].replace(/<[^>]+>/g, '').trim().slice(0, 80) : '';
    // 4. Visible byline from itemprop="author" or common class patterns
    const itempropAuthor = /<[^>]+itemprop\s*=\s*["']author["'][^>]*>([\s\S]*?)<\/[^>]+>/i.exec(clean);
    const itempropAuthorText = itempropAuthor ? itempropAuthor[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    // Consolidate
    const detectedAuthor = schemaAuthor || metaArticleAuthor || relAuthorText || itempropAuthorText;
    const detectedPublished = schemaDatePublished || metaPublishedTime;
    const detectedModified = schemaDateModified || metaModifiedTime;
    const hasAuthor = !!detectedAuthor;
    const hasPublishedDate = !!detectedPublished;
    const hasModifiedDate = !!detectedModified;
    // Credibility signals: HTTPS, canonical, external links already computed
    // Compute authorship score: 0-100 based on what's present
    const authorshipSignals = [hasAuthor, hasPublishedDate, hasModifiedDate, externalLinks.length > 0];
    const authorshipScore = Math.round(authorshipSignals.filter(Boolean).length / authorshipSignals.length * 100);

    // Helper
    const item = (label: string, value: string, status: DimensionItem['status']): DimensionItem => ({label, value, status});
    const dd = (id: string, name: string, weight: number, score: number | null, evidence: string, action: string, details: DimensionDetail): Dimension =>
        ({id, name, weight, score, evidence, action, details});

    return [
        dd('crawl', 'Crawler access', 10, null,
            'Imported HTML cannot establish robots rules, WAF access, or indexing.',
            'Use the Scanner tab to fetch the live URL. It checks robots.txt, WAF, and HTTP status automatically.',
            {
                found: [],
                missing: ['Live crawl required — use Scanner tab to assess robots.txt, WAF and HTTP response'],
                items: [
                    item('Assessment method', 'HTML import — crawler signals not available', 'info'),
                    item('How to check', 'Scanner tab → enter URL → Run scan', 'info'),
                ],
                table: {
                    headers: ["Check", "Result"],
                    rows: [
                        ["Assessment method", "HTML import — crawler signals not available"],
                        ["How to check", "Scanner tab → enter URL → Run scan"]
                    ]
                }
            }),

        dd('technical', 'Page structure', 10, noindex ? 0 : 25 * [title, h1, desc, canonical].filter(Boolean).length,
            `Title ${title ? 'present' : 'missing'}; H1 ${h1 ? 'present' : 'missing'}; description ${desc ? 'present' : 'missing'}; canonical ${canonical ? 'present' : 'missing'}; noindex ${noindex ? 'detected' : 'not detected'}.`,
            'Review title, H1, description, canonical and intended indexing policy.',
            {
                found: [...(title ? [`<title> found: "${titleText}"`] : []), ...(h1 ? [`<h1> found: "${h1Text}"`] : []), ...(desc ? [`<meta name="description"> found: "${descTag!.attrs.content!.slice(0,120)}"`] : []), ...(canonical ? [`<link rel="canonical"> found: "${canonicalTag!.attrs.href}"`] : [])],
                missing: [...(!title ? ['<title> tag — add a descriptive page title (50–60 chars). In HTML: <title>Your page title here</title> in <head>'] : []), ...(!h1 ? ['<h1> tag — add one main heading that describes the page. In HTML: <h1>Your main heading</h1>'] : []), ...(!desc ? ['<meta name="description"> — add a summary for search snippets (120–155 chars). In HTML: <meta name="description" content="Your description here">'] : []), ...(!canonical ? ['<link rel="canonical"> — declare the canonical URL. In HTML: <link rel="canonical" href="https://your-site.com/this-page/">'] : []), ...(noindex ? ['noindex directive detected — <meta name="robots"> is blocking indexing. Remove noindex if the page should be indexed.'] : [])],
                items: [
                    item('<title>', title ? `"${titleText}" (${titleText.length} chars)` : 'MISSING', title ? (titleText.length >= 30 && titleText.length <= 70 ? 'ok' : 'warn') : 'fail'),
                    item('<h1>', h1 ? `"${h1Text}"` : 'MISSING', h1 ? 'ok' : 'fail'),
                    item('<meta description>', desc ? `"${descTag!.attrs.content!.slice(0, 120)}" (${descTag!.attrs.content!.length} chars)` : 'MISSING', desc ? (descTag!.attrs.content!.length >= 100 && descTag!.attrs.content!.length <= 160 ? 'ok' : 'warn') : 'fail'),
                    item('<link canonical>', canonical ? canonicalTag!.attrs.href : 'MISSING', canonical ? 'ok' : 'fail'),
                    item('noindex', noindex ? `DETECTED — "${noindexTag!.attrs.content}"` : 'Not set', noindex ? 'fail' : 'ok'),
                ],
                table: {
                    headers: ["Attribute", "Value", "Status", "Chars"],
                    rows: [
                        ["<title>", title ? titleText : "MISSING", title ? (titleText.length >= 30 && titleText.length <= 70 ? "Pass" : "Warning") : "Fail", title ? String(titleText.length) : "0"],
                        ["<h1>", h1 ? h1Text : "MISSING", h1 ? "Pass" : "Fail", h1 ? String(h1Text.length) : "0"],
                        ["<meta description>", desc ? descTag!.attrs.content! : "MISSING", desc ? (descTag!.attrs.content!.length >= 100 && descTag!.attrs.content!.length <= 160 ? "Pass" : "Warning") : "Fail", desc ? String(descTag!.attrs.content!.length) : "0"],
                        ["<link canonical>", canonical ? canonicalTag!.attrs.href! : "MISSING", canonical ? "Pass" : "Fail", "—"],
                        ["noindex", noindex ? `DETECTED — "${noindexTag!.attrs.content}"` : "Not set", noindex ? "Fail" : "Pass", "—"]
                    ]
                }
            }),

        dd('entity', 'Brand clarity', 12, brandFound ? 100 : 0,
            `Brand name or alias ${brandFound ? 'found' : 'not found'} in visible text.`,
            'Name the brand explicitly in the opening paragraph. List what the brand does and who it serves.',
            {
                found: brandFound ? [`Brand name "${c.name}" or alias found in visible text`] : [],
                missing: brandFound ? [] : [`Brand name "${c.name}" not found in page text — mention the brand clearly in the opening paragraph`],
                items: [
                    item('Brand name', c.name || '(not configured)', c.name ? 'info' : 'warn'),
                    item('Brand aliases', c.brandAliases?.length ? c.brandAliases.join(', ') : 'None configured', 'info'),
                    item('Brand found in text', brandFound ? 'Yes' : 'No — not detected', brandFound ? 'ok' : 'fail'),
                    item('Visible word count', `${words} words`, words >= 150 ? 'ok' : 'warn'),
                ],
                table: {
                    headers: ["Check", "Result"],
                    rows: [
                        ["Brand name", c.name || "(not configured)"],
                        ["Brand aliases", c.brandAliases?.length ? c.brandAliases.join(', ') : "None configured"],
                        ["Brand found in text", brandFound ? "Yes" : "No — not detected"],
                        ["Visible word count", `${words} words`]
                    ]
                }
            }),

        // ── Content / thin-content dimension (cnt-6 integrated) ──────────────
        (()=>{
            // Thin content: < 300 words with no lists/tables = thin; 300-600 = acceptable; 600+ = rich
            const isThin = words < 300 && !hasList && !hasTable;
            const isAcceptable = words >= 300 || hasList || hasTable;
            // Duplicate paragraphs: collect visible paragraphs, find near-duplicates
            const paragraphTexts: string[] = [];
            for (const m of clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
                const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (t.length > 40) paragraphTexts.push(t.slice(0, 200));
            }
            const dupePairs = new Set<string>();
            for (let i = 0; i < paragraphTexts.length; i++) {
                for (let j = i + 1; j < paragraphTexts.length; j++) {
                    const a = paragraphTexts[i].toLowerCase(), b = paragraphTexts[j].toLowerCase();
                    // Jaccard similarity on trigrams
                    const trigramsA = new Set(Array.from({length: Math.max(0, a.length - 2)}, (_, k) => a.slice(k, k + 3)));
                    const trigramsB = new Set(Array.from({length: Math.max(0, b.length - 2)}, (_, k) => b.slice(k, k + 3)));
                    const intersection = [...trigramsA].filter(t => trigramsB.has(t)).length;
                    const union = trigramsA.size + trigramsB.size - intersection;
                    if (union > 0 && intersection / union > 0.7) dupePairs.add(`${i}-${j}`);
                }
            }
            const hasDupes = dupePairs.size > 0;
            const baseScore = 25 * [h1, h2Texts.length > 0, words >= 150, hasList || hasTable].filter(Boolean).length;
            const thinPenalty = isThin ? -20 : 0;
            const dupePenalty = hasDupes ? -10 : 0;
            const score = Math.max(0, Math.min(100, baseScore + thinPenalty + dupePenalty));
            return dd('content', 'Answer structure', 10, score,
                `${words} words${isThin ? ' (thin)' : ''}; ${h2Texts.length} H2; ${h3Texts.length} H3; lists: ${hasList ? 'yes' : 'no'}; tables: ${hasTable ? 'yes' : 'no'}; duplicate paragraphs: ${dupePairs.size}.`,
                isThin ? 'Page has thin content. Expand to 300+ words, add headings for each key topic, and include lists or tables.' : 'Use descriptive headings and clear, factual answers; add lists or tables where useful.',
                {
                    found: [...(h1 ? [`<h1>: "${h1Text}"`] : []), ...h2Texts.map(t => `<h2>: "${t}"`), ...h3Texts.map(t => `<h3>: "${t}"`), ...(hasList ? ['Lists (<ul>/<ol>) found'] : []), ...(hasTable ? ['Table (<table>) found'] : []), ...(words >= 300 ? [`Word count: ${words} words (sufficient)`] : [])],
                    missing: [
                        ...(!h1 ? ['<h1> tag missing — add a main heading'] : []),
                        ...(h2Texts.length === 0 ? ['No <h2> headings — add sub-headings for each key topic or question'] : []),
                        ...(isThin ? [`Thin content: only ${words} words with no lists or tables — expand to 300+ substantive words`] : words < 150 ? [`Only ${words} words — aim for at least 300 words`] : []),
                        ...(!hasList && !hasTable ? ['No lists or tables — add <ul>/<ol> for steps/features or <table> for comparisons'] : []),
                        ...(hasDupes ? [`${dupePairs.size} near-duplicate paragraph pair(s) detected — consolidate or differentiate repeated content`] : []),
                    ],
                    items: [
                        item('<h1>', h1 ? `"${h1Text}"` : 'MISSING', h1 ? 'ok' : 'fail'),
                        item('<h2> headings', h2Texts.length > 0 ? `${h2Texts.length} found` : 'NONE FOUND', h2Texts.length > 0 ? 'ok' : 'fail'),
                        item('Word count', `${words} words`, words >= 300 ? 'ok' : words >= 150 ? 'warn' : 'fail'),
                        item('Thin content', isThin ? `Yes — ${words} words, no lists/tables` : 'No', isThin ? 'fail' : 'ok'),
                        item('Duplicate content', hasDupes ? `${dupePairs.size} near-duplicate paragraph pair(s)` : 'None detected', hasDupes ? 'warn' : 'ok'),
                        item('Lists / tables', hasList || hasTable ? `${hasList ? '<ul>/<ol> ' : ''}${hasTable ? '<table>' : ''}found` : 'NONE FOUND', hasList || hasTable ? 'ok' : 'warn'),
                    ],
                    table: {
                        headers: ["Element", "Text", "Status"],
                        rows: [
                            ["<h1>", h1 ? h1Text : "MISSING", h1 ? "Pass" : "Fail"],
                            ["Word count", `${words} words`, words >= 300 ? "Pass" : words >= 150 ? "Warning" : "Fail"],
                            ["Thin content", isThin ? "Yes" : "No", isThin ? "Fail" : "Pass"],
                            ["Duplicate paragraphs", hasDupes ? `${dupePairs.size} pairs` : "None", hasDupes ? "Warning" : "Pass"],
                            ...h2Elements.map(h => [h.id ? `<h2> (id: ${h.id})` : "<h2>", h.text, "Pass"] as string[]),
                        ]
                    }
                });
        })(),

        dd('evidence', 'Reference cues', 12,
            // Score blends external links presence (60%) with authorship signals (40%)
            Math.round((externalLinks.length ? 60 : 0) + authorshipScore * 0.4),
            `${externalLinks.length} external link(s). Author: ${detectedAuthor || 'not found'}. Published: ${detectedPublished || 'not found'}. Modified: ${detectedModified || 'not found'}.`,
            'Add external reference links, an identifiable author, and published/modified dates to boost E-E-A-T and AI source credibility.',
            {
                found: [
                    ...(detectedAuthor ? [`Author: ${detectedAuthor}${schemaAuthor ? ' (JSON-LD)' : metaArticleAuthor ? ' (meta)' : relAuthorText ? ' (rel=author)' : ' (itemprop)'}`] : []),
                    ...(detectedPublished ? [`Published: ${detectedPublished}`] : []),
                    ...(detectedModified ? [`Modified: ${detectedModified}`] : []),
                    ...externalLinks.slice(0, 6).map(u => `External link: ${u}`),
                ],
                missing: [
                    ...(!hasAuthor ? ['No author detected — add an author name via JSON-LD (Article.author), meta property="article:author", rel="author" link, or itemprop="author"'] : []),
                    ...(!hasPublishedDate ? ['No published date found — add article:published_time meta or JSON-LD Article.datePublished'] : []),
                    ...(!hasModifiedDate ? ['No modified date found — add article:modified_time meta or JSON-LD Article.dateModified to signal freshness'] : []),
                    ...(externalLinks.length === 0 ? ['No external reference links — add at least one authoritative outbound link (standards bodies, research, official docs)'] : []),
                ],
                items: [
                    item('Author', detectedAuthor || 'Not found', hasAuthor ? 'ok' : 'warn'),
                    item('Published date', detectedPublished || 'Not found', hasPublishedDate ? 'ok' : 'warn'),
                    item('Modified date', detectedModified || 'Not found', hasModifiedDate ? 'ok' : 'warn'),
                    item('External links', String(externalLinks.length), externalLinks.length > 0 ? 'ok' : 'fail'),
                    ...externalLinks.slice(0, 4).map(u => item('Link', u, 'info')),
                    ...(externalLinks.length > 4 ? [item('Additional links', `+${externalLinks.length - 4} more`, 'info')] : []),
                ],
                table: {
                    headers: ["Signal", "Detected", "Source"],
                    rows: [
                        ["Author", detectedAuthor || "—", schemaAuthor ? "JSON-LD" : metaArticleAuthor ? "meta" : relAuthorText ? "rel=author" : itempropAuthorText ? "itemprop" : "—"],
                        ["Published", detectedPublished || "—", schemaDatePublished ? "JSON-LD" : metaPublishedTime ? "meta" : "—"],
                        ["Modified", detectedModified || "—", schemaDateModified ? "JSON-LD" : metaModifiedTime ? "meta" : "—"],
                        ...extLinks.slice(0, 6).map(l => [l.href.slice(0, 60), l.domain, l.text.slice(0, 40)] as string[]),
                    ],
                }
            }),

        dd('schema', 'Structured data cues', 10,
            invalid ? 0 : valid ? schemaCompletenessAvg : 0,
            `${schemaTypes.length} typed JSON-LD block(s); ${invalid} invalid or untyped. Types: ${schemaTypes.length ? schemaTypes.join(', ') : 'none'}. Avg completeness: ${schemaCompletenessAvg}%.`,
            'Add JSON-LD structured data matching the page content. Fill all required + recommended properties. Validate at schema.org/validator.',
            {
                found: [...schemaTypes.map(t => `JSON-LD type: ${t}`), ...(schemaCompletenessAvg > 0 ? [`Schema completeness: ${schemaCompletenessAvg}%`] : [])],
                missing: [
                    ...(schemaTypes.length === 0 && invalid === 0 ? ['No JSON-LD found — add a <script type="application/ld+json"> block in <head> matching the page type (Article, FAQPage, Product, Organization, etc.)'] : []),
                    ...(invalid > 0 ? [`${invalid} invalid/untyped JSON-LD block(s) — fix syntax or add @type property`] : []),
                    ...jsonLdBlocks.filter(b => b.missing?.length).flatMap(b => b.missing!.slice(0, 3).map(p => `Block #${b.index} missing: ${p}`)),
                ],
                items: [
                    item('JSON-LD blocks', String(schemaTypes.length + invalid), (schemaTypes.length > 0 && invalid === 0) ? 'ok' : (schemaTypes.length === 0 && invalid === 0) ? 'fail' : 'warn'),
                    item('Schema completeness', schemaCompletenessAvg ? `${schemaCompletenessAvg}%` : 'N/A', schemaCompletenessAvg >= 80 ? 'ok' : schemaCompletenessAvg >= 50 ? 'warn' : 'fail'),
                    ...schemaTypes.map(t => item('@type', t, 'ok')),
                    ...(invalid > 0 ? [item('Invalid blocks', `${invalid} block(s) with syntax errors or missing @type`, 'fail')] : []),
                ],
                table: {
                    headers: ["Block", "@type", "Completeness", "Missing Properties"],
                    rows: jsonLdBlocks.map(b => [
                        `Block #${b.index}`,
                        b.type,
                        b.valid ? `${b.completeness ?? 0}%` : 'Invalid',
                        b.valid && b.missing?.length ? b.missing.slice(0, 3).join(', ') : (b.valid ? '—' : b.type)
                    ])
                }
            }),

        dd('query', 'Query readiness', 10, questionPatterns.length ? 100 : 0,
            `Detected ${questionPatterns.length} question-like heading(s).`,
            'Structure headers as direct questions (ending with ?) or step-by-step instructions.',
            {
                found: questionPatterns.map(q => `Question heading: "${q}"`),
                missing: questionPatterns.length === 0 ? ['No question-like headings detected — structure H2/H3s to match direct user queries'] : [],
                items: [
                    item('FAQ Patterns', questionPatterns.length > 0 ? `${questionPatterns.length} detected` : 'None', questionPatterns.length > 0 ? 'ok' : 'warn'),
                    item('Numbered lists (<ol>)', hasOl ? 'Found' : 'None', hasOl ? 'ok' : 'info'),
                    item('Definition lists (<dl>)', hasDl ? 'Found' : 'None', hasDl ? 'ok' : 'info'),
                ],
                table: {
                    headers: ["Pattern / Element", "Detected", "Details"],
                    rows: [
                        ["FAQ patterns (Question H2/H3)", questionPatterns.length > 0 ? "Yes" : "No", questionPatterns.length ? `${questionPatterns.length} detected: ${questionPatterns.join(', ')}` : "None"],
                        ["Numbered lists (<ol>)", hasOl ? "Yes" : "No", hasOl ? "Found step-by-step list" : "No <ol> tags found"],
                        ["Definition lists (<dl>)", hasDl ? "Yes" : "No", hasDl ? "Found definition lists" : "No <dl> tags found"]
                    ]
                }
            }),

        // ── Freshness / staleness dimension (cnt-4) ─────────────────────────
        (()=>{
            // Extract datePublished / dateModified from JSON-LD
            let jsonLdDate: string | null = null;
            for (const m of clean.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
                try {
                    const j = JSON.parse(m[1]);
                    const nodes = Array.isArray(j) ? j : [j, ...(Array.isArray(j?.['@graph']) ? j['@graph'] : [])];
                    for (const n of nodes) {
                        const d = n?.dateModified || n?.datePublished;
                        if (d && typeof d === 'string') { jsonLdDate = d; break; }
                    }
                } catch { /* ignore */ }
                if (jsonLdDate) break;
            }
            // <time datetime="…"> elements
            const timeTags = [...clean.matchAll(/<time\b[^>]*datetime\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
            // <meta> property article:published_time or article:modified_time
            const metaDates = tags.filter(t => t.tag === 'meta' && /^article:(published|modified)_time$/i.test(t.attrs.property || '')).map(t => t.attrs.content ?? '');
            // Visible text patterns: "Updated May 2024", "Last updated: Jan 2023", "Published: 2023-09-01"
            const visibleDatePatterns = [
                /\b(?:updated|published|last\s+updated|modified|reviewed)\s*:?\s*([A-Za-z]+ \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
                /\b(\d{4}-\d{2}-\d{2})\b/,
            ];
            let visibleDate: string | null = null;
            for (const p of visibleDatePatterns) {
                const m = visible.match(p);
                if (m) { visibleDate = m[1] ?? m[0]; break; }
            }
            const allDates = [jsonLdDate, ...timeTags, ...metaDates, visibleDate].filter(Boolean) as string[];
            const latestDate = allDates.reduce<string | null>((best, d) => {
                const parsed = Date.parse(d);
                if (isNaN(parsed)) return best;
                return best === null || parsed > Date.parse(best) ? d : best;
            }, null);
            // Staleness: >18 months = stale, 6–18 months = aging, <6 months = fresh
            const nowMs = Date.now();
            const ageMs = latestDate ? nowMs - Date.parse(latestDate) : null;
            const ageMonths = ageMs !== null ? ageMs / (1000 * 60 * 60 * 24 * 30) : null;
            const isFresh = ageMonths !== null && ageMonths < 6;
            const isAging = ageMonths !== null && ageMonths >= 6 && ageMonths < 18;
            const isStale = ageMonths !== null && ageMonths >= 18;
            const hasAnyDate = allDates.length > 0;
            const score = !hasAnyDate ? null : isFresh ? 100 : isAging ? 60 : 30;
            const ageLabel = ageMonths === null ? 'unknown' : isFresh ? `${Math.round(ageMonths)} months old — fresh` : isAging ? `${Math.round(ageMonths)} months old — aging` : `${Math.round(ageMonths / 12 * 10) / 10} years old — stale`;
            return dd('freshness', 'Content freshness', 5, score,
                hasAnyDate
                    ? `Latest date found: ${latestDate} (${ageLabel}). Sources: ${[jsonLdDate ? 'JSON-LD' : '', timeTags.length ? '<time>' : '', metaDates.length ? 'meta' : '', visibleDate ? 'visible text' : ''].filter(Boolean).join(', ')}.`
                    : 'No date signals found in JSON-LD, <time> tags, meta properties, or visible text.',
                hasAnyDate && isStale
                    ? `Content is ${Math.round(ageMonths! / 12 * 10) / 10} years old. Refresh the page, update dateModified in JSON-LD, and add a visible "Last updated" date.`
                    : 'Add datePublished and dateModified to JSON-LD. Show a visible "Last updated" date on the page.',
                {
                    found: [
                        ...(jsonLdDate ? [`JSON-LD dateModified/datePublished: ${jsonLdDate}`] : []),
                        ...timeTags.map(d => `<time datetime="${d}">`),
                        ...metaDates.map(d => `<meta> article date: ${d}`),
                        ...(visibleDate ? [`Visible date text: "${visibleDate}"`] : []),
                    ],
                    missing: [
                        ...(!jsonLdDate ? ['dateModified/datePublished missing from JSON-LD — add "dateModified": "YYYY-MM-DD" to your Organization/Article schema'] : []),
                        ...(timeTags.length === 0 ? ['No <time datetime="…"> elements — add a visible date with <time datetime="YYYY-MM-DD">Updated: Month Year</time>'] : []),
                        ...(isStale ? [`Content is ${Math.round(ageMonths! / 12 * 10) / 10} years old — update content and set dateModified to today`] : []),
                    ],
                    items: [
                        item('Date found', hasAnyDate ? latestDate! : 'None detected', hasAnyDate ? (isFresh ? 'ok' : isAging ? 'warn' : 'fail') : 'warn'),
                        item('Age', ageLabel, isFresh ? 'ok' : isAging ? 'warn' : ageMonths !== null ? 'fail' : 'info'),
                        item('JSON-LD date', jsonLdDate ?? 'Not found', jsonLdDate ? 'ok' : 'warn'),
                        item('<time> elements', timeTags.length > 0 ? `${timeTags.length} found` : 'None', timeTags.length > 0 ? 'ok' : 'info'),
                        item('Meta article date', metaDates.length > 0 ? metaDates[0] : 'Not found', metaDates.length > 0 ? 'ok' : 'info'),
                    ],
                    table: {
                        headers: ["Source", "Value", "Age Status"],
                        rows: [
                            ["JSON-LD dateModified/Published", jsonLdDate ?? "Not found", jsonLdDate ? ageLabel : "—"],
                            ...timeTags.map(d => ["<time datetime>", d, ""] as string[]),
                            ...metaDates.map(d => ["meta article:*_time", d, ""] as string[]),
                            ...(visibleDate ? [["Visible text", visibleDate, ""]] : []),
                            ["Staleness assessment", hasAnyDate ? ageLabel : "No dates found", isFresh ? "Fresh" : isAging ? "Aging" : ageMonths !== null ? "Stale" : "Unknown"],
                        ]
                    }
                });
        })(),

        dd('authority', 'External authority', 5, null,
            'Third-party reputation has not been assessed.',
            'Build backlinks from authoritative domains. Pursue press coverage, analyst mentions, and partner directories.',
            {
                found: [],
                missing: ['External authority requires third-party data — not assessable from HTML alone'],
                items: [
                    item('Assessment', 'Not measurable from HTML — requires backlink/reputation data', 'info'),
                    item('Recommended', 'Run Google Search Console, Ahrefs or Moz to check domain authority and backlink profile', 'info'),
                ],
                table: {
                    headers: ["Check", "Result"],
                    rows: [
                        ["Assessment", "Not measurable from HTML — requires backlink/reputation data"],
                        ["Recommended", "Run Google Search Console, Ahrefs or Moz to check domain authority and backlink profile"]
                    ]
                }
            }),

        dd('measurement', 'Monitoring coverage', 5,
            probeRunCount > 0 ? 100 : 0,
            probeRunCount > 0
                ? `${probeRunCount} AI probe run(s) recorded. Brand visibility is being monitored.`
                : 'No AI probe runs recorded for this client.',
            probeRunCount > 0
                ? 'Keep running probes regularly to track mention and citation rate trends.'
                : 'Go to the Observations tab → Run probe to query AI engines and start measuring GEO visibility.',
            {
                found: probeRunCount > 0 ? [`${probeRunCount} probe run(s) completed`] : [],
                missing: probeRunCount > 0 ? [] : ['No AI probe runs — run a probe in the Observations tab to score this dimension'],
                items: [
                    item('Probe runs', probeRunCount > 0 ? `${probeRunCount} run(s) recorded` : 'None yet', probeRunCount > 0 ? 'ok' : 'warn'),
                    item(probeRunCount > 0 ? 'Keep monitoring' : 'How to fix', probeRunCount > 0 ? 'Continue running probes to track visibility trends' : 'Observations tab → Run probe → select providers and prompts', probeRunCount > 0 ? 'ok' : 'warn'),
                ],
                table: {
                    headers: ["Check", "Result"],
                    rows: [
                        ["Probe runs recorded", probeRunCount > 0 ? `${probeRunCount}` : "0 — none yet"],
                        [probeRunCount > 0 ? "Status" : "How to fix", probeRunCount > 0 ? "Monitoring active" : "Observations tab → Run probe"]
                    ]
                }
            }),

        // ── Accessibility dimension ──────────────────────────────────────────
        (()=>{
            const hasViewport = /<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/i.test(clean);
            const viewportContent = clean.match(/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
            const hasLang = /<html\b[^>]*\blang\s*=/i.test(clean);
            const langVal = clean.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
            const imgsNoAlt = extractedImages.filter(img => !img.hasAlt);
            const interactiveInputs = extractedInputs.filter(i => !['hidden','submit','button','reset'].includes(i.type));
            const headings = [...clean.matchAll(/<(h[1-6])\b[^>]*>/gi)].map(m => parseInt(m[1][1]));
            let headingOrderOk = true;
            for (let i = 1; i < headings.length; i++) { if (headings[i] - headings[i-1] > 1) { headingOrderOk = false; break; } }
            const buttons = [...clean.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
            const emptyButtons = buttons.filter(m => {
                const text = m[2].replace(/<[^>]+>/g, '').trim();
                return !text && !/aria-label\s*=/i.test(m[1]);
            });
            // Score: % of critical checks passing
            const checks = [
                imgsNoAlt.length === 0,
                hasViewport,
                hasLang,
                headingOrderOk || headings.length === 0,
                emptyButtons.length === 0,
            ];
            const score = Math.round(checks.filter(Boolean).length / checks.length * 100);
            return dd('accessibility', 'Accessibility', 0,  // weight 0 — informational, not counted in SEO score
                score,
                `${imgsNoAlt.length} image(s) missing alt; viewport ${hasViewport ? 'present' : 'missing'}; lang ${hasLang ? `"${langVal}"` : 'missing'}; heading order ${headingOrderOk ? 'ok' : 'skips detected'}; ${emptyButtons.length} empty button(s).`,
                'Fix alt text, add lang attribute, ensure viewport meta, maintain heading order, add button labels.',
                {
                    found: [
                        ...(hasViewport ? [`Viewport: "${viewportContent}"`] : []),
                        ...(hasLang ? [`HTML lang="${langVal}"`] : []),
                        ...(imgsNoAlt.length === 0 && extractedImages.length > 0 ? [`All ${extractedImages.length} image(s) have alt text`] : []),
                        ...(emptyButtons.length === 0 && buttons.length > 0 ? [`All ${buttons.length} button(s) have accessible names`] : []),
                    ],
                    missing: [
                        ...(!hasViewport ? ['<meta name="viewport" content="width=device-width, initial-scale=1"> — missing from <head>'] : []),
                        ...(!hasLang ? ['lang attribute missing from <html> element — add lang="en"'] : []),
                        ...(imgsNoAlt.length > 0 ? [`${imgsNoAlt.length} image(s) missing alt attribute`] : []),
                        ...(!headingOrderOk ? ['Heading order skips levels — e.g. h1 → h3 skips h2'] : []),
                        ...(emptyButtons.length > 0 ? [`${emptyButtons.length} button(s) with no visible text or aria-label`] : []),
                    ],
                    items: [
                        item('Images without alt', imgsNoAlt.length === 0 ? `All ${extractedImages.length} image(s) have alt` : `${imgsNoAlt.length} of ${extractedImages.length} missing alt`, imgsNoAlt.length === 0 ? 'ok' : 'fail'),
                        item('Viewport meta', hasViewport ? viewportContent || 'present' : 'MISSING', hasViewport ? 'ok' : 'fail'),
                        item('HTML lang attribute', hasLang ? `lang="${langVal}"` : 'MISSING', hasLang ? 'ok' : 'fail'),
                        item('Heading order', headings.length === 0 ? 'No headings' : headingOrderOk ? `ok (${headings.map(h=>`h${h}`).join('→')})` : `SKIP DETECTED (${headings.map(h=>`h${h}`).join('→')})`, headingOrderOk ? 'ok' : 'warn'),
                        item('Empty buttons', emptyButtons.length === 0 ? `${buttons.length} button(s) all have names` : `${emptyButtons.length} button(s) missing accessible name`, emptyButtons.length === 0 ? 'ok' : 'fail'),
                        item('Interactive inputs', interactiveInputs.length > 0 ? `${interactiveInputs.length} found` : 'None', 'info'),
                    ],
                    table: {
                        headers: ["Check", "Finding", "Status"],
                        rows: [
                            ["Images — alt text", imgsNoAlt.length === 0 ? `All ${extractedImages.length} have alt` : `${imgsNoAlt.length}/${extractedImages.length} missing alt`, imgsNoAlt.length === 0 ? "Pass" : "Fail"],
                            ...extractedImages.slice(0, 8).map(img => ["  img src", img.src.slice(0, 80) || "(no src)", img.hasAlt ? `alt="${img.alt}"` : "MISSING alt"] as string[]),
                            ["Viewport meta", hasViewport ? viewportContent : "MISSING", hasViewport ? "Pass" : "Fail"],
                            ["HTML lang", hasLang ? `lang="${langVal}"` : "MISSING", hasLang ? "Pass" : "Fail"],
                            ["Heading order", headings.length === 0 ? "No headings" : headings.map(h=>`h${h}`).join(' → '), headingOrderOk ? "Pass" : "Skip detected"],
                            ["Empty buttons", emptyButtons.length === 0 ? "None" : `${emptyButtons.length} found`, emptyButtons.length === 0 ? "Pass" : "Fail"],
                        ]
                    }
                });
        })(),

        // ── Best Practices dimension ─────────────────────────────────────────
        (()=>{
            const hasDoctype = /^\s*<!doctype\s+html\b/i.test(html);
            const hasCharset = /<meta\b[^>]*charset\s*=/i.test(clean);
            const charsetVal = clean.match(/<meta\b[^>]*charset\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? '';
            const isHttps = !!(c.domain && c.domain.startsWith('https://'));
            // Render-blocking scripts in head
            const headHtml = clean.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
            const blockingScripts: string[] = [];
            for (const m of headHtml.matchAll(/<script\b([^>]*)>/gi)) {
                const a = m[1];
                if (/\bsrc\s*=/i.test(a) && !/\b(async|defer)\b/i.test(a)) {
                    const src = a.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '(unknown)';
                    blockingScripts.push(src);
                }
            }
            // Images missing dimensions
            const imgsMissingDims = extractedImages.filter(img => {
                const tag = clean.match(new RegExp(`<img[^>]*src=["']${img.src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["'][^>]*>`, 'i'))?.[0] ?? '';
                return !/\bwidth\s*=/i.test(tag) || !/\bheight\s*=/i.test(tag);
            });
            const checks = [isHttps, hasDoctype, hasCharset, blockingScripts.length === 0, imgsMissingDims.length === 0];
            const score = Math.round(checks.filter(Boolean).length / checks.length * 100);
            return dd('best-practices', 'Best Practices', 0,  // weight 0 — informational
                score,
                `HTTPS: ${isHttps ? 'yes' : 'no'}; doctype: ${hasDoctype ? 'present' : 'missing'}; charset: ${hasCharset ? charsetVal : 'missing'}; render-blocking scripts: ${blockingScripts.length}; images missing dimensions: ${imgsMissingDims.length}.`,
                'Use HTTPS, declare doctype and charset, add async/defer to head scripts, add width/height to images.',
                {
                    found: [
                        ...(isHttps ? ['HTTPS — domain uses secure connection'] : []),
                        ...(hasDoctype ? ['<!DOCTYPE html> declared'] : []),
                        ...(hasCharset ? [`charset="${charsetVal}" declared`] : []),
                        ...(blockingScripts.length === 0 ? ['No render-blocking scripts in <head>'] : []),
                        ...(imgsMissingDims.length === 0 && extractedImages.length > 0 ? ['All images have explicit width/height'] : []),
                    ],
                    missing: [
                        ...(!isHttps ? ['HTTPS not detected on domain — serve all pages over TLS'] : []),
                        ...(!hasDoctype ? ['<!DOCTYPE html> missing — add as first line of document'] : []),
                        ...(!hasCharset ? ['<meta charset="UTF-8"> missing — add as first element in <head>'] : []),
                        ...(blockingScripts.length > 0 ? [`${blockingScripts.length} render-blocking script(s) in <head> — add defer or async`] : []),
                        ...(imgsMissingDims.length > 0 ? [`${imgsMissingDims.length} image(s) missing explicit width/height — causes layout shift (CLS)`] : []),
                    ],
                    items: [
                        item('HTTPS', isHttps ? 'Yes' : 'Not detected on domain', isHttps ? 'ok' : 'warn'),
                        item('DOCTYPE', hasDoctype ? '<!DOCTYPE html> present' : 'MISSING', hasDoctype ? 'ok' : 'fail'),
                        item('Charset', hasCharset ? `charset="${charsetVal}"` : 'MISSING', hasCharset ? 'ok' : 'fail'),
                        item('Render-blocking scripts', blockingScripts.length === 0 ? 'None in <head>' : `${blockingScripts.length} script(s) block rendering`, blockingScripts.length === 0 ? 'ok' : 'fail'),
                        item('Image dimensions', imgsMissingDims.length === 0 ? `All ${extractedImages.length} images have dimensions` : `${imgsMissingDims.length}/${extractedImages.length} missing width/height`, imgsMissingDims.length === 0 ? 'ok' : 'warn'),
                    ],
                    table: {
                        headers: ["Check", "Finding", "Status"],
                        rows: [
                            ["HTTPS", isHttps ? "Domain uses HTTPS" : "HTTP only — upgrade required", isHttps ? "Pass" : "Fail"],
                            ["DOCTYPE", hasDoctype ? "<!DOCTYPE html> present" : "MISSING", hasDoctype ? "Pass" : "Fail"],
                            ["Charset", hasCharset ? `charset="${charsetVal}"` : "MISSING", hasCharset ? "Pass" : "Fail"],
                            ["Render-blocking scripts", blockingScripts.length === 0 ? "None" : `${blockingScripts.length} found`, blockingScripts.length === 0 ? "Pass" : "Fail"],
                            ...blockingScripts.slice(0, 5).map(src => ["  Script src", src.slice(0, 80), "Add defer or async"] as string[]),
                            ["Image dimensions", imgsMissingDims.length === 0 ? "All have width+height" : `${imgsMissingDims.length} missing`, imgsMissingDims.length === 0 ? "Pass" : "Warning"],
                            ...imgsMissingDims.slice(0, 5).map(img => ["  img src", img.src.slice(0, 80) || "(no src)", "Missing width/height"] as string[]),
                        ]
                    }
                });
        })(),

        // ── Performance dimension ────────────────────────────────────────────
        (()=>{
            const headHtml2 = clean.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
            const blockingScripts2: string[] = [];
            for (const m of headHtml2.matchAll(/<script\b([^>]*)>/gi)) {
                const a = m[1];
                if (/\bsrc\s*=/i.test(a) && !/\b(async|defer)\b/i.test(a)) {
                    const src = a.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '(unknown)';
                    blockingScripts2.push(src);
                }
            }
            const cssLinks = [...clean.matchAll(/<link\b([^>]*)>/gi)]
                .map(m => m[1])
                .filter(a => /rel\s*=\s*["']stylesheet["']/i.test(a))
                .map(a => a.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '');
            const imgsMissingDims2 = extractedImages.filter(img => {
                const tag = clean.match(new RegExp(`<img[^>]*src=["']${img.src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["'][^>]*>`, 'i'))?.[0] ?? '';
                return !/\bwidth\s*=/i.test(tag) || !/\bheight\s*=/i.test(tag);
            });
            const inlineStyles = (clean.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).length;
            const checks = [blockingScripts2.length === 0, cssLinks.length <= 3, imgsMissingDims2.length === 0];
            const score = Math.round(checks.filter(Boolean).length / checks.length * 100);
            return dd('performance', 'Performance Signals', 0,  // weight 0 — informational
                score,
                `Render-blocking scripts: ${blockingScripts2.length}; CSS stylesheets: ${cssLinks.length}; images missing dimensions: ${imgsMissingDims2.length}; inline <style> blocks: ${inlineStyles}.`,
                'Add defer/async to head scripts, reduce stylesheet count, add width/height to all images.',
                {
                    found: [
                        ...(blockingScripts2.length === 0 ? ['No render-blocking scripts in <head>'] : []),
                        ...(cssLinks.length <= 3 ? [`${cssLinks.length} CSS stylesheet(s) — within limit`] : []),
                    ],
                    missing: [
                        ...(blockingScripts2.length > 0 ? [`${blockingScripts2.length} render-blocking script(s) in <head> — add async or defer`] : []),
                        ...(cssLinks.length > 3 ? [`${cssLinks.length} CSS stylesheets — consider combining or inlining critical CSS`] : []),
                        ...(imgsMissingDims2.length > 0 ? [`${imgsMissingDims2.length} image(s) missing width/height — causes Cumulative Layout Shift (CLS)`] : []),
                    ],
                    items: [
                        item('Render-blocking scripts', blockingScripts2.length === 0 ? 'None in <head>' : `${blockingScripts2.length} found`, blockingScripts2.length === 0 ? 'ok' : 'fail'),
                        item('CSS stylesheets', `${cssLinks.length} found`, cssLinks.length <= 3 ? 'ok' : 'warn'),
                        item('Images missing dimensions', imgsMissingDims2.length === 0 ? `All ${extractedImages.length} ok` : `${imgsMissingDims2.length}/${extractedImages.length} missing`, imgsMissingDims2.length === 0 ? 'ok' : 'warn'),
                        item('Inline <style> blocks', `${inlineStyles} found`, inlineStyles > 2 ? 'warn' : 'ok'),
                    ],
                    table: {
                        headers: ["Signal", "Finding", "Impact"],
                        rows: [
                            ["Render-blocking scripts", blockingScripts2.length === 0 ? "None in <head>" : `${blockingScripts2.length} script(s) block rendering`, blockingScripts2.length === 0 ? "None" : "High — add defer/async"],
                            ...blockingScripts2.slice(0, 5).map(src => ["  Script src", src.slice(0, 80), "Add defer or async"] as string[]),
                            ["CSS stylesheets", `${cssLinks.length} link(s)`, cssLinks.length > 3 ? "Medium — combine sheets" : "Low"],
                            ...cssLinks.slice(0, 4).map(href => ["  CSS href", href.slice(0, 80), ""] as string[]),
                            ["Image dimensions missing", imgsMissingDims2.length === 0 ? "All have dimensions" : `${imgsMissingDims2.length} images`, imgsMissingDims2.length === 0 ? "None" : "Medium — fix CLS"],
                            ["Inline <style> blocks", String(inlineStyles), inlineStyles > 2 ? "Low — consider external CSS" : "None"],
                        ]
                    }
                });
        })(),

        // ── Reasoning Cues dimension ─────────────────────────────────────────
        (()=>{
            const CUES: {label: string; patterns: RegExp[]}[] = [
                {label:'Step / sequence', patterns:[/\bstep\s*\d/i,/\bfirst[,\s]/i,/\bnext[,\s]/i,/\bfinally[,\s]/i,/\bthen[,\s]/i]},
                {label:'Summary', patterns:[/\bin summary\b/i,/\bin short\b/i,/\bkey takeaway/i,/\bto summarize\b/i,/\bto conclude\b/i]},
                {label:'Definition', patterns:[/\bis defined as\b/i,/\brefers to\b/i,/\bmeans that\b/i,/\bwhat is\b/i,/\bdefinition of\b/i]},
                {label:'Example', patterns:[/\bfor example\b/i,/\bfor instance\b/i,/\bsuch as\b/i,/\bconsider this\b/i,/\btake the case\b/i]},
                {label:'Comparison', patterns:[/\bunlike\b/i,/\bin contrast\b/i,/\bcompared to\b/i,/\bwhereas\b/i,/\bon the other hand\b/i]},
                {label:'Warning / caution', patterns:[/\bwarning[:\s]/i,/\bcaution[:\s]/i,/\bbe cautious\b/i,/\bavoid\b/i,/\bcommon mistake\b/i]},
                {label:'Why it matters', patterns:[/\bwhy it matters\b/i,/\bimportant because\b/i,/\bthe reason\b/i,/\bbenefits of\b/i]},
            ];
            const foundCues: string[] = [];
            const missingCues: string[] = [];
            for (const cue of CUES) {
                const hit = cue.patterns.some(p => p.test(visible));
                if (hit) foundCues.push(cue.label);
                else missingCues.push(cue.label);
            }
            const score = Math.round(foundCues.length / CUES.length * 100);
            const items: DimensionItem[] = CUES.map(cue => {
                const hit = cue.patterns.some(p => p.test(visible));
                return item(cue.label, hit ? 'Detected in page text' : 'Not found', hit ? 'ok' : 'warn');
            });
            return dd('reasoning-cues', 'Reasoning Cues', 3, score,
                `${foundCues.length}/${CUES.length} reasoning cue types detected: ${foundCues.join(', ') || 'none'}.`,
                'Add explicit reasoning signals: step-by-step sequences, summary callouts, definitions, examples, comparisons, and warnings. These help LLMs extract and cite your content.',
                {
                    found: foundCues.map(c => `${c} cues detected in page text`),
                    missing: missingCues.map(c => `Add ${c} language — e.g. "${c === 'Step / sequence' ? 'Step 1: …' : c === 'Summary' ? 'In summary, …' : c === 'Definition' ? '[Term] is defined as …' : c === 'Example' ? 'For example, …' : c === 'Comparison' ? 'Unlike [X], …' : c === 'Warning / caution' ? 'Warning: …' : 'This matters because …'}"`),
                    items,
                    table: {
                        headers: ["Cue Type", "Status", "Example Phrase"],
                        rows: CUES.map(cue => {
                            const hit = cue.patterns.some(p => p.test(visible));
                            const examples: Record<string, string> = {
                                'Step / sequence': 'Step 1: …, First, …, Next, …',
                                'Summary': 'In summary, …, Key takeaway: …',
                                'Definition': '[Term] is defined as …, This refers to …',
                                'Example': 'For example, …, Such as …',
                                'Comparison': 'Unlike [X], …, Compared to …',
                                'Warning / caution': 'Warning: …, Avoid …',
                                'Why it matters': 'This matters because …, The benefit is …',
                            };
                            return [cue.label, hit ? '✓ Detected' : '✗ Missing', examples[cue.label] ?? ''] as string[];
                        })
                    }
                });
        })(),

        // ── Passage Density dimension ────────────────────────────────────────
        (()=>{
            // Extract <p> tags and check if they are 100-300 token (~80-240 word) self-contained blocks
            const paragraphs: {text: string; wordCount: number; ok: boolean}[] = [];
            for (const m of clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
                const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (!text || text.length < 20) continue;
                const wordCount = text.split(/\s+/).length;
                paragraphs.push({text: text.slice(0, 120), wordCount, ok: wordCount >= 15 && wordCount <= 240});
            }
            const total = paragraphs.length;
            const goodPassages = paragraphs.filter(p => p.ok).length;
            const tooShort = paragraphs.filter(p => p.wordCount < 15).length;
            const tooLong = paragraphs.filter(p => p.wordCount > 240).length;
            // Also check for FAQ pattern: <dt>/<dd> or question-style h2/h3
            const hasFaq = /<dt\b/i.test(clean) || /<details\b/i.test(clean) ||
                h2Texts.some(h => /\?$/.test(h.trim())) || h3Texts.some(h => /\?$/.test(h.trim()));
            const hasLists = /<[uo]l\b/i.test(clean);
            const hasTables = /<table\b/i.test(clean);
            const passageScore = total === 0 ? 0 : Math.round(goodPassages / total * 100);
            const formatBonus = [hasFaq, hasLists, hasTables].filter(Boolean).length * 8;
            const score = Math.min(100, passageScore + formatBonus);
            return dd('passage-density', 'Passage Density', 3, total === 0 ? null : score,
                `${goodPassages}/${total} paragraphs are well-sized (15–240 words); ${tooShort} too short, ${tooLong} too long. FAQ: ${hasFaq ? 'yes' : 'no'}, Lists: ${hasLists ? 'yes' : 'no'}, Tables: ${hasTables ? 'yes' : 'no'}.`,
                'Structure content as 100–300 token self-contained passages. Add FAQ sections (Q+A format), bullet lists, and comparison tables. Each block should stand alone so LLMs can extract and cite it.',
                {
                    found: [
                        ...(goodPassages > 0 ? [`${goodPassages} well-sized paragraphs (15–240 words)`] : []),
                        ...(hasFaq ? ['FAQ / Q&A pattern detected'] : []),
                        ...(hasLists ? ['Unordered/ordered lists present'] : []),
                        ...(hasTables ? ['Tables present for structured comparisons'] : []),
                    ],
                    missing: [
                        ...(tooLong > 0 ? [`${tooLong} paragraph(s) over 240 words — split into smaller self-contained blocks`] : []),
                        ...(tooShort > 0 ? [`${tooShort} very short paragraph(s) — merge or expand to carry a complete thought`] : []),
                        ...(!hasFaq ? ['No FAQ section detected — add Q&A pairs using question-form H2/H3 or <details> elements'] : []),
                        ...(!hasLists ? ['No bullet/numbered lists — add for step-by-step content and comparisons'] : []),
                        ...(!hasTables ? ['No comparison tables — add <table> elements for feature/price/spec comparisons'] : []),
                    ],
                    items: [
                        item('Well-sized passages', total === 0 ? 'No paragraphs found' : `${goodPassages}/${total} paragraphs (15–240 words)`, total === 0 ? 'warn' : goodPassages / total >= 0.7 ? 'ok' : 'warn'),
                        item('Too-long paragraphs', tooLong === 0 ? 'None' : `${tooLong} over 240 words`, tooLong === 0 ? 'ok' : 'fail'),
                        item('Too-short paragraphs', tooShort === 0 ? 'None' : `${tooShort} under 15 words`, tooShort === 0 ? 'ok' : 'warn'),
                        item('FAQ / Q&A', hasFaq ? 'Detected' : 'Not found', hasFaq ? 'ok' : 'warn'),
                        item('Lists (ul/ol)', hasLists ? 'Present' : 'Not found', hasLists ? 'ok' : 'warn'),
                        item('Comparison tables', hasTables ? 'Present' : 'Not found', hasTables ? 'ok' : 'warn'),
                    ],
                    table: {
                        headers: ["Check", "Finding", "Impact"],
                        rows: [
                            ["Total paragraphs", String(total), ""],
                            ["Well-sized (15–240 words)", String(goodPassages), goodPassages === total ? "Excellent" : "Improve"],
                            ["Too long (>240 words)", String(tooLong), tooLong > 0 ? "Split these" : "OK"],
                            ["Too short (<15 words)", String(tooShort), tooShort > 0 ? "Expand or merge" : "OK"],
                            ["FAQ / Q&A section", hasFaq ? "Yes" : "No", hasFaq ? "Good" : "Add FAQ section"],
                            ["Lists (ul/ol)", hasLists ? "Yes" : "No", hasLists ? "Good" : "Add lists"],
                            ["Tables", hasTables ? "Yes" : "No", hasTables ? "Good" : "Add comparison tables"],
                            ...paragraphs.slice(0, 5).map(p => ["Sample paragraph", p.text.slice(0, 80) + '…', `${p.wordCount} words — ${p.ok ? 'ok' : p.wordCount < 15 ? 'too short' : 'too long'}`] as string[]),
                        ]
                    }
                });
        })(),

        // ── Entity Links (sameAs) dimension ──────────────────────────────────
        (()=>{
            const entityScore = [hasWikidata, hasWikipedia, hasLinkedIn].filter(Boolean).length;
            const entityScoreNorm = Math.round(entityScore / 3 * 100);
            const sameAsLinks = allSameAs.slice(0, 10);
            return dd('entity-links', 'Entity authority links', 5, schemaTypes.length === 0 ? null : entityScoreNorm,
                `sameAs links: ${allSameAs.length > 0 ? allSameAs.join(', ') : 'none'}. Wikidata: ${hasWikidata ? 'yes' : 'no'}; Wikipedia: ${hasWikipedia ? 'yes' : 'no'}; LinkedIn: ${hasLinkedIn ? 'yes' : 'no'}.`,
                'Add sameAs links in your Organization/Person JSON-LD pointing to Wikidata, Wikipedia, and LinkedIn profiles. This signals entity confidence to AI engines.',
                {
                    found: [
                        ...(hasWikidata ? ['sameAs → Wikidata detected'] : []),
                        ...(hasWikipedia ? ['sameAs → Wikipedia detected'] : []),
                        ...(hasLinkedIn ? ['sameAs → LinkedIn detected'] : []),
                        ...sameAsLinks.map(u => `sameAs: ${u}`),
                    ],
                    missing: [
                        ...(schemaTypes.length === 0 ? ['No JSON-LD found — add Organization or Person schema with sameAs links'] : []),
                        ...(!hasWikidata && schemaTypes.length > 0 ? ['sameAs → Wikidata missing — add wikidata.org/entity/Q… URL to Organization/Person schema'] : []),
                        ...(!hasWikipedia && schemaTypes.length > 0 ? ['sameAs → Wikipedia missing — add en.wikipedia.org/wiki/… URL to Organization/Person schema'] : []),
                        ...(!hasLinkedIn && schemaTypes.length > 0 ? ['sameAs → LinkedIn missing — add linkedin.com/company/… URL to Organization/Person schema'] : []),
                    ],
                    items: [
                        item('Total sameAs links', String(allSameAs.length), allSameAs.length > 0 ? 'ok' : 'warn'),
                        item('Wikidata', hasWikidata ? 'Linked' : 'Not found', hasWikidata ? 'ok' : 'warn'),
                        item('Wikipedia', hasWikipedia ? 'Linked' : 'Not found', hasWikipedia ? 'ok' : 'warn'),
                        item('LinkedIn', hasLinkedIn ? 'Linked' : 'Not found', hasLinkedIn ? 'ok' : 'warn'),
                        ...sameAsLinks.map(u => item('sameAs URL', u, 'info')),
                    ],
                    table: {
                        headers: ["Authority Source", "Detected", "URL"],
                        rows: [
                            ["Wikidata", hasWikidata ? "✓ Yes" : "✗ No", allSameAs.find(u => /wikidata\.org/i.test(u)) ?? "—"],
                            ["Wikipedia", hasWikipedia ? "✓ Yes" : "✗ No", allSameAs.find(u => /wikipedia\.org/i.test(u)) ?? "—"],
                            ["LinkedIn", hasLinkedIn ? "✓ Yes" : "✗ No", allSameAs.find(u => /linkedin\.com/i.test(u)) ?? "—"],
                            ...allSameAs.filter(u => !/wikidata\.org|wikipedia\.org|linkedin\.com/i.test(u)).slice(0, 5).map(u => ["Other sameAs", "✓ Yes", u] as string[]),
                        ]
                    }
                });
        })(),
    ];
}
export type QueryItem = {intent: string; funnel: 'awareness' | 'consideration' | 'decision' | 'retention'; prompt: string};
export function queryUniverse(c: Client): QueryItem[] {
    return (c.products.length ? c.products : [c.industry]).flatMap(p => [
        {intent: 'Education',    funnel: 'awareness'     as const, prompt: `What is ${p} and who is it for?`},
        {intent: 'Education',    funnel: 'awareness'     as const, prompt: `What problems does ${p} solve?`},
        {intent: 'Evaluation',   funnel: 'consideration' as const, prompt: `Which ${p} providers should a business in ${c.market} evaluate?`},
        {intent: 'Evaluation',   funnel: 'consideration' as const, prompt: `What should I look for when choosing a ${p} solution?`},
        {intent: 'Implementation', funnel: 'decision'    as const, prompt: `How can a business implement ${p}?`},
        {intent: 'Implementation', funnel: 'decision'    as const, prompt: `What is the cost of ${p} for a mid-size company?`},
        {intent: 'Retention',    funnel: 'retention'     as const, prompt: `What are best practices for ${p} ongoing management?`},
        ...c.competitors.map(k => ({intent: 'Comparison', funnel: 'consideration' as const, prompt: `How does ${c.name} compare with ${k} for ${p}?`})),
    ]);
}
export function visibility(c: Client, rows: Observation[]) { const hostname = new URL(c.domain).hostname.replace(/^www\./, ''); const mentions = rows.filter(r => mentionsBrand(c, r.response)).length; const citations = rows.filter(r => r.citations.some(u => { const h = new URL(u).hostname.replace(/^www\./, ''); return h === hostname || h.endsWith('.' + hostname); })).length; return { sample: rows.length, mentionRate: rows.length ? Math.round(mentions / rows.length * 100) : null, citationRate: rows.length ? Math.round(citations / rows.length * 100) : null }; }
