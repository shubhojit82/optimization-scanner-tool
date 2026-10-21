import {z} from 'zod';
import type {AIProvider, Observation} from '../../core/contracts';
import {CollectionError} from '../../core/contracts';

// Anthropic Messages API response schema (passthrough to tolerate future fields)
const messageSchema = z.object({
    id: z.string(),
    model: z.string(),
    content: z.array(z.object({
        type: z.string(),
        text: z.string().optional(),
    }).passthrough()),
    stop_reason: z.string().nullable().optional(),
    usage: z.object({input_tokens: z.number().optional(), output_tokens: z.number().optional()}).optional(),
}).passthrough();
// Claude claude-opus-4-5: ~$15/M input, $75/M output tokens (approximate)
function claudeCost(input: number, output: number) { return (input * 15 + output * 75) / 1_000_000; }

function safeUrl(value: string) {
    try {const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password;}
    catch {return false;}
}

export class ClaudeProvider implements AIProvider {
    readonly id = 'claude';
    constructor(private key: string, readonly model = 'claude-opus-4-5-20251101', private request: typeof fetch = fetch) {}

    async observe(prompt: string, market: string): Promise<Omit<Observation, 'id'|'clientId'|'created'|'source'>> {
        let result: Response;
        try {
            result = await this.request('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                signal: AbortSignal.timeout(60000),
                headers: {
                    'x-api-key': this.key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'web-search-2025-03-05',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 2048,
                    system: `You are a helpful research assistant. Answer questions for the ${market} market. Always search the web for current information and cite your sources.`,
                    tools: [{
                        type: 'web_search_20250305',
                        name: 'web_search',
                        max_uses: 5,
                    }],
                    messages: [{role: 'user', content: prompt}],
                }),
            });
        } catch {
            throw new CollectionError('Claude connection failed or exceeded 60 seconds. No observation was saved. The provider may have charged for this attempt; check usage before retrying.');
        }

        if (!result.ok) {
            let body: unknown;
            try {body = await result.json();} catch {body = {};}
            const errMsg = typeof body === 'object' && body !== null && 'error' in body
                ? String((body as {error?: {message?: string}}).error?.message ?? '')
                : '';
            const message = result.status === 401 ? 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY on the server.'
                : result.status === 403 ? 'Anthropic API key lacks permission. Check ANTHROPIC_API_KEY.'
                : result.status === 429 ? 'Anthropic rate or account quota limit reached. Check account usage before retrying.'
                : result.status === 400 ? `Anthropic rejected the request${errMsg ? ': ' + errMsg : '. Check GEO_CLAUDE_MODEL supports web search.'}`
                : 'Claude could not complete the request. No observation was saved.';
            throw new CollectionError(message, result.status === 429 ? 429 : 502);
        }

        let raw: unknown;
        try {raw = await result.json();} catch {throw new CollectionError('Claude returned invalid JSON. No observation was saved.');}

        const parsed = messageSchema.safeParse(raw);
        if (!parsed.success) throw new CollectionError('Claude response was incomplete or invalid. No observation was saved.');
        const data = parsed.data;

        // Extract text blocks and citation URLs from content
        let response = '';
        const citations = new Set<string>();

        for (const block of data.content) {
            if (block.type === 'text' && block.text) {
                if (response) response += '\n\n';
                response += block.text;
            }
            // web_search_result blocks contain source URLs
            if (block.type === 'web_search_result') {
                const b = block as {url?: string};
                if (b.url && safeUrl(b.url)) citations.add(b.url);
            }
            // tool_result blocks may contain structured results with URLs
            if (block.type === 'tool_result') {
                const b = block as {content?: Array<{type?: string; url?: string; text?: string}>};
                for (const item of b.content ?? []) {
                    if (item.url && safeUrl(item.url)) citations.add(item.url);
                }
            }
        }

        // Also scan response text for inline citation URLs (Claude sometimes embeds [1]: https://...)
        const urlMatches = response.matchAll(/https?:\/\/[^\s\)\]>,"']+/g);
        for (const m of urlMatches) {
            if (safeUrl(m[0])) citations.add(m[0]);
        }

        if (!response.trim()) throw new CollectionError('Claude returned an empty answer. No observation was saved.');
        if (response.length > 12000) throw new CollectionError('Claude returned an oversized answer. No observation was saved.');

        const inputTok = data.usage?.input_tokens ?? 0;
        const outputTok = data.usage?.output_tokens ?? 0;
        const tokenCount = (inputTok + outputTok) || undefined;
        const estimatedCostUsd = tokenCount ? claudeCost(inputTok, outputTok) : undefined;
        return {
            engine: this.id,
            surface: 'Messages API · web search',
            model: data.model,
            prompt,
            response,
            citations: [...citations],
            annotations: [],
            observedAt: new Date().toISOString(),
            tokenCount,
            estimatedCostUsd,
        };
    }
}
