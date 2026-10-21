import {CollectionError} from '../core/contracts';
import type {AIProvider, Client, ProbeResult, ProbeRun} from '../core/contracts';
import {mentionsBrand} from '../core/brand-matching';

/** Current month's ISO prefix e.g. "2025-07" */
function currentMonthPrefix(): string {
    return new Date().toISOString().slice(0, 7);
}

// ── Retry helper (ops-3) ──────────────────────────────────────────────────────
/** Exponential back-off retry for rate-limit / transient errors (429 / 502).
 *  Max 2 retries: waits 1 s then 2 s before each attempt. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const delays = [1000, 2000];
    let lastErr: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastErr = err;
            const status = (err as CollectionError).status ?? 0;
            // Only retry on retryable provider errors
            if (status !== 429 && status !== 502) throw err;
            if (attempt < delays.length) {
                await new Promise(r => setTimeout(r, delays[attempt]));
            }
        }
    }
    throw lastErr;
}

function probeSentiment(text: string, brandName: string): {sentiment: ProbeResult['sentiment']; reason: string} {
    const t = text.toLowerCase();
    const brandLc = brandName.toLowerCase();
    if (!text.includes(brandLc) && !text.toLowerCase().includes(brandLc)) return {sentiment:'absent', reason:'Brand not mentioned'};
    const positiveTerms = ['leading','best','top','recommended','trusted','excellent','strong','innovative','popular','preferred','award','recognized','market leader'];
    const negativeTerms = ['avoid','poor','bad','unreliable','expensive','slow','difficult','complex','limited','lacks','outperformed','inferior','worse','negative','controversial'];
    const positiveCount = positiveTerms.filter(t2 => t.includes(t2)).length;
    const negativeCount = negativeTerms.filter(t2 => t.includes(t2)).length;
    if (negativeCount > positiveCount) return {sentiment:'negative', reason:`Negative terms: ${negativeTerms.filter(t2 => t.includes(t2)).join(', ')}`};
    if (positiveCount > 0) return {sentiment:'positive', reason:`Positive terms: ${positiveTerms.filter(t2 => t.includes(t2)).join(', ')}`};
    return {sentiment:'neutral', reason:'Brand mentioned without strong sentiment signals'};
}

function extractCitingDomains(citations: string[]): string[] {
    return citations.map(u => {try {return new URL(u).hostname.replace(/^www\./,'');} catch {return '';}}).filter(Boolean);
}

export class ProbeRunner {
    constructor(private providers: Map<string, AIProvider>) {}

    async runProbes(client: Client, prompts: string[], providerIds: string[], priorRuns: ProbeRun[] = []): Promise<ProbeRun> {
        // Budget cap check (ops-6 / cst-2)
        if (client.monthlyBudgetUsd != null && client.monthlyBudgetUsd > 0) {
            const prefix = currentMonthPrefix();
            const monthCost = priorRuns
                .filter(r => r.created.startsWith(prefix))
                .reduce((s, r) => s + (r.totalEstimatedCostUsd ?? 0), 0);
            if (monthCost >= client.monthlyBudgetUsd) {
                throw new CollectionError(
                    `Monthly AI spend cap of $${client.monthlyBudgetUsd.toFixed(2)} reached ($${monthCost.toFixed(4)} used this month). ` +
                    `Increase the budget in client settings or wait until next month.`,
                    402
                );
            }
        }
        const hostname = new URL(client.domain).hostname.replace(/^www\./,'');
        const engines = providerIds.filter(id => this.providers.has(id));

        // Run all prompt×engine combinations in parallel
        const tasks: Array<{prompt: string; engineId: string}> = [];
        for (const prompt of prompts) for (const engineId of engines) tasks.push({prompt, engineId});

        const results: ProbeResult[] = await Promise.all(tasks.map(async ({prompt, engineId}) => {
            const provider = this.providers.get(engineId)!;
            try {
                const obs = await withRetry(() => provider.observe(prompt, client.market));
                const brandMentioned = mentionsBrand(client, obs.response);
                const citesClientDomain = obs.citations.some(u => {
                    try {const h = new URL(u).hostname.replace(/^www\./,''); return h === hostname || h.endsWith('.'+hostname);} catch {return false;}
                });
                const {sentiment, reason} = probeSentiment(obs.response, client.name);
                const competitorsMentioned = (client.competitors||[]).filter(comp =>
                    obs.response.toLowerCase().includes(comp.toLowerCase())
                );
                return {
                    engine: engineId, model: obs.model, prompt, response: obs.response,
                    brandMentioned, sentiment, sentimentReason: reason, citations: obs.citations,
                    citesClientDomain, competitorsMentioned, probedAt: new Date().toISOString(),
                    tokenCount: obs.tokenCount, estimatedCostUsd: obs.estimatedCostUsd,
                };
            } catch {
                return {
                    engine: engineId, model: engineId, prompt,
                    response: '', brandMentioned: false, sentiment: 'absent' as const,
                    sentimentReason: 'Provider error — no response', citations: [],
                    citesClientDomain: false, competitorsMentioned: [], probedAt: new Date().toISOString(),
                };
            }
        }));

        // Aggregate KPIs
        const withResponse = results.filter(r => r.response.length > 0);
        const sample = withResponse.length || results.length;
        const mentionRate = sample ? Math.round(results.filter(r => r.brandMentioned).length / sample * 100) : null;
        const citationRate = sample ? Math.round(results.filter(r => r.citesClientDomain).length / sample * 100) : null;

        const sentimentBreakdown = {
            positive: results.filter(r => r.sentiment === 'positive').length,
            neutral: results.filter(r => r.sentiment === 'neutral').length,
            negative: results.filter(r => r.sentiment === 'negative').length,
            absent: results.filter(r => r.sentiment === 'absent').length,
        };

        // Share of voice: brand mention rate vs each competitor
        const shareOfVoice = (client.competitors||[]).map(comp => {
            const compMentions = results.filter(r => r.competitorsMentioned.includes(comp)).length;
            return {competitor: comp, mentionRate: sample ? Math.round(compMentions / sample * 100) : 0};
        });

        // Top citing domains across all responses
        const domainCounts: Record<string, number> = {};
        for (const r of results) for (const d of extractCitingDomains(r.citations)) {
            domainCounts[d] = (domainCounts[d] ?? 0) + 1;
        }
        const citingSources = Object.entries(domainCounts)
            .sort((a,b) => b[1]-a[1]).slice(0, 10)
            .map(([domain, count]) => ({domain, count}));

        const totalTokens = results.reduce((n, r) => n + (r.tokenCount ?? 0), 0) || undefined;
        const totalEstimatedCostUsd = results.reduce((n, r) => n + (r.estimatedCostUsd ?? 0), 0) || undefined;

        const failedCount = results.filter(r => !r.response).length || undefined;
        const failureRate = tasks.length ? Math.round((results.filter(r => !r.response).length / tasks.length) * 100) : undefined;

        // Per-engine cost breakdown
        const engineCostMap: Record<string, {tokens: number; cost: number}> = {};
        for (const r of results) {
            if (!engineCostMap[r.engine]) engineCostMap[r.engine] = {tokens: 0, cost: 0};
            engineCostMap[r.engine].tokens += r.tokenCount ?? 0;
            engineCostMap[r.engine].cost += r.estimatedCostUsd ?? 0;
        }
        const costByEngine = Object.entries(engineCostMap)
            .filter(([, v]) => v.tokens > 0)
            .map(([engine, v]) => ({engine, tokens: v.tokens, estimatedCostUsd: v.cost}));

        return {
            id: crypto.randomUUID(),
            clientId: client.id,
            created: new Date().toISOString(),
            prompts,
            results,
            mentionRate,
            citationRate,
            sentimentBreakdown,
            shareOfVoice,
            citingSources,
            engines,
            totalTokens,
            totalEstimatedCostUsd,
            failedCount,
            failureRate,
            costByEngine: costByEngine.length ? costByEngine : undefined,
        };
    }
}
