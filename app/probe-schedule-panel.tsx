"use client";
import { useState, useEffect } from 'react';
import { Calendar, Trash2, Plus } from 'lucide-react';
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

    return (
        <section className="panel">
            <div className="panel-heading">
                <div><h2>Automated re-probing</h2><p>Run probes on a schedule and save results to history automatically</p></div>
                <Calendar size={18} color="var(--text-secondary)" />
            </div>

            {schedules.length > 0 && (
                <div style={{ padding: '16px 24px', background: 'var(--layer-01)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: '.875rem', fontWeight: 600 }}>Active schedule: {schedules[0].cadence}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {schedules[0].providers.join(', ')} · {schedules[0].prompts.length} prompt{schedules[0].prompts.length !== 1 ? 's' : ''}
                            {schedules[0].nextRunAt && ` · Next: ${new Date(schedules[0].nextRunAt).toLocaleDateString()}`}
                        </div>
                    </div>
                    <button className="secondary danger" onClick={remove} disabled={busy}><Trash2 size={14} />Remove schedule</button>
                </div>
            )}

            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Cadence</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['daily', 'weekly', 'monthly'] as const).map(c => (
                        <button key={c} onClick={() => setCadence(c)} style={{ padding: '6px 16px', border: `1px solid ${cadence === c ? 'var(--interactive)' : 'var(--border-subtle)'}`, background: cadence === c ? 'var(--info-bg)' : 'var(--layer-01)', fontSize: '.875rem', borderRadius: 0, cursor: 'pointer', color: cadence === c ? 'var(--interactive)' : 'var(--text-primary)', fontWeight: cadence === c ? 600 : 400 }}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
                    ))}
                </div>
            </div>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Providers</div>
                {configured.length === 0
                    ? <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)' }}>No providers configured.</p>
                    : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {configured.map(p => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.875rem', cursor: 'pointer', padding: '6px 12px', border: `1px solid ${selectedProviders.includes(p.id) ? 'var(--interactive)' : 'var(--border-subtle)'}`, background: selectedProviders.includes(p.id) ? 'var(--info-bg)' : 'var(--layer-01)' }}>
                                <input type="checkbox" checked={selectedProviders.includes(p.id)} onChange={() => toggleProv(p.id)} style={{ accentColor: 'var(--interactive)' }} />
                                {p.label}
                            </label>
                        ))}
                    </div>
                }
            </div>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', maxHeight: 200, overflowY: 'auto' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Prompts (select from query universe)</div>
                {queries.slice(0, 20).map((q, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '.8125rem', cursor: 'pointer', padding: '4px 0', color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={selectedPrompts.includes(q.prompt)} onChange={() => togglePrompt(q.prompt)} style={{ accentColor: 'var(--interactive)', marginTop: 2 }} />
                        {q.prompt}
                    </label>
                ))}
                {queries.length === 0 && <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)' }}>No prompts available. Create a client with products and competitors first.</p>}
            </div>

            {error && <div className="error" style={{ margin: '12px 24px' }} role="alert">{error}</div>}
            {notice && <div className="notice" style={{ margin: '12px 24px' }} role="status">{notice}<button style={{ marginLeft: 8, background: 'none', color: 'inherit', fontSize: '.875rem' }} onClick={() => setNotice('')}>✕</button></div>}

            <div style={{ padding: '16px 24px' }}>
                <button className="primary" onClick={save} disabled={busy} style={{ height: 40, paddingRight: 16 }}>
                    <Plus size={16} />{schedules.length > 0 ? 'Update schedule' : 'Save schedule'}
                </button>
            </div>
        </section>
    );
}
