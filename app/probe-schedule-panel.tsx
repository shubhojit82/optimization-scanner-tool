"use client";
import { useState, useEffect } from 'react';
import { Calendar, Trash2, Plus, Zap, Clock, RefreshCw } from 'lucide-react';
import type { Client, ProviderInfo, ProbeSchedule } from '../src/core/contracts';
import { api, del } from './workbench-api';

type Props = {
    client: Client;
    providers: ProviderInfo[];
    queries: { prompt: string }[];
    busy: boolean;
    onBusy: (b: boolean) => void;
};

export function ProbeSchedulePanel({ client, providers, queries, busy, onBusy }: Props) {
    const [schedules, setSchedules] = useState<ProbeSchedule[]>([]);
    const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
    const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const configured = providers.filter(p => p.configured);

    useEffect(() => {
        api<ProbeSchedule[]>(`schedules/${client.id}`).then(setSchedules).catch(() => {});
    }, [client.id]);

    function toggleProv(id: string) { setSelectedProviders(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
    function togglePrompt(p: string) { setSelectedPrompts(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]); }

    async function save() {
        if (!selectedProviders.length || !selectedPrompts.length) { setError('Select at least one provider and one prompt.'); return; }
        onBusy(true); setError('');
        try {
            const s = await api<ProbeSchedule>('schedules', { clientId: client.id, cadence, providers: selectedProviders, prompts: selectedPrompts, enabled: true });
            setSchedules([s]);
            setNotice('Schedule saved. Next run: ' + new Date(s.nextRunAt).toLocaleDateString());
        } catch (e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    async function remove() {
        onBusy(true); setError('');
        try {
            await del(`schedules/${client.id}`);
            setSchedules([]);
            setNotice('Schedule removed.');
        } catch (e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    const hasSchedule = schedules.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Automated re-probing</h2><p>Run probes on a schedule and save results to history automatically</p></div>
                    <Calendar size={18} color="var(--text-secondary)" />
                </div>

                {/* Active schedule banner */}
                {hasSchedule && (
                    <div style={{ padding: '14px 24px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, background: '#dcfce7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Calendar size={15} color="#15803d" />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                                    Active: {schedules[0].cadence.charAt(0).toUpperCase() + schedules[0].cadence.slice(1)} re-probe
                                </div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                                    {schedules[0].providers.join(', ')} · {schedules[0].prompts.length} prompt{schedules[0].prompts.length !== 1 ? 's' : ''}
                                    {schedules[0].nextRunAt && ` · Next: ${new Date(schedules[0].nextRunAt).toLocaleDateString()}`}
                                </div>
                            </div>
                        </div>
                        <button className="secondary danger" onClick={remove} disabled={busy}><Trash2 size={14} />Remove schedule</button>
                    </div>
                )}

                {/* Cadence */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>Cadence</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {(['daily', 'weekly', 'monthly'] as const).map(c => (
                            <button key={c} onClick={() => setCadence(c)} style={{
                                padding: '8px 18px', border: `1.5px solid ${cadence === c ? '#4f6ef7' : '#e4e6ef'}`,
                                background: cadence === c ? '#eef2ff' : '#fafafa',
                                fontSize: 13, borderRadius: 8, cursor: 'pointer',
                                color: cadence === c ? '#3730a3' : '#374151',
                                fontWeight: cadence === c ? 700 : 400,
                                transition: 'all .12s',
                            }}>
                                {c.charAt(0).toUpperCase() + c.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Providers */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>Providers</div>
                    {configured.length === 0
                        ? <p style={{ fontSize: 13, color: '#6b7280' }}>No providers configured. Add API keys in your .env file.</p>
                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {configured.map(p => (
                                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '7px 14px', border: `1.5px solid ${selectedProviders.includes(p.id) ? '#4f6ef7' : '#e4e6ef'}`, borderRadius: 8, background: selectedProviders.includes(p.id) ? '#eef2ff' : '#fafafa', fontWeight: selectedProviders.includes(p.id) ? 600 : 400 }}>
                                    <input type="checkbox" checked={selectedProviders.includes(p.id)} onChange={() => toggleProv(p.id)} style={{ accentColor: '#4f6ef7' }} />
                                    {p.label}
                                </label>
                            ))}
                        </div>
                    }
                </div>

                {/* Prompts */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', maxHeight: 220, overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>Prompts</div>
                    {queries.length === 0
                        ? <p style={{ fontSize: 13, color: '#6b7280' }}>No prompts available. Create a client with products and competitors first.</p>
                        : queries.slice(0, 20).map((q, i) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: 'pointer', padding: '5px 0', color: '#374151', borderBottom: '1px solid #f9fafb' }}>
                                <input type="checkbox" checked={selectedPrompts.includes(q.prompt)} onChange={() => togglePrompt(q.prompt)} style={{ accentColor: '#4f6ef7', marginTop: 2 }} />
                                <span style={{ lineHeight: 1.5 }}>{q.prompt}</span>
                            </label>
                        ))
                    }
                </div>

                {error && <div className="error" style={{ margin: '12px 24px 0' }} role="alert">{error}</div>}
                {notice && <div className="notice" style={{ margin: '12px 24px 0' }} role="status">{notice}<button style={{ marginLeft: 8, background: 'none', color: 'inherit', fontSize: 13 }} onClick={() => setNotice('')}>✕</button></div>}

                <div style={{ padding: '16px 24px' }}>
                    <button className="primary" onClick={save} disabled={busy}>
                        <Plus size={15} />{hasSchedule ? 'Update schedule' : 'Save schedule'}
                    </button>
                </div>
            </section>

            {/* ── Empty state (no schedule configured) ── */}
            {!hasSchedule && (
                <div style={{ background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)', border: '1px solid #e4e6ef', borderRadius: 10, padding: '32px 32px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flexShrink: 0 }}>
                        <svg width={200} height={120} viewBox="0 0 200 120" aria-hidden="true">
                            {/* Calendar grid */}
                            <rect x={40} y={10} width={120} height={100} rx={8} fill="#fff" stroke="#e4e6ef" strokeWidth={1.5} />
                            <rect x={40} y={10} width={120} height={28} rx={8} fill="#4f6ef7" />
                            <rect x={40} y={30} width={120} height={8} fill="#4f6ef7" />
                            <text x={100} y={30} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">Schedule</text>
                            {/* Day cells */}
                            {[[52,50],[72,50],[92,50],[112,50],[132,50],[152,50],
                              [52,70],[72,70],[92,70],[112,70],[132,70],[152,70],
                              [52,90],[72,90],[92,90]].map(([cx,cy],i)=>(
                                <circle key={i} cx={cx} cy={cy} r={7}
                                    fill={[2,8,14].includes(i) ? '#4f6ef7' : '#f3f4f6'}
                                    stroke={[2,8,14].includes(i) ? '#4f6ef7' : '#e4e6ef'} strokeWidth={1}/>
                            ))}
                            {/* Clock icon in corner */}
                            <circle cx={152} cy={90} r={12} fill="#ecfdf5" stroke="#86efac" strokeWidth={1.5}/>
                            <circle cx={152} cy={90} r={5} fill="none" stroke="#15803d" strokeWidth={1.5}/>
                            <line x1={152} y1={90} x2={152} y2={86} stroke="#15803d" strokeWidth={1.5}/>
                            <line x1={152} y1={90} x2={155} y2={90} stroke="#15803d" strokeWidth={1.5}/>
                        </svg>
                        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Illustrative — save a schedule to automate probes</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>What automated re-probing does</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { icon: <RefreshCw size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Runs probes automatically', text: 'No manual trigger needed — probes fire daily, weekly, or monthly on schedule.' },
                                { icon: <Clock size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Builds a trend history', text: 'Every scheduled run is saved to AI Visibility history for KPI trend tracking.' },
                                { icon: <Zap size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Same engines, same prompts', text: 'Consistent measurement conditions let you compare results meaningfully over time.' },
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
                            <strong style={{ color: '#4f6ef7' }}>To get started:</strong> Select a cadence, pick providers and prompts above, then click <strong>Save schedule</strong>.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
