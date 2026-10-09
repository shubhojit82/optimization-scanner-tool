import {z} from 'zod';
import type {AIProvider, Observation} from '../../core/contracts';
import {CollectionError} from '../../core/contracts';

const candidateSchema = z.object({
    candidates: z.array(z.object({
        content: z.object({parts: z.array(z.object({text: z.string().optional()}).passthrough())}).optional(),
        groundingMetadata: z.object({
            groundingChunks: z.array(z.object({web: z.object({uri: z.string(), title: z.string().optional()}).optional()}).passthrough()).optional(),
        }).optional(),
    }).passthrough()),
    modelVersion: z.string().optional(),
}).passthrough();

function safeUrl(value: string) {try {const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password;} catch {return false;}}

export class GeminiProvider implements AIProvider {
    readonly id = 'gemini';
    constructor(private key: string, readonly model = 'gemini-3.8-flash', private request: typeof fetch = fetch) {}

    async observe(prompt: string, market: string): Promise<Omit<Observation, 'id'|'clientId'|'created'|'source'>> {
        let result: Response;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.key}`;
        try {
            result = await this.request(url, {
                method: 'POST', signal: AbortSignal.timeout(60000),
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    contents: [{role:'user', parts:[{text: `Answer the following question for the ${market} market. Search the web and cite sources.\n\n${prompt}`}]}],
                    tools: [{googleSearch: {}}],
                    generationConfig: {maxOutputTokens: 2048},
                }),
            });
        } catch {
            throw new CollectionError('Gemini connection failed or exceeded 60 seconds. No observation was saved.');
        }
        if (!result.ok) {
            const message = result.status === 400 ? 'Gemini rejected the request. Check GEMINI_API_KEY and that the model supports grounded search.'
                : result.status === 403 ? 'Gemini API key is invalid or lacks permission. Check GEMINI_API_KEY.'
                : result.status === 429 ? 'Gemini rate limit reached. Check quota before retrying.'
                : 'Gemini could not complete the request. No observation was saved.';
            throw new CollectionError(message, result.status === 429 ? 429 : 502);
        }
        let raw: unknown;
        try {raw = await result.json();} catch {throw new CollectionError('Gemini returned invalid JSON. No observation was saved.');}
        const parsed = candidateSchema.safeParse(raw);
        if (!parsed.success) throw new CollectionError('Gemini response was incomplete or invalid. No observation was saved.');
        const data = parsed.data;
        const candidate = data.candidates[0];
        if (!candidate) throw new CollectionError('Gemini returned no candidates. No observation was saved.');
        const response = (candidate.content?.parts ?? []).map(p => p.text ?? '').join('\n\n').trim();
        if (!response || response.length > 12000) throw new CollectionError('Gemini returned an empty or oversized answer. No observation was saved.');
        const citations: string[] = [];
        for (const chunk of candidate.groundingMetadata?.groundingChunks ?? []) {
            if (chunk.web?.uri && safeUrl(chunk.web.uri)) citations.push(chunk.web.uri);
        }
        const modelVersion = data.modelVersion ?? this.model;
        return {
            engine: this.id, surface: 'Gemini API · grounded search', model: modelVersion,
            prompt, response, citations: [...new Set(citations)], annotations: [], observedAt: new Date().toISOString(),
        };
    }
}
