"use client";
import type { Audit } from '../src/core/contracts';

type Props = { audits: Audit[] };

function fmt(d: string, allSameDay: boolean) {
    try {
        const date = new Date(d);
        if (allSameDay) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return d.slice(0, 10); }
}

export function ScoreTrendChart({ audits }: Props) {
    if (audits.length < 2) return null;
    const sorted = [...audits].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()).slice(-10);
    const W = 560, H = 200, PAD = { top: 16, right: 20, bottom: 36, left: 36 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    function x(i: number) { return PAD.left + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW); }
    function y(v: number) { return PAD.top + innerH - (v / 100) * innerH; }

    function polyline(vals: (number | null)[], color: string, width = 2) {
        const pts = vals.map((v, i) => v !== null ? `${x(i)},${y(v)}` : null).filter(Boolean) as string[];
        if (pts.length < 2) return null;
        return <polyline key={color} points={pts.join(' ')} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />;
    }
    function dots(vals: (number | null)[], color: string) {
        return vals.map((v, i) => v !== null ? (
            <g key={i}>
                    <circle cx={x(i)} cy={y(v)} r={4} fill={color} />
                    <title>{fmt(sorted[i].created, allSameDay)}: {v}</title>
                </g>
        ) : null);
    }

    const uniqueDays = new Set(sorted.map(a => a.created.slice(0, 10)));
    const allSameDay = uniqueDays.size === 1;

    const overall = sorted.map(a => a.score);
    const seo = sorted.map(a => a.subScores?.seoScore ?? null);
    const aeo = sorted.map(a => a.subScores?.aeoScore ?? null);
    const geo = sorted.map(a => a.subScores?.geoScore ?? null);

    const yTicks = [0, 25, 50, 75, 100];

    return (
        <section className="panel" style={{ marginBottom: 0, marginTop: 20 }}>
            <div className="panel-heading">
                <div><h2>Score Trend</h2><p>Last {sorted.length} audits · overall and sub-scores over time</p></div>
            </div>
            <div style={{ overflowX: 'auto', padding: '16px 24px 4px' }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }} aria-label="Score trend chart">
                    {/* Y-axis ticks */}
                    {yTicks.map(t => (
                        <g key={t}>
                            <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
                            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{t}</text>
                        </g>
                    ))}
                    {/* Lines */}
                    {polyline(overall, '#1f2328', 2.5)}
                    {polyline(seo, '#3b82d4')}
                    {polyline(aeo, '#7c5cd8')}
                    {polyline(geo, '#14b8a6')}
                    {/* Dots */}
                    {dots(overall, '#1f2328')}
                    {dots(seo, '#3b82d4')}
                    {dots(aeo, '#7c5cd8')}
                    {dots(geo, '#14b8a6')}
                    {/* X-axis labels */}
                    {sorted.map((a, i) => (
                        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">{fmt(a.created, allSameDay)}</text>
                    ))}
                </svg>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4, paddingTop: 8, paddingBottom: 16, paddingLeft: 24, borderTop: '1px solid #f0f0f0' }}>
                {[['Overall', '#1f2328'], ['SEO', '#3b82d4'], ['AEO', '#7c5cd8'], ['GEO', '#14b8a6']].map(([label, color]) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#57606a' }}>
                        <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke={color} strokeWidth={2.5} /></svg>
                        {label}
                    </span>
                ))}
            </div>
        </section>
    );
}
