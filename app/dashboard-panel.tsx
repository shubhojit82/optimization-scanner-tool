"use client";
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight, LayoutDashboard, Activity, BarChart2, Globe } from 'lucide-react';
import type { Client, Audit } from '../src/core/contracts';
import { api } from './workbench-api';

type ClientRow = {
    client: Client;
    latestAudit: Audit | null;
    prevAudit: Audit | null;
    mentionRate: number | null;
    citationRate: number | null;
};

type Props = {
    clients: Client[];
    onSelect: (id: string) => void;
};

function ScoreBadge({ score }: { score: number | null }) {
    if (score === null) return <span style={{ fontFamily: 'IBM Plex Mono,monospace', color: 'var(--text-placeholder)', fontSize: '.875rem' }}>—</span>;
    const color = score >= 75 ? 'var(--score-good)' : score >= 50 ? 'var(--warning)' : 'var(--score-danger)';
    return (
        <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 600, fontSize: '.875rem', color }}>{score}</span>
    );
}

function Trend({ prev, curr }: { prev: number | null; curr: number | null }) {
    if (prev === null || curr === null) return <Minus size={14} color="var(--text-placeholder)" />;
    const diff = curr - prev;
    if (diff === 0) return <Minus size={14} color="var(--text-secondary)" />;
    return diff > 0
        ? <TrendingUp size={14} color="var(--score-good)" />
        : <TrendingDown size={14} color="var(--score-danger)" />;
}

function DashboardEmptyState() {
    return (
        <div style={{
            background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)',
            border: '1px solid #e4e6ef',
            borderRadius: 10,
            padding: '36px 32px',
            display: 'flex',
            gap: 48,
            alignItems: 'center',
            flexWrap: 'wrap',
        }}>
            {/* SVG illustration — grid of client cards */}
            <div style={{ flexShrink: 0 }}>
                <svg width={220} height={130} viewBox="0 0 220 130" aria-hidden="true">
                    {/* Card 1 */}
                    <rect x={10} y={20} width={90} height={50} rx={7} fill="#fff" stroke="#e4e6ef" strokeWidth={1.5} />
                    <circle cx={28} cy={38} r={9} fill="#eef2ff" stroke="#4f6ef7" strokeWidth={1.5} />
                    <text x={28} y={42} textAnchor="middle" fontSize={9} fontWeight={700} fill="#4f6ef7">A</text>
                    <rect x={42} y={32} width={42} height={6} rx={3} fill="#e4e6ef" />
                    <rect x={42} y={43} width={28} height={4} rx={2} fill="#f0f4ff" />
                    <rect x={17} y={56} width={20} height={8} rx={4} fill="#ecfdf5" />
                    <text x={27} y={63} textAnchor="middle" fontSize={7} fontWeight={700} fill="#15803d">78</text>
                    <rect x={41} y={56} width={20} height={8} rx={4} fill="#fef9c3" />
                    <text x={51} y={63} textAnchor="middle" fontSize={7} fontWeight={700} fill="#a16207">64</text>
                    {/* Card 2 */}
                    <rect x={120} y={20} width={90} height={50} rx={7} fill="#fff" stroke="#e4e6ef" strokeWidth={1.5} />
                    <circle cx={138} cy={38} r={9} fill="#f5f3ff" stroke="#8b5cf6" strokeWidth={1.5} />
                    <text x={138} y={42} textAnchor="middle" fontSize={9} fontWeight={700} fill="#8b5cf6">B</text>
                    <rect x={152} y={32} width={42} height={6} rx={3} fill="#e4e6ef" />
                    <rect x={152} y={43} width={28} height={4} rx={2} fill="#f5f3ff" />
                    <rect x={127} y={56} width={20} height={8} rx={4} fill="#fef2f2" />
                    <text x={137} y={63} textAnchor="middle" fontSize={7} fontWeight={700} fill="#dc2626">42</text>
                    <rect x={151} y={56} width={20} height={8} rx={4} fill="#f3f4f6" />
                    <text x={161} y={63} textAnchor="middle" fontSize={7} fill="#6b7280">—</text>
                    {/* Add client hint */}
                    <rect x={65} y={90} width={90} height={30} rx={7} fill="#eef2ff" stroke="#4f6ef7" strokeWidth={1.5} strokeDasharray="4 3" />
                    <text x={110} y={108} textAnchor="middle" fontSize={10} fontWeight={600} fill="#4f6ef7">+ Add client</text>
                </svg>
                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>All your clients at a glance</p>
            </div>

            {/* Explainer tiles */}
            <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>
                    What the dashboard shows
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                        { icon: <Activity size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'GEO score per client', text: 'Latest audit score, trend arrow vs previous audit, and last run date.' },
                        { icon: <BarChart2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Mention & citation rates', text: 'Live AI visibility KPIs pulled from probe runs for each client.' },
                        { icon: <Globe size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'One-click navigation', text: 'Click any row to jump straight into that client\'s full workspace.' },
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
                    <strong style={{ color: '#4f6ef7' }}>To get started:</strong> Click <strong>+ New client</strong> in the top bar to add your first brand or domain.
                </div>
            </div>
        </div>
    );
}

