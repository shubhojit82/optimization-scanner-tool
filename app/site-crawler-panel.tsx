"use client";
import { useState } from 'react';
import { Globe, Download, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import type { Client } from '../src/core/contracts';
import type { SiteScanResult, PageCrawlResult } from '../src/server/site-crawler';

type Props = { clients: Client[]; busy: boolean; onBusy: (b: boolean) => void };

function ScorePill({ score }: { score: number | null }) {
    if (score === null) return <span style={{ fontFamily: 'IBM Plex Mono,monospace', color: 'var(--text-placeholder)', fontSize: '.8125rem' }}>—</span>;
    const color = score >= 75 ? 'var(--score-good)' : score >= 50 ? 'var(--warning)' : 'var(--score-danger)';
    return <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 600, fontSize: '.8125rem', color }}>{score}</span>;
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
        <div>
            <section className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-heading">
                    <div><h2>Site crawler</h2><p>Crawls up to 50 pages · max depth 3 · sequential with 600 ms delay between requests</p></div>
                    <Globe size={18} color="var(--text-secondary)" />
                </div>
                <form onSubmit={scan} style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <label style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Site URL
                        <input
                            type="url" required value={url} onChange={e => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            style={{ height: 40, padding: '0 12px', border: 'none', borderBottom: '1px solid var(--border-strong)', background: 'var(--layer-01)', fontSize: '.875rem', color: 'var(--text-primary)', borderRadius: 0 }}
                        />
                    </label>
                    <label style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Client (optional)
                        <select value={clientId} onChange={e => setClientId(e.target.value)}
                            style={{ height: 40, padding: '0 12px', border: 'none', borderBottom: '1px solid var(--border-strong)', background: 'var(--layer-01)', fontSize: '.875rem', color: 'var(--text-primary)', borderRadius: 0 }}>
                            <option value="">No client</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <button className="primary" type="submit" disabled={busy || !url} style={{ height: 40, paddingRight: 16 }}>
                        <Search size={16} />{busy ? 'Crawling…' : 'Start crawl'}
                    </button>
                </form>
            </section>

            {error && <div className="error" role="alert">{error}</div>}

            {result && (
                <>
                    <section className="panel" style={{ marginBottom: 16 }}>
                        <div className="panel-heading">
                            <div>
                                <h2>Crawl summary</h2>
                                <p>Crawled {new URL(result.startUrl).hostname} · {new Date(result.crawledAt).toLocaleString()}</p>
                            </div>
                            <button className="secondary" onClick={exportXlsx} disabled={exporting} style={{ height: 36 }}>
                                <Download size={15} />{exporting ? 'Exporting…' : 'Export XLSX'}
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border-subtle)' }}>
                            {[
                                { label: 'Pages attempted', value: result.pagesAttempted },
                                { label: 'Pages scored', value: result.pagesScored },
                                { label: 'Avg GEO score', value: result.avgScore !== null ? result.avgScore.toFixed(1) : '—' },
                                { label: 'Avg coverage', value: result.avgCoverage !== null ? result.avgCoverage.toFixed(1) + '%' : '—' },
                            ].map(m => (
                                <div key={m.label} style={{ padding: '20px 24px', borderRight: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '.6875rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>{m.label}</div>
                                    <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '1.5rem', fontWeight: 300, color: 'var(--text-primary)' }}>{m.value}</div>
                                </div>
                            ))}
                        </div>

                        {result.commonGaps.length > 0 && (
                            <div style={{ padding: '16px 24px' }}>
                                <div style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>Common gaps across pages</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {result.commonGaps.slice(0, 12).map(g => (
                                        <div key={g.name} style={{ padding: '6px 12px', background: 'var(--layer-01)', border: '1px solid var(--border-subtle)', fontSize: '.8125rem' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{g.name}</span>
                                            <span style={{ fontFamily: 'IBM Plex Mono,monospace', marginLeft: 8, fontWeight: 600, color: 'var(--score-danger)' }}>{g.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="panel">
                        <div className="panel-heading">
                            <div><h2>Page results</h2><p>{result.pages.length} pages crawled and scored</p></div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>URL</th>
                                    <th>GEO score</th>
                                    <th>Coverage</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.pages.map((page: PageCrawlResult, i: number) => (
                                    <tr key={i}>
                                        <td style={{ maxWidth: 440, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <a href={page.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--interactive)', fontSize: '.8125rem' }}>{page.url}</a>
                                        </td>
                                        <td><ScorePill score={page.audit?.score ?? null} /></td>
                                        <td style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
                                            {page.audit?.coverage != null ? `${page.audit.coverage}%` : '—'}
                                        </td>
                                        <td>
                                            {page.audit === null
                                                ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--score-danger)', fontSize: '.8125rem' }}><AlertTriangle size={13} />Not scored</span>
                                                : <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--score-good)', fontSize: '.8125rem' }}><CheckCircle size={13} />Scored</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </>
            )}
        </div>
    );
}
