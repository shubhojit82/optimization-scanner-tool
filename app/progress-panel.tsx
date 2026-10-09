"use client";
import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
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
    'AI Visibility':'#3b82d4','Technical AI Optimization':'#b45309',
    'Content Analysis':'#0d8073','Sentiment & Reputation':'#7c5cd8','AI-era KPIs':'#db2777',
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

export function ProgressPanel({ audits }: Props) {
    // Audits arrive newest-first
    const sorted = [...audits].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

    const [baseIdx, setBaseIdx] = useState(Math.max(0, sorted.length - 2));
    const [compIdx, setCompIdx] = useState(sorted.length - 1);

    if (sorted.length < 1) {
        return (
            <section className="panel">
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#57606a' }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#213f50', marginBottom: 8 }}>No audit history yet</p>
                    <p style={{ fontSize: '.88rem' }}>Import at least one page or run a scan to start tracking progress.</p>
                </div>
            </section>
        );
    }

    const base = sorted[baseIdx];
    const comp = sorted[compIdx];
    const isSame = base?.id === comp?.id;

    // Build dimension diff map
    type DimDiff = {
        id: string; name: string; weight: number; pillar: string;
        baseScore: number | null; compScore: number | null; delta: number | null;
    };

    const diffs: DimDiff[] = (comp?.dimensions ?? []).filter(d => d.weight > 0).map(d => {
        const b = base?.dimensions.find(x => x.id === d.id);
        const delta = b?.score !== null && d.score !== null ? d.score - (b?.score ?? 0) : null;
        return { id: d.id, name: d.name, weight: d.weight, pillar: PILLAR[d.id] ?? '', baseScore: b?.score ?? null, compScore: d.score, delta };
    });

    const improved = diffs.filter(d => (d.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    const regressed = diffs.filter(d => (d.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
    const unchanged = diffs.filter(d => d.delta === 0 || d.delta === null);

    const overallDelta = isSame ? null : (comp?.score ?? 0) - (base?.score ?? 0);
    const seoDelta = isSame ? null : (comp?.subScores?.seoScore ?? null) !== null && (base?.subScores?.seoScore ?? null) !== null
        ? (comp.subScores!.seoScore! - base.subScores!.seoScore!) : null;
    const aeoDelta = isSame ? null : (comp?.subScores?.aeoScore ?? null) !== null && (base?.subScores?.aeoScore ?? null) !== null
        ? (comp.subScores!.aeoScore! - base.subScores!.aeoScore!) : null;
    const geoDelta = isSame ? null : (comp?.subScores?.geoScore ?? null) !== null && (base?.subScores?.geoScore ?? null) !== null
        ? (comp.subScores!.geoScore! - base.subScores!.geoScore!) : null;

    // Trend data for sparkline (last 10 audits)
    const spark = sorted.slice(-10);
    const W = 400, H = 80, PL = 8, PR = 8, PT = 8, PB = 20;
    const iW = W - PL - PR, iH = H - PT - PB;
    function sx(i: number) { return PL + (spark.length < 2 ? iW / 2 : (i / (spark.length - 1)) * iW); }
    function sy(v: number) { return PT + iH - (v / 100) * iH; }
    const sparkPts = spark.map((a, i) => `${sx(i)},${sy(a.score)}`).join(' ');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Audit selector ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Audit Comparison</h2><p>Select two audits to compare — baseline vs current</p></div>
                </div>
                <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 220px' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>Baseline (from)</label>
                        <select value={baseIdx} onChange={e => setBaseIdx(Number(e.target.value))}
                            style={{ width: '100%', fontSize: 13 }}>
                            {sorted.map((a, i) => (
                                <option key={a.id} value={i}>{fmt(a.created)} — Score {a.score}/100</option>
                            ))}
                        </select>
                    </div>
                    <ArrowRight size={18} color="#8b9aa6" style={{ flexShrink: 0, marginTop: 18 }} />
                    <div style={{ flex: '1 1 220px' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>Current (to)</label>
                        <select value={compIdx} onChange={e => setCompIdx(Number(e.target.value))}
                            style={{ width: '100%', fontSize: 13 }}>
                            {sorted.map((a, i) => (
                                <option key={a.id} value={i}>{fmt(a.created)} — Score {a.score}/100</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {isSame ? (
                <div className="panel" style={{ padding: '24px', textAlign: 'center', color: '#57606a', fontSize: 13 }}>
                    Select two different audits to see the comparison.
                </div>
            ) : (
                <>
                    {/* ── Score delta header ── */}
                    <section className="panel" style={{ background: '#0f3b52', border: 'none' }}>
                        <div style={{ padding: '24px 28px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#78ddc6', textTransform: 'uppercase', marginBottom: 12 }}>
                                Progress Report · {fmt(base.created)} → {fmt(comp.created)}
                            </div>
                            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                                {[
                                    { label: 'Overall', from: base.score, to: comp.score, delta: overallDelta, color: '#57e3c2' },
                                    { label: 'SEO', from: base.subScores?.seoScore ?? null, to: comp.subScores?.seoScore ?? null, delta: seoDelta, color: '#3b82d4' },
                                    { label: 'AEO', from: base.subScores?.aeoScore ?? null, to: comp.subScores?.aeoScore ?? null, delta: aeoDelta, color: '#7c5cd8' },
                                    { label: 'GEO', from: base.subScores?.geoScore ?? null, to: comp.subScores?.geoScore ?? null, delta: geoDelta, color: '#0d8073' },
                                ].map(({ label, from, to, delta, color }) => (
                                    <div key={label} style={{ textAlign: 'center', minWidth: 80 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#78ddc6', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                            <span style={{ fontSize: 15, color: '#92ded0' }}>{from ?? '—'}</span>
                                            <ArrowRight size={13} color="#4a8fa8" />
                                            <span style={{ fontSize: 22, fontWeight: 800, color }}>  {to ?? '—'}</span>
                                        </div>
                                        {delta !== null && (
                                            <div style={{ fontSize: 13, fontWeight: 800, color: delta > 0 ? '#57e3c2' : delta < 0 ? '#f87171' : '#8b9aa6', marginTop: 4 }}>
                                                {delta > 0 ? '+' : ''}{delta} pts
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Sparkline */}
                                {spark.length >= 2 && (
                                    <div style={{ marginLeft: 'auto', opacity: .9 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#78ddc6', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 4 }}>All-time trend</div>
                                        <svg width={W * 0.6} height={H * 0.8} viewBox={`0 0 ${W} ${H}`}>
                                            <polyline points={sparkPts} fill="none" stroke="#57e3c2" strokeWidth={2} strokeLinejoin="round" />
                                            {spark.map((a, i) => <circle key={i} cx={sx(i)} cy={sy(a.score)} r={3} fill="#57e3c2" />)}
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── Summary cards ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {[
                            { label: 'Improved', count: improved.length, color: '#15803d', bg: '#dcfce7', icon: <TrendingUp size={18} /> },
                            { label: 'Regressed', count: regressed.length, color: '#b91c1c', bg: '#fee2e2', icon: <TrendingDown size={18} /> },
                            { label: 'Unchanged / Unscored', count: unchanged.length, color: '#57606a', bg: '#f0f2f5', icon: <Minus size={18} /> },
                        ].map(c => (
                            <div key={c.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ color: c.color, background: c.bg, borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
                                <div>
                                    <div style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.count}</div>
                                    <div style={{ fontSize: 12, color: '#57606a', marginTop: 3 }}>{c.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Dimension diff table ── */}
                    <section className="panel">
                        <div className="panel-heading">
                            <div><h2>Dimension-by-Dimension Comparison</h2>
                                <p>Every scored dimension — sorted by improvement. Grey bar = baseline, coloured bar = current.</p>
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
                                                <td style={{ padding: '11px 16px', fontWeight: 600, color: '#213f50' }}>{d.name}</td>
                                                <td style={{ padding: '11px 16px' }}>
                                                    {d.pillar && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: pc + '18', color: pc }}>{d.pillar}</span>}
                                                </td>
                                                <td style={{ padding: '11px 16px', fontWeight: 700, color: scoreColor(d.baseScore) }}>
                                                    {d.baseScore === null ? <span style={{ color: '#9ca3af' }}>—</span> : d.baseScore}
                                                </td>
                                                <td style={{ padding: '11px 16px', fontWeight: 700, color: scoreColor(d.compScore) }}>
                                                    {d.compScore === null ? <span style={{ color: '#9ca3af' }}>—</span> : d.compScore}
                                                </td>
                                                <td style={{ padding: '11px 16px' }}>
                                                    <DeltaBadge from={d.baseScore} to={d.compScore} />
                                                </td>
                                                <td style={{ padding: '11px 16px', minWidth: 120 }}>
                                                    <MiniBar value={d.compScore} prev={d.baseScore} color={pc} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* ── What changed narrative ── */}
                    {(improved.length > 0 || regressed.length > 0) && (
                        <div style={{ display: 'grid', gridTemplateColumns: improved.length && regressed.length ? '1fr 1fr' : '1fr', gap: 14 }}>
                            {improved.length > 0 && (
                                <section className="panel">
                                    <div className="panel-heading" style={{ background: '#f0fdf4' }}>
                                        <div><h2 style={{ color: '#15803d' }}>✓ What Improved</h2><p>{improved.length} dimension{improved.length > 1 ? 's' : ''} moved up</p></div>
                                    </div>
                                    <div style={{ padding: '12px 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {improved.map(d => (
                                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <TrendingUp size={13} color="#15803d" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#213f50' }}>{d.name}</div>
                                                    <div style={{ fontSize: 11, color: '#57606a' }}>{d.baseScore} → {d.compScore} · +{d.delta} pts</div>
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', background: '#dcfce7', borderRadius: 20, padding: '2px 8px' }}>+{d.delta}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                            {regressed.length > 0 && (
                                <section className="panel">
                                    <div className="panel-heading" style={{ background: '#fff8f8' }}>
                                        <div><h2 style={{ color: '#b91c1c' }}>⚠ What Regressed</h2><p>{regressed.length} dimension{regressed.length > 1 ? 's' : ''} moved down</p></div>
                                    </div>
                                    <div style={{ padding: '12px 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {regressed.map(d => (
                                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <TrendingDown size={13} color="#b91c1c" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#213f50' }}>{d.name}</div>
                                                    <div style={{ fontSize: 11, color: '#57606a' }}>{d.baseScore} → {d.compScore} · {d.delta} pts</div>
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', borderRadius: 20, padding: '2px 8px' }}>{d.delta}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
