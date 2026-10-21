"use client";
import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import type { Client, Alert } from '../src/core/contracts';
import { api, del } from './workbench-api';

type Props = { client: Client; busy: boolean; onBusy: (b: boolean) => void };

const METRICS: { value: Alert['metric']; label: string }[] = [
    { value: 'mentionRate', label: 'Mention rate (%)' },
    { value: 'citationRate', label: 'Citation rate (%)' },
    { value: 'score', label: 'GEO score (0-100)' },
];

function selectStyle(accent = false): React.CSSProperties {
    return {
        width: '100%', appearance: 'none', WebkitAppearance: 'none',
        border: `1.5px solid ${accent ? '#4f6ef7' : '#e4e6ef'}`, borderRadius: 8,
        padding: '8px 32px 8px 12px', fontSize: 13,
        background: '#fafafa', color: '#1a1d2e', outline: 'none', cursor: 'pointer',
    };
}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Alert thresholds</h2><p>Get notified when metrics breach configured thresholds after a probe run</p></div>
                    <Bell size={18} color="var(--text-secondary)" />
                </div>

                {/* Active alerts table */}
                {alerts.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f7f8fa' }}>
                                    {['Metric', 'Condition', 'Last triggered', 'Status', ''].map(h => (
                                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280', borderBottom: '2px solid #e4e6ef', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map(a => (
                                    <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#1a1d2e' }}>{metricLabel(a.metric)}</td>
                                        <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'IBM Plex Mono,monospace', color: '#374151' }}>
                                            {a.direction === 'below' ? '< ' : '> '}{a.threshold}
                                        </td>
                                        <td style={{ padding: '11px 16px', fontSize: 12, color: '#6b7280' }}>
                                            {a.lastTriggeredAt ? new Date(a.lastTriggeredAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td style={{ padding: '11px 16px' }}>
                                            <span style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, background: a.enabled ? '#dcfce7' : '#f3f4f6', color: a.enabled ? '#15803d' : '#6b7280' }}>
                                                {a.enabled ? 'Active' : 'Paused'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '11px 16px' }}>
                                            <button className="text-button" onClick={() => removeAlert(a.id)} disabled={busy} style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Add alert form */}
                <div style={{ padding: '16px 24px', borderTop: alerts.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 12 }}>Add alert</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: 180 }}>
                            Metric
                            <div style={{ position: 'relative' }}>
                                <select value={metric} onChange={e => setMetric(e.target.value as Alert['metric'])} style={selectStyle()}>
                                    {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <svg viewBox="0 0 20 20" width={14} height={14} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="5 8 10 13 15 8" /></svg>
                            </div>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: 110 }}>
                            Condition
                            <div style={{ position: 'relative' }}>
                                <select value={direction} onChange={e => setDirection(e.target.value as 'below' | 'above')} style={selectStyle()}>
                                    <option value="below">below</option>
                                    <option value="above">above</option>
                                </select>
                                <svg viewBox="0 0 20 20" width={14} height={14} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="5 8 10 13 15 8" /></svg>
                            </div>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: 90 }}>
                            Threshold
                            <input type="number" min={0} max={100} step={1} value={threshold} onChange={e => setThreshold(Number(e.target.value))}
                                style={{ border: '1.5px solid #e4e6ef', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fafafa', color: '#1a1d2e', outline: 'none', fontFamily: 'IBM Plex Mono, monospace', width: 90 }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#4f6ef7')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#e4e6ef')}
                            />
                        </label>
                        <button className="primary" onClick={addAlert} disabled={busy}>
                            <Plus size={15} />Add alert
                        </button>
                    </div>
                    {error && <div className="error" style={{ marginTop: 12 }} role="alert">{error}</div>}
                    {notice && <div className="notice" style={{ marginTop: 12 }} role="status">{notice}</div>}
                </div>
            </section>

            {/* ── Empty state (no alerts yet) ── */}
            {alerts.length === 0 && (
                <div style={{ background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)', border: '1px solid #e4e6ef', borderRadius: 10, padding: '32px 32px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flexShrink: 0 }}>
                        <svg width={200} height={120} viewBox="0 0 200 120" aria-hidden="true">
                            {/* Bell outline */}
                            <path d="M100 15 C75 15 58 33 58 55 L58 75 L45 88 L155 88 L142 75 L142 55 C142 33 125 15 100 15 Z" fill="#eef2ff" stroke="#4f6ef7" strokeWidth={1.5} />
                            <line x1={88} y1={88} x2={112} y2={88} stroke="#4f6ef7" strokeWidth={2} />
                            <circle cx={100} cy={95} r={6} fill="#4f6ef7" />
                            {/* Threshold line */}
                            <line x1={28} y1={55} x2={172} y2={55} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" />
                            <text x={175} y={59} fontSize={9} fill="#ef4444" fontWeight={700}>threshold</text>
                            {/* Down arrow (trigger) */}
                            <line x1={100} y1={35} x2={100} y2={52} stroke="#ef4444" strokeWidth={2} />
                            <polygon points="95,48 100,56 105,48" fill="#ef4444" />
                            <text x={100} y={110} textAnchor="middle" fontSize={9} fill="#9ca3af">metric drops below threshold → alert fires</text>
                        </svg>
                        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Illustrative — add a threshold to start monitoring</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>What alerts do</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { icon: <TrendingDown size={15} />, color: '#ef4444', bg: '#fef2f2', title: 'Fires when a metric drops below threshold', text: 'E.g. alert if mention rate falls below 40% after any probe run.' },
                                { icon: <TrendingUp size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Or when a metric rises above threshold', text: 'E.g. alert if GEO score exceeds 80 — useful for milestone tracking.' },
                                { icon: <Zap size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Checked automatically after every probe run', text: 'No manual checking needed — alerts are evaluated every time a probe completes.' },
                            ].map(item => (
                                <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1d2e' }}>{item.title}</div>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{item.text}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff', border: '1px solid #e4e6ef', borderRadius: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                            <strong style={{ color: '#4f6ef7' }}>To get started:</strong> Choose a metric, set a threshold, and click <strong>Add alert</strong> above.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
