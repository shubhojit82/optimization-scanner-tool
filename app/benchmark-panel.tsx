"use client";
import { useState } from 'react';
import { Plus, X, Zap, BarChart2, TrendingUp } from 'lucide-react';
import type { Client } from '../src/core/contracts';

type BenchmarkRow = {
    url: string;
    label: string;
    name: string;
    score: number;
    coverage: number;
    subScores: { seoScore: number | null; aeoScore: number | null; geoScore: number | null };
    topGaps: string[];
};

type Props = {
    client: Client;
    busy: boolean;
    onBusy: (b: boolean) => void;
};

function scoreColor(s: number | null): string {
    if (s === null) return '#9ca3af';
    if (s >= 80) return '#15803d';
    if (s >= 65) return '#0369a1';
    if (s >= 45) return '#b45309';
    return '#b91c1c';
}

function gradeLabel(s: number | null): string {
    if (s === null) return 'N/A';
    if (s >= 80) return 'A';
    if (s >= 65) return 'B';
    if (s >= 45) return 'C';
    if (s >= 25) return 'D';
    return 'F';
}

/** Mini horizontal bar: 0-100 value, coloured. */
function Bar({ value, color, max = 100 }: { value: number | null; color: string; max?: number }) {
    const pct = value === null ? 0 : Math.round((value / max) * 100);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 7, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: value === null ? '#9ca3af' : color, minWidth: 28, textAlign: 'right' }}>
                {value === null ? '—' : value}
            </span>
        </div>
    );
}

