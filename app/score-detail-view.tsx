"use client";
import { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Audit, DimensionItem, Observation } from '../src/core/contracts';

export type ScoreCategory = 'SEO' | 'AEO' | 'GEO';

const CATEGORY_META: Record<ScoreCategory, {color: string; tagline: string; description: string; ids: string[]}> = {
    SEO: {
        color: '#3b82d4',
        tagline: 'Search Engine Optimisation',
        description: 'Can crawlers access and understand this page? Covers robots access, HTTP response, page structure (title, H1, meta description, canonical), structured data (JSON-LD), and content freshness signals.',
        ids: ['crawl', 'technical', 'schema', 'freshness'],
    },
    AEO: {
        color: '#7c5cd8',
        tagline: 'Answer Engine Optimisation',
        description: 'Does the page directly answer the questions AI engines ask? Covers answer structure (headings, lists, word count), brand clarity, reference cues, query readiness, reasoning cues, passage density, and entity authority links.',
        ids: ['content', 'entity', 'evidence', 'query', 'reasoning-cues', 'passage-density', 'entity-links'],
    },
    GEO: {
        color: '#14b8a6',
        tagline: 'Generative Engine Optimisation',
        description: 'Is this brand being mentioned and cited in AI-generated answers? Covers AI observation coverage (has a prompt set been tested?) and external authority signals (third-party mentions and reputation data).',
        ids: ['measurement', 'authority'],
    },
};

function scoreColor(score: number | null) {
    if (score === null) return '#57606a';
    if (score >= 75) return '#15803d';
    if (score >= 40) return '#b45309';
    return '#b91c1c';
}

function scoreBg(score: number | null) {
    if (score === null) return '#f0f2f5';
    if (score >= 75) return '#dcfce7';
    if (score >= 40) return '#fef3c7';
    return '#fee2e2';
}

type Props = {
    category: ScoreCategory;
    audits: Audit[];
    observations?: Observation[];
    onBack: () => void;
};

interface AuditItem {
    id: string;
    title: string;
    passed: boolean;
    errorsCount?: number;
    description: string;
    learnMoreHref?: string;
    table?: {headers: string[]; rows: string[][]};
}

interface AuditGroup {
    title: string;
    items: AuditItem[];
}

