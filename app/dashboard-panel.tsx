"use client";
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
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
            <div className="panel">
                <div className="empty">
                    <p>No clients yet. Add your first client to populate the dashboard.</p>
                </div>
            </div>
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
                                        <div style={{ width: 28, height: 28, background: 'var(--interactive)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '.75rem', fontWeight: 600, flexShrink: 0 }}>
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
