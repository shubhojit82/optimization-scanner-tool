import type {Audit, Client} from '../core/contracts';

export type ContentBriefSection = {
    type: 'headings' | 'faq' | 'schema' | 'entity' | 'passage' | 'reasoning' | 'summary';
    title: string;
    items: string[];
};

export type ContentBrief = {
    clientName: string;
    pageUrl: string;
    generatedAt: string;
    model: string;
    provider: string;
    overallScore: number | null;
    sections: ContentBriefSection[];
    executiveSummary: string;
};

/** Build a structured audit gap summary for the prompt (no dependencies — pure data). */
function buildGapContext(client: Client, audit: Audit): string {
    const GAP_DIMS = ['content','query','schema','entity','evidence','reasoning-cues','passage-density','entity-links','freshness','technical'];
    const gaps = audit.dimensions
        .filter(d => GAP_DIMS.includes(d.id) && d.score !== null && d.score < 90)
        .sort((a,b) => b.weight*(100-b.score!) - a.weight*(100-a.score!));

    const lines: string[] = [
        `Client: ${client.name}`,
        `Domain: ${client.domain}`,
        `Industry: ${client.industry}`,
        `Market: ${client.market}`,
        `Products/Services: ${client.products.join(', ') || 'not specified'}`,
        `Overall GEO score: ${audit.score}/100`,
        ``,
        `TOP DIMENSION GAPS (highest weighted impact first):`,
    ];

    for (const d of gaps.slice(0, 8)) {
        lines.push(`- ${d.name} (score ${d.score}/100, weight ${d.weight}%): ${d.action}`);
        if (d.details?.missing?.length) {
            for (const m of d.details.missing.slice(0, 3)) lines.push(`  Missing: ${m}`);
        }
    }

    const pageTitle = audit.dimensions.find(d => d.id === 'technical')?.evidence ?? '';
    if (pageTitle) lines.push(`\nPage context: ${pageTitle.slice(0,300)}`);

    return lines.join('\n');
}

const BRIEF_PROMPT = (ctx: string) => `You are an expert GEO (Generative Engine Optimisation) content strategist working with a GEO specialist. 
Based on the following audit gap analysis, generate a detailed, actionable content brief in valid JSON.

AUDIT GAP ANALYSIS:
${ctx}

Respond ONLY with a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "executiveSummary": "2-3 sentence summary of what needs to change and why it matters for AI visibility",
  "sections": [
    {
      "type": "headings",
      "title": "Recommended H2/H3 Headings to Add",
      "items": ["5-8 specific heading strings the page should include to answer AI queries"]
    },
    {
      "type": "faq",
      "title": "FAQ Questions to Answer on the Page",
      "items": ["6-10 specific questions (ending with ?) that users and AI engines ask about this brand/product"]
    },
    {
      "type": "schema",
      "title": "Schema Markup Recommendations",
      "items": ["3-6 specific @type and property additions needed, e.g. 'Add FAQPage schema with mainEntity for each FAQ'"]
    },
    {
      "type": "entity",
      "title": "Entity & Authority Signals to Build",
      "items": ["3-5 specific sameAs or entity links to pursue, e.g. Wikidata entry, Wikipedia page, LinkedIn company page"]
    },
    {
      "type": "passage",
      "title": "Passage-Optimised Content Blocks",
      "items": ["4-6 specific 100-300 word content blocks to write, with clear topic descriptions"]
    },
    {
      "type": "reasoning",
      "title": "LLM Reasoning Cues to Add",
      "items": ["3-5 specific additions: definitions, step-by-step sections, comparison tables, or explicit 'Key takeaway:' callouts"]
    }
  ]
}`;

type RawBrief = {
    executiveSummary?: string;
    sections?: Array<{type?: string; title?: string; items?: string[]}>;
};

/** Call OpenAI chat completions (no web search — we want pure generation). */
async function providerErrMsg(res: Response, prefix: string): Promise<never> {
    let detail = '';
    try {
        const body = await res.json() as {error?: {message?: string} | string; message?: string};
        if (typeof body.error === 'string') detail = body.error;
        else if (typeof body.error === 'object' && body.error?.message) detail = body.error.message;
        else if (typeof body.message === 'string') detail = body.message;
    } catch { /* ignore */ }
    throw new Error(`${prefix} (HTTP ${res.status})${detail ? ': ' + detail : ''}`);
}

