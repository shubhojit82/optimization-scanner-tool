/**
 * RGPS Rewrite Assistant
 *
 * Takes a failing passage (scored by rgps.ts), sends it to an AI provider
 * with the top failing dimensions and rules, and returns a rewrite that:
 *   - Uses ONLY facts already present on the page (no hallucination)
 *   - Targets the specific RGPS dimensions that scored 0 or partial
 *   - Shows before/after RGPS scores
 *
 * Implements gen-1 / gen-3 from the roadmap.
 */

import {scorePassage, isYmyl, rgpsExtractText} from '../core/rgps';
import type {RgpsResult} from '../core/rgps';
import {CollectionError} from '../core/contracts';

export type RgpsRewriteRequest = {
    html: string;       // the full page HTML to rewrite the lead passage of
    url: string;
    provider: 'openai' | 'gemini' | 'claude';
};

export type RgpsRewriteResult = {
    original: string;           // original passage text (extracted)
    rewritten: string;          // AI-rewritten passage
    scoreBefore: RgpsResult;
    scoreAfter: RgpsResult;
    pointsGained: number;
    dimensionsMoved: number;
};

type ProviderConfig = {
    openaiKey?: string;
    openaiModel?: string;
    geminiKey?: string;
    geminiModel?: string;
    claudeKey?: string;
    claudeModel?: string;
};

function buildPrompt(passageText: string, failingDimensions: string[]): string {
    return `You are an expert GEO (Generative Engine Optimisation) editor.
Your task: rewrite the passage below so AI engines can lift, match and cite it.

STRICT RULES:
1. Use ONLY facts that are already in the passage. Do not add new claims, statistics or information.
2. Do not remove any substantive fact from the passage.
3. Fix ONLY the specific issues listed below. Do not change style unnecessarily.
4. Return ONLY the rewritten passage text — no preamble, no explanation, no markdown fencing.

ISSUES TO FIX:
${failingDimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

ORIGINAL PASSAGE:
${passageText}

REWRITTEN PASSAGE:`;
}

export class RgpsRewriteService {
    constructor(private config: ProviderConfig) {}

    async rewrite(req: RgpsRewriteRequest): Promise<RgpsRewriteResult> {
        const text = rgpsExtractText(req.html);
        const ymyl = isYmyl(req.url, text);
        const scoreBefore = scorePassage(req.html, ymyl);

        // Collect the failing/partial dimensions with their action hints
        const failingDimensions = scoreBefore.dimensions
            .filter(d => d.action !== null && d.score < d.weight)
            .sort((a, b) => (b.weight - b.score) - (a.weight - a.score))
            .slice(0, 6)
            .map(d => `${d.id} (${d.name}): ${d.action}`);

        if (!failingDimensions.length) {
            return {
                original: text.slice(0, 2000),
                rewritten: text.slice(0, 2000),
                scoreBefore,
                scoreAfter: scoreBefore,
                pointsGained: 0,
                dimensionsMoved: 0,
            };
        }

        const prompt = buildPrompt(text.slice(0, 3000), failingDimensions);
        const rewritten = await this.callProvider(req.provider, prompt);

        // Score the rewritten text as if it were a minimal HTML snippet with heading preserved
        const firstH = req.html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i)?.[0] ?? '';
        const rewrittenHtml = firstH ? `${firstH}<p>${rewritten}</p>` : `<p>${rewritten}</p>`;
        const scoreAfter = scorePassage(rewrittenHtml, ymyl);

        const pointsGained = scoreAfter.total - scoreBefore.total;
        const dimensionsMoved = scoreBefore.dimensions.filter((d, i) =>
            scoreAfter.dimensions[i] && scoreAfter.dimensions[i].score > d.score
        ).length;

        return {
            original: text.slice(0, 2000),
            rewritten,
            scoreBefore,
            scoreAfter,
            pointsGained,
            dimensionsMoved,
        };
    }

    private async callProvider(provider: string, prompt: string): Promise<string> {
        if (provider === 'openai' && this.config.openaiKey) {
            return this.callOpenAI(prompt);
        }
        if (provider === 'claude' && this.config.claudeKey) {
            return this.callClaude(prompt);
        }
        if (provider === 'gemini' && this.config.geminiKey) {
            return this.callGemini(prompt);
        }
        throw new CollectionError('No AI provider configured for RGPS rewrite. Set OPENAI_API_KEY, ANTHROPIC_API_KEY or GEMINI_API_KEY.', 400);
    }

    private async callOpenAI(prompt: string): Promise<string> {
        const model = this.config.openaiModel || 'gpt-4.1';
        let res: Response;
        try {
            res = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                signal: AbortSignal.timeout(60000),
                headers: {'Authorization': `Bearer ${this.config.openaiKey}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({model, store: false, max_output_tokens: 1024, input: prompt}),
            });
        } catch {
            throw new CollectionError('OpenAI connection failed during RGPS rewrite.');
        }
        if (!res.ok) throw new CollectionError(`OpenAI rewrite failed: HTTP ${res.status}`, res.status === 429 ? 429 : 502);
        const data = await res.json() as {output?: {type: string; content?: {type: string; text?: string}[]}[]};
        const text = data.output?.flatMap(o => o.content ?? []).find(c => c.type === 'output_text')?.text ?? '';
        if (!text.trim()) throw new CollectionError('OpenAI returned empty rewrite.');
        return text.trim();
    }

    private async callClaude(prompt: string): Promise<string> {
        const model = this.config.claudeModel || 'claude-opus-4-5-20251101';
        let res: Response;
        try {
            res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                signal: AbortSignal.timeout(60000),
                headers: {'x-api-key': this.config.claudeKey!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'},
                body: JSON.stringify({model, max_tokens: 1024, messages: [{role: 'user', content: prompt}]}),
            });
        } catch {
            throw new CollectionError('Claude connection failed during RGPS rewrite.');
        }
        if (!res.ok) throw new CollectionError(`Claude rewrite failed: HTTP ${res.status}`, res.status === 429 ? 429 : 502);
        const data = await res.json() as {content?: {type: string; text?: string}[]};
        const text = data.content?.find(b => b.type === 'text')?.text ?? '';
        if (!text.trim()) throw new CollectionError('Claude returned empty rewrite.');
        return text.trim();
    }

    private async callGemini(prompt: string): Promise<string> {
        const model = this.config.geminiModel || 'gemini-2.0-flash';
        let res: Response;
        try {
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.config.geminiKey!)}`, {
                method: 'POST',
                signal: AbortSignal.timeout(60000),
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({contents: [{parts: [{text: prompt}]}]}),
            });
        } catch {
            throw new CollectionError('Gemini connection failed during RGPS rewrite.');
        }
        if (!res.ok) throw new CollectionError(`Gemini rewrite failed: HTTP ${res.status}`, res.status === 429 ? 429 : 502);
        const data = await res.json() as {candidates?: {content?: {parts?: {text?: string}[]}}[]};
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text.trim()) throw new CollectionError('Gemini returned empty rewrite.');
        return text.trim();
    }
}
