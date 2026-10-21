/**
 * Article Draft Generator — gen-2
 *
 * Takes a content brief (or generates one inline from an audit) and calls an AI
 * provider to write a complete, RGPS-ready article draft. The draft is:
 *   - Structured with H1 + intro + H2 sections derived from the brief
 *   - Returned as Markdown for easy copy-paste into any CMS
 *   - Scored against RGPS v3.6.0 after generation
 */

import type {Audit, Client} from '../core/contracts';
import type {ContentBrief} from './content-brief';
import {scorePassage, isYmyl, rgpsExtractText, RGPS_VERSION} from '../core/rgps';
import type {RgpsResult} from '../core/rgps';

export type ArticleDraft = {
    clientName: string;
    pageUrl: string;
    generatedAt: string;
    model: string;
    provider: string;
    wordCount: number;
    markdown: string;       // full article in Markdown
    html: string;           // simple HTML conversion for preview
    rgpsScore: RgpsResult;  // RGPS score of the generated article
    rgpsVersion: string;
};

type ProviderConfig = {
    openaiKey?: string; openaiModel?: string;
    geminiKey?: string; geminiModel?: string;
    claudeKey?: string; claudeModel?: string;
};

function buildArticlePrompt(client: Client, audit: Audit, brief: ContentBrief | null): string {
    const headings = brief?.sections.find(s => s.type === 'headings')?.items ?? [];
    const faqs = brief?.sections.find(s => s.type === 'faq')?.items ?? [];
    const passages = brief?.sections.find(s => s.type === 'passage')?.items ?? [];
    const topGap = audit.dimensions
        .filter(d => d.score !== null && d.score < 80)
        .sort((a, b) => b.weight * (100 - b.score!) - a.weight * (100 - a.score!))
        .slice(0, 3).map(d => d.name).join(', ');

    return `You are an expert GEO (Generative Engine Optimisation) content writer.
Write a complete, AI-retrieval-ready article for the client below.

CLIENT:
- Name: ${client.name}
- Domain: ${client.domain}
- Industry: ${client.industry}
- Market: ${client.market}
- Products/Services: ${client.products.slice(0, 5).join(', ')}

CONTENT OBJECTIVES (fix these GEO gaps): ${topGap || 'improve overall answer-readiness'}

STRUCTURE TO USE:
${headings.slice(0, 6).map((h, i) => `H2 ${i + 1}: ${h}`).join('\n') || 'Write 4-6 relevant H2 sections'}
${faqs.length ? `\nFAQ section with: ${faqs.slice(0, 4).join(' | ')}` : ''}
${passages.length ? `\nInclude passage blocks on: ${passages.slice(0, 3).join(' | ')}` : ''}

WRITING RULES:
1. Every H2 section must open with a direct 1-2 sentence answer (answer-first pattern)
2. Use specific numbers, dates, mechanisms — no vague adjectives
3. Each sentence makes one declarative claim — short, snippable sentences
4. Name the brand explicitly at first mention; define what it is and does
5. Add an "as of [current year]" marker near any time-sensitive facts
6. End with a structured FAQ using question headings

FORMAT: Return clean Markdown only. Start with # H1 title. No preamble, no explanation.
Target length: 600-900 words.`;
}

function markdownToSimpleHtml(md: string): string {
    return md
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/^(?!<[h|u|l])/gm, '')
        .replace(/(<\/h[1-6]>|<\/ul>)(<p>)/g, '$1$2')
        .replace(/^(.+)$/gm, (line) => line.startsWith('<') ? line : `<p>${line}</p>`);
}

async function callProvider(config: ProviderConfig, provider: string, prompt: string): Promise<{text: string; model: string}> {
    if (provider === 'openai' && config.openaiKey) {
        const model = config.openaiModel || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST', signal: AbortSignal.timeout(120000),
            headers: {'Authorization': `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({model, max_tokens: 2048, messages: [{role: 'user', content: prompt}]}),
        });
        if (!res.ok) throw new Error(`OpenAI article draft failed: HTTP ${res.status}`);
        const data = await res.json() as {choices?: {message?: {content?: string}}[]; model?: string};
        return {text: data.choices?.[0]?.message?.content ?? '', model: data.model ?? model};
    }
    if (provider === 'claude' && config.claudeKey) {
        const model = config.claudeModel || 'claude-opus-4-5-20251101';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', signal: AbortSignal.timeout(120000),
            headers: {'x-api-key': config.claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'},
            body: JSON.stringify({model, max_tokens: 2048, messages: [{role: 'user', content: prompt}]}),
        });
        if (!res.ok) throw new Error(`Claude article draft failed: HTTP ${res.status}`);
        const data = await res.json() as {content?: {type?: string; text?: string}[]; model?: string};
        return {text: data.content?.find(b => b.type === 'text')?.text ?? '', model: data.model ?? model};
    }
    if (provider === 'gemini' && config.geminiKey) {
        const model = config.geminiModel || 'gemini-2.0-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.geminiKey)}`, {
            method: 'POST', signal: AbortSignal.timeout(120000),
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({contents: [{parts: [{text: prompt}]}], generationConfig: {maxOutputTokens: 2048}}),
        });
        if (!res.ok) throw new Error(`Gemini article draft failed: HTTP ${res.status}`);
        const data = await res.json() as {candidates?: {content?: {parts?: {text?: string}[]}}[]; modelVersion?: string};
        return {text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '', model: data.modelVersion ?? model};
    }
    throw new Error(`Provider "${provider}" is not configured. Add its API key to .env.`);
}

export class ArticleDraftService {
    constructor(private config: ProviderConfig) {}

    async generate(client: Client, audit: Audit, brief: ContentBrief | null, provider: string): Promise<ArticleDraft> {
        const prompt = buildArticlePrompt(client, audit, brief);
        const {text: markdown, model} = await callProvider(this.config, provider, prompt);

        if (!markdown.trim()) throw new Error('AI returned empty article draft. Try again or switch provider.');

        const words = markdown.split(/\s+/).filter(Boolean).length;
        const html = markdownToSimpleHtml(markdown);

        // Score the generated article with RGPS
        const rgpsHtml = html;
        const rgpsText = rgpsExtractText(rgpsHtml);
        const ymyl = isYmyl(client.domain, rgpsText);
        const rgpsScore = scorePassage(rgpsHtml, ymyl);

        return {
            clientName: client.name,
            pageUrl: audit.url,
            generatedAt: new Date().toISOString(),
            model,
            provider,
            wordCount: words,
            markdown,
            html,
            rgpsScore,
            rgpsVersion: RGPS_VERSION,
        };
    }
}
