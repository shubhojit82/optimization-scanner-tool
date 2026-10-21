"use client";
import { useEffect, useState } from 'react';
import { BarChart2, Globe, Plus, Trash2, X, TrendingUp, Award, Zap, ChevronDown, ChevronUp, ExternalLink, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { Client, CompetitorScanResult, ProbeRun } from '../src/core/contracts';
import { api } from './workbench-api';

type Props = {
    client: Client;
    busy: boolean;
    onBusy: (b: boolean) => void;
};

function ScoreBar({ value, max = 100, color }: { value: number | null; max?: number; color: string }) {
    const pct = value === null ? 0 : Math.round((value / max) * 100);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 4, transition: 'width .4s ease' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{value === null ? '—' : value}</span>
        </div>
    );
}

function scoreColor(score: number | null) {
    if (score === null) return '#9ca3af';
    if (score >= 70) return '#15803d';
    if (score >= 40) return '#d97706';
    return '#dc2626';
}

// ── Empty-state illustration ────────────────────────────────────────────────
function CompetitorEmptyState({ urlCount }: { urlCount: number }) {
    const bars = [
        { label: 'You', height: 72, color: '#4f6ef7', x: 40 },
        { label: 'Comp A', height: 54, color: '#e5e7eb', x: 100 },
        { label: 'Comp B', height: 88, color: '#e5e7eb', x: 160 },
        { label: 'Comp C', height: 40, color: '#e5e7eb', x: 220 },
    ];
    return (
        <div style={{
            background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
            border: '1px solid #e4e6ef',
            borderRadius: 10,
            padding: '36px 32px',
            display: 'flex',
            gap: 48,
            alignItems: 'center',
            flexWrap: 'wrap',
        }}>
            {/* SVG bar chart illustration */}
            <div style={{ flexShrink: 0 }}>
                <svg width={290} height={140} viewBox="0 0 290 140" aria-hidden="true">
                    {/* Grid lines */}
                    {[0, 33, 66, 100].map(pct => {
                        const y = 10 + (100 - pct) * 0.9;
                        return (
                            <g key={pct}>
                                <line x1={28} y1={y} x2={272} y2={y} stroke="#e4e6ef" strokeWidth={1} strokeDasharray={pct === 0 ? 'none' : '3 3'} />
                                <text x={22} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{pct}</text>
                            </g>
                        );
                    })}
                    {/* Bars */}
                    {bars.map(b => (
                        <g key={b.label}>
                            <rect
                                x={b.x} y={10 + (100 - b.height) * 0.9}
                                width={36} height={b.height * 0.9}
                                rx={4} fill={b.color}
                                opacity={b.color === '#e5e7eb' ? 1 : 1}
                            />
                            <text x={b.x + 18} y={128} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={b.label === 'You' ? 700 : 400}>{b.label}</text>
                        </g>
                    ))}
                    {/* "You" label */}
                    <text x={58} y={10 + (100 - 72) * 0.9 - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#4f6ef7">72</text>
                    {/* Dotted baseline for "You" */}
                    <line x1={28} y1={10 + (100 - 72) * 0.9} x2={272} y2={10 + (100 - 72) * 0.9} stroke="#4f6ef7" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />
                </svg>
                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Illustrative only — run a comparison to see real scores</p>
            </div>

            {/* Explainer text */}
            <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 10 }}>
                    How competitor comparison works
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                        { icon: <Globe size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Scan competitor pages', text: 'Each URL is fetched and scored against the same GEO rubric as your own audits.' },
                        { icon: <BarChart2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'SEO · AEO · GEO side-by-side', text: 'Overall score plus sub-scores for Search, Answer Engine, and Generative Engine readiness.' },
                        { icon: <TrendingUp size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Gap analysis', text: 'Top missing cues per competitor — focus on where rivals outrank you to reclaim AI citations.' },
                    ].map(item => (
                        <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {item.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1d2e' }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{item.text}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: 18, padding: '10px 14px', background: '#fff', border: '1px solid #e4e6ef', borderRadius: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                    <strong style={{ color: '#4f6ef7' }}>{urlCount} URL{urlCount !== 1 ? 's' : ''} ready.</strong>{' '}
                    Hit <strong>Run Comparison</strong> to fetch and score each one. Results typically take 10–30 seconds per URL.
                </div>
            </div>
        </div>
    );
}

export function CompetitorPanel({ client, busy, onBusy }: Props) {
    const [urls, setUrls] = useState<string[]>(client.competitors.length ? client.competitors.map(c => {
        try { return 'https://' + c.toLowerCase().replace(/\s+/g, '') + '.com'; } catch { return ''; }
    }).filter(Boolean) : ['']);
    const [results, setResults] = useState<CompetitorScanResult[] | null>(null);
    const [clientResult, setClientResult] = useState<CompetitorScanResult | null>(null);
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);
    const [probeHistory, setProbeHistory] = useState<ProbeRun[]>([]);

    // Load probe history for visibility trend (cmp-5)
    useEffect(() => {
        if (!client.id || client.id === 'demo') return;
        fetch(`/api/v1/probe-history/${encodeURIComponent(client.id)}`, {
            headers: { 'Accept': 'application/json' },
        })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((runs: ProbeRun[]) => setProbeHistory(runs))
            .catch(() => {});
    }, [client.id]);

    function setUrl(i: number, val: string) { setUrls(u => u.map((v, j) => j === i ? val : v)); }
    function addUrl() { if (urls.length < 5) setUrls(u => [...u, '']); }
    function removeUrl(i: number) { setUrls(u => u.filter((_, j) => j !== i)); }

    async function runScan() {
        const validUrls = urls.map(u => u.trim()).filter(u => u.startsWith('http'));
        if (!validUrls.length) { setError('Enter at least one competitor URL.'); return; }
        setError('');
        onBusy(true);
        setScanning(true);
        try {
            const [compResults, clientScan] = await Promise.all([
                api<CompetitorScanResult[]>('competitors', { competitorUrls: validUrls, clientId: client.id }),
                api<CompetitorScanResult[]>('competitors', { competitorUrls: [client.domain], clientId: client.id }),
            ]);
            setResults(compResults);
            setClientResult(clientScan[0] ?? null);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            onBusy(false);
            setScanning(false);
        }
    }

    const allResults: (CompetitorScanResult & { isClient?: boolean })[] = [
        ...(clientResult ? [{ ...clientResult, name: client.name + ' (you)', isClient: true }] : []),
        ...(results ?? []),
    ].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const validUrlCount = urls.filter(u => u.trim().startsWith('http')).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── URL input panel ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Competitor GEO Comparison</h2>
                        <p>Scan competitor URLs and compare SEO / AEO / GEO scores side-by-side.</p>
                    </div>
                    <BarChart2 size={19} color="var(--text-secondary)" />
                </div>

                <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* URL inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {urls.map((u, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                                    <Globe size={14} color="#9ca3af" style={{ position: 'absolute', left: 11, pointerEvents: 'none' }} />
                                    <input
                                        type="url"
                                        placeholder="https://competitor.com"
                                        value={u}
                                        onChange={e => setUrl(i, e.target.value)}
                                        aria-label={`Competitor URL ${i + 1}`}
                                        style={{
                                            flex: 1, fontFamily: 'inherit', fontSize: 14,
                                            padding: '9px 12px 9px 32px',
                                            border: '1.5px solid #e4e6ef', borderRadius: 8,
                                            background: '#fafafa', color: '#1a1d2e',
                                            outline: 'none', transition: 'border-color .15s',
                                        }}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#4f6ef7')}
                                        onBlur={e => (e.currentTarget.style.borderColor = '#e4e6ef')}
                                    />
                                </div>
                                <button
                                    className="secondary"
                                    onClick={() => removeUrl(i)}
                                    disabled={urls.length <= 1}
                                    title="Remove URL"
                                    aria-label={`Remove competitor URL ${i + 1}`}
                                    style={{ padding: '9px 11px', borderRadius: 8 }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Action row */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="secondary" onClick={addUrl} disabled={urls.length >= 5}>
                            <Plus size={15} /> Add URL
                        </button>
                        <button className="primary" onClick={runScan} disabled={busy || scanning}>
                            {scanning
                                ? <><Globe size={15} style={{ animation: 'spin 1s linear infinite' }} />Scanning…</>
                                : <><Globe size={15} />Run Comparison</>}
                        </button>
                        {urls.length >= 5 && (
                            <span style={{ fontSize: 12, color: '#6b7280' }}>Maximum 5 competitor URLs</span>
                        )}
                    </div>

                    {error && <div className="error" role="alert">{error}</div>}
                </div>
            </section>

            {/* ── Results or empty state ── */}
            {allResults.length > 0 && (
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Comparison Results</h2>
                            <p>Ranked by overall GEO readiness score — your brand highlighted in blue</p>
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                            {[['SEO', '#4f6ef7'], ['AEO', '#8b5cf6'], ['GEO', '#10b981']].map(([lbl, col]) => (
                                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: col, display: 'inline-block' }} />
                                    {lbl}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#f7f8fa' }}>
                                    {[
                                        { label: 'Rank', w: 48 },
                                        { label: 'Brand / URL', w: undefined },
                                        { label: 'Overall Score', w: 200, color: '#374151' },
                                        { label: 'SEO', w: 160, color: '#4f6ef7' },
                                        { label: 'AEO', w: 160, color: '#8b5cf6' },
                                        { label: 'GEO', w: 160, color: '#10b981' },
                                        { label: 'Top Gaps', w: undefined },
                                    ].map(h => (
                                        <th key={h.label} style={{
                                            padding: '10px 14px', textAlign: 'left',
                                            fontWeight: 700, color: h.color ?? '#6b7280',
                                            fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em',
                                            borderBottom: '2px solid #e4e6ef',
                                            minWidth: h.w, whiteSpace: 'nowrap',
                                        }}>{h.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {allResults.map((r, i) => (
                                    <tr key={i} style={{
                                        background: r.isClient ? '#eef2ff' : i % 2 === 0 ? '#fff' : '#fafafa',
                                        borderBottom: '1px solid #f0f0f0',
                                        borderLeft: r.isClient ? '3px solid #4f6ef7' : '3px solid transparent',
                                    }}>
                                        <td style={{ padding: '11px 14px', fontWeight: 700, fontSize: 14, color: i === 0 ? '#d97706' : '#9ca3af', textAlign: 'center' }}>
                                            {i === 0 ? <Award size={16} color="#d97706" /> : `#${i + 1}`}
                                        </td>
                                        <td style={{ padding: '11px 14px', fontWeight: r.isClient ? 700 : 500, maxWidth: 200 }}>
                                            <div style={{ fontSize: 14, color: '#111827', fontWeight: r.isClient ? 700 : 600 }}>{r.name}</div>
                                            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginTop: 2 }}>
                                                {r.url.replace(/^https?:\/\//, '').slice(0, 42)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '11px 14px', minWidth: 180 }}>
                                            <ScoreBar value={r.score} color={scoreColor(r.score)} />
                                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{r.coverage}% rubric coverage</div>
                                        </td>
                                        <td style={{ padding: '11px 14px', minWidth: 140 }}><ScoreBar value={r.subScores.seoScore} color="#4f6ef7" /></td>
                                        <td style={{ padding: '11px 14px', minWidth: 140 }}><ScoreBar value={r.subScores.aeoScore} color="#8b5cf6" /></td>
                                        <td style={{ padding: '11px 14px', minWidth: 140 }}><ScoreBar value={r.subScores.geoScore} color="#10b981" /></td>
                                        <td style={{ padding: '11px 14px', maxWidth: 220 }}>
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {r.topGaps.map((g, gi) => (
                                                    <li key={gi} style={{ fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'flex-start', gap: 5, lineHeight: 1.4 }}>
                                                        <X size={10} style={{ marginTop: 2, flexShrink: 0 }} />{g}
                                                    </li>
                                                ))}
                                                {r.topGaps.length === 0 && <li style={{ fontSize: 12, color: '#15803d' }}>No major gaps</li>}
                                            </ul>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ padding: '12px 20px', background: '#eef2ff', borderTop: '1px solid #e0e7ff', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                        <strong style={{ color: '#3730a3' }}>How to use this:</strong> Focus on dimensions where competitors score higher than you — those gaps are where AI engines are more likely to cite them instead of your brand. Address the top gaps shown above first, as they have the highest weighted impact on your overall score.
                    </div>
                </section>
            )}

            {/* ── Citation Sources + Topic Gaps (cmp-3 / cmp-4) ── */}
            {allResults.length > 0 && allResults.some(r => (r.citationSources?.length ?? 0) > 0 || (r.topTopics?.length ?? 0) > 0) && (
                <CitationTopicSection results={allResults} clientName={client.name} />
            )}

            {/* ── Visibility trend (cmp-5) ── always shown when we have probe history ── */}
            {probeHistory.length >= 1 && (
                <VisibilityTrendSection runs={probeHistory} clientName={client.name} competitorNames={client.competitors} />
            )}

            {allResults.length === 0 && (
                <CompetitorEmptyState urlCount={validUrlCount} />
            )}
        </div>
    );
}

// ── Citation Sources & Topic Gaps Section ────────────────────────────────────

function CitationTopicSection({ results, clientName }: {
    results: (CompetitorScanResult & { isClient?: boolean })[]; clientName: string;
}) {
    const [openRows, setOpenRows] = useState<Set<number>>(new Set([1])); // default open first competitor
    function toggle(i: number) { setOpenRows(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; }); }

    // Aggregate all unique sources and topics across competitors (exclude client)
    const competitors = results.filter(r => !r.isClient);
    const allSources = [...new Set(competitors.flatMap(r => r.citationSources ?? []))];
    const clientTopics = new Set<string>();
    const competitorTopics = competitors.flatMap(r => r.topTopics ?? []);
    const uniqueTopicGaps = [...new Set(competitorTopics)].filter(t => !clientTopics.has(t));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Aggregate citation intelligence */}
            {allSources.length > 0 && (
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Competitor Citation Sources</h2>
                            <p>Domains cited by AI engines when discussing your competitors — earning placement here raises your citation probability</p>
                        </div>
                        <Globe size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    </div>
                    <div style={{ padding: '12px 24px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {allSources.slice(0, 20).map((src, i) => (
                            <a key={i} href={src.startsWith('http') ? src : `https://${src}`} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 11px', borderRadius: 8, background: '#f7f8fa', border: '1px solid #e4e6ef', color: '#374151', textDecoration: 'none', fontWeight: 500 }}>
                                {src.replace(/^https?:\/\//, '').split('/')[0]}
                                <ExternalLink size={10} color="#9ca3af" />
                            </a>
                        ))}
                    </div>
                    <div style={{ padding: '0 24px 16px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                        These sources were extracted from AI-generated responses during competitor scans. Getting featured, linked from, or reviewed on these domains can improve how often AI engines cite your brand.
                    </div>
                </section>
            )}

            {/* Topic gap analysis */}
            {uniqueTopicGaps.length > 0 && (
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Topic Coverage Gaps</h2>
                            <p>Topics competitors are being cited for that your content does not yet cover</p>
                        </div>
                        <TrendingUp size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    </div>
                    <div style={{ padding: '12px 24px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {uniqueTopicGaps.slice(0, 16).map((topic, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 12px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa', color: '#92400e', fontWeight: 500 }}>
                                    <Zap size={10} color="#d97706" /> {topic}
                                </span>
                            ))}
                        </div>
                        <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                            Add content covering these topics to close the gap. Each topic represents an area where competitors are more likely to be cited by AI engines.
                        </div>
                    </div>
                </section>
            )}

            {/* Per-competitor detail rows */}
            {competitors.some(r => (r.citationSources?.length ?? 0) > 0 || (r.topTopics?.length ?? 0) > 0) && (
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Per-Competitor Intelligence</h2>
                            <p>Citation sources and topic areas for each competitor individually</p>
                        </div>
                    </div>
                    <div style={{ padding: '0 0 8px' }}>
                        {competitors.map((r, i) => {
                            const hasCitations = (r.citationSources?.length ?? 0) > 0;
                            const hasTopics = (r.topTopics?.length ?? 0) > 0;
                            if (!hasCitations && !hasTopics) return null;
                            const isOpen = openRows.has(i);
                            return (
                                <div key={i} style={{ borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
                                    <button onClick={() => toggle(i)} style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 24px',
                                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                                    }}>
                                        <Globe size={14} color="#9ca3af" />
                                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1f2328' }}>{r.name}</span>
                                        <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 6 }}>
                                            {hasCitations ? `${r.citationSources!.length} sources` : ''}
                                            {hasCitations && hasTopics ? ' · ' : ''}
                                            {hasTopics ? `${r.topTopics!.length} topics` : ''}
                                        </span>
                                        {isOpen ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
                                    </button>
                                    {isOpen && (
                                        <div style={{ padding: '0 24px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            {hasCitations && (
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Citation sources</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {r.citationSources!.map((src, si) => (
                                                            <a key={si} href={src.startsWith('http') ? src : `https://${src}`} target="_blank" rel="noopener noreferrer"
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 7, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', textDecoration: 'none' }}>
                                                                {src.replace(/^https?:\/\//, '').split('/')[0]}
                                                                <ExternalLink size={9} />
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {hasTopics && (
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Topic areas</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {r.topTopics!.map((topic, ti) => (
                                                            <span key={ti} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>{topic}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}

// ── Visibility Trend Section (cmp-5) ─────────────────────────────────────────

function DeltaBadge({ current, previous }: { current: number | null; previous: number | null }) {
    if (current === null || previous === null) return null;
    const delta = current - previous;
    if (Math.abs(delta) < 1) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 10 }}><Minus size={10} />0%</span>;
    const up = delta > 0;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: up ? '#15803d' : '#dc2626', background: up ? '#dcfce7' : '#fee2e2', padding: '2px 8px', borderRadius: 10 }}>
            {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {up ? '+' : ''}{delta}%
        </span>
    );
}

function VisibilityTrendSection({ runs, clientName, competitorNames }: {
    runs: ProbeRun[];
    clientName: string;
    competitorNames: string[];
}) {
    // Chronological order (oldest first)
    const sorted = [...runs].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

    // SVG sparkline
    const W = 280, H = 64, PAD = 6;
    const points = sorted.map((r, i) => ({
        x: sorted.length === 1 ? W / 2 : PAD + (i / (sorted.length - 1)) * (W - PAD * 2),
        y: H - PAD - ((r.mentionRate ?? 0) / 100) * (H - PAD * 2),
        rate: r.mentionRate ?? 0,
        date: new Date(r.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = points.length > 0
        ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - PAD} L${points[0].x.toFixed(1)},${H - PAD} Z`
        : '';

    // Competitor mention rates from latest run shareOfVoice
    const sovEntries = latest?.shareOfVoice ?? [];
    const allBrands = [
        { name: clientName, rate: latest?.mentionRate ?? null, prevRate: previous?.mentionRate ?? null, isClient: true },
        ...competitorNames.map(comp => {
            const entry = sovEntries.find(sv => sv.competitor.toLowerCase().includes(comp.toLowerCase()) || comp.toLowerCase().includes(sv.competitor.toLowerCase()));
            const prevEntry = previous?.shareOfVoice?.find(sv => sv.competitor.toLowerCase().includes(comp.toLowerCase()));
            return { name: comp, rate: entry?.mentionRate ?? null, prevRate: prevEntry?.mentionRate ?? null, isClient: false };
        }).filter(b => b.rate !== null),
    ].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

    return (
        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>AI Visibility Trend</h2>
                    <p>Brand mention rate over time — based on {sorted.length} probe run{sorted.length !== 1 ? 's' : ''}</p>
                </div>
                <TrendingUp size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
            </div>

            <div style={{ padding: '14px 24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Sparkline + latest KPIs */}
                <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Sparkline */}
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Mention rate over time</div>
                        <svg width={W} height={H} style={{ display: 'block' }}>
                            {/* Grid lines at 0, 50, 100 */}
                            {[0, 50, 100].map(pct => {
                                const y = H - PAD - (pct / 100) * (H - PAD * 2);
                                return <line key={pct} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#f0f0f0" strokeWidth={1} />;
                            })}
                            {/* Area fill */}
                            {areaPath && <path d={areaPath} fill="#4f6ef714" />}
                            {/* Line */}
                            {linePath && <path d={linePath} fill="none" stroke="#4f6ef7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                            {/* Data points */}
                            {points.map((p, i) => (
                                <g key={i}>
                                    <circle cx={p.x} cy={p.y} r={4} fill="#4f6ef7" stroke="#fff" strokeWidth={1.5} />
                                    <title>{p.date}: {p.rate}%</title>
                                </g>
                            ))}
                            {/* Date labels for first + last */}
                            {points.length >= 1 && (
                                <>
                                    <text x={points[0].x} y={H} textAnchor="middle" fontSize={9} fill="#9ca3af">{points[0].date}</text>
                                    {points.length > 1 && <text x={points[points.length - 1].x} y={H} textAnchor="middle" fontSize={9} fill="#9ca3af">{points[points.length - 1].date}</text>}
                                </>
                            )}
                        </svg>
                    </div>

                    {/* Latest run KPIs */}
                    <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em' }}>Latest probe snapshot</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Mention rate', value: latest?.mentionRate ?? null, prev: previous?.mentionRate ?? null, unit: '%' },
                                { label: 'Citation rate', value: latest?.citationRate ?? null, prev: previous?.citationRate ?? null, unit: '%' },
                            ].map(kpi => (
                                <div key={kpi.label} style={{ background: '#f7f8fa', borderRadius: 9, padding: '12px 18px', minWidth: 120 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>{kpi.label}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 28, fontWeight: 800, color: '#4f6ef7', lineHeight: 1 }}>
                                            {kpi.value !== null ? `${kpi.value}%` : '—'}
                                        </span>
                                        <DeltaBadge current={kpi.value} previous={kpi.prev} />
                                    </div>
                                    {kpi.prev !== null && kpi.value !== null && (
                                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>was {kpi.prev}%</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Sentiment shift */}
                        {latest && previous && (
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Sentiment shift</div>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {(['positive', 'neutral', 'negative'] as const).map(s => {
                                        const latestCount = latest.sentimentBreakdown[s];
                                        const prevCount = previous.sentimentBreakdown[s];
                                        const latestPct = Math.round(latestCount / Math.max(latest.results.length, 1) * 100);
                                        const prevPct = Math.round(prevCount / Math.max(previous.results.length, 1) * 100);
                                        const delta = latestPct - prevPct;
                                        const color = s === 'positive' ? '#15803d' : s === 'negative' ? '#dc2626' : '#6b7280';
                                        return (
                                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600, color, textTransform: 'capitalize' }}>{s}</span>
                                                <span style={{ color: '#374151' }}>{latestPct}%</span>
                                                <DeltaBadge current={latestPct} previous={prevPct} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Share-of-voice comparison */}
                {allBrands.length > 1 && (
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Share of voice — latest run vs previous</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {allBrands.map((b, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {b.isClient
                                                ? <span style={{ fontSize: 9, fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: 8, letterSpacing: '0.05em' }}>YOU</span>
                                                : <span style={{ fontSize: 9, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', padding: '2px 7px', borderRadius: 8, letterSpacing: '0.05em' }}>COMP</span>}
                                            <span style={{ fontSize: 13, fontWeight: b.isClient ? 700 : 500, color: '#1f2328' }}>{b.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <DeltaBadge current={b.rate} previous={b.prevRate} />
                                            <span style={{ fontSize: 14, fontWeight: 800, color: b.isClient ? '#4f6ef7' : '#6b7280' }}>
                                                {b.rate !== null ? `${b.rate}%` : '—'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ height: 7, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 4,
                                            width: (b.rate ?? 0) + '%',
                                            background: b.isClient ? '#4f6ef7' : (b.rate ?? 0) > (latest?.mentionRate ?? 0) ? '#fca5a5' : '#d1d5db',
                                            transition: 'width .5s ease',
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12, color: '#0369a1', lineHeight: 1.5 }}>
                    Data from AI Visibility probe runs. Run probes regularly to build a statistically meaningful trend. Delta badges compare the latest run against the immediately preceding one.
                </div>
            </div>
        </section>
    );
}