export function BenchmarkPanel({ client, busy, onBusy }: Props) {
    const [urls, setUrls] = useState<string[]>([client.domain, '']);
    const [labels, setLabels] = useState<string[]>([client.name, '']);
    const [results, setResults] = useState<BenchmarkRow[] | null>(null);
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);

    function addRow() {
        if (urls.length >= 6) return;
        setUrls(u => [...u, '']);
        setLabels(l => [...l, '']);
    }

    function removeRow(i: number) {
        setUrls(u => u.filter((_, j) => j !== i));
        setLabels(l => l.filter((_, j) => j !== i));
    }

    function setUrl(i: number, v: string) { setUrls(u => u.map((x, j) => j === i ? v : x)); }
    function setLabel(i: number, v: string) { setLabels(l => l.map((x, j) => j === i ? v : x)); }

    async function run() {
        setError('');
        const validUrls = urls.map(u => u.trim()).filter(Boolean);
        const validLabels = labels.map(l => l.trim());
        if (validUrls.length < 2) { setError('Enter at least 2 URLs to benchmark.'); return; }
        setScanning(true); onBusy(true);
        try {
            const r = await fetch('/api/v1/benchmark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
                body: JSON.stringify({ urls: validUrls, labels: validLabels }),
            });
            if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || 'Benchmark failed');
            const data: BenchmarkRow[] = await r.json();
            setResults(data.sort((a, b) => b.score - a.score));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setScanning(false); onBusy(false);
        }
    }

    // Find max score for relative bar scaling
    const maxScore = results ? Math.max(...results.map(r => r.score), 1) : 100;
    // Position of the "client" row by domain match
    const clientDomain = new URL(client.domain).hostname.replace(/^www\./, '');
    const clientIdx = results?.findIndex(r => {
        try { return new URL(r.url).hostname.replace(/^www\./, '') === clientDomain; } catch { return false; }
    }) ?? -1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── URL input table ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>URL Benchmark</h2>
                        <p>Score up to 6 URLs side-by-side — client page + industry peers. Results are cached for 5 minutes.</p>
                    </div>
                    <button className="secondary" onClick={addRow} disabled={urls.length >= 6 || busy}>
                        <Plus size={15} /> Add URL
                    </button>
                </div>
                <div style={{ padding: '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px 12px', alignItems: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase' }}>URL</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase' }}>Label (optional)</div>
                        <div />
                        {urls.map((url, i) => (
                            <>
                                <input
                                    key={`url-${i}`}
                                    type="url"
                                    value={url}
                                    onChange={e => setUrl(i, e.target.value)}
                                    placeholder={i === 0 ? client.domain : 'https://competitor.com'}
                                    style={{ fontSize: 13 }}
                                    disabled={busy}
                                />
                                <input
                                    key={`lbl-${i}`}
                                    type="text"
                                    value={labels[i] ?? ''}
                                    onChange={e => setLabel(i, e.target.value)}
                                    placeholder={i === 0 ? client.name : `Competitor ${i}`}
                                    style={{ fontSize: 13 }}
                                    disabled={busy}
                                />
                                <button
                                    key={`del-${i}`}
                                    className="secondary"
                                    onClick={() => removeRow(i)}
                                    disabled={urls.length <= 2 || busy}
                                    title="Remove this row"
                                    style={{ padding: '6px 10px' }}
                                >
                                    <X size={14} />
                                </button>
                            </>
                        ))}
                    </div>
                    {error && <div className="error" role="alert">{error}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <button className="primary" onClick={run} disabled={busy || scanning}>
                            <BarChart2 size={15} />
                            {scanning ? 'Scanning…' : `Run benchmark (${urls.filter(u => u.trim()).length} URLs)`}
                        </button>
                    </div>
                </div>
            </section>

            {/* ── League table ── */}
            {results && (
                <>
                    {/* Summary KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {[
                            { label: 'Benchmark leader', value: results[0]?.label ?? '—', sub: `Score: ${results[0]?.score ?? '—'}`, color: '#0d8073', icon: <TrendingUp size={18} /> },
                            { label: `${results[clientIdx >= 0 ? clientIdx : 0]?.label ?? client.name} rank`, value: clientIdx >= 0 ? `#${clientIdx + 1} of ${results.length}` : 'N/A', sub: clientIdx >= 0 ? `Score: ${results[clientIdx].score}` : 'Not in results', color: '#3b82d4', icon: <Zap size={18} /> },
                            { label: 'Score range', value: `${results[results.length - 1]?.score ?? '—'} – ${results[0]?.score ?? '—'}`, sub: `${results.length} URLs scored`, color: '#7c5cd8', icon: <BarChart2 size={18} /> },
                        ].map(card => (
                            <div key={card.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <div style={{ color: card.color, marginTop: 2 }}>{card.icon}</div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 4 }}>{card.label}</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                                    <div style={{ fontSize: 11, color: '#57606a', marginTop: 3 }}>{card.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* League table */}
                    <section className="panel">
                        <div className="panel-heading">
                            <div>
                                <h2>League Table</h2>
                                <p>Ranked by overall GEO score · SEO / AEO / GEO sub-scores shown · client row highlighted</p>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: '#f7f8fa', borderBottom: '2px solid #e5e7eb' }}>
                                        {['Rank', 'Site', 'Overall', 'SEO', 'AEO', 'GEO', 'Coverage', 'Top gaps'].map(h => (
                                            <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#8b9aa6', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row, i) => {
                                        const isClient = i === clientIdx;
                                        const oc = scoreColor(row.score);
                                        return (
                                            <tr key={row.url} style={{ borderBottom: '1px solid #f0f2f5', background: isClient ? '#f0f9ff' : i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 700, color: i === 0 ? '#0d8073' : '#57606a' }}>
                                                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#0d8073' : '#e5e7eb', color: i === 0 ? '#fff' : '#57606a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px', minWidth: 160 }}>
                                                    <div style={{ fontWeight: 700, color: '#213f50', fontSize: 13 }}>
                                                        {row.label}
                                                        {isClient && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#3b82d4', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>CLIENT</span>}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#8b9aa6', marginTop: 2 }}>{new URL(row.url).hostname}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px', minWidth: 130 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ flex: 1, height: 8, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                                                            <div style={{ height: '100%', width: `${Math.round(row.score / maxScore * 100)}%`, background: oc, borderRadius: 4 }} />
                                                        </div>
                                                        <span style={{ fontSize: 14, fontWeight: 800, color: oc, minWidth: 28 }}>{row.score}</span>
                                                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: scoreColor(row.score) + '18', color: scoreColor(row.score) }}>{gradeLabel(row.score)}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 16px', minWidth: 110 }}>
                                                    <Bar value={row.subScores.seoScore} color="#3b82d4" />
                                                </td>
                                                <td style={{ padding: '12px 16px', minWidth: 110 }}>
                                                    <Bar value={row.subScores.aeoScore} color="#7c5cd8" />
                                                </td>
                                                <td style={{ padding: '12px 16px', minWidth: 110 }}>
                                                    <Bar value={row.subScores.geoScore} color="#0d8073" />
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#57606a', fontWeight: 500 }}>{row.coverage}%</td>
                                                <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                        {row.topGaps.slice(0, 3).map(g => (
                                                            <span key={g} style={{ fontSize: 11, color: '#57606a', background: '#f7f8fa', borderRadius: 4, padding: '2px 7px', display: 'inline-block' }}>{g}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Gap analysis: where does the client lag the leader? */}
                    {clientIdx >= 0 && clientIdx > 0 && (() => {
                        const leader = results[0];
                        const mine = results[clientIdx];
                        const gaps: { dim: string; gap: number }[] = [];
                        if (leader.subScores.seoScore !== null && mine.subScores.seoScore !== null && leader.subScores.seoScore > mine.subScores.seoScore) gaps.push({ dim: 'SEO', gap: leader.subScores.seoScore - mine.subScores.seoScore });
                        if (leader.subScores.aeoScore !== null && mine.subScores.aeoScore !== null && leader.subScores.aeoScore > mine.subScores.aeoScore) gaps.push({ dim: 'AEO', gap: leader.subScores.aeoScore - mine.subScores.aeoScore });
                        if (leader.subScores.geoScore !== null && mine.subScores.geoScore !== null && leader.subScores.geoScore > mine.subScores.geoScore) gaps.push({ dim: 'GEO', gap: leader.subScores.geoScore - mine.subScores.geoScore });
                        if (!gaps.length) return null;
                        return (
                            <section className="panel">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Gap vs Leader ({leader.label})</h2>
                                        <p>Dimensions where {mine.label} trails the benchmark leader — close these first</p>
                                    </div>
                                </div>
                                <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                    {gaps.sort((a, b) => b.gap - a.gap).map(g => {
                                        const col = g.dim === 'SEO' ? '#3b82d4' : g.dim === 'AEO' ? '#7c5cd8' : '#0d8073';
                                        return (
                                            <div key={g.dim} style={{ flex: '1 1 160px', background: '#fff8f3', border: '1px solid #fed7aa', borderRadius: 9, padding: '14px 16px' }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: col, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>{g.dim} gap</div>
                                                <div style={{ fontSize: 28, fontWeight: 800, color: '#b45309', lineHeight: 1 }}>–{g.gap} pts</div>
                                                <div style={{ fontSize: 11, color: '#57606a', marginTop: 4 }}>
                                                    {mine.label}: {g.dim === 'SEO' ? mine.subScores.seoScore : g.dim === 'AEO' ? mine.subScores.aeoScore : mine.subScores.geoScore} vs leader: {g.dim === 'SEO' ? leader.subScores.seoScore : g.dim === 'AEO' ? leader.subScores.aeoScore : leader.subScores.geoScore}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ padding: '0 24px 16px' }}>
                                    <div style={{ fontSize: 12, color: '#57606a', background: '#f7f8fa', borderRadius: 7, padding: '10px 14px', lineHeight: 1.6 }}>
                                        Top gaps to close on {mine.label}: {mine.topGaps.join(' · ')}
                                    </div>
                                </div>
                            </section>
                        );
                    })()}
                </>
            )}
        </div>
    );
}
