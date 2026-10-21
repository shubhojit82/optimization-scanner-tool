"use client";
import type { Audit, Client, Observation, ProbeRun } from '../src/core/contracts';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';

type Props = {
    client: Client;
    audits: Audit[];
    observations: Observation[];
};

// ── helpers ─────────────────────────────────────────────────────────────────

function scoreGrade(s: number | null): { grade: string; color: string; bg: string } {
    if (s === null) return { grade: 'N/A', color: '#57606a', bg: '#f0f2f5' };
    if (s >= 80) return { grade: 'A', color: '#15803d', bg: '#dcfce7' };
    if (s >= 65) return { grade: 'B', color: '#0369a1', bg: '#e0f2fe' };
    if (s >= 45) return { grade: 'C', color: '#b45309', bg: '#fef3c7' };
    if (s >= 25) return { grade: 'D', color: '#b91c1c', bg: '#fee2e2' };
    return { grade: 'F', color: '#7f1d1d', bg: '#fee2e2' };
}

function projectedScore(current: number | null, dims: Audit['dimensions']): number | null {
    if (current === null) return null;
    // Find all low-effort fixable gaps (weight > 0, score < 100, id in quick-win set)
    const QUICK: Record<string, number> = { technical: 10, entity: 15, evidence: 15, query: 10, freshness: 5, 'reasoning-cues': 4, 'passage-density': 4, 'best-practices': 0 };
    let gain = 0;
    for (const d of dims) {
        if (d.score === null || d.score >= 100 || !QUICK[d.id]) continue;
        // Assume fixing to 80
        const projected = Math.max(d.score, 80);
        gain += (projected - d.score) * d.weight / 100;
    }
    return Math.min(100, Math.round(current + gain));
}

const PILLAR_MAP: Record<string, { pillar: string; desc: string }> = {
    'crawl':           { pillar: 'AI Visibility', desc: 'Crawler and bot access' },
    'technical':       { pillar: 'Technical AI Optimization', desc: 'Page structure signals' },
    'schema':          { pillar: 'Technical AI Optimization', desc: 'Structured data completeness' },
    'freshness':       { pillar: 'Technical AI Optimization', desc: 'Content freshness signals' },
    'content':         { pillar: 'Content Analysis', desc: 'Answer structure quality' },
    'entity':          { pillar: 'Content Analysis', desc: 'Brand clarity in text' },
    'evidence':        { pillar: 'Content Analysis', desc: 'Authoritative citations' },
    'query':           { pillar: 'Content Analysis', desc: 'Query-ready headings' },
    'reasoning-cues':  { pillar: 'Content Analysis', desc: 'LLM reasoning signals' },
    'passage-density': { pillar: 'Content Analysis', desc: 'Passage extraction density' },
    'entity-links':    { pillar: 'Sentiment & Reputation', desc: 'Entity authority links' },
    'measurement':     { pillar: 'AI-era KPIs', desc: 'AI observation coverage' },
    'authority':       { pillar: 'AI-era KPIs', desc: 'External authority signals' },
};

const PILLAR_COLOR: Record<string, string> = {
    'AI Visibility': '#3b82d4',
    'Sentiment & Reputation': '#7c5cd8',
    'Content Analysis': '#0d8073',
    'Technical AI Optimization': '#b45309',
    'AI-era KPIs': '#db2777',
};

// ── components ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80, color }: { score: number | null; size?: number; color: string }) {
    const v = score ?? 0;
    const r = size / 2 - 6;
    const circ = 2 * Math.PI * r;
    const cx = size / 2;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={color}
                strokeWidth={6}
                strokeDasharray={`${circ * v / 100} ${circ * (1 - v / 100)}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cx})`} />
            <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
                fontSize={score === null ? 9 : size > 70 ? 18 : 13}
                fontWeight={700} fill={score === null ? '#9ca3af' : '#1f2328'}>
                {score === null ? 'N/A' : score}
            </text>
        </svg>
    );
}

function TrendArrow({ current, previous }: { current: number | null; previous: number | null }) {
    if (current === null || previous === null) return null;
    const diff = current - previous;
    if (diff === 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#57606a' }}><Minus size={10} /> No change</span>;
    const up = diff > 0;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: up ? '#15803d' : '#b91c1c' }}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {up ? '+' : ''}{diff} pts vs prev
        </span>
    );
}

// ── main panel ────────────────────────────────────────────────────────────────

