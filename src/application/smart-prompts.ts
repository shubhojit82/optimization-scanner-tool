import type {Audit, Client} from '../core/contracts';

export type SmartPromptItem = {
    prompt: string;
    intent: 'transactional' | 'informational' | 'navigational' | 'comparison' | 'evaluation';
    persona: string;       // e.g. "Enterprise buyer", "Technical evaluator"
    rationale: string;     // 1 sentence: why this prompt tests a specific GEO gap
    priority: 'high' | 'medium' | 'low';
};

export type SmartPromptsResult = {
    prompts: SmartPromptItem[];
    generatedAt: string;
    model: string;
    provider: string;
    totalCount: number;
};

export type SmartPromptsProviderConfig = {
    openaiKey?: string; openaiModel?: string;
    geminiKey?: string; geminiModel?: string;
    claudeKey?: string; claudeModel?: string;
};

const GAP_DIMS = ['content', 'query', 'schema', 'entity', 'evidence', 'reasoning-cues', 'passage-density'];
const VALID_INTENTS = new Set(['transactional', 'informational', 'navigational', 'comparison', 'evaluation']);
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

/** Build the client + top-5 weighted gap context for the prompt (pure data). */
function buildContext(client: Client, audit: Audit): string {
    const gaps = audit.dimensions
        .filter(d => GAP_DIMS.includes(d.id) && d.score !== null)
        .sort((a, b) => b.weight * (100 - b.score!) - a.weight * (100 - a.score!))
        .slice(0, 5);

    const lines: string[] = [
        `Client: ${client.name}`,
        `Domain: ${client.domain}`,
        `Industry: ${client.industry}`,
        `Market: ${client.market}`,
        `Products/Services: ${client.products.join(', ') || 'not specified'}`,
        `Competitors: ${client.competitors.join(', ') || 'not specified'}`,
        `Overall GEO score: ${audit.score}/100`,
        ``,
        `TOP 5 WEIGHTED DIMENSION GAPS (highest impact first):`,
    ];

    for (const d of gaps) {
        lines.push(`- ${d.name} [${d.id}] (score ${d.score}/100, weight ${d.weight}%): ${d.action}`);
        for (const m of (d.details?.missing ?? []).slice(0, 3)) lines.push(`  Missing: ${m}`);
    }

    return lines.join('\n');
}

const SMART_PROMPT = (ctx: string) => `You are an expert GEO (Generative Engine Optimisation) prompt engineer working with an IBM consultant.
Based on the client profile and audit gaps below, design probe prompts to send to AI answer engines to test whether the client brand is mentioned and cited.

CLIENT & AUDIT GAP ANALYSIS:
${ctx}

Generate 15-20 realistic prompts that:
- Target the dimension gaps above (each prompt should test at least one gap)
- Cover ALL intent types: transactional, informational, navigational, comparison, evaluation
- Cover ALL personas: Enterprise buyer, Industry analyst, Press/journalist, Technical evaluator
- Reference the client's actual market, products and competitors where natural
- Read like real user questions, not keyword lists

Respond ONLY with a valid JSON object matching this exact schema (no markdown, no explanation). Keep each rationale to one short sentence:
{
  "prompts": [
    {
      "prompt": "the exact text a user would type into an AI assistant",
      "intent": "transactional | informational | navigational | comparison | evaluation",
      "persona": "e.g. Enterprise buyer",
      "rationale": "1 sentence: why this prompt tests a specific GEO gap",
      "priority": "high | medium | low"
    }
  ]
}`;

type RawPrompts = {
    prompts?: Array<{prompt?: unknown; intent?: unknown; persona?: unknown; rationale?: unknown; priority?: unknown}>;
};

/** Extract a human-readable message from a failed provider response. */
async function providerErrMsg(res: Response, prefix: string): Promise<never> {
    let detail = '';
    try {
        const body = await res.json() as {error?: {message?: string} | string; message?: string};
        if (typeof body.error === 'string') detail = body.error;
        else if (typeof body.error === 'object' && body.error?.message) detail = body.error.message;
        else if (typeof body.message === 'string') detail = body.message;
    } catch { /* ignore parse failure */ }
    throw new Error(`${prefix} (HTTP ${res.status})${detail ? ': ' + detail : ''}`);
}

/** Call OpenAI chat completions (no web search — pure generation). */
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
    return {text: data.choices?.[0]?.message?.content ?? '', model: data.model ?? model};
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
    const data = await res.json() as {candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>; modelVersion?: string};
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

export class SmartPromptsService {
    constructor(private cfg: SmartPromptsProviderConfig) {}

    async generate(client: Client, audit: Audit, providerId: string): Promise<SmartPromptsResult> {
        const prompt = SMART_PROMPT(buildContext(client, audit));

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

        // Extract the outermost {...} block to tolerate fences, preamble and thinking artefacts
        let parsed: RawPrompts;
        try {
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start === -1 || end <= start) throw new SyntaxError('no JSON object found');
            parsed = JSON.parse(raw.slice(start, end + 1)) as RawPrompts;
        } catch {
            throw new Error('AI returned malformed JSON. Try again or switch provider.');
        }

        const prompts: SmartPromptItem[] = (Array.isArray(parsed.prompts) ? parsed.prompts : [])
            .filter(p => typeof p?.prompt === 'string' && p.prompt.trim() && typeof p.intent === 'string' && VALID_INTENTS.has(p.intent))
            .map(p => ({
                prompt: String(p.prompt).trim(),
                intent: p.intent as SmartPromptItem['intent'],
                persona: String(p.persona ?? '').trim() || 'General user',
                rationale: String(p.rationale ?? '').trim(),
                priority: typeof p.priority === 'string' && VALID_PRIORITIES.has(p.priority)
                    ? p.priority as SmartPromptItem['priority']
                    : 'medium',
            }))
            .slice(0, 20);

        if (!prompts.length) throw new Error('AI returned no usable prompts. Try again.');

        return {
            prompts,
            generatedAt: new Date().toISOString(),
            model: modelUsed,
            provider: providerId,
            totalCount: prompts.length,
        };
    }
}
