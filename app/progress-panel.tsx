"use client";
import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight, Calendar } from 'lucide-react';
import type { Audit } from '../src/core/contracts';

type Props = { audits: Audit[] };

const PILLAR: Record<string, string> = {
    'crawl':'AI Visibility','technical':'Technical AI Optimization','schema':'Technical AI Optimization',
    'freshness':'Technical AI Optimization','content':'Content Analysis','entity':'Content Analysis',
    'evidence':'Content Analysis','query':'Content Analysis','reasoning-cues':'Content Analysis',
    'passage-density':'Content Analysis','entity-links':'Sentiment & Reputation',
    'measurement':'AI-era KPIs','authority':'AI-era KPIs',
};
const PILLAR_COLOR: Record<string, string> = {
    'AI Visibility':'#4f6ef7','Technical AI Optimization':'#b45309',
    'Content Analysis':'#0d8073','Sentiment & Reputation':'#8b5cf6','AI-era KPIs':'#db2777',
};

function scoreColor(s: number | null) {
    if (s === null) return '#9ca3af';
    if (s >= 80) return '#15803d';
    if (s >= 65) return '#0369a1';
    if (s >= 45) return '#b45309';
    return '#b91c1c';
}

function DeltaBadge({ from, to }: { from: number | null; to: number | null }) {
    if (from === null || to === null) return <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>;
    const diff = to - from;
    if (diff === 0) return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#57606a', background: '#f0f2f5', borderRadius: 20, padding: '2px 9px' }}>
            <Minus size={10} /> No change
        </span>
    );
    const up = diff > 0;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: up ? '#15803d' : '#b91c1c', background: up ? '#dcfce7' : '#fee2e2', borderRadius: 20, padding: '2px 9px' }}>
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {up ? '+' : ''}{diff} pts
        </span>
    );
}

function MiniBar({ value, prev, color }: { value: number | null; prev?: number | null; color: string }) {
    const v = value ?? 0;
    const p = prev ?? null;
    return (
        <div style={{ position: 'relative', height: 8, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden', minWidth: 80 }}>
            {p !== null && (
                <div style={{ position: 'absolute', height: '100%', width: `${p}%`, background: '#e5e7eb', borderRadius: 4 }} />
            )}
            <div style={{ position: 'absolute', height: '100%', width: `${v}%`, background: color, borderRadius: 4, transition: 'width .4s ease' }} />
        </div>
    );
}

function fmt(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Styled audit select card ────────────────────────────────────────────────
function AuditSelect({
    label, value, onChange, audits, accent,
}: {
    label: string; value: number; onChange: (i: number) => void;
    audits: Audit[]; accent: string;
}) {
    const selected = audits[value];
    return (
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} /> {label}
            </div>
            <div style={{ position: 'relative' }}>
                <select
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    style={{
                        width: '100%',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        background: '#ffffff',
                        border: `1.5px solid ${accent}40`,
                        borderRadius: 8,
                        padding: '10px 40px 10px 14px',
                        fontSize: '.875rem',
                        fontWeight: 600,
                        color: '#1a1d2e',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                        outline: 'none',
                        lineHeight: 1.4,
                    }}
                >
                    {audits.map((a, i) => (
                        <option key={a.id} value={i}>{fmt(a.created)} · Score {a.score}/100</option>
                    ))}
                </select>
                {/* Chevron icon */}
                <svg
                    viewBox="0 0 20 20" width={16} height={16}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: accent }}
                    fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                >
                    <polyline points="5 8 10 13 15 8" />
                </svg>
            </div>
            {selected && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', paddingLeft: 2 }}>
                    {selected.coverage}% rubric coverage
                </div>
            )}
        </div>
    );
}

