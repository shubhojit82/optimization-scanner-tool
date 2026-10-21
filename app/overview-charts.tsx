"use client";
import type { Audit } from '../src/core/contracts';

// ── SVG Donut chart ────────────────────────────────────────────────────────
function DonutChart({
    value,
    color,
    label,
    tagline,
    onClick,
}: {
    value: number | null;
    color: string;
    label: string;
    tagline: string;
    onClick?: () => void;
}) {
    const R = 34, CX = 42, CY = 42;
    const circumference = 2 * Math.PI * R;
    const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
    const dash = (pct / 100) * circumference;
    const gap = circumference - dash;
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: onClick ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flex: 1,
                minWidth: 80,
            }}
            title={onClick ? `See full ${label} breakdown` : undefined}
        >
            <svg viewBox="0 0 84 84" width={84} height={84} aria-hidden="true">
                {/* Track */}
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e4e6ef" strokeWidth={7} />
                {/* Fill */}
                {pct > 0 && (
                    <circle
                        cx={CX} cy={CY} r={R}
                        fill="none"
                        stroke={color}
                        strokeWidth={7}
                        strokeDasharray={`${dash} ${gap}`}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${CX} ${CY})`}
                        style={{ transition: 'stroke-dasharray .5s ease' }}
                    />
                )}
                {/* Centre label */}
                <text x={CX} y={CY - 5} textAnchor="middle" fontSize={16} fontWeight={700} fill={value === null ? '#9ca3af' : '#1a1d2e'} fontFamily="IBM Plex Mono,monospace">
                    {value === null ? '—' : value}
                </text>
                <text x={CX} y={CY + 12} textAnchor="middle" fontSize={9} fontWeight={600} fill={color} letterSpacing={1} fontFamily="Inter,sans-serif">
                    {label}
                </text>
            </svg>
            <span style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', lineHeight: 1.3 }}>{tagline}</span>
        </button>
    );
}

// ── Horizontal bar chart for dimensions ───────────────────────────────────
function DimBar({ name, weight, score }: { name: string; weight: number; score: number | null }) {
    const colors: Record<string, string> = {
        '100': '#10b981', '75': '#4f6ef7', '50': '#f59e0b', '25': '#ef4444', '0': '#ef4444',
    };
    const color = score === null ? '#d1d5db'
        : score >= 75 ? '#10b981'
        : score >= 50 ? '#4f6ef7'
        : score >= 25 ? '#f59e0b'
        : '#ef4444';
    const W = 200;
    const filled = score === null ? 0 : (score / 100) * W;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 52px', alignItems: 'center', gap: '8px 12px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, color: '#1a1d2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                <div style={{ fontSize: '.6875rem', color: '#9ca3af', marginTop: 1 }}>{weight}% weight</div>
            </div>
            <svg height={8} style={{ display: 'block', width: '100%' }} aria-hidden="true">
                <rect x={0} y={0} width="100%" height={8} rx={4} fill="#e4e6ef" />
                {score !== null && score > 0 && (
                    <rect x={0} y={0} width={`${score}%`} height={8} rx={4} fill={color} style={{ transition: 'width .5s ease' }} />
                )}
            </svg>
            <span style={{ fontSize: '.8125rem', fontWeight: 700, color: score === null ? '#9ca3af' : color, textAlign: 'right', fontFamily: 'IBM Plex Mono,monospace' }}>
                {score === null ? 'N/A' : score}
            </span>
        </div>
    );
}

// ── Mini ring gauge (for metric cards) ────────────────────────────────────
export function MiniRing({ value, color }: { value: number | null; color: string }) {
    const R = 16, CX = 20, CY = 20;
    const circumference = 2 * Math.PI * R;
    const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
    const dash = (pct / 100) * circumference;
    return (
        <svg viewBox="0 0 40 40" width={40} height={40} aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e4e6ef" strokeWidth={4} />
            {pct > 0 && (
                <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={4}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${CX} ${CY})`}
                    style={{ transition: 'stroke-dasharray .5s ease' }}
                />
            )}
        </svg>
    );
}

// ── Full Overview chart panel ──────────────────────────────────────────────
type Props = {
    audit: Audit;
    onScoreView: (cat: 'SEO' | 'AEO' | 'GEO') => void;
};

export function OverviewCharts({ audit, onScoreView }: Props) {
    const seo = audit.subScores?.seoScore ?? null;
    const aeo = audit.subScores?.aeoScore ?? null;
    const geo = audit.subScores?.geoScore ?? null;

    return (
        <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-heading">
                <div>
                    <h2>Sub-score breakdown</h2>
                    <p>SEO · AEO · GEO readiness — click any ring to see page-level fixes</p>
                </div>
            </div>
            {/* Donut row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', padding: '20px 24px 4px', gap: 8 }}>
                <DonutChart value={seo} color="#4f6ef7" label="SEO" tagline="Technical crawlability" onClick={() => onScoreView('SEO')} />
                <DonutChart value={aeo} color="#8b5cf6" label="AEO" tagline="Content answer-readiness" onClick={() => onScoreView('AEO')} />
                <DonutChart value={geo} color="#10b981" label="GEO" tagline="Live AI engine visibility" onClick={() => onScoreView('GEO')} />
            </div>
            {/* Dimension bars */}
            <div style={{ padding: '4px 20px 12px' }}>
                <div style={{ fontSize: '.6875rem', fontWeight: 700, letterSpacing: '.08em', color: '#9ca3af', textTransform: 'uppercase', padding: '12px 0 4px' }}>All dimensions</div>
                {audit.dimensions.map(d => (
                    <DimBar key={d.id} name={d.name} weight={d.weight} score={d.score} />
                ))}
            </div>
            <div className="panel-note">Score = weighted cue scores ÷ assessed weight. Unknown dimensions excluded from total.</div>
        </section>
    );
}
