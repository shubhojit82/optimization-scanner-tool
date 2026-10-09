/**
 * report-analysis.ts — Lighthouse-style categorical analysis from HTML.
 * Produces CategoryReport[] for: SEO, AEO, GEO, Accessibility, Best Practices.
 * No external dependencies — pure HTML string analysis.
 */
import type {Audit, AuditFinding, CategoryReport, Client, Dimension} from './contracts';

function f(id: string, title: string, description: string, impact: AuditFinding['impact'], passed: boolean, detail?: string, howToFix?: string, table?: {headers: string[]; rows: string[][]}): AuditFinding {
    return {id, title, description, impact, passed, detail, howToFix, table};
}

// ── Accessibility ─────────────────────────────────────────────────────────────
export function analyzeAccessibility(html: string, _url: string): CategoryReport {
    const clean = html.replace(/<!--[\s\S]*?-->/g, '');
    const findings: AuditFinding[] = [];

    // 1. Images without alt
    const imgs = [...clean.matchAll(/<img\b([^>]*)>/gi)].map(m => m[1]);
    const imgsNoAlt = imgs.filter(a => !/\balt\s*=/i.test(a));
    const imgsEmptyAlt = imgs.filter(a => /\balt\s*=\s*["']\s*["']/i.test(a));

    const imgDetails: string[][] = [];
    for (const m of clean.matchAll(/<img\b([^>]*?)>/gi)) {
        const attrs = m[1];
        const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
        const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
        const src = srcMatch ? srcMatch[1] : '(no src)';
        const hasAlt = !!altMatch;
        const altText = altMatch ? altMatch[1] : '';
        const status = !hasAlt ? 'Missing Alt' : altText.trim() === '' ? 'Empty Alt (Decorative)' : 'Pass';
        imgDetails.push([src, hasAlt ? `"${altText}"` : '(none)', status]);
    }

    findings.push(f(
        'img-alt', 'Image elements have alt attributes',
        'Informative images must have descriptive alt text. Decorative images should use alt="".',
        'serious', imgsNoAlt.length === 0,
        imgsNoAlt.length ? `${imgsNoAlt.length} image(s) missing alt attribute out of ${imgs.length} total` : `All ${imgs.length} image(s) have alt attributes`,
        imgsNoAlt.length ? 'Add alt="Descriptive text" to every <img> that conveys meaning. Use alt="" for purely decorative images.' : undefined,
        {headers: ["Image src", "Alt text", "Status"], rows: imgDetails}
    ));

    // 2. Form inputs without labels
    const inputs = [...clean.matchAll(/<input\b([^>]*)>/gi)].map(m => m[1]);
    const interactiveInputs = inputs.filter(a => !/type\s*=\s*["'](hidden|submit|button|reset)["']/i.test(a));
    const inputsWithId = interactiveInputs.filter(a => /\bid\s*=/i.test(a));
    const orphanInputs = inputsWithId.filter(a => {
        const idMatch = a.match(/\bid\s*=\s*["']([^"']+)["']/i);
        if (!idMatch) return true;
        return !new RegExp(`for\\s*=\\s*["']${idMatch[1]}["']`, 'i').test(clean);
    });
    const inputsNoLabel = interactiveInputs.filter(a => !/<label\b/i.test(clean) || orphanInputs.includes(a));

    const inputDetails: string[][] = [];
    for (const m of clean.matchAll(/<input\b([^>]*?)>/gi)) {
        const attrs = m[1];
        const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
        const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
        const id = idMatch ? idMatch[1] : '';
        const type = typeMatch ? typeMatch[1] : 'text';
        
        const isInteractive = !/^(hidden|submit|button|reset)$/i.test(type);
        if (!isInteractive) continue;

        let hasLabel = false;
        let issue = 'None';
        if (!id) {
            hasLabel = false;
            issue = 'Missing id attribute; cannot pair with <label for>';
        } else {
            const pairedLabel = new RegExp(`for\\s*=\\s*["']${id}["']`, 'i').test(clean);
            const hasAriaLabel = /\baria-label\s*=/i.test(attrs);
            hasLabel = pairedLabel || hasAriaLabel;
            if (!hasLabel) {
                issue = `No <label for="${id}"> or aria-label found`;
            }
        }
        inputDetails.push([id ? `id="${id}" (${type})` : `(no id) (${type})`, hasLabel ? 'Yes' : 'No', issue]);
    }

    findings.push(f(
        'form-labels', 'Form elements have associated labels',
        'Each form input must have a <label for="id"> or aria-label so screen readers can identify it.',
        'serious', interactiveInputs.length === 0 || (orphanInputs.length === 0 && inputsWithId.length > 0),
        interactiveInputs.length === 0 ? 'No interactive inputs found' : orphanInputs.length ? `${orphanInputs.length} input(s) may lack an associated label` : `${interactiveInputs.length} input(s) appear to have labels`,
        orphanInputs.length ? 'Add <label for="inputId">Label text</label> paired with id="inputId" on each input, or add aria-label="Label text" directly to the input.' : undefined,
        {headers: ["Input id/type", "Has label", "Issue"], rows: inputDetails}
    ));

    // 3. Viewport meta
    const hasViewport = /<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/i.test(clean);
    const viewportContent = clean.match(/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    findings.push(f(
        'viewport', 'Has a <meta name="viewport"> tag with width or initial-scale',
        'A viewport meta tag is needed for proper mobile rendering.',
        'critical', hasViewport && /width/.test(viewportContent),
        hasViewport ? `viewport content: "${viewportContent}"` : 'MISSING',
        !hasViewport ? 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.' : undefined,
        {headers: ["Meta attribute", "Value"], rows: [["viewport", hasViewport ? viewportContent : "MISSING"]]}
    ));

    // 4. Document language
    const hasLang = /<html\b[^>]*\blang\s*=/i.test(clean);
    const langVal = clean.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1];
    findings.push(f(
        'html-lang', '<html> element has a lang attribute',
        'Screen readers use the lang attribute to select the correct language profile.',
        'serious', hasLang,
        hasLang ? `lang="${langVal}"` : 'MISSING — <html> has no lang attribute',
        !hasLang ? 'Add lang="en" (or the appropriate language code) to the <html> element.' : undefined,
        {headers: ["Element", "lang value"], rows: [["<html>", hasLang ? langVal || "" : "MISSING"]]}
    ));

    // 5. Heading order
    const headings = [...clean.matchAll(/<(h[1-6])\b[^>]*>/gi)].map(m => parseInt(m[1][1]));
    let headingOrderOk = true;
    for (let i = 1; i < headings.length; i++) {
        if (headings[i] - headings[i - 1] > 1) { headingOrderOk = false; break; }
    }

    const headingDetails: string[][] = [];
    const parsedHeadings: {level: number; text: string}[] = [];
    for (const m of clean.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
        const level = parseInt(m[1][1]);
        const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
        parsedHeadings.push({level, text});
    }
    for (let i = 0; i < parsedHeadings.length; i++) {
        let issue = 'None';
        if (i > 0 && parsedHeadings[i].level - parsedHeadings[i - 1].level > 1) {
            issue = `Skips level from h${parsedHeadings[i - 1].level} to h${parsedHeadings[i].level}`;
        }
        headingDetails.push([`H${parsedHeadings[i].level}`, parsedHeadings[i].text, issue]);
    }

    findings.push(f(
        'heading-order', 'Heading elements are in a sequentially-descending order',
        'Proper heading hierarchy helps screen reader users navigate the page.',
        'moderate', headings.length === 0 || headingOrderOk,
        headings.length === 0 ? 'No headings found' : `Heading sequence: ${headings.map(h => `h${h}`).join(' → ')}`,
        !headingOrderOk ? 'Do not skip heading levels (e.g. h1 → h3 skips h2). Use h1 → h2 → h3 in order.' : undefined,
        {headers: ["Level", "Text", "Issue"], rows: headingDetails}
    ));

    // 6. Links with descriptive text
    const links = [...clean.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    const genericLinks = links.filter(t => /^(click here|here|read more|more|link|learn more)$/i.test(t));

    const linkDetails: string[][] = [];
    for (const m of clean.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)) {
        const attrs = m[1];
        const text = m[2].replace(/<[^>]+>/g, '').trim().slice(0, 80);
        const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
        const href = hrefMatch ? hrefMatch[1] : '';
        const isGeneric = /^(click here|here|read more|more|link|learn more)$/i.test(text);
        linkDetails.push([
            text || '(no text)',
            href || '(none)',
            isGeneric ? 'Generic link text' : !text ? 'Empty link text' : 'None'
        ]);
    }

    findings.push(f(
        'link-text', 'Links have descriptive text',
        'Link text should describe the destination, not just say "click here" or "read more".',
        'serious', genericLinks.length === 0,
        genericLinks.length ? `${genericLinks.length} generic link(s) found: ${genericLinks.slice(0, 3).map(t => `"${t}"`).join(', ')}` : `All ${links.length} link(s) have descriptive text`,
        genericLinks.length ? 'Replace generic link text like "click here" with descriptive text like "View Sreeshti pricing plans".' : undefined,
        {headers: ["Link text", "href", "Issue"], rows: linkDetails}
    ));

    // 7. Skip navigation / landmark
    const hasMain = /<main\b/i.test(clean);
    findings.push(f(
        'landmark-main', 'Page has a <main> landmark element',
        'A <main> landmark helps screen reader users skip to the primary content.',
        'moderate', hasMain,
        hasMain ? '<main> element found' : 'No <main> element found',
        !hasMain ? 'Wrap the primary page content in a <main> element. Optionally add a skip link: <a href="#main">Skip to content</a>.' : undefined,
        {headers: ["Landmark", "Status"], rows: [["<main>", hasMain ? "Present" : "Missing"]]}
    ));

    // 8. Button accessible names
    const buttons = [...clean.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
    const emptyButtons = buttons.filter(m => {
        const text = m[2].replace(/<[^>]+>/g, '').trim();
        const hasAriaLabel = /aria-label\s*=/i.test(m[1]);
        const hasAriaLabelledBy = /aria-labelledby\s*=/i.test(m[1]);
        return !text && !hasAriaLabel && !hasAriaLabelledBy;
    });

    const buttonDetails: string[][] = [];
    for (const m of clean.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
        const attrs = m[1];
        const text = m[2].replace(/<[^>]+>/g, '').trim().slice(0, 80);
        const hasAriaLabel = /aria-label\s*=/i.test(attrs);
        const hasAriaLabelledBy = /aria-labelledby\s*=/i.test(attrs);
        const isPassed = !!text || hasAriaLabel || hasAriaLabelledBy;
        buttonDetails.push([
            text || '(no text)',
            hasAriaLabel ? 'aria-label' : hasAriaLabelledBy ? 'aria-labelledby' : 'None',
            isPassed ? 'Pass' : 'Missing accessible name'
        ]);
    }

    findings.push(f(
        'button-name', 'Buttons have accessible names',
        'Buttons must have visible text or aria-label so screen readers can announce them.',
        'critical', emptyButtons.length === 0,
        emptyButtons.length ? `${emptyButtons.length} button(s) with no accessible name` : `All ${buttons.length} button(s) have names`,
        emptyButtons.length ? 'Add visible text inside <button> elements, or use aria-label="Action description" for icon-only buttons.' : undefined,
        {headers: ["Button inner text", "Aria attributes", "Status"], rows: buttonDetails}
    ));

    // Score: % of critical+serious issues that pass
    const scorable = findings.filter(f => f.impact === 'critical' || f.impact === 'serious');
    const score = scorable.length ? Math.round((scorable.filter(f => f.passed).length / scorable.length) * 100) : 100;

    return {id: 'accessibility', label: 'Accessibility', score, findings};
}

// ── Best Practices ────────────────────────────────────────────────────────────
export function analyzeBestPractices(html: string, url: string, headers: Record<string, string> = {}): CategoryReport {
    const clean = html.replace(/<!--[\s\S]*?-->/g, '');
    const findings: AuditFinding[] = [];

    // 1. HTTPS
    const isHttps = url.startsWith('https://');
    findings.push(f(
        'https', 'Uses HTTPS',
        'All pages should be served over HTTPS to protect user data and avoid mixed-content warnings.',
        'critical', isHttps,
        isHttps ? 'HTTPS confirmed' : 'Page loaded over HTTP',
        !isHttps ? 'Obtain a TLS certificate (free via Let\'s Encrypt) and redirect all HTTP traffic to HTTPS.' : undefined,
        {headers: ["Protocol Check", "Result"], rows: [["HTTPS", isHttps ? "Yes" : "No"]]}
    ));

    // 2. doctype
    const hasDoctype = /^\s*<!doctype\s+html\b/i.test(html);
    findings.push(f(
        'doctype', 'Page has the HTML5 doctype',
        'A <!DOCTYPE html> declaration prevents browsers from entering quirks mode.',
        'moderate', hasDoctype,
        hasDoctype ? '<!DOCTYPE html> present' : 'DOCTYPE missing or non-HTML5',
        !hasDoctype ? 'Add <!DOCTYPE html> as the very first line of the HTML document.' : undefined,
        {headers: ["DOCTYPE declaration", "Status"], rows: [["<!DOCTYPE html>", hasDoctype ? "Present" : "Missing"]]}
    ));

    // 3. Charset
    const hasCharset = /<meta\b[^>]*charset\s*=/i.test(clean);
    const charsetVal = clean.match(/<meta\b[^>]*charset\s*=\s*["']?([^"'\s>]+)/i)?.[1];
    findings.push(f(
        'charset', 'Character encoding is declared',
        'A charset meta tag prevents garbled text in browsers that default to legacy encodings.',
        'moderate', hasCharset,
        hasCharset ? `charset="${charsetVal}"` : 'MISSING',
        !hasCharset ? 'Add <meta charset="UTF-8"> as the first element inside <head>.' : undefined,
        {headers: ["Charset tag", "Declared value"], rows: [["<meta charset>", hasCharset ? charsetVal || "" : "MISSING"]]}
    ));

    // 4. CSP header
    const csp = headers['content-security-policy'] || '';
    const hasCSP = csp.length > 0;
    findings.push(f(
        'csp', 'Has a Content Security Policy (CSP)',
        'CSP headers significantly reduce the risk of XSS attacks.',
        'serious', hasCSP,
        hasCSP ? `CSP: ${csp.slice(0, 120)}` : 'No Content-Security-Policy header found',
        !hasCSP ? 'Add a Content-Security-Policy response header. Start with: default-src \'self\'; script-src \'self\';' : undefined,
        {headers: ["Security Header", "Value"], rows: [["Content-Security-Policy", hasCSP ? csp : "MISSING"]]}
    ));

    // 5. X-Frame-Options or CSP frame-ancestors
    const xfo = headers['x-frame-options'] || '';
    const hasFrameProtection = xfo.length > 0 || /frame-ancestors/i.test(csp);
    findings.push(f(
        'clickjacking', 'Page is protected against clickjacking',
        'X-Frame-Options or CSP frame-ancestors prevents the page from being embedded in iframes on other sites.',
        'serious', hasFrameProtection,
        hasFrameProtection ? (xfo ? `X-Frame-Options: ${xfo}` : 'CSP frame-ancestors found') : 'No X-Frame-Options or CSP frame-ancestors header',
        !hasFrameProtection ? 'Add X-Frame-Options: SAMEORIGIN header, or include frame-ancestors \'self\' in your CSP.' : undefined,
        {headers: ["Header / Directive", "Value"], rows: [["X-Frame-Options", xfo || "MISSING"], ["CSP frame-ancestors", /frame-ancestors/i.test(csp) ? "Yes" : "No"]]}
    ));

    // 6. Images with width/height
    const imgTags = [...clean.matchAll(/<img\b([^>]*)>/gi)].map(m => m[1]);
    const imgsMissingDimensions = imgTags.filter(a => !/\bwidth\s*=/i.test(a) || !/\bheight\s*=/i.test(a));

    const imgDimDetails: string[][] = [];
    for (const m of clean.matchAll(/<img\b([^>]*?)>/gi)) {
        const attrs = m[1];
        const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
        const widthMatch = attrs.match(/\bwidth\s*=\s*["']([^"']*)["']/i);
        const heightMatch = attrs.match(/\bheight\s*=\s*["']([^"']*)["']/i);
        const src = srcMatch ? srcMatch[1] : '(no src)';
        const w = widthMatch ? widthMatch[1] : '';
        const h = heightMatch ? heightMatch[1] : '';
        let missing = 'None';
        if (!w && !h) missing = 'width and height';
        else if (!w) missing = 'width';
        else if (!h) missing = 'height';
        imgDimDetails.push([src, w || '(none)', h || '(none)', missing]);
    }

    findings.push(f(
        'img-dimensions', 'Image elements have explicit width and height',
        'Explicit dimensions prevent layout shifts (CLS) while images load.',
        'moderate', imgsMissingDimensions.length === 0,
        imgsMissingDimensions.length ? `${imgsMissingDimensions.length}/${imgTags.length} image(s) missing explicit width or height` : `All ${imgTags.length} image(s) have dimensions`,
        imgsMissingDimensions.length ? 'Add width and height attributes to all <img> elements matching the natural size of the image. This enables the browser to reserve space before the image loads.' : undefined,
        {headers: ["Image src", "width", "height", "Missing"], rows: imgDimDetails}
    ));

    // 7. External JS in <head> without async/defer
    const headMatch = clean.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
    const headHtml = headMatch ? headMatch[1] : '';
    const blockingScripts = [...headHtml.matchAll(/<script\b([^>]*)>/gi)]
        .map(m => m[1])
        .filter(a => /\bsrc\s*=/i.test(a) && !/\b(async|defer)\b/i.test(a));

    const scriptDetails: string[][] = [];
    for (const m of headHtml.matchAll(/<script\b([^>]*)>/gi)) {
        const attrs = m[1];
        const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
        if (srcMatch) {
            const src = srcMatch[1];
            const isAsync = /\basync\b/i.test(attrs);
            const isDefer = /\bdefer\b/i.test(attrs);
            scriptDetails.push([src, isAsync ? "Yes" : "No", isDefer ? "Yes" : "No", "head"]);
        }
    }

    findings.push(f(
        'render-blocking-scripts', 'Scripts do not block rendering',
        'Synchronous <script src="..."> in <head> block HTML parsing and delay page paint.',
        'serious', blockingScripts.length === 0,
        blockingScripts.length ? `${blockingScripts.length} render-blocking script(s) in <head>` : 'No render-blocking scripts in <head>',
        blockingScripts.length ? 'Add defer or async attribute to <script> tags in <head>. Use async for independent scripts, defer for scripts that need DOM order.' : undefined,
        {headers: ["Script src", "async", "defer", "Location"], rows: scriptDetails}
    ));

    // 8. Inline event handlers (security / maintainability)
    const inlineHandlers = [...clean.matchAll(/\bon\w+\s*=\s*["'][^"']+["']/gi)].length;

    const handlerDetails: string[][] = [];
    for (const m of clean.matchAll(/<[^>]*?\s(on\w+)\s*=\s*["']([^"']+)["'][^>]*?>/gi)) {
        handlerDetails.push([m[1], m[2]]);
    }

    findings.push(f(
        'inline-handlers', 'No inline event handlers',
        'Inline onclick/onload handlers bypass CSP and make code harder to maintain.',
        'minor', inlineHandlers === 0,
        inlineHandlers ? `${inlineHandlers} inline event handler(s) found` : 'No inline event handlers',
        inlineHandlers ? 'Move event handlers to external JavaScript files and attach with addEventListener().' : undefined,
        {headers: ["Event", "Handler code"], rows: handlerDetails}
    ));

    // Score
    const scorable = findings.filter(f => f.impact === 'critical' || f.impact === 'serious');
    const score = scorable.length ? Math.round((scorable.filter(f => f.passed).length / scorable.length) * 100) : 100;

    return {id: 'best-practices', label: 'Best Practices', score, findings};
}

// ── SEO (from existing dimensions) ───────────────────────────────────────────
export function seoFromDimensions(dims: Dimension[]): CategoryReport {
    const SEO_IDS = ['crawl', 'technical', 'schema', 'freshness'];
    const relevant = dims.filter(d => SEO_IDS.includes(d.id));
    const assessed = relevant.filter(d => d.score !== null);
    const w = assessed.reduce((n, d) => n + d.weight, 0);
    const score = w ? Math.round(assessed.reduce((n, d) => n + d.weight * d.score!, 0) / w) : null;
    const findings: AuditFinding[] = relevant.flatMap(d => {
        if (!d.details) return [];
        return (d.details.items ?? []).map(it => f(
            `${d.id}-${it.label.replace(/\W+/g, '-').toLowerCase()}`,
            `${d.name}: ${it.label}`,
            d.evidence,
            it.status === 'fail' ? 'serious' : it.status === 'warn' ? 'moderate' : 'info',
            it.status === 'ok' || it.status === 'info',
            it.value,
            it.status === 'fail' || it.status === 'warn' ? d.action : undefined,
            d.details?.table,
        ));
    });
    return {id: 'seo', label: 'SEO', score, findings};
}

// ── AEO (from existing dimensions) ───────────────────────────────────────────
export function aeoFromDimensions(dims: Dimension[]): CategoryReport {
    const AEO_IDS = ['content', 'entity', 'evidence', 'query'];
    const relevant = dims.filter(d => AEO_IDS.includes(d.id));
    const assessed = relevant.filter(d => d.score !== null);
    const w = assessed.reduce((n, d) => n + d.weight, 0);
    const score = w ? Math.round(assessed.reduce((n, d) => n + d.weight * d.score!, 0) / w) : null;
    const findings: AuditFinding[] = relevant.flatMap(d => {
        if (!d.details) return [];
        return (d.details.items ?? []).map(it => f(
            `${d.id}-${it.label.replace(/\W+/g, '-').toLowerCase()}`,
            `${d.name}: ${it.label}`,
            d.evidence,
            it.status === 'fail' ? 'serious' : it.status === 'warn' ? 'moderate' : 'info',
            it.status === 'ok' || it.status === 'info',
            it.value,
            it.status === 'fail' || it.status === 'warn' ? d.action : undefined,
            d.details?.table,
        ));
    });
    return {id: 'aeo', label: 'AEO', score, findings};
}

// ── Full report builder ────────────────────────────────────────────────────────
export type FullReport = {
    url: string;
    client: {name: string; domain: string; industry: string; market: string};
    auditId: string;
    generatedAt: string;
    overallScore: number;
    categories: CategoryReport[];
};

export function buildFullReport(audit: Audit, client: Client, headers: Record<string, string> = {}, html = ''): FullReport {
    const categories: CategoryReport[] = [
        seoFromDimensions(audit.dimensions),
        aeoFromDimensions(audit.dimensions),
        {
            id: 'geo', 
            label: 'GEO', 
            score: audit.subScores?.geoScore ?? null, 
            findings: audit.dimensions.filter(d => ['measurement','authority'].includes(d.id)).flatMap(d => (d.details?.items ?? []).map(it => f(`${d.id}-${it.label.replace(/\W+/g,'-').toLowerCase()}`, `${d.name}: ${it.label}`, d.evidence, 'info', true, it.value, undefined, d.details?.table)))
        },
        analyzeAccessibility(html || '', audit.url),
        analyzeBestPractices(html || '', audit.url, headers),
    ];
    const scored = categories.filter(c => c.score !== null);
    const overallScore = scored.length ? Math.round(scored.reduce((n, c) => n + c.score!, 0) / scored.length) : 0;
    return {
        url: audit.url,
        client: {name: client.name, domain: client.domain, industry: client.industry, market: client.market},
        auditId: audit.id,
        generatedAt: new Date().toISOString(),
        overallScore,
        categories,
    };
}
