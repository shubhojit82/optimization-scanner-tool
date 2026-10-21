import type {Audit, Finding, FindingSeverity} from '../core/contracts';

// Map dimension score to severity
function severity(score: number | null, weight: number): FindingSeverity {
    if (score === null) return 'info';
    const gap = 100 - score;
    if (gap === 0) return 'info';
    if (weight >= 10 && gap >= 80) return 'critical';
    if (weight >= 10 && gap >= 50) return 'high';
    if (gap >= 70) return 'high';
    if (gap >= 40) return 'medium';
    return 'low';
}

// Dimensions that are never actionable as standalone findings
const SKIP_DIM = new Set(['freshness', 'authority', 'measurement']);

/**
 * Derive a list of open Findings from an audit's dimension gaps.
 * Only creates findings for dimensions with a measurable score < 100.
 * Skips dimensions that require external data (freshness, authority, measurement).
 */
export function deriveFindings(audit: Audit, clientId: string): Finding[] {
    const now = new Date().toISOString();
    const findings: Finding[] = [];

    for (const dim of audit.dimensions) {
        if (SKIP_DIM.has(dim.id)) continue;
        if (dim.score === null) continue;
        if (dim.score >= 100) continue; // nothing to fix

        const sev = severity(dim.score, dim.weight);
        const missing = dim.details?.missing ?? [];

        findings.push({
            id: crypto.randomUUID(),
            clientId,
            auditId: audit.id,
            url: audit.url,
            dimensionId: dim.id,
            dimensionName: dim.name,
            severity: sev,
            title: `${dim.name} — score ${dim.score}/100`,
            evidence: dim.evidence,
            action: dim.action,
            missing,
            status: 'open',
            scoreBefore: dim.score,
            created: now,
            updated: now,
        });
    }

    // Sort: critical → high → medium → low
    const order: Record<FindingSeverity, number> = {critical:0, high:1, medium:2, low:3, info:4};
    return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Auto-generate a recommendation proposal string from a finding.
 * This is a deterministic fallback — the AI content brief generates richer proposals.
 */
export function proposalFromFinding(f: Finding): string {
    if (f.missing.length) {
        return `Fix ${f.dimensionName}: ${f.missing.slice(0, 3).join('; ')}.`;
    }
    return f.action;
}

/** Map dimension ID to the team most likely responsible */
export function ownerFromDimension(dimensionId: string): string {
    const map: Record<string, string> = {
        crawl: 'engineering',
        technical: 'engineering',
        schema: 'engineering',
        entity: 'content',
        content: 'content',
        evidence: 'content',
        query: 'content',
        'reasoning-cues': 'content',
        'passage-density': 'content',
        'entity-links': 'seo',
        accessibility: 'engineering',
    };
    return map[dimensionId] ?? 'content';
}