export function DashboardPanel({ clients, onSelect }: Props) {
    const [rows, setRows] = useState<ClientRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<'name' | 'score' | 'mentionRate' | 'citationRate' | 'lastAudit'>('score');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        let alive = true;
        setLoading(true);
        Promise.all(
            clients.map(client =>
                api<{ client: Client; audits: Audit[]; visibility: { mentionRate: number | null; citationRate: number | null } }>('clients/' + client.id)
                    .then(d => ({
                        client: d.client,
                        latestAudit: d.audits[0] ?? null,
                        prevAudit: d.audits[1] ?? null,
                        mentionRate: d.visibility.mentionRate,
                        citationRate: d.visibility.citationRate,
                    }))
                    .catch(() => ({ client, latestAudit: null, prevAudit: null, mentionRate: null, citationRate: null }))
            )
        ).then(r => { if (alive) { setRows(r); setLoading(false); } });
        return () => { alive = false; };
    }, [clients]);

    function toggleSort(key: typeof sortKey) {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    }

    const sorted = [...rows].sort((a, b) => {
        let va: number | string | null, vb: number | string | null;
        if (sortKey === 'name') { va = a.client.name; vb = b.client.name; }
        else if (sortKey === 'score') { va = a.latestAudit?.score ?? null; vb = b.latestAudit?.score ?? null; }
        else if (sortKey === 'mentionRate') { va = a.mentionRate; vb = b.mentionRate; }
        else if (sortKey === 'citationRate') { va = a.citationRate; vb = b.citationRate; }
        else { va = a.latestAudit?.created ?? ''; vb = b.latestAudit?.created ?? ''; }
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
    });

    function SortTh({ label, col }: { label: string; col: typeof sortKey }) {
        const active = sortKey === col;
        return (
            <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                {label}
                {active && <span style={{ marginLeft: 4, fontSize: '.625rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </th>
        );
    }

    if (clients.length === 0) {
        return (
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Dashboard</h2>
                        <p>All clients at a glance — scores, visibility KPIs, and trends.</p>
                    </div>
                    <LayoutDashboard size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                </div>
                <div style={{ padding: '0 24px 28px' }}>
                    <DashboardEmptyState />
                </div>
            </section>
        );
    }

    return (
        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>All clients</h2>
                    <p>{clients.length} client{clients.length !== 1 ? 's' : ''} · sorted by {sortKey} {sortDir === 'asc' ? '↑' : '↓'}</p>
                </div>
            </div>
            {loading ? (
                <div className="empty" style={{ padding: 32 }}>Loading client data…</div>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <SortTh label="Client" col="name" />
                            <th>Domain</th>
                            <SortTh label="GEO Score" col="score" />
                            <SortTh label="Mention Rate" col="mentionRate" />
                            <SortTh label="Citation Rate" col="citationRate" />
                            <SortTh label="Last Audit" col="lastAudit" />
                            <th>Trend</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(row => (
                            <tr key={row.client.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(row.client.id)}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 28, height: 28, background: '#eef2ff', border: '1.5px solid #c7d2fe', color: '#3730a3', borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>
                                            {row.client.name.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{row.client.name}</div>
                                            <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{row.client.industry}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ fontSize: '.8125rem', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.client.domain.replace('https://', '').replace('http://', '')}
                                </td>
                                <td><ScoreBadge score={row.latestAudit?.score ?? null} /></td>
                                <td><ScoreBadge score={row.mentionRate} /></td>
                                <td><ScoreBadge score={row.citationRate} /></td>
                                <td style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono,monospace' }}>
                                    {row.latestAudit ? new Date(row.latestAudit.created).toLocaleDateString() : '—'}
                                </td>
                                <td><Trend prev={row.prevAudit?.score ?? null} curr={row.latestAudit?.score ?? null} /></td>
                                <td>
                                    <button className="text-button" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <ArrowRight size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
