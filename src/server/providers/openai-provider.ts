import {z} from 'zod';
import type {AIProvider, Observation} from '../../core/contracts';
import {CollectionError} from '../../core/contracts';

const payloadSchema = z.object({
    id: z.string(), model: z.string(), status: z.literal('completed'),
    output: z.array(z.object({type: z.string(), status: z.string().optional(), content: z.array(z.object({
        type: z.string(), text: z.string().optional(), annotations: z.array(z.object({
            type: z.string(), url: z.string().optional(), start_index: z.number().int().nonnegative().optional(), end_index: z.number().int().nonnegative().optional()
        }).passthrough()).optional()
    }).passthrough()).optional()}).passthrough()),
    usage: z.object({input_tokens: z.number().optional(), output_tokens: z.number().optional(), total_tokens: z.number().optional()}).optional(),
}).passthrough();
// GPT-4.1: $2/M input, $8/M output tokens (approximate)
function openaiCost(input: number, output: number) { return (input * 2 + output * 8) / 1_000_000; }
function safeUrl(value: string) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }

export class OpenAIProvider implements AIProvider {
    readonly id = 'openai';
    constructor(private key: string, readonly model = 'gpt-4.1', private request: typeof fetch = fetch) {}
    async observe(prompt: string, market: string): Promise<Omit<Observation, 'id'|'clientId'|'created'|'source'>> {
        let result: Response;
        try {
            result = await this.request('https://api.openai.com/v1/responses', {
                method: 'POST', signal: AbortSignal.timeout(60000),
                headers: {'Authorization': `Bearer ${this.key}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({model: this.model, store: false, max_output_tokens: 2048,
                    tools: [{type: 'web_search'}], tool_choice: 'required',
                    instructions: `Answer the user's question for the following market: ${market}. Search the web and cite sources.`, input: prompt})
            });
        } catch {
            throw new CollectionError('Provider connection failed or exceeded 60 seconds. No observation was saved. The provider may have charged for this attempt; check usage before retrying.');
        }
        if (!result.ok) {
            const message = result.status === 401 ? 'OpenAI rejected the API key. Check OPENAI_API_KEY on the server.'
                : result.status === 429 ? 'OpenAI rate or account quota limit reached. Check account usage before retrying.'
                : result.status === 400 ? 'OpenAI rejected the request. Check GEO_OPENAI_MODEL supports Responses API web search.'
                : 'OpenAI could not complete the request. No observation was saved.';
            throw new CollectionError(message, result.status === 429 ? 429 : 502);
        }
        let raw: unknown;
        try { raw = await result.json(); } catch { throw new CollectionError('Provider returned invalid JSON. No observation was saved.'); }
        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) throw new CollectionError('Provider response was incomplete or invalid. No observation was saved.');
        const data = parsed.data;
        if (!data.output.some(o => o.type === 'web_search_call' && o.status === 'completed'))
            throw new CollectionError('Provider did not complete a web search. No observation was saved.');
        let response = '';
        const citations = new Set<string>();
        const annotations: NonNullable<Observation['annotations']> = [];
        for (const item of data.output) if (item.type === 'message') for (const part of item.content || []) {
            if (part.type !== 'output_text' || !part.text) continue;
            if (response) response += '\n\n';
            const offset = response.length;
            response += part.text;
            for (const a of part.annotations || []) if (a.type === 'url_citation' && a.url && safeUrl(a.url)) {
                citations.add(a.url);
                if (a.start_index !== undefined && a.end_index !== undefined && a.end_index > a.start_index && a.end_index <= part.text.length)
                    annotations.push({url: a.url, startIndex: offset + a.start_index, endIndex: offset + a.end_index});
            }
        }
        if (!response.trim() || response.length > 12000) throw new CollectionError('Provider returned an empty or oversized answer. No observation was saved.');
        const inputTok = data.usage?.input_tokens ?? 0;
        const outputTok = data.usage?.output_tokens ?? 0;
        const tokenCount = (data.usage?.total_tokens ?? (inputTok + outputTok)) || undefined;
        const estimatedCostUsd = tokenCount ? openaiCost(inputTok, outputTok) : undefined;
        return {engine: this.id, surface: 'Responses API · web search', model: data.model, prompt, response,
            citations: [...citations], annotations, providerResponseId: data.id, observedAt: new Date().toISOString(),
            tokenCount, estimatedCostUsd};
    }
}