export function ExecSummaryPanel({ client, audits, observations }: Props) {
    const [latestRun, setLatestRun] = useState<ProbeRun | null>(null);
    const [exporting, setExporting] = useState(false);

    async function exportPdf() {
        setExporting(true);
        try {
            const r = await fetch(`/api/v1/exec-summary/${encodeURIComponent(client.id)}`);
            if (!r.ok) throw new Error((await r.json() as { error?: string }).error || 'Export failed');
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const w = window.open(url, '_blank');
            // Allow the tab to load then revoke
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            if (!w) {
                // Fallback: download the file
                const a = document.createElement('a');
                a.href = url; a.download = `geo-exec-summary-${client.name.toLowerCase().replace(/\s+/g, '-')}.html`; a.click();
            }
        } catch (e) {
            alert((e as Error).message);
        } finally {
            setExporting(false);
        }
    }

    const audit = audits[0] ?? null;
    const prevAudit = audits[1] ?? null;

    useEffect(() => {
        if (!client.id || client.id === 'demo') return;
        fetch(`/api/v1/probe-history/${encodeURIComponent(client.id)}`)
            .then(r => r.ok ? r.json() : null)
            .then((runs: ProbeRun[] | null) => { if (runs?.[0]) setLatestRun(runs[0]); })
            .catch(() => {});
    }, [client.id]);

    if (!audit) {
        return (
            <section className="panel">
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#57606a' }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#213f50', marginBottom: 8 }}>No audit data yet</p>
                    <p style={{ fontSize: '.88rem' }}>Import a page or run a scan to generate the executive summary for <strong>{client.name}</strong>.</p>
                </div>
            </section>
        );
    }

    const { seoScore, aeoScore, geoScore } = audit.subScores ?? {};
    const projected = projectedScore(audit.score, audit.dimensions);
    const uplift = projected !== null && audit.score !== null ? projected - audit.score : null;

    // Top 3 priority actions by weighted gap
    const topActions = audit.dimensions
        .filter(d => d.score !== null && d.score < 100 && d.weight > 0)
        .map(d => ({ ...d, gap: Math.round(d.weight * (100 - d.score!) / 100) }))
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 3);


    const assessedDate = new Date(audit.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Header banner ── */}
            <section className="panel" style={{ background: '#0f3b52', color: '#fff', border: 'none' }}>
                <div style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: '#78ddc6', textTransform: 'uppercase', marginBottom: 8 }}>
                                GEO Readiness Assessment
                            </div>
                            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>{client.name}</h1>
                            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#92ded0' }}>
                                {client.domain.replace('https://', '')} · {client.industry} · {client.market}
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6ab8ab' }}>Assessed {assessedDate} · Rubric {audit.version}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                                <ScoreRing score={audit.score} size={90} color="#57e3c2" />
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#78ddc6', marginTop: 4, letterSpacing: '.06em' }}>OVERALL</div>
                            </div>
                            {uplift !== null && uplift > 0 && (
                                <div style={{ textAlign: 'center', opacity: .85 }}>
                                    <div style={{ fontSize: 32, fontWeight: 800, color: '#57e3c2', lineHeight: 1 }}>+{uplift}</div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#78ddc6', marginTop: 4, letterSpacing: '.06em' }}>PTS UPLIFT</div>
                                    <div style={{ fontSize: 10, color: '#6ab8ab', marginTop: 2 }}>with quick wins</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Export button row ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: -8 }}>
                <button
                    className="secondary"
                    style={{ gap: 6, fontSize: 12 }}
                    onClick={exportPdf}
                    disabled={exporting || client.id === 'demo'}
                    title={client.id === 'demo' ? 'Create a real client to export' : 'Opens print-ready HTML in a new tab — use browser Print → Save as PDF'}
                >
                    <Download size={13} />
                    {exporting ? 'Generating…' : 'Export PDF-ready report'}
                </button>
            </div>

            {/* ── Three pillars row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {([
                    { label: 'SEO', score: seoScore ?? null, color: '#3b82d4', desc: 'Crawlability, structure & schema' },
                    { label: 'AEO', score: aeoScore ?? null, color: '#7c5cd8', desc: 'Answer-engine content signals' },
                    { label: 'GEO', score: geoScore ?? null, color: '#0d8073', desc: 'AI visibility & brand mentions' },
                ] as const).map(({ label, score, color, desc }) => {
                    const { grade, bg } = scoreGrade(score);
                    const prevScore = prevAudit ? (label === 'SEO' ? prevAudit.subScores?.seoScore : label === 'AEO' ? prevAudit.subScores?.aeoScore : prevAudit.subScores?.geoScore) ?? null : null;
                    const isUnmeasured = score === null;
                    return (
                        <div key={label} style={{ background: '#fff', border: `1px solid ${isUnmeasured ? '#e5e7eb' : '#e0e7ed'}`, borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: isUnmeasured ? '#9ca3af' : color, textTransform: 'uppercase' }}>{label}</div>
                                    <div style={{ fontSize: 12, color: '#57606a', marginTop: 2 }}>{desc}</div>
                                </div>
                                {!isUnmeasured && <span style={{ fontSize: 20, fontWeight: 800, color, background: bg, borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{grade}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <ScoreRing score={score} size={56} color={isUnmeasured ? '#d1d5db' : color} />
                                <div>
                                    {isUnmeasured ? (
                                        <div style={{ fontSize: 12, color: '#8b9aa6', lineHeight: 1.5 }}>
                                            Not yet measured
                                            {label === 'GEO' && <div style={{ marginTop: 3, fontSize: 11, color: '#3b82d4' }}>→ Run AI Visibility probe</div>}
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#213f50', lineHeight: 1 }}>{score}<span style={{ fontSize: 13, fontWeight: 400, color: '#8b9aa6' }}>/100</span></div>
                                            <TrendArrow current={score} previous={prevScore} />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── AI visibility KPIs (from probe history) ── */}
            {latestRun && (
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Live AI Visibility KPIs</h2>
                            <p>From most recent probe run · {new Date(latestRun.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {latestRun.engines.join(', ')}</p>
                        </div>
                    </div>
                    <div style={{ padding: '8px 24px 20px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        {((): {label: string; value: number | null; suffix: string; color: string; desc: string}[] => {
                            const totalResponses = latestRun.results.length;
                            // Share of Voice: client mention rate vs top competitor
                            const topCompetitorRate = latestRun.shareOfVoice.length
                                ? Math.max(...latestRun.shareOfVoice.map(sv => sv.mentionRate))
                                : null;
                            const sov = topCompetitorRate !== null && latestRun.mentionRate !== null
                                ? latestRun.mentionRate - topCompetitorRate  // positive = ahead, negative = behind
                                : null;
                            return [
                                { label: 'Brand Mention Rate', value: latestRun.mentionRate, suffix: '%', color: '#3b82d4', desc: '% of prompts where AI mentioned the brand' },
                                { label: 'Domain Citation Rate', value: latestRun.citationRate, suffix: '%', color: '#7c5cd8', desc: '% of prompts where your domain was cited' },
                                { label: 'Positive Sentiment', value: totalResponses ? Math.round(latestRun.sentimentBreakdown.positive / totalResponses * 100) : null, suffix: '%', color: '#15803d', desc: 'Share of responses with positive framing' },
                                { label: 'Share of Voice vs #1 Competitor', value: sov, suffix: ' pts', color: sov !== null && sov >= 0 ? '#0d8073' : '#dc2626', desc: sov !== null ? (sov >= 0 ? `Ahead of top competitor by ${sov} pts` : `Behind top competitor by ${Math.abs(sov)} pts`) : 'No competitors configured' },
                            ];
                        })().map(kpi => (
                            <div key={kpi.label} style={{ flex: '1 1 160px', background: '#f7f8fa', borderRadius: 9, padding: '14px 16px', borderTop: `3px solid ${kpi.color}` }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: kpi.value === null ? '#9ca3af' : kpi.color, lineHeight: 1 }}>
                                    {kpi.value === null ? '—' : `${kpi.value}${kpi.suffix}`}
                                </div>
                                <div style={{ fontSize: 11, color: '#57606a', marginTop: 4 }}>{kpi.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── GEO readiness pillars ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>GEO Readiness Pillars</h2><p>Score contribution per GEO readiness framework pillar — all 5 pillars shown; unmeasured pillars shown with dashes</p></div>
                </div>
                <div style={{ padding: '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(['AI Visibility', 'Technical AI Optimization', 'Content Analysis', 'Sentiment & Reputation', 'AI-era KPIs'] as const).map(pillar => {
                        const color = PILLAR_COLOR[pillar] ?? '#57606a';
                        // Also collect dims that are null (not yet assessed)
                        const allDimsForPillar = audit.dimensions.filter(d => PILLAR_MAP[d.id]?.pillar === pillar);
                        const assessed = allDimsForPillar.filter(d => d.score !== null);
                        const avg = assessed.length ? Math.round(assessed.reduce((n, d) => n + d.score!, 0) / assessed.length) : null;
                        const dimNames = allDimsForPillar.map(d => d.name);
                        return (
                            <div key={pillar}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: 13, fontWeight: 650, color: '#213f50' }}>{pillar}</span>
                                        <span style={{ fontSize: 11, color: '#8b9aa6', marginLeft: 8 }}>{dimNames.join(' · ')}</span>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: avg === null ? '#9ca3af' : color, minWidth: 44, textAlign: 'right' }}>
                                        {avg === null ? '—' : avg}
                                    </span>
                                </div>
                                <div style={{ height: 8, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden' }}>
                                    {avg !== null
                                        ? <div style={{ height: '100%', width: `${avg}%`, background: color, borderRadius: 4, transition: 'width .5s ease' }} />
                                        : <div style={{ height: '100%', width: '100%', background: 'repeating-linear-gradient(90deg,#e5e7eb 0,#e5e7eb 6px,transparent 6px,transparent 12px)' }} />
                                    }
                                </div>
                                {avg === null && (
                                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                                        {pillar === 'AI-era KPIs' ? 'Requires AI visibility probe runs' : 'Not assessable from HTML — requires live data'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Top 3 priority actions ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Top 3 Priority Recommendations</h2><p>Highest weighted-impact actions — present these to the client as immediate next steps</p></div>
                </div>
                <div style={{ padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {topActions.map((d, i) => {
                        const pillar = PILLAR_MAP[d.id]?.pillar ?? 'Content Analysis';
                        const pillarColor = PILLAR_COLOR[pillar] ?? '#57606a';
                        return (
                            <div key={d.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', background: i === 0 ? '#f0fdf4' : '#fafbfc', borderRadius: 9, border: `1px solid ${i === 0 ? '#bbf7d0' : '#e5e7eb'}` }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? '#15803d' : '#e5e7eb', color: i === 0 ? '#fff' : '#57606a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '.92rem', color: '#213f50' }}>{d.name}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: pillarColor, color: '#fff' }}>{pillar}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>+{d.gap} pts</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '.83rem', color: '#374151', lineHeight: 1.6 }}>{d.action}</p>
                                    <div style={{ marginTop: 6, fontSize: 11, color: '#8b9aa6' }}>Current score: {d.score}/100 · Weight: {d.weight}%</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Full dimension table ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Full Dimension Scorecard</h2><p>All rubric dimensions with scores, weights, and gap analysis</p></div>
                    <button className="secondary" style={{ gap: 6, fontSize: 12 }}
                        onClick={() => {
                            const rows = audit.dimensions.map(d => [d.name, d.score === null ? 'N/A' : String(d.score), String(d.weight) + '%', PILLAR_MAP[d.id]?.pillar ?? '', d.action].join('\t')).join('\n');
                            const header = ['Dimension', 'Score', 'Weight', 'Pillar', 'Recommended Action'].join('\t');
                            const blob = new Blob([header + '\n' + rows], { type: 'text/plain' });
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                            a.download = `geo-scorecard-${client.name.toLowerCase().replace(/\s+/g, '-')}.tsv`; a.click();
                        }}>
                        <Download size={13} /> Export TSV
                    </button>
                </div>
                <div style={{ padding: '0 0 8px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: '#f7f8fa', borderBottom: '2px solid #e5e7eb' }}>
                                {['Dimension', 'Pillar', 'Score', 'Grade', 'Weight', 'Gap', 'Action'].map(h => (
                                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#8b9aa6', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {audit.dimensions.filter(d => d.weight > 0).map((d, i) => {
                                const { grade, color, bg } = scoreGrade(d.score);
                                const gap = d.score !== null ? Math.round(d.weight * (100 - d.score) / 100) : 0;
                                const pillar = PILLAR_MAP[d.id]?.pillar ?? '';
                                return (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #f0f2f5', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#213f50' }}>{d.name}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            {pillar && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: (PILLAR_COLOR[pillar] ?? '#57606a') + '18', color: PILLAR_COLOR[pillar] ?? '#57606a' }}>{pillar}</span>}
                                        </td>
                                        <td style={{ padding: '10px 16px', fontWeight: 700, color: d.score === null ? '#9ca3af' : color }}>{d.score === null ? 'N/A' : d.score}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: bg, color }}>{grade}</span>
                                        </td>
                                        <td style={{ padding: '10px 16px', color: '#57606a' }}>{d.weight}%</td>
                                        <td style={{ padding: '10px 16px', fontWeight: gap > 5 ? 700 : 400, color: gap > 10 ? '#b91c1c' : gap > 4 ? '#b45309' : '#57606a' }}>{d.score !== null ? `+${gap}` : '—'}</td>
                                        <td style={{ padding: '10px 16px', color: '#57606a', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.action}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Footer note ── */}
            <div style={{ fontSize: 11, color: '#8b9aa6', lineHeight: 1.6, padding: '4px 0 8px' }}>
                Assessment based on page-level HTML analysis · Rubric {audit.version} · {audit.coverage}% rubric coverage · Generated {assessedDate}.
                Scores reflect implementation cues only — not a ranking guarantee. Live AI visibility requires probe runs from the AI Visibility tab.
            </div>
        </div>
    );
}
