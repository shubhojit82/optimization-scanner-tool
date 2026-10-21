"use client";
import { useState } from 'react';
import { Globe, Download, AlertTriangle, CheckCircle, Search, Map, BarChart2, FileText, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import type { Client } from '../src/core/contracts';
import type { SiteScanResult, PageCrawlResult, DimensionAggregate } from '../src/server/site-crawler';

type Props = { clients: Client[]; busy: boolean; onBusy: (b: boolean) => void };

function ScorePill({ score }: { score: number | null }) {
    if (score === null) return <span style={{ fontFamily: 'IBM Plex Mono,monospace', color: '#9ca3af', fontSize: 13 }}>—</span>;
    const color = score >= 75 ? '#15803d' : score >= 50 ? '#d97706' : '#b91c1c';
    return <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700, fontSize: 13, color }}>{score}</span>;
}

// ── Dimension aggregates section (scr-3) ─────────────────────────────────────
function DimensionAggregatesSection({ aggregates }: { aggregates: DimensionAggregate[] }) {
    const sorted = [...aggregates].sort((a, b) => (a.avgScore ?? 100) - (b.avgScore ?? 100));
    return (
        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>Site-wide dimension scores</h2>
                    <p>Average score per GEO rubric dimension across all crawled pages</p>
                </div>
            </div>
            <div style={{ padding: '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map(d => {
                    const score = d.avgScore;
                    const pct = score ?? 0;
                    const color = pct >= 75 ? '#15803d' : pct >= 50 ? '#d97706' : '#b91c1c';
                    const barColor = pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                        <div key={d.id}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1d2e' }}>{d.name}</span>
                                    <span style={{ fontSize: 11, color: '#57606a' }}>{d.weight}% weight</span>
                                    {d.pagesBelow70 > 0 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', borderRadius: 20, padding: '1px 7px' }}>
                                            {d.pagesBelow70} page{d.pagesBelow70 > 1 ? 's' : ''} below 70
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#57606a' }}>
                                    {d.minScore !== null && <span>min <strong style={{ color }}>{d.minScore}</strong></span>}
                                    {d.maxScore !== null && <span>max <strong style={{ color: '#15803d' }}>{d.maxScore}</strong></span>}
                                    <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700, fontSize: 13, color, minWidth: 32, textAlign: 'right' }}>
                                        {score === null ? '—' : score}
                                    </span>
                                </div>
                            </div>
                            <div style={{ background: '#f0f2f5', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .3s' }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ── Empty state illustration ──────────────────────────────────────────────────
function CrawlerEmptyState() {
    return (
        <div style={{
            background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
            border: '1px solid #e4e6ef',
            borderRadius: 10,
            padding: '32px 32px',
            display: 'flex',
            gap: 48,
            alignItems: 'center',
            flexWrap: 'wrap',
        }}>
            {/* SVG site tree illustration */}
            <div style={{ flexShrink: 0 }}>
                <svg width={270} height={148} viewBox="0 0 270 148" aria-hidden="true">
                    {/* Root node */}
                    <rect x={103} y={6} width={64} height={30} rx={5} fill="#4f6ef7" />
                    <text x={135} y={26} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">Root</text>

                    {/* Trunk line */}
                    <line x1={135} y1={36} x2={135} y2={52} stroke="#c4c8d8" strokeWidth={1.5} />
                    {/* Branch bar */}
                    <line x1={35} y1={52} x2={235} y2={52} stroke="#c4c8d8" strokeWidth={1.5} />

                    {/* Branch stems + page nodes */}
                    {[35, 135, 235].map((cx, i) => {
                        const scores = [81, 72, 55];
                        const colors = ['#15803d', '#4f6ef7', '#d97706'];
                        const fills = ['#f0fdf4', '#eef2ff', '#fefce8'];
                        const borders = ['#86efac', '#93c5fd', '#fde68a'];
                        return (
                            <g key={cx}>
                                <line x1={cx} y1={52} x2={cx} y2={64} stroke="#c4c8d8" strokeWidth={1.5} />
                                <rect x={cx - 24} y={64} width={48} height={28} rx={5}
                                    fill={fills[i]} stroke={borders[i]} strokeWidth={1.2} />
                                <text x={cx} y={82} textAnchor="middle" fontSize={9} fill="#374151">Page {i + 1}</text>
                                {/* Score below */}
                                <text x={cx} y={108} textAnchor="middle" fontSize={14} fontWeight={700} fill={colors[i]}>
                                    {scores[i]}
                                </text>
                                <text x={cx} y={120} textAnchor="middle" fontSize={8} fill="#9ca3af">/100</text>
                                {/* Depth-2 child for middle node */}
                                {i === 1 && (
                                    <>
                                        <line x1={135} y1={92} x2={135} y2={102} stroke="#d1d5db" strokeWidth={1} strokeDasharray="2 2" />
                                        <rect x={111} y={102} width={48} height={20} rx={4}
                                            fill="#f9fafb" stroke="#e4e6ef" strokeWidth={1} />
                                        <text x={135} y={116} textAnchor="middle" fontSize={8} fill="#9ca3af">+deeper pages</text>
                                    </>
                                )}
                            </g>
                        );
                    })}
                    <text x={135} y={142} textAnchor="middle" fontSize={9} fill="#9ca3af">Up to 50 pages · depth 3 · 600 ms between requests</text>
                </svg>
                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>
                    Illustrative — run a crawl to see real scores
                </p>
            </div>

            {/* Feature explainer */}
            <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>
                    What site crawler does
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                        { icon: <Map size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Crawls your entire site', text: 'Follows internal links depth-first — up to 50 pages, max depth 3, with a polite 600 ms delay.' },
                        { icon: <BarChart2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Scores every page', text: 'Each page is scored individually against the full GEO rubric — structure, schema, content, AI-bot access.' },
                        { icon: <Zap size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Site-wide gap analysis', text: 'Surfaces dimensions missing across multiple pages. Fix these first for maximum site-level impact.' },
                        { icon: <FileText size={15} />, color: '#d97706', bg: '#fffbeb', title: 'XLSX export', text: 'Download all page scores and gap data in one spreadsheet for client reporting.' },
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
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff', border: '1px solid #e4e6ef', borderRadius: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                    <strong style={{ color: '#4f6ef7' }}>Tip:</strong> Select a client to associate crawl results with an existing workspace.
                    JavaScript-rendered pages (SPAs) are not fully assessed — use the Scanner for those.
                </div>
            </div>
        </div>
    );
}

export function SiteCrawlerPanel({ clients, busy, onBusy }: Props) {
    const [url, setUrl] = useState('');
    const [clientId, setClientId] = useState('');
    const [result, setResult] = useState<SiteScanResult | null>(null);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);

    async function scan(e: React.FormEvent) {
        e.preventDefault();
        if (!url) return;
        onBusy(true); setError(''); setResult(null);
        try {
            const r = await fetch('/api/v1/site-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
                body: JSON.stringify({ url, clientId: clientId || undefined }),
            });
            const data = await r.json() as SiteScanResult & { error?: string };
            if (!r.ok) throw new Error(data.error || 'Scan failed');
            setResult(data);
        } catch (e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    async function exportXlsx() {
        setExporting(true);
        try {
            const r = await fetch('/api/v1/site-scan/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
                body: JSON.stringify({ url, clientId: clientId || undefined }),
            });
            if (!r.ok) throw new Error('Export failed');
            const blob = await r.blob();
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `site-scan-${new URL(url).hostname}.xlsx`; a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) { setError((e as Error).message); } finally { setExporting(false); }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Form panel ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Site crawler</h2>
                        <p>Crawls up to 50 pages · max depth 3 · sequential with 600 ms delay between requests</p>
                    </div>
                    <Globe size={18} color="var(--text-secondary)" />
                </div>
                <form onSubmit={scan} style={{ padding: '16px 24px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    {/* Site URL */}
                    <label style={{ flex: '1 1 320px', margin: 0 }}>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
                            Site URL
                        </span>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Globe size={14} color="#9ca3af" style={{ position: 'absolute', left: 11, pointerEvents: 'none' }} />
                            <input
                                type="url" required value={url} onChange={e => setUrl(e.target.value)}
                                placeholder="https://example.com" disabled={busy}
                                aria-label="Site URL to crawl"
                                style={{ width: '100%', border: '1.5px solid #e4e6ef', borderRadius: 8, padding: '9px 12px 9px 32px', fontSize: 14, background: '#fafafa', color: '#1a1d2e', outline: 'none', transition: 'border-color .15s' }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#4f6ef7')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#e4e6ef')}
                            />
                        </div>
                    </label>

                    {/* Client select */}
                    <label style={{ flex: '0 1 220px', margin: 0 }}>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
                            Client <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional)</span>
                        </span>
                        <div style={{ position: 'relative' }}>
                            <select
                                value={clientId} onChange={e => setClientId(e.target.value)}
                                aria-label="Associate with client (optional)"
                                style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', border: '1.5px solid #e4e6ef', borderRadius: 8, padding: '9px 36px 9px 12px', fontSize: 14, background: '#fafafa', color: '#1a1d2e', outline: 'none', cursor: 'pointer' }}>
                                <option value="">No client</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <svg viewBox="0 0 20 20" width={15} height={15}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }}
                                fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="5 8 10 13 15 8" />
                            </svg>
                        </div>
                    </label>

                    <button className="primary" type="submit" disabled={busy || !url}>
                        <Search size={15} />
                        {busy ? 'Crawling…' : 'Start crawl'}
                    </button>
                </form>
                {error && <div className="error" role="alert" style={{ margin: '0 24px 16px' }}>{error}</div>}
            </section>

            {/* ── Empty state ── */}
            {!result && !busy && <CrawlerEmptyState />}

            {/* ── Results ── */}
            {result && (
                <>
                    {/* Summary stat strip */}
                    <section className="panel">
                        <div className="panel-heading">
                            <div>
                                <h2>Crawl summary</h2>
                                <p>Crawled {new URL(result.startUrl).hostname} · {new Date(result.crawledAt).toLocaleString()}</p>
                            </div>
                            <button className="secondary" onClick={exportXlsx} disabled={exporting}>
                                <Download size={15} />{exporting ? 'Exporting…' : 'Export XLSX'}
                            </button>
                        </div>

                        {/* Stat tiles */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border-subtle)' }}>
                            {[
                                { label: 'Pages attempted', value: String(result.pagesAttempted) },
                                { label: 'Pages scored', value: String(result.pagesScored) },
                                { label: 'Avg GEO score', value: result.avgScore !== null ? result.avgScore.toFixed(1) : '—' },
                                { label: 'Avg coverage', value: result.avgCoverage !== null ? result.avgCoverage.toFixed(1) + '%' : '—' },
                            ].map((m, i, arr) => (
                                <div key={m.label} style={{ padding: '18px 24px', borderRight: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>{m.label}</div>
                                    <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '1.625rem', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{m.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Common gaps */}
                        {result.commonGaps.length > 0 && (
                            <div style={{ padding: '16px 24px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>
                                    Common gaps across pages
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {result.commonGaps.slice(0, 12).map(g => (
                                        <div key={g.name} style={{ padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: '#1a1d2e', fontWeight: 600 }}>{g.name}</span>
                                            <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700, color: '#b91c1c', fontSize: 12 }}>{g.count}×</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Dimension aggregates (scr-3) */}
                    {result.dimensionAggregates.length > 0 && (
                        <DimensionAggregatesSection aggregates={result.dimensionAggregates} />
                    )}

                    {/* Top / bottom page callout */}
                    {(result.topPage || result.bottomPage) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
                            {result.topPage && (
                                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <TrendingUp size={18} color="#15803d" />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#15803d', marginBottom: 3 }}>Top page</div>
                                        <a href={result.topPage.url} target="_blank" rel="noopener noreferrer"
                                            style={{ fontSize: 12, color: '#15803d', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}>
                                            {result.topPage.url}
                                        </a>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginTop: 4 }}>{result.topPage.score}/100</div>
                                    </div>
                                </div>
                            )}
                            {result.bottomPage && (
                                <div style={{ background: '#fff7ed', border: '1px solid #fde68a', borderRadius: 9, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <TrendingDown size={18} color="#d97706" />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#d97706', marginBottom: 3 }}>Lowest page</div>
                                        <a href={result.bottomPage.url} target="_blank" rel="noopener noreferrer"
                                            style={{ fontSize: 12, color: '#b45309', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}>
                                            {result.bottomPage.url}
                                        </a>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginTop: 4 }}>{result.bottomPage.score}/100</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Page results table */}
                    <section className="panel">
                        <div className="panel-heading">
                            <div>
                                <h2>Page results</h2>
                                <p>{result.pages.length} pages crawled and scored</p>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6b7280', background: '#f7f8fa', borderBottom: '2px solid #e4e6ef' }}>URL</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6b7280', background: '#f7f8fa', borderBottom: '2px solid #e4e6ef', whiteSpace: 'nowrap' }}>GEO score</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6b7280', background: '#f7f8fa', borderBottom: '2px solid #e4e6ef' }}>Coverage</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6b7280', background: '#f7f8fa', borderBottom: '2px solid #e4e6ef' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.pages.map((page: PageCrawlResult, i: number) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                            <td style={{ padding: '10px 16px', maxWidth: 440, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <a href={page.url} target="_blank" rel="noopener noreferrer"
                                                    style={{ color: '#4f6ef7', fontSize: 13, fontWeight: 500 }}>
                                                    {page.url}
                                                </a>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <ScorePill score={page.audit?.score ?? null} />
                                            </td>
                                            <td style={{ padding: '10px 16px', fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, color: '#4b5563' }}>
                                                {page.audit?.coverage != null ? `${page.audit.coverage}%` : '—'}
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                {page.audit === null
                                                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b91c1c', fontSize: 13 }}>
                                                        <AlertTriangle size={13} />Not scored
                                                      </span>
                                                    : <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803d', fontSize: 13 }}>
                                                        <CheckCircle size={13} />Scored
                                                      </span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