// ── Score transition card (Overall / SEO / AEO / GEO) ──────────────────────
function ScoreCard({
    label, tagline, from, to, delta, color, accentBg,
}: {
    label: string; tagline: string;
    from: number | null; to: number | null; delta: number | null;
    color: string; accentBg: string;
}) {
    const noData = from === null && to === null;
    const deltaUp = (delta ?? 0) > 0;
    const deltaDown = (delta ?? 0) < 0;

    return (
        <div style={{
            background: '#ffffff',
            border: '1px solid #e4e6ef',
            borderRadius: 10,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
            flex: '1 1 160px',
            minWidth: 0,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#6b7280', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>— {tagline}</span>
            </div>

            {/* Score transition */}
            {noData ? (
                <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Not assessed</div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* From */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>Before</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#9ca3af', letterSpacing: '-.02em', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>
                            {from ?? '—'}
                        </div>
                    </div>

                    {/* Arrow */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0 4px' }}>
                        <ArrowRight size={18} color={deltaDown ? '#ef4444' : deltaUp ? color : '#d1d5db'} strokeWidth={2.5} />
                    </div>

                    {/* To */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>After</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: deltaDown ? '#ef4444' : deltaUp ? color : '#1a1d2e', letterSpacing: '-.02em', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>
                            {to ?? '—'}
                        </div>
                    </div>

                    {/* Delta badge */}
                    {delta !== null && (
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 13, fontWeight: 800,
                                color: deltaDown ? '#b91c1c' : deltaUp ? '#15803d' : '#57606a',
                                background: deltaDown ? '#fee2e2' : deltaUp ? '#dcfce7' : '#f0f2f5',
                                borderRadius: 8, padding: '5px 10px',
                            }}>
                                {deltaUp ? <TrendingUp size={13} /> : deltaDown ? <TrendingDown size={13} /> : <Minus size={13} />}
                                {deltaUp ? '+' : ''}{delta}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Mini progress bar */}
            {!noData && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>0</span>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>100</span>
                    </div>
                    <div style={{ position: 'relative', height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'visible' }}>
                        {/* Baseline ghost bar */}
                        {from !== null && (
                            <div style={{ position: 'absolute', height: '100%', width: `${from}%`, background: '#e5e7eb', borderRadius: 3 }} />
                        )}
                        {/* Current bar */}
                        {to !== null && (
                            <div style={{ position: 'absolute', height: '100%', width: `${to}%`, background: color, borderRadius: 3, opacity: .85, transition: 'width .5s ease' }} />
                        )}
                        {/* Baseline tick marker */}
                        {from !== null && (
                            <div style={{
                                position: 'absolute', left: `${from}%`, top: -3, bottom: -3,
                                width: 2, background: '#c4c8d8', borderRadius: 1,
                                transform: 'translateX(-1px)',
                            }} />
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 10, color: '#9ca3af' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 3, background: '#e5e7eb', display: 'inline-block', borderRadius: 2 }} /> Baseline
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 3, background: color, display: 'inline-block', borderRadius: 2, opacity: .85 }} /> Current
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ProgressPanel({ audits }: Props) {
    const sorted = [...audits].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

    const [baseIdx, setBaseIdx] = useState(Math.max(0, sorted.length - 2));
    const [compIdx, setCompIdx] = useState(sorted.length - 1);

    if (sorted.length < 1) {
        return (
            <section className="panel">
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#57606a' }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1a1d2e', marginBottom: 8 }}>No audit history yet</p>
                    <p style={{ fontSize: '.88rem' }}>Import at least one page or run a scan to start tracking progress.</p>
                </div>
            </section>
        );
    }

    const base = sorted[baseIdx];
    const comp = sorted[compIdx];
    const isSame = base?.id === comp?.id;

    type DimDiff = {
        id: string; name: string; weight: number; pillar: string;
        baseScore: number | null; compScore: number | null; delta: number | null;
    };

    const diffs: DimDiff[] = (comp?.dimensions ?? []).filter(d => d.weight > 0).map(d => {
        const b = base?.dimensions.find(x => x.id === d.id);
        const delta = b?.score !== null && d.score !== null ? d.score - (b?.score ?? 0) : null;
        return { id: d.id, name: d.name, weight: d.weight, pillar: PILLAR[d.id] ?? '', baseScore: b?.score ?? null, compScore: d.score, delta };
    });

    const improved  = diffs.filter(d => (d.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    const regressed = diffs.filter(d => (d.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
    const unchanged = diffs.filter(d => d.delta === 0 || d.delta === null);

    const overallDelta = isSame ? null : (comp?.score ?? 0) - (base?.score ?? 0);
    const seoDelta = (!isSame && comp?.subScores?.seoScore != null && base?.subScores?.seoScore != null)
        ? comp.subScores.seoScore - base.subScores.seoScore : null;
    const aeoDelta = (!isSame && comp?.subScores?.aeoScore != null && base?.subScores?.aeoScore != null)
        ? comp.subScores.aeoScore - base.subScores.aeoScore : null;
    const geoDelta = (!isSame && comp?.subScores?.geoScore != null && base?.subScores?.geoScore != null)
        ? comp.subScores.geoScore - base.subScores.geoScore : null;

    // Sparkline
    const spark = sorted.slice(-10);
    const W = 320, H = 60, PL = 4, PR = 4, PT = 4, PB = 4;
    const iW = W - PL - PR, iH = H - PT - PB;
    function sx(i: number) { return PL + (spark.length < 2 ? iW / 2 : (i / (spark.length - 1)) * iW); }
    function sy(v: number) { return PT + iH - (v / 100) * iH; }
    const sparkPts = spark.map((a, i) => `${sx(i)},${sy(a.score)}`).join(' ');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Audit selector ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Audit Comparison</h2><p>Select two audits to compare — baseline vs current</p></div>
                </div>
                <div style={{ padding: '16px 24px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <AuditSelect label="Baseline (from)" value={baseIdx} onChange={setBaseIdx} audits={sorted} accent="#6b7280" />
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: 34, flexShrink: 0 }}>
                        <ArrowRight size={20} color="#d1d5db" />
                    </div>
                    <AuditSelect label="Current (to)" value={compIdx} onChange={setCompIdx} audits={sorted} accent="#4f6ef7" />
                </div>
            </section>

            {isSame ? (
                <div className="panel" style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                    Select two <em>different</em> audits to see the comparison.
                </div>
            ) : (
                <>
                    {/* ── Score comparison cards ── */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 10 }}>
                            Score Comparison · {fmt(base.created)} → {fmt(comp.created)}
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <ScoreCard
                                label="Overall" tagline="composite"
                                from={base.score} to={comp.score} delta={overallDelta}
                                color="#4f6ef7" accentBg="#eef2ff"
                            />
                            <ScoreCard
                                label="SEO" tagline="search engine"
                                from={base.subScores?.seoScore ?? null} to={comp.subScores?.seoScore ?? null} delta={seoDelta}
                                color="#3b82f6" accentBg="#eff6ff"
                            />
                            <ScoreCard
                                label="AEO" tagline="answer engine"
                                from={base.subScores?.aeoScore ?? null} to={comp.subScores?.aeoScore ?? null} delta={aeoDelta}
                                color="#8b5cf6" accentBg="#f5f3ff"
                            />
                            <ScoreCard
                                label="GEO" tagline="generative engine"
                                from={base.subScores?.geoScore ?? null} to={comp.subScores?.geoScore ?? null} delta={geoDelta}
                                color="#10b981" accentBg="#ecfdf5"
                            />
                            {/* Sparkline card */}
                            {spark.length >= 2 && (
                                <div style={{
                                    background: '#ffffff', border: '1px solid #e4e6ef', borderRadius: 10,
                                    padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                                    flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8,
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#6b7280', textTransform: 'uppercase' }}>All-time trend</div>
                                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} aria-label="Score trend">
                                        <polyline points={sparkPts} fill="none" stroke="#4f6ef7" strokeWidth={2} strokeLinejoin="round" />
                                        {spark.map((a, i) => <circle key={i} cx={sx(i)} cy={sy(a.score)} r={3} fill="#4f6ef7" />)}
                                    </svg>
                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Last {spark.length} audits · overall score</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Unified change summary panel ── */}
                    <section className="panel">
                        {/* Stat strip — WCAG AA: all text ≥ 4.5:1 */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #d1d5db' }}>
                            {[
                                { label: 'dimensions improved', count: improved.length, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: <TrendingUp size={15} /> },
                                { label: 'dimensions regressed', count: regressed.length, color: '#991b1b', bg: '#fff5f5', border: '#fecaca', icon: <TrendingDown size={15} /> },
                                { label: 'unchanged or unscored', count: unchanged.length, color: '#374151', bg: '#f9fafb', border: '#e5e7eb', icon: <Minus size={15} /> },
                            ].map((s, i, arr) => (
                                <div key={s.label} style={{
                                    flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '14px 22px', background: s.bg,
                                    borderRight: i < arr.length - 1 ? `1px solid ${s.border}` : 'none',
                                }}>
                                    <div style={{ color: s.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{s.icon}</div>
                                    <span style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-.02em', lineHeight: 1, flexShrink: 0 }}
                                        aria-label={`${s.count} ${s.label}`}>{s.count}</span>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{s.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Dimension rows — all groups in one list */}
                        {[
                            ...improved.map(d => ({ ...d, status: 'improved' as const })),
                            ...regressed.map(d => ({ ...d, status: 'regressed' as const })),
                            ...unchanged.map(d => ({ ...d, status: 'unchanged' as const })),
                        ].map((d, i, arr) => {
                            const isImproved  = d.status === 'improved';
                            const isRegressed = d.status === 'regressed';
                            const accentColor = isImproved ? '#15803d' : isRegressed ? '#b91c1c' : '#d1d5db';
                            const deltaLabel  = isImproved ? `+${d.delta}` : isRegressed ? `${d.delta}` : null;
                            const deltaColor  = isImproved ? '#15803d' : '#b91c1c';
                            const deltaBg     = isImproved ? '#dcfce7' : '#fee2e2';
                            // group separator: first row in each group gets a slightly different bg header
                            const prevStatus  = i > 0 ? arr[i - 1].status : null;
                            const isGroupStart = d.status !== prevStatus;
                            return (
                                <div key={d.id}>
                                    {isGroupStart && (
                                        <div style={{
                                            padding: '7px 20px 6px',
                                            background: '#f3f4f6',
                                            borderTop: i > 0 ? '2px solid #d1d5db' : 'none',
                                            borderBottom: '1px solid #e4e6ef',
                                            display: 'flex', alignItems: 'center', gap: 7,
                                        }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor === '#d1d5db' ? '#57606a' : accentColor, display: 'inline-block', flexShrink: 0 }} />
                                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: accentColor === '#d1d5db' ? '#374151' : accentColor }}>
                                                {d.status === 'improved' ? `Improved · ${improved.length}` : d.status === 'regressed' ? `Regressed · ${regressed.length}` : `Unchanged / Unscored · ${unchanged.length}`}
                                            </span>
                                        </div>
                                    )}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto auto',
                                        alignItems: 'center',
                                        gap: 16,
                                        padding: '10px 20px 10px 22px',
                                        borderBottom: '1px solid #f0f0f0',
                                        borderLeft: `3px solid ${accentColor === '#d1d5db' ? '#c4c8d8' : accentColor}`,
                                        background: isImproved ? '#f6fef9' : isRegressed ? '#fff5f5' : '#ffffff',
                                    }}>
                                        {/* Name + pillar — left column */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{d.name}</span>
                                            {/* Scores sit right next to the name */}
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                                <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500, color: '#4b5563' }}
                                                    aria-label={`Baseline score ${d.baseScore ?? 'not assessed'}`}>
                                                    {d.baseScore ?? '—'}
                                                </span>
                                                <ArrowRight size={12} color="#6b7280" aria-hidden="true" />
                                                <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700,
                                                    color: isImproved ? '#15803d' : isRegressed ? '#b91c1c' : '#111827' }}
                                                    aria-label={`Current score ${d.compScore ?? 'not assessed'}`}>
                                                    {d.compScore !== null ? d.compScore : <span style={{ fontStyle: 'italic', color: '#6b7280', fontFamily: 'inherit' }}>N/A</span>}
                                                </span>
                                            </span>
                                            {d.pillar && (
                                                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 8,
                                                    background: (PILLAR_COLOR[d.pillar] ?? '#57606a') + '20',
                                                    color: PILLAR_COLOR[d.pillar] ?? '#374151' }}>
                                                    {d.pillar}
                                                </span>
                                            )}
                                        </div>
                                        {/* Delta badge — right, always visible */}
                                        {deltaLabel !== null ? (
                                            <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor, background: deltaBg,
                                                borderRadius: 6, padding: '3px 10px', flexShrink: 0,
                                                border: `1px solid ${isImproved ? '#86efac' : '#fca5a5'}` }}
                                                aria-label={`Change: ${deltaLabel} points`}>
                                                {deltaLabel} pts
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}
                                                aria-label="No change">
                                                No change
                                            </span>
                                        )}
                                        {/* Spacer column (keeps grid 3-col consistent) */}
                                        <span />
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    {/* ── Dimension diff table ── */}
                    <section className="panel">
                        <div className="panel-heading">
                            <div>
                                <h2>Dimension-by-Dimension Comparison</h2>
                                <p>Every scored dimension — sorted by improvement. Light bar = baseline, coloured bar = current.</p>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: '#f7f8fa', borderBottom: '2px solid #e5e7eb' }}>
                                        {['Dimension', 'Pillar', 'Baseline', 'Current', 'Change', 'Progress'].map(h => (
                                            <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#8b9aa6', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...improved, ...unchanged, ...regressed].map((d, i) => {
                                        const pc = PILLAR_COLOR[d.pillar] ?? '#57606a';
                                        const rowBg = (d.delta ?? 0) > 0 ? '#f0fdf4' : (d.delta ?? 0) < 0 ? '#fff8f8' : i % 2 === 0 ? '#fff' : '#fafbfc';
                                        return (
                                            <tr key={d.id} style={{ borderBottom: '1px solid #f0f2f5', background: rowBg }}>
                                                <td style={{ padding: '11px 16px', fontWeight: 600, color: '#1a1d2e' }}>{d.name}</td>
                                                <td style={{ padding: '11px 16px' }}>
                                                    {d.pillar && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: pc + '18', color: pc }}>{d.pillar}</span>}
                                                </td>
                                                <td style={{ padding: '11px 16px', fontWeight: 700, color: scoreColor(d.baseScore), fontFamily: 'IBM Plex Mono, monospace' }}>
                                                    {d.baseScore === null ? <span style={{ color: '#9ca3af' }}>—</span> : d.baseScore}
                                                </td>
                                                <td style={{ padding: '11px 16px', fontWeight: 700, color: scoreColor(d.compScore), fontFamily: 'IBM Plex Mono, monospace' }}>
                                                    {d.compScore === null ? <span style={{ color: '#9ca3af' }}>—</span> : d.compScore}
                                                </td>
                                                <td style={{ padding: '11px 16px' }}>
                                                    <DeltaBadge from={d.baseScore} to={d.compScore} />
                                                </td>
                                                <td style={{ padding: '11px 16px', minWidth: 140 }}>
                                                    <MiniBar value={d.compScore} prev={d.baseScore} color={pc} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </>
            )}
        </div>
    );
}
