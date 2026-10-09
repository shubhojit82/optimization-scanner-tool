"use client";
import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import type { Client, Alert } from '../src/core/contracts';
import { api, del } from './workbench-api';

type Props = { client: Client; busy: boolean; onBusy: (b: boolean) => void };

const METRICS: { value: Alert['metric']; label: string }[] = [
    { value: 'mentionRate', label: 'Mention rate (%)' },
    { value: 'citationRate', label: 'Citation rate (%)' },
    { value: 'score', label: 'GEO score (0-100)' },
];

export function AlertsPanel({ client, busy, onBusy }: Props) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [metric, setMetric] = useState<Alert['metric']>('mentionRate');
    const [threshold, setThreshold] = useState(50);
    const [direction, setDirection] = useState<'below' | 'above'>('below');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        api<Alert[]>(`alerts/${client.id}`).then(setAlerts).catch(() => {});
    }, [client.id]);

    async function addAlert() {
        onBusy(true); setError('');
        try {
            const a = await api<Alert>('alerts', { clientId: client.id, metric, threshold, direction, enabled: true });
            setAlerts(prev => [...prev, a]);
            setNotice('Alert added.');
        } catch (e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    async function removeAlert(id: string) {
        onBusy(true); setError('');
        try {
            await del(`alerts/${client.id}/${id}`);
            setAlerts(prev => prev.filter(a => a.id !== id));
        } catch (e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    function metricLabel(m: Alert['metric']) { return METRICS.find(x => x.value === m)?.label ?? m; }

    return (
        <section className="panel">
            <div className="panel-heading">
                <div><h2>Alert thresholds</h2><p>Get notified when metrics breach configured thresholds after a probe run</p></div>
                <Bell size={18} color="var(--text-secondary)" />
            </div>

            {alerts.length > 0 && (
                <table style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Condition</th>
                            <th>Last triggered</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {alerts.map(a => (
                            <tr key={a.id}>
                                <td style={{ fontSize: '.875rem' }}>{metricLabel(a.metric)}</td>
                                <td style={{ fontSize: '.875rem', fontFamily: 'IBM Plex Mono,monospace' }}>
                                    {a.direction === 'below' ? '< ' : '> '}{a.threshold}
                                </td>
                                <td style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
                                    {a.lastTriggeredAt ? new Date(a.lastTriggeredAt).toLocaleDateString() : '—'}
                                </td>
                                <td>
                                    <span style={{ padding: '2px 8px', fontSize: '.6875rem', fontWeight: 600, background: a.enabled ? 'var(--tag-green-bg)' : 'var(--tag-gray-bg)', color: a.enabled ? 'var(--tag-green-text)' : 'var(--tag-gray-text)' }}>
                                        {a.enabled ? 'Active' : 'Paused'}
                                    </span>
                                </td>
                                <td>
                                    <button className="text-button" onClick={() => removeAlert(a.id)} disabled={busy} style={{ color: 'var(--score-danger)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <div style={{ padding: '16px 24px', borderTop: alerts.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>Add alert</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Metric
                        <select value={metric} onChange={e => setMetric(e.target.value as Alert['metric'])} style={{ height: 36, padding: '0 10px', border: 'none', borderBottom: '1px solid var(--border-strong)', background: 'var(--layer-01)', fontSize: '.875rem', borderRadius: 0, minWidth: 180 }}>
                            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Condition
                        <select value={direction} onChange={e => setDirection(e.target.value as 'below' | 'above')} style={{ height: 36, padding: '0 10px', border: 'none', borderBottom: '1px solid var(--border-strong)', background: 'var(--layer-01)', fontSize: '.875rem', borderRadius: 0, minWidth: 80 }}>
                            <option value="below">below</option>
                            <option value="above">above</option>
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Threshold
                        <input type="number" min={0} max={100} step={1} value={threshold} onChange={e => setThreshold(Number(e.target.value))} style={{ height: 36, width: 80, padding: '0 10px', border: 'none', borderBottom: '1px solid var(--border-strong)', background: 'var(--layer-01)', fontSize: '.875rem', borderRadius: 0, fontFamily: 'IBM Plex Mono,monospace' }} />
                    </label>
                    <button className="primary" onClick={addAlert} disabled={busy} style={{ height: 36, paddingRight: 16 }}>
                        <Plus size={15} />Add alert
                    </button>
                </div>
                {error && <div className="error" style={{ marginTop: 12 }} role="alert">{error}</div>}
                {notice && <div className="notice" style={{ marginTop: 12 }} role="status">{notice}</div>}
            </div>
        </section>
    );
}
