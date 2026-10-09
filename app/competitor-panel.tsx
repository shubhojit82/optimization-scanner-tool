"use client";
import { useState } from 'react';
import { BarChart2, Globe, Plus, Trash2, X } from 'lucide-react';
import type { Client, CompetitorScanResult } from '../src/core/contracts';
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

export function CompetitorPanel({ client, busy, onBusy }: Props) {
    const [urls, setUrls] = useState<string[]>(client.competitors.length ? client.competitors.map(c => {
        try { return 'https://' + c.toLowerCase().replace(/\s+/g, '') + '.com'; } catch { return ''; }
    }).filter(Boolean) : ['']);
    const [results, setResults] = useState<CompetitorScanResult[] | null>(null);
    const [clientResult, setClientResult] = useState<CompetitorScanResult | null>(null);
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);

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
            // Scan client + competitors in parallel
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Competitor GEO Comparison</h2><p>Scan competitor URLs and compare SEO / AEO / GEO scores side-by-side.</p></div>
                    <BarChart2 size={19} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {urls.map((u, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="url"
                                placeholder="https://competitor.com"
                                value={u}
                                onChange={e => setUrl(i, e.target.value)}
                                style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fafafa' }}
                            />
                            <button className="secondary" onClick={() => removeUrl(i)} disabled={urls.length <= 1} style={{ padding: '7px 10px' }}><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="secondary" onClick={addUrl} disabled={urls.length >= 5}><Plus size={15} />Add URL</button>
                    <button className="primary" onClick={runScan} disabled={busy || scanning}>
                        {scanning ? <><Globe size={15} style={{ animation: 'spin 1s linear infinite' }} />Scanning…</> : <><Globe size={15} />Run Comparison</>}
                    </button>
                </div>
                {error && <div className="error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
            </section>

            {allResults.length > 0 && (
                <section className="panel">
                    <div className="panel-heading">
                        <div><h2>Comparison Results</h2><p>Ranked by overall GEO readiness score</p></div>
                    </div>

                    {/* Comparison table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#f7f8fa' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#57606a', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb' }}>Brand / URL</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#57606a', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', minWidth: 200 }}>Overall Score</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#3b82d4', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', minWidth: 160 }}>SEO</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#7c5cd8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', minWidth: 160 }}>AEO</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#14b8a6', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', minWidth: 160 }}>GEO</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#57606a', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb' }}>Top Gaps</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allResults.map((r, i) => (
                                    <tr key={i} style={{ background: r.isClient ? '#f0f7ff' : i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '10px 12px', fontWeight: r.isClient ? 700 : 400, maxWidth: 200, wordBreak: 'break-all' }}>
                                            <div>{r.name}</div>
                                            <div style={{ fontSize: 11, color: '#57606a', fontWeight: 400 }}>{r.url.replace(/^https?:\/\//, '').slice(0, 40)}</div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <ScoreBar value={r.score} color={scoreColor(r.score)} />
                                            <div style={{ fontSize: 11, color: '#57606a', marginTop: 2 }}>{r.coverage}% rubric coverage</div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}><ScoreBar value={r.subScores.seoScore} color="#3b82d4" /></td>
                                        <td style={{ padding: '10px 12px' }}><ScoreBar value={r.subScores.aeoScore} color="#7c5cd8" /></td>
                                        <td style={{ padding: '10px 12px' }}><ScoreBar value={r.subScores.geoScore} color="#14b8a6" /></td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                {r.topGaps.map((g, gi) => (
                                                    <li key={gi} style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <X size={10} />{g}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Insight note */}
                    <div style={{ marginTop: 14, padding: '10px 14px', background: '#f7f8fa', borderRadius: 6, fontSize: 12, color: '#57606a', borderLeft: '3px solid #3b82d4' }}>
                        <strong>How to use this:</strong> Focus on dimensions where competitors score higher than you — those gaps are where AI engines are more likely to cite them instead of your brand.
                        Address the top gaps shown above first, as they have the highest weighted impact on your overall score.
                    </div>
                </section>
            )}
        </div>
    );
}