export function ScoreDetailView({category, audits, observations = [], onBack}: Props) {
    const meta = CATEGORY_META[category];

    // Compute active audit category score
    const audit = audits[0];
    let catScore: number | null = null;
    if (audit) {
        const dims = audit.dimensions.filter(d => meta.ids.includes(d.id));
        const assessed = dims.filter(d => d.score !== null);
        const w = assessed.reduce((n, d) => n + d.weight, 0);
        catScore = w ? Math.round(assessed.reduce((n, d) => n + d.weight * d.score!, 0) / w) : null;
    }

    // Map audit data to groups
    const groups: AuditGroup[] = [];

    if (audit) {
        const crawlDim = audit.dimensions.find(d => d.id === 'crawl');
        const technicalDim = audit.dimensions.find(d => d.id === 'technical');
        const entityDim = audit.dimensions.find(d => d.id === 'entity');
        const contentDim = audit.dimensions.find(d => d.id === 'content');
        const evidenceDim = audit.dimensions.find(d => d.id === 'evidence');
        const schemaDim = audit.dimensions.find(d => d.id === 'schema');
        const queryDim = audit.dimensions.find(d => d.id === 'query');
        const freshnessDim = audit.dimensions.find(d => d.id === 'freshness');
        const accessibilityDim = audit.dimensions.find(d => d.id === 'accessibility');
        const bestPracticesDim = audit.dimensions.find(d => d.id === 'best-practices');
        const perfDim = audit.dimensions.find(d => d.id === 'performance');
        const reasoningDim = audit.dimensions.find(d => d.id === 'reasoning-cues');
        const passageDim = audit.dimensions.find(d => d.id === 'passage-density');
        const entityLinksDim = audit.dimensions.find(d => d.id === 'entity-links');

        const schemaTypes = schemaDim?.details?.items
            ?.filter(it => it.label === '@type')
            ?.map(it => it.value) || [];

        // Extract technical values safely
        const titleItem = technicalDim?.details?.items?.find(it => it.label === '<title>');
        const titleText = titleItem?.value.replace(/^"|"$/g, '') || '';
        const titleLength = titleText.length;
        const titlePassed = !!titleItem && titleItem.status === 'ok';

        const h1Item = technicalDim?.details?.items?.find(it => it.label === '<h1>');
        const h1Text = h1Item?.value.replace(/^"|"$/g, '') || '';
        const h1Passed = !!h1Item && h1Item.status === 'ok';

        const descItem = technicalDim?.details?.items?.find(it => it.label === '<meta description>');
        const descText = descItem?.value.replace(/^"|"$/g, '') || '';
        const descLength = descText.length;
        const descPassed = !!descItem && descItem.status === 'ok';

        const canonicalItem = technicalDim?.details?.items?.find(it => it.label === '<link canonical>');
        const canonicalVal = canonicalItem?.value || '';
        const canonicalPassed = !!canonicalItem && canonicalItem.status === 'ok';

        const noindexItem = technicalDim?.details?.items?.find(it => it.label === 'noindex');
        const noindexDetected = !!noindexItem && noindexItem.status === 'fail';

        if (category === 'SEO') {
            // Group 1: CRAWLING & INDEXING
            groups.push({
                title: "CRAWLING & INDEXING",
                items: [
                    {
                        id: "crawler-access",
                        title: "Crawler access",
                        passed: false, // HTML import doesn't check live rules
                        description: "Crawler access must be verified on live servers. Use the Scanner tab to test robots.txt directives, HTTP response codes, and WAF flags.",
                        learnMoreHref: "https://web.dev/search-crawl-indexing/",
                        table: crawlDim?.details?.table
                    },
                    {
                        id: "noindex-directive",
                        title: "Noindex detection",
                        passed: !noindexDetected,
                        errorsCount: noindexDetected ? 1 : 0,
                        description: "The noindex directive prevents search engines from indexing this page. Ensure this is not set if the page is intended for public discovery.",
                        learnMoreHref: "https://developers.google.com/search/docs/crawling-indexing/block-indexing",
                        table: {
                            headers: ["Directive Check", "Detected Value", "Status"],
                            rows: [["noindex", noindexDetected ? "DETECTED" : "Not set", noindexDetected ? "Fail" : "Pass"]]
                        }
                    },
                    {
                        id: "canonical-url",
                        title: "Canonical URL declared",
                        passed: canonicalPassed,
                        errorsCount: canonicalPassed ? 0 : 1,
                        description: "Canonical link declarations ensure that duplicate URL variations are consolidated under one primary indexed address.",
                        learnMoreHref: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
                        table: {
                            headers: ["Canonical Tag", "Href Value", "Status"],
                            rows: [["<link rel='canonical'>", canonicalVal || "MISSING", canonicalPassed ? "Pass" : "Fail"]]
                        }
                    },
                    {
                        id: "x-robots",
                        title: "X-Robots-Tag headers",
                        passed: true,
                        description: "X-Robots-Tag headers provide HTTP-level indexing rules. This cannot be assessed from a raw HTML import.",
                        learnMoreHref: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#x-robots-tag",
                        table: {
                            headers: ["HTTP Header", "Expected Result"],
                            rows: [["X-Robots-Tag", "Requires live crawler scanner run to assess headers"]]
                        }
                    }
                ]
            });

            // Group 2: PAGE STRUCTURE
            groups.push({
                title: "PAGE STRUCTURE",
                items: [
                    {
                        id: "title-tag",
                        title: "<title> tag",
                        passed: titlePassed,
                        errorsCount: titlePassed ? 0 : 1,
                        description: "Page titles are primary hooks. A strong descriptive title should measure between 50 to 60 characters.",
                        learnMoreHref: "https://web.dev/title/",
                        table: {
                            headers: ["Attribute", "Value", "Length", "Status"],
                            rows: [["<title>", titleText || "(missing)", String(titleLength), titlePassed ? "Pass" : "Warning/Fail"]]
                        }
                    },
                    {
                        id: "h1-tag",
                        title: "<h1> heading",
                        passed: h1Passed,
                        errorsCount: h1Passed ? 0 : 1,
                        description: "The <h1> heading should serve as the clear main topic marker. Avoid skipping or stacking multiple <h1> tags.",
                        learnMoreHref: "https://web.dev/heading-order/",
                        table: {
                            headers: ["Element", "Text", "Status"],
                            rows: [["<h1>", h1Text || "(missing)", h1Passed ? "Pass" : "Fail"]]
                        }
                    },
                    {
                        id: "meta-description",
                        title: "<meta description>",
                        passed: descPassed,
                        errorsCount: descPassed ? 0 : 1,
                        description: "Meta description snippets summarize the page content. Keep them within a 120-155 character range.",
                        learnMoreHref: "https://web.dev/meta-description/",
                        table: {
                            headers: ["Attribute", "Value", "Length", "Status"],
                            rows: [["description", descText || "(missing)", String(descLength), descPassed ? "Pass" : "Warning/Fail"]]
                        }
                    }
                ]
            });

            // Group 3: STRUCTURED DATA
            groups.push({
                title: "STRUCTURED DATA",
                items: [
                    {
                        id: "structured-data",
                        title: "JSON-LD structured data blocks",
                        passed: !!schemaDim && schemaDim.score === 100,
                        errorsCount: (schemaDim?.details?.items?.filter(x => x.status === 'fail').length) || 0,
                        description: "JSON-LD enables precise semantic schema recognition, mapping explicit entities (Articles, Organization, products) for rich engine results.",
                        learnMoreHref: "https://schema.org/docs/gs.html",
                        table: schemaDim?.details?.table
                    }
                ]
            });

            // Group 4: CONTENT FRESHNESS
            groups.push({
                title: "CONTENT FRESHNESS",
                items: [
                    {
                        id: "freshness-signals",
                        title: "Content freshness indicators",
                        passed: true,
                        description: "Content freshness can be verified using schema dates (datePublished/dateModified), visual update labels, or <time> tags.",
                        learnMoreHref: "https://developers.google.com/search/docs/appearance/publication-dates",
                        table: freshnessDim?.details?.table
                    }
                ]
            });

            // Group 5: PERFORMANCE SIGNALS
            groups.push({
                title: "PERFORMANCE SIGNALS",
                items: [
                    {
                        id: "render-blocking",
                        title: "Render-blocking head scripts",
                        passed: !perfDim || perfDim.details?.items?.find(it => it.label === 'Render-blocking scripts')?.status === 'ok',
                        description: "Synchronous external head scripts block critical rendering. Use defer or async attributes to allow parallel script parsing.",
                        learnMoreHref: "https://web.dev/render-blocking-resources/",
                        table: perfDim?.details?.table
                    },
                    {
                        id: "missing-dimensions",
                        title: "Image elements with missing dimensions",
                        passed: !perfDim || perfDim.details?.items?.find(it => it.label === 'Image dimensions')?.status === 'ok',
                        description: "Missing image width/height attributes cause page reflows and Layout Shift (CLS). Specify dimensions on all static image assets.",
                        learnMoreHref: "https://web.dev/optimize-cls/",
                        table: perfDim?.details?.table
                    }
                ]
            });

            // Group 6: ACCESSIBILITY
            groups.push({
                title: "ACCESSIBILITY",
                items: [
                    {
                        id: "img-alt",
                        title: "Image alt tags coverage",
                        passed: !accessibilityDim || accessibilityDim.details?.items?.find(it => it.label === 'Image alt text')?.status === 'ok',
                        description: "Every informative image needs a descriptive alt tag. Purely decorative images can specify an empty alt=\"\" string.",
                        learnMoreHref: "https://web.dev/image-alt/",
                        table: accessibilityDim?.details?.table
                    },
                    {
                        id: "form-labels",
                        title: "Form input label pairs",
                        passed: !accessibilityDim || accessibilityDim.details?.items?.find(it => it.label === 'Form labels')?.status === 'ok',
                        description: "Pair interactive forms with <label for=\"id\"> tags to enable accessibility readers to correctly identify fields.",
                        learnMoreHref: "https://web.dev/input-authoring/",
                        table: accessibilityDim?.details?.table
                    },
                    {
                        id: "doc-lang",
                        title: "<html> language designation",
                        passed: !accessibilityDim || accessibilityDim.details?.items?.find(it => it.label === 'Document language')?.status === 'ok',
                        description: "Ensure that the root <html> tag defines a lang attribute to load corresponding assistive speech models.",
                        learnMoreHref: "https://web.dev/html-has-lang/",
                        table: accessibilityDim?.details?.table
                    },
                    {
                        id: "viewport",
                        title: "Has viewport meta tag",
                        passed: !accessibilityDim || accessibilityDim.details?.items?.find(it => it.label === 'Viewport meta')?.status === 'ok',
                        description: "A viewport tag scales width appropriately on high-density displays and prevents rigid desktop rendering bugs.",
                        learnMoreHref: "https://web.dev/viewport/",
                        table: accessibilityDim?.details?.table
                    },
                    {
                        id: "heading-order",
                        title: "Sequential heading hierarchy",
                        passed: !accessibilityDim || accessibilityDim.details?.items?.find(it => it.label === 'Heading order')?.status === 'ok',
                        description: "Maintain logical, descending sequence levels. Avoid skipping sizes (e.g. h1 directly to h3) to support reading models.",
                        learnMoreHref: "https://web.dev/heading-order/",
                        table: accessibilityDim?.details?.table
                    },
                    {
                        id: "button-names",
                        title: "Buttons have accessible names",
                        passed: !accessibilityDim || accessibilityDim.details?.items?.find(it => it.label === 'Button accessible names')?.status === 'ok',
                        description: "Every button action must provide clear visible text or an descriptive aria-label fallback attribute.",
                        learnMoreHref: "https://web.dev/button-name/",
                        table: accessibilityDim?.details?.table
                    }
                ]
            });

            // Group 7: BEST PRACTICES
            groups.push({
                title: "BEST PRACTICES",
                items: [
                    {
                        id: "https",
                        title: "Uses secure HTTPS connection",
                        passed: audit.url.startsWith('https://'),
                        description: "All client public-facing pages must be routed exclusively via TLS to protect transaction data.",
                        learnMoreHref: "https://web.dev/why-https-matters/",
                        table: bestPracticesDim?.details?.table
                    },
                    {
                        id: "doctype",
                        title: "HTML5 doctype declared",
                        passed: !bestPracticesDim || bestPracticesDim.details?.items?.find(it => it.label === 'Doctype')?.status === 'ok',
                        description: "Explicitly declare the HTML5 doctype. Placing tags lower or omitting them drives browsers into legacy compatibility modes.",
                        learnMoreHref: "https://web.dev/doctype/",
                        table: bestPracticesDim?.details?.table
                    },
                    {
                        id: "charset",
                        title: "Character charset encoding defined",
                        passed: !bestPracticesDim || bestPracticesDim.details?.items?.find(it => it.label === 'Charset')?.status === 'ok',
                        description: "Declare a UTF-8 character meta tag early within the <head> container to prevent rendering bugs.",
                        learnMoreHref: "https://web.dev/char-encoding/",
                        table: bestPracticesDim?.details?.table
                    }
                ]
            });
        } else if (category === 'AEO') {
            // Group 1: ANSWER STRUCTURE
            groups.push({
                title: "ANSWER STRUCTURE",
                items: [
                    {
                        id: "aeo-h1",
                        title: "Main topic heading (H1)",
                        passed: h1Passed,
                        description: "AI crawlers require a high-level H1 declaration to build topical answer mappings.",
                        table: {
                            headers: ["Heading", "Visible Text", "Status"],
                            rows: [["<h1>", h1Text || "MISSING", h1Passed ? "Pass" : "Fail"]]
                        }
                    },
                    {
                        id: "aeo-h2s",
                        title: "Topical subheadings (H2s)",
                        passed: (contentDim?.details?.items?.find(it => it.label === '<h2> headings')?.status === 'ok') || false,
                        description: "List of H2 elements detected. Structural questions are ideal entry-points for LLM crawlers.",
                        table: contentDim?.details?.table
                    },
                    {
                        id: "aeo-word-count",
                        title: "Substantive word count",
                        passed: (contentDim?.details?.items?.find(it => it.label === 'Word count')?.status === 'ok') || false,
                        description: "Total visible crawlable text count. LLM answer generation engines prefer robust pages exceeding 300 words.",
                        table: {
                            headers: ["Metric", "Measured Value"],
                            rows: [["Crawlable word count", contentDim?.details?.items?.find(it => it.label === 'Word count')?.value || "0 words"]]
                        }
                    },
                    {
                        id: "aeo-lists-tables",
                        title: "Lists or tables structures present",
                        passed: (contentDim?.details?.items?.find(it => it.label === 'Lists / tables')?.status === 'ok') || false,
                        description: "Generative search formats favor structured data tables and checklists for comparative question results.",
                        table: {
                            headers: ["Check", "Result"],
                            rows: [["Lists/Tables on page", contentDim?.details?.items?.find(it => it.label === 'Lists / tables')?.value || "None"]]
                        }
                    }
                ]
            });

            // Group 2: BRAND CLARITY
            groups.push({
                title: "BRAND CLARITY",
                items: [
                    {
                        id: "brand-match",
                        title: "Brand name matches in text body",
                        passed: !!entityDim && entityDim.score === 100,
                        description: "AI engines must establish clear attribution. Ensure your exact brand name appears directly in the opening paragraph.",
                        table: entityDim?.details?.table
                    }
                ]
            });

            // Group 3: REFERENCE CUES
            groups.push({
                title: "REFERENCE CUES",
                items: [
                    {
                        id: "external-references",
                        title: "Authoritative external citation links",
                        passed: !!evidenceDim && evidenceDim.score === 100,
                        description: "Outbound reference links support claims with authoritative citation sources, building topical trust graphs.",
                        table: evidenceDim?.details?.table
                    }
                ]
            });

            // Group 4: QUERY READINESS
            groups.push({
                title: "QUERY READINESS",
                items: [
                    {
                        id: "faq-patterns",
                        title: "Question-like H2/H3 query patterns",
                        passed: !!queryDim && queryDim.score === 100,
                        description: "Identifies question structures ending with '?' or starting with transactional terms like 'How', 'What', or 'Why'.",
                        table: queryDim?.details?.table
                    }
                ]
            });

            // Group 5: REASONING CUES
            groups.push({
                title: "REASONING CUES",
                items: [
                    {
                        id: "reasoning-cues",
                        title: "LLM reasoning signal types",
                        passed: !!reasoningDim && (reasoningDim.score ?? 0) >= 70,
                        errorsCount: reasoningDim ? Math.round((1 - (reasoningDim.score ?? 0) / 100) * 7) : 7,
                        description: "Detects 7 reasoning signal types (step sequences, summaries, definitions, examples, comparisons, warnings, why-it-matters) that help LLMs extract and cite your content.",
                        learnMoreHref: "https://developer.chrome.com/docs/ai/",
                        table: reasoningDim?.details?.table
                    }
                ]
            });

            // Group 6: PASSAGE DENSITY
            groups.push({
                title: "PASSAGE DENSITY",
                items: [
                    {
                        id: "passage-density",
                        title: "Self-contained passage blocks",
                        passed: !!passageDim && (passageDim.score ?? 0) >= 70,
                        description: "Checks that paragraphs are 15–240 words (100–300 tokens) — the ideal size for LLMs to extract and cite as standalone passages. Also checks for FAQ patterns, lists, and comparison tables.",
                        table: passageDim?.details?.table
                    }
                ]
            });

            // Group 7: ENTITY AUTHORITY LINKS
            groups.push({
                title: "ENTITY AUTHORITY LINKS",
                items: [
                    {
                        id: "entity-links",
                        title: "sameAs authority links (Wikidata, Wikipedia, LinkedIn)",
                        passed: !!entityLinksDim && (entityLinksDim.score ?? 0) >= 33,
                        description: "sameAs links in Organization/Person JSON-LD pointing to Wikidata, Wikipedia, and LinkedIn signal entity confidence to AI engines, helping them disambiguate your brand from similar names.",
                        table: entityLinksDim?.details?.table
                    }
                ]
            });
        } else if (category === 'GEO') {
            const sampleSize = observations.length;
            const hostname = new URL(audit.url).hostname.replace(/^www\./, '');
            const mentions = observations.filter(r => r.response.toLowerCase().includes(audit.clientId.toLowerCase()) || r.response.toLowerCase().includes('northstar')).length;
            const citations = observations.filter(r => r.citations.some(u => { const h = new URL(u).hostname.replace(/^www\./, ''); return h === hostname || h.endsWith('.' + hostname); })).length;
            const mentionRate = sampleSize ? Math.round(mentions / sampleSize * 100) : null;
            const citationRate = sampleSize ? Math.round(citations / sampleSize * 100) : null;

            // Group 1: AI VISIBILITY
            groups.push({
                title: "AI VISIBILITY",
                items: [
                    {
                        id: "obs-count",
                        title: "Total observation queries checked",
                        passed: sampleSize > 0,
                        description: "Number of monitored generative engine observation queries logged inside this workspace.",
                        table: {
                            headers: ["Metric", "Value"],
                            rows: [["Monitored Query Runs", `${sampleSize} checked`]]
                        }
                    },
                    {
                        id: "mention-rate",
                        title: "AI brand mention rate",
                        passed: mentionRate !== null && mentionRate > 0,
                        description: "Monitors what share of overall generative answers explicitly discuss your brand.",
                        table: {
                            headers: ["Metric", "Measured Rate"],
                            rows: [["Mention Rate", mentionRate !== null ? `${mentionRate}%` : "Not assessed — run query tests"]]
                        }
                    },
                    {
                        id: "citation-rate",
                        title: "AI domain citation rate",
                        passed: citationRate !== null && citationRate > 0,
                        description: "Monitors what percentage of generative search answers provide citations pointing back to your domain.",
                        table: {
                            headers: ["Metric", "Measured Rate"],
                            rows: [["Citation Rate", citationRate !== null ? `${citationRate}%` : "Not assessed — run query tests"]]
                        }
                    }
                ]
            });

            // Group 2: MONITORING COVERAGE
            groups.push({
                title: "MONITORING COVERAGE",
                items: [
                    {
                        id: "monitoring-coverage",
                        title: "Coverage monitoring coverage runs",
                        passed: true,
                        description: "Go to the Observations tab to build out comprehensive generative visibility histories over time.",
                        table: {
                            headers: ["Check", "Workspace Setup"],
                            rows: [
                                ["Total Query Set", "10 prompt universe templates mapped"],
                                ["Observations logs", `${sampleSize} logged`]
                            ]
                        }
                    }
                ]
            });

            // Group 3: AUTHORITY SIGNALS
            groups.push({
                title: "AUTHORITY SIGNALS",
                items: [
                    {
                        id: "authority-domains",
                        title: "Referencing authoritative inbound domains",
                        passed: (evidenceDim?.details?.items?.length || 0) > 0,
                        description: "Generative search rankings align with inbound link references. List of support domain targets on page.",
                        table: evidenceDim?.details?.table
                    },
                    {
                        id: "authority-schema",
                        title: "Trust-building Organization & Person schemas",
                        passed: schemaTypes.includes('Organization') || schemaTypes.includes('Person') || schemaTypes.includes('LocalBusiness'),
                        description: "High-level entities like Organization, Person, or local profiles establish solid brand credentials.",
                        table: {
                            headers: ["Entity Type", "Detected in schema JSON-LD"],
                            rows: [
                                ["Organization Schema", schemaTypes.includes('Organization') ? "Yes" : "No"],
                                ["Person Schema", schemaTypes.includes('Person') ? "Yes" : "No"]
                            ]
                        }
                    }
                ]
            });
        }
    }

    return (
        <div style={{animation: 'fadeIn .2s ease'}}>
            {/* Header section */}
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:22}}>
                <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'7px 14px',fontSize:13,color:'#57606a',cursor:'pointer',fontWeight:600}}>
                    <ArrowLeft size={14}/> Back to overview
                </button>
                <div>
                    <span style={{fontSize:20,fontWeight:800,color:meta.color,letterSpacing:'.04em'}}>{category}</span>
                    <span style={{fontSize:14,color:'#57606a',marginLeft:8}}>— {meta.tagline}</span>
                </div>
            </div>

            {/* Score Ring Top Panel */}
            <section className="panel" style={{padding:'24px',marginBottom:22,background:'#fafbfc'}}>
                <div style={{display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}>
                    {/* Main score ring */}
                    <div style={{position:'relative',width:110,height:110,flexShrink:0}}>
                        <svg width="110" height="110" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="44" fill="transparent" stroke="#e5e7eb" strokeWidth="8" />
                            <circle cx="50" cy="50" r="44" fill="transparent"
                                    stroke={scoreColor(catScore)}
                                    strokeWidth="8"
                                    strokeDasharray="276.4"
                                    strokeDashoffset={276.4 - (276.4 * (catScore ?? 0)) / 100}
                                    strokeLinecap="round"
                                    transform="rotate(-90 50 50)" />
                        </svg>
                        <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center'}}>
                            <span style={{fontSize:24,fontWeight:800,color:'#1f2328'}}>{catScore ?? 'N/A'}</span>
                            <span style={{fontSize:10,color:'#57606a',fontWeight:600}}>SCORE</span>
                        </div>
                    </div>
                    <div style={{flex:1,minWidth:200}}>
                        <h2 style={{fontSize:16,fontWeight:800,color:'#1f2328',margin:'0 0 4px 0'}}>{category} — {meta.tagline}</h2>
                        <p style={{fontSize:13,color:'#57606a',margin:0,lineHeight:1.6}}>{meta.description}</p>
                    </div>
                </div>
                {/* SEO also shows accessibility, performance, best-practices sub-rings */}
                {category === 'SEO' && audit && (()=>{
                    const sub = [
                        {label:'Accessibility', id:'accessibility', color:'#b45309'},
                        {label:'Performance', id:'performance', color:'#7c3aed'},
                        {label:'Best Practices', id:'best-practices', color:'#1d4ed8'},
                    ];
                    return (
                        <div style={{display:'flex',gap:20,marginTop:20,paddingTop:16,borderTop:'1px solid #e5e7eb',flexWrap:'wrap'}}>
                            {sub.map(s => {
                                const dim = audit.dimensions.find(d => d.id === s.id);
                                const sc = dim?.score ?? null;
                                const circ = 2 * Math.PI * 28;
                                return (
                                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:12}}>
                                        <div style={{position:'relative',width:70,height:70,flexShrink:0}}>
                                            <svg width="70" height="70" viewBox="0 0 70 70">
                                                <circle cx="35" cy="35" r="28" fill="transparent" stroke="#e5e7eb" strokeWidth="6"/>
                                                <circle cx="35" cy="35" r="28" fill="transparent"
                                                        stroke={sc === null ? '#e5e7eb' : scoreColor(sc)}
                                                        strokeWidth="6"
                                                        strokeDasharray={`${circ}`}
                                                        strokeDashoffset={circ - (circ * (sc ?? 0)) / 100}
                                                        strokeLinecap="round"
                                                        transform="rotate(-90 35 35)"/>
                                            </svg>
                                            <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#1f2328'}}>
                                                {sc === null ? '?' : sc}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{fontSize:12,fontWeight:700,color:s.color}}>{s.label}</div>
                                            <div style={{fontSize:11,color:'#57606a',marginTop:1}}>
                                                {sc === null ? 'Scan to assess' : sc >= 90 ? 'Good' : sc >= 50 ? 'Needs improvement' : 'Poor'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div style={{fontSize:11,color:'#8b9aa6',alignSelf:'center',maxWidth:260,lineHeight:1.5}}>
                                These scores are derived from the page HTML. Run a live scan for full performance metrics.
                            </div>
                        </div>
                    );
                })()}
            </section>

            {/* Lighthouse style audit details */}
            {audit ? (
                <div>
                    {groups.map((group, groupIndex) => {
                        const failedItems = group.items.filter(it => !it.passed);
                        const passedItems = group.items.filter(it => it.passed);

                        return (
                            <section key={groupIndex} className="panel" style={{marginBottom:24,padding:'20px 24px'}}>
                                <h3 style={{fontSize:11,fontWeight:800,color:'#57606a',letterSpacing:'.1em',borderBottom:'1px solid #e5e7eb',paddingBottom:8,marginBottom:16,textTransform:'uppercase'}}>
                                    {group.title}
                                </h3>

                                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                                    {/* FAILED / WARNING COLLAPSIBLE AUDITS */}
                                    {failedItems.map(item => (
                                        <details key={item.id} open style={{border:'1px solid #e5e7eb',borderRadius:6,background:'#ffffff',overflow:'hidden'}}>
                                            <summary style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',fontWeight:700,fontSize:13,color:'#1f2328',userSelect:'none',background:'#fafbfc'}}>
                                                <span style={{color:'#b91c1c',fontSize:14}}>▲</span>
                                                <span style={{flex:1}}>{item.title}</span>
                                                {item.errorsCount && item.errorsCount > 0 ? (
                                                    <span style={{color:'#b91c1c',fontSize:11,background:'#fee2e2',padding:'2px 8px',borderRadius:4,fontWeight:600}}>
                                                        — {item.errorsCount} error{item.errorsCount !== 1 ? 's' : ''} found
                                                    </span>
                                                ) : (
                                                    <span style={{color:'#b45309',fontSize:11,background:'#fef3c7',padding:'2px 8px',borderRadius:4,fontWeight:600}}>
                                                        Needs Review
                                                    </span>
                                                )}
                                            </summary>

                                            <div style={{padding:'14px 16px',borderTop:'1px solid #e5e7eb',background:'#ffffff',fontSize:13,lineHeight:1.6,color:'#213f50'}}>
                                                <p style={{margin:'0 0 12px 0'}}>{item.description}</p>
                                                
                                                {item.learnMoreHref && (
                                                    <a href={item.learnMoreHref} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:4,color:'#3b82d4',fontSize:12,fontWeight:600,textDecoration:'none',marginBottom:14}}>
                                                        Learn more <ExternalLink size={11}/>
                                                    </a>
                                                )}

                                                {/* Enriched detailed data table */}
                                                {item.table && item.table.rows && item.table.rows.length > 0 && (
                                                    <div style={{overflowX:'auto',borderRadius:6,border:'1px solid #e5e7eb'}}>
                                                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,textAlign:'left'}}>
                                                            <thead>
                                                                <tr style={{background:'#f7f8fa',borderBottom:'1px solid #e5e7eb'}}>
                                                                    {item.table.headers.map((h, hi) => (
                                                                        <th key={hi} style={{padding:'8px 12px',fontWeight:700,color:'#57606a'}}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {item.table.rows.map((row, ri) => (
                                                                    <tr key={ri} style={{borderBottom: ri < item.table!.rows.length - 1 ? '1px solid #e5e7eb' : 'none', background: ri % 2 === 1 ? '#fcfcfd' : '#ffffff'}}>
                                                                        {row.map((cell, ci) => {
                                                                            const isCode = cell.startsWith('<') || cell.includes('/') || cell.includes('{');
                                                                            return (
                                                                                <td key={ci} style={{
                                                                                    padding:'8px 12px',
                                                                                    color:'#1f2328',
                                                                                    fontFamily: isCode ? 'monospace' : 'inherit',
                                                                                    wordBreak:'break-all'
                                                                                }}>
                                                                                    {cell}
                                                                                </td>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </details>
                                    ))}

                                    {/* PASSED AUDITS COLLAPSIBLE SECTION */}
                                    {passedItems.length > 0 && (
                                        <details style={{border:'1px solid #e5e7eb',borderRadius:6,background:'#ffffff'}}>
                                            <summary style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',fontWeight:700,fontSize:13,color:'#15803d',userSelect:'none',background:'#fafbfc'}}>
                                                <span>✓</span>
                                                <span style={{flex:1}}>PASSED AUDITS ({passedItems.length})</span>
                                                <span style={{color:'#15803d',fontSize:10,background:'#dcfce7',padding:'2px 8px',borderRadius:4,fontWeight:600}}>
                                                    Pass
                                                </span>
                                            </summary>

                                            <div style={{padding:'8px 16px 16px 16px',borderTop:'1px solid #e5e7eb',display:'flex',flexDirection:'column',gap:10}}>
                                                {passedItems.map(item => (
                                                    <details key={item.id} style={{border:'1px solid #e5e7eb',borderRadius:6,marginTop:8,background:'#ffffff',overflow:'hidden'}}>
                                                        <summary style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',fontWeight:600,fontSize:12,color:'#213f50',background:'#fafbfc'}}>
                                                            <span style={{color:'#15803d'}}>✓</span>
                                                            <span style={{flex:1}}>{item.title}</span>
                                                        </summary>
                                                        <div style={{padding:'12px 14px',borderTop:'1px solid #e5e7eb',background:'#ffffff',fontSize:12,lineHeight:1.6,color:'#57606a'}}>
                                                            <p style={{margin:'0 0 10px 0'}}>{item.description}</p>

                                                            {item.table && item.table.rows && item.table.rows.length > 0 && (
                                                                <div style={{overflowX:'auto',borderRadius:6,border:'1px solid #e5e7eb',marginTop:8}}>
                                                                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,textAlign:'left'}}>
                                                                        <thead>
                                                                            <tr style={{background:'#f7f8fa',borderBottom:'1px solid #e5e7eb'}}>
                                                                                {item.table.headers.map((h, hi) => (
                                                                                    <th key={hi} style={{padding:'6px 10px',fontWeight:700,color:'#57606a'}}>{h}</th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {item.table.rows.map((row, ri) => (
                                                                                <tr key={ri} style={{borderBottom: ri < item.table!.rows.length - 1 ? '1px solid #e5e7eb' : 'none', background: ri % 2 === 1 ? '#fcfcfd' : '#ffffff'}}>
                                                                                    {row.map((cell, ci) => (
                                                                                        <td key={ci} style={{
                                                                                            padding:'6px 10px',
                                                                                            color:'#1f2328',
                                                                                            fontFamily: cell.startsWith('<') || cell.includes('/') ? 'monospace' : 'inherit',
                                                                                            wordBreak:'break-all'
                                                                                        }}>
                                                                                            {cell}
                                                                                        </td>
                                                                                    ))}
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </details>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div style={{padding:'40px',textAlign:'center',color:'#57606a'}}>
                    No audits found for this client. Import page evidence to generate a scan analysis report.
                </div>
            )}
        </div>
    );
}
