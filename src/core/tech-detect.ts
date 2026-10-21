/**
 * CMS and technology stack detection — pure function, no I/O.
 * Implements P0 feature: onb-3 (CMS and technology detection)
 */

export type TechSignal = {
    name: string;
    category: 'cms' | 'framework' | 'ecommerce' | 'hosting' | 'analytics' | 'cdn' | 'server';
    confidence: 'high' | 'medium' | 'low';
    evidence: string;
};

export type TechStack = {
    primary: TechSignal | null;          // highest-confidence CMS/framework
    signals: TechSignal[];               // all detected signals
    summary: string;                     // human-readable one-liner
};

/** Detect CMS and technology stack from HTML body and HTTP response headers. */
export function detectTechStack(html: string, headers: Record<string, string> = {}): TechStack {
    const signals: TechSignal[] = [];
    const h = html.slice(0, 60000); // scan first 60 KB only
    const lower = h.toLowerCase();
    const hdr = (k: string) => (headers[k] || headers[k.toLowerCase()] || '').toLowerCase();

    // ── Server / hosting ──────────────────────────────────────────────────────
    const server = hdr('server') || hdr('x-powered-by');
    if (server.includes('nginx'))  signals.push({name:'Nginx',  category:'server',  confidence:'high',   evidence:`Server: ${hdr('server')||hdr('x-powered-by')}`});
    if (server.includes('apache')) signals.push({name:'Apache', category:'server',  confidence:'high',   evidence:`Server: ${hdr('server')||hdr('x-powered-by')}`});
    if (server.includes('iis'))    signals.push({name:'IIS',    category:'server',  confidence:'high',   evidence:`Server: ${hdr('server')||hdr('x-powered-by')}`});
    if (hdr('x-powered-by').includes('php')) signals.push({name:'PHP', category:'server', confidence:'high', evidence:`X-Powered-By: ${hdr('x-powered-by')}`});

    // ── CDN ───────────────────────────────────────────────────────────────────
    if (hdr('cf-ray') || hdr('cf-cache-status')) signals.push({name:'Cloudflare', category:'cdn', confidence:'high', evidence:'CF-Ray / CF-Cache-Status header present'});
    if (hdr('x-cache').includes('cloudfront') || hdr('via').includes('cloudfront')) signals.push({name:'AWS CloudFront', category:'cdn', confidence:'high', evidence:'Via / X-Cache header'});
    if (hdr('x-fastly-request-id')) signals.push({name:'Fastly', category:'cdn', confidence:'high', evidence:'X-Fastly-Request-Id header'});
    if (hdr('x-akamai-transformed') || hdr('akamai-origin-hop')) signals.push({name:'Akamai', category:'cdn', confidence:'high', evidence:'Akamai header'});

    // ── CMS — HTML meta generator ─────────────────────────────────────────────
    const generatorMatch = h.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i)
                        || h.match(/<meta\s+content=["']([^"']+)["']\s+name=["']generator["']/i);
    const generator = generatorMatch ? generatorMatch[1].toLowerCase() : '';

    if (generator.includes('wordpress'))    signals.push({name:'WordPress',  category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('drupal'))       signals.push({name:'Drupal',     category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('joomla'))       signals.push({name:'Joomla',     category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('squarespace'))  signals.push({name:'Squarespace',category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('wix'))          signals.push({name:'Wix',        category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('webflow'))      signals.push({name:'Webflow',    category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('ghost'))        signals.push({name:'Ghost',      category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('hubspot'))      signals.push({name:'HubSpot CMS',category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});
    if (generator.includes('contentful'))   signals.push({name:'Contentful', category:'cms', confidence:'high',   evidence:`meta generator: ${generatorMatch![1]}`});

    // ── CMS — HTML body patterns ──────────────────────────────────────────────
    if (!generator.includes('wordpress') && (lower.includes('/wp-content/') || lower.includes('/wp-includes/')))
        signals.push({name:'WordPress', category:'cms', confidence:'high', evidence:'wp-content / wp-includes path in HTML'});
    if (!generator.includes('drupal') && lower.includes('/sites/default/files/'))
        signals.push({name:'Drupal', category:'cms', confidence:'medium', evidence:'Drupal file path pattern'});
    if (lower.includes('data-reactroot') || lower.includes('__next'))
        signals.push({name:'Next.js', category:'framework', confidence:'medium', evidence:'data-reactroot or __next in HTML'});
    if (lower.includes('id="__nuxt"') || lower.includes('data-v-app'))
        signals.push({name:'Nuxt.js', category:'framework', confidence:'medium', evidence:'Nuxt root element detected'});
    if (lower.includes('ng-version') || lower.includes('ng-app') || lower.includes('angular'))
        signals.push({name:'Angular', category:'framework', confidence:'medium', evidence:'ng-version / ng-app attribute'});
    if (lower.includes('data-gatsby') || lower.includes('gatsby-'))
        signals.push({name:'Gatsby', category:'framework', confidence:'medium', evidence:'gatsby- attribute prefix'});
    if (lower.includes('data-shopify') || lower.includes('shopify.com/s/files'))
        signals.push({name:'Shopify', category:'ecommerce', confidence:'high', evidence:'Shopify asset path'});
    if (lower.includes('magento') || lower.includes('mage/')) 
        signals.push({name:'Magento', category:'ecommerce', confidence:'medium', evidence:'Magento JS reference'});
    if (lower.includes('sitecore') || lower.includes('/-/media/'))
        signals.push({name:'Sitecore', category:'cms', confidence:'medium', evidence:'Sitecore media path'});
    if (lower.includes('/jcr:content') || lower.includes('wem.aem') || lower.includes('cq-analytics'))
        signals.push({name:'Adobe AEM', category:'cms', confidence:'high', evidence:'AEM JCR content path / cq-analytics'});
    if (lower.includes('contentstack'))
        signals.push({name:'Contentstack', category:'cms', confidence:'medium', evidence:'Contentstack reference in HTML'});

    // ── Analytics ─────────────────────────────────────────────────────────────
    if (lower.includes('google-analytics') || lower.includes('gtag(') || lower.includes('ga(\'send'))
        signals.push({name:'Google Analytics', category:'analytics', confidence:'high', evidence:'GA script tag'});
    if (lower.includes('gtm.js') || lower.includes('googletagmanager'))
        signals.push({name:'Google Tag Manager', category:'analytics', confidence:'high', evidence:'GTM script tag'});

    // ── Deduplicate by name ────────────────────────────────────────────────────
    const seen = new Set<string>();
    const unique = signals.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; });

    // Primary = first high-confidence CMS/framework/ecommerce signal
    const primary = unique.find(s => s.confidence === 'high' && (s.category === 'cms' || s.category === 'framework' || s.category === 'ecommerce'))
                 ?? unique.find(s => s.category === 'cms' || s.category === 'framework' || s.category === 'ecommerce')
                 ?? null;

    const cms = unique.filter(s => s.category === 'cms' || s.category === 'framework' || s.category === 'ecommerce');
    const summary = cms.length
        ? cms.map(s => s.name).join(', ')
        : unique.length
            ? unique.filter(s => s.category === 'server' || s.category === 'cdn').map(s => s.name).join(', ') || 'Unknown stack'
            : 'No technology signals detected';

    return {primary, signals: unique, summary};
}