async function callOpenAI(key: string, model: string, prompt: string): Promise<{text: string; model: string}> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(120000),
        headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            response_format: {type: 'json_object'},
            messages: [{role: 'user', content: prompt}],
        }),
    });
    if (!res.ok) await providerErrMsg(res, 'OpenAI');
    const data = await res.json() as {choices?: Array<{message?: {content?: string}}>; model?: string};
    const text = data.choices?.[0]?.message?.content ?? '';
    return {text, model: data.model ?? model};
}

/** Call Gemini generateContent (no grounding — pure generation). */
async function callGemini(key: string, model: string, prompt: string): Promise<{text: string; model: string}> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(180000),
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            contents: [{role: 'user', parts: [{text: prompt}]}],
            // 16k total — thinking models consume a large hidden budget before output tokens
            generationConfig: {maxOutputTokens: 16000, responseMimeType: 'application/json'},
        }),
    });
    if (!res.ok) await providerErrMsg(res, 'Gemini');
    const data = await res.json() as {candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>;modelVersion?: string};
    const text = (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
    return {text, model: data.modelVersion ?? model};
}

/** Call Anthropic Messages API (no web search — pure generation). */
async function callClaude(key: string, model: string, prompt: string): Promise<{text: string; model: string}> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(120000),
        headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            messages: [{role: 'user', content: prompt}],
        }),
    });
    if (!res.ok) await providerErrMsg(res, 'Claude');
    const data = await res.json() as {content?: Array<{type?: string; text?: string}>; model?: string};
    const text = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('');
    return {text, model: data.model ?? model};
}

export type BriefProviderConfig = {
    openaiKey?: string; openaiModel?: string;
    geminiKey?: string; geminiModel?: string;
    claudeKey?: string; claudeModel?: string;
};

export class ContentBriefService {
    constructor(private cfg: BriefProviderConfig) {}

    async generate(client: Client, audit: Audit, providerId: string): Promise<ContentBrief> {
        const ctx = buildGapContext(client, audit);
        const prompt = BRIEF_PROMPT(ctx);

        let raw: string;
        let modelUsed: string;

        if (providerId === 'openai' && this.cfg.openaiKey) {
            const r = await callOpenAI(this.cfg.openaiKey, this.cfg.openaiModel ?? 'gpt-4o-mini', prompt);
            raw = r.text; modelUsed = r.model;
        } else if (providerId === 'gemini' && this.cfg.geminiKey) {
            const r = await callGemini(this.cfg.geminiKey, this.cfg.geminiModel ?? 'gemini-3.8-flash', prompt);
            raw = r.text; modelUsed = r.model;
        } else if (providerId === 'claude' && this.cfg.claudeKey) {
            const r = await callClaude(this.cfg.claudeKey, this.cfg.claudeModel ?? 'claude-opus-4-5-20251101', prompt);
            raw = r.text; modelUsed = r.model;
        } else {
            throw new Error(`Provider "${providerId}" is not configured. Add its API key to .env.`);
        }

        // Parse and validate the JSON response — extract the outermost {...} block
        // to handle markdown fences, preamble text, and thinking-model artefacts
        let parsed: RawBrief;
        try {
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start === -1 || end === -1 || end <= start) throw new SyntaxError('no JSON object found');
            parsed = JSON.parse(raw.slice(start, end + 1)) as RawBrief;
        } catch {
            throw new Error('AI returned malformed JSON. Try again or switch provider.');
        }

        const VALID_TYPES = new Set(['headings','faq','schema','entity','passage','reasoning','summary']);
        const sections: ContentBriefSection[] = (parsed.sections ?? [])
            .filter(s => s.type && VALID_TYPES.has(s.type) && s.title && Array.isArray(s.items))
            .map(s => ({
                type: s.type as ContentBriefSection['type'],
                title: String(s.title ?? ''),
                items: (s.items ?? []).map(String).filter(Boolean).slice(0, 12),
            }));

        if (!sections.length) throw new Error('AI returned an empty brief. Try again.');

        return {
            clientName: client.name,
            pageUrl: audit.url,
            generatedAt: new Date().toISOString(),
            model: modelUsed,
            provider: providerId,
            overallScore: audit.score,
            sections,
            executiveSummary: String(parsed.executiveSummary ?? '').slice(0, 800),
        };
    }
}
