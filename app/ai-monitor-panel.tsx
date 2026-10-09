"use client";
import { useState } from 'react';
import { Zap, Edit3 } from 'lucide-react';
import type { Client, ProbeRun, ProviderInfo } from '../src/core/contracts';
import { api } from './workbench-api';

type Props = {
    client: Client;
    providers: ProviderInfo[];
    busy: boolean;
    onBusy: (b: boolean) => void;
};

function monitorPrompts(client: Client): string[] {
    return [
        `What do AI search engines currently say about ${client.name}?`,
        `Summarise what AI-generated answers say about ${client.name} in ${client.market}.`,
        `List companies mentioned in AI answers about ${client.industry} in ${client.market}.`,
        `When users ask about ${client.industry} solutions, does ${client.name} appear in AI-generated results?`,
        `What reputation or sentiment does ${client.name} have in AI-generated search answers?`,
    ];
}

export function AiMonitorPanel({ client, providers, busy, onBusy }: Props) {
    const [prompts, setPrompts] = useState<string[]>(() => monitorPrompts(client));
    const [selectedProviders, setSelectedProviders] = useState<string[]>(
        providers.filter(p => p.configured).map(p => p.id).slice(0, 2)
    );
    const [result, setResult] = useState<ProbeRun | null>(null);
    const [error, setError] = useState('');

    function toggleProvider(id: string) {
        setSelectedProviders(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }

    function updatePrompt(i: number, value: string) {
        setPrompts(prev => prev.map((p, idx) => idx === i ? value : p));
    }

    async function run() {
        if (!selectedProviders.length) return;
        onBusy(true); setError(''); setResult(null);
        try {
            const run = await api<ProbeRun>('probe', {
                clientId: client.id,
                prompts: prompts.filter(Boolean),
                providers: selectedProviders,
            });
            setResult(run);
        } catch (e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    const configuredProviders = providers.filter(p => p.configured);

    return (
        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>AI Search Monitor</h2>
                    <p>Passive brand monitoring — measures what AI engines say about {client.name} without user-query framing</p>
                </div>
                <Zap size={18} color="var(--text-secondary)" />
            </div>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Monitor prompts <span style={{ fontSize: '.6875rem', color: 'var(--text-placeholder)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— edit before running</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {prompts.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <Edit3 size={13} style={{ marginTop: 9, flexShrink: 0, color: 'var(--text-secondary)' }} />
                            <input
                                value={p}
                                onChange={e => updatePrompt(i, e.target.value)}
                                style={{ flex: 1, height: 36, padding: '0 10px', border: 'none', borderBottom: '1px solid var(--border-subtle)', background: 'var(--layer-01)', fontSize: '.875rem', color: 'var(--text-primary)', borderRadius: 0 }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>AI engines</div>
                {configuredProviders.length === 0
                    ? <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)' }}>No AI providers configured. Add API keys in your .env file.</p>
                    : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {configuredProviders.map(p => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.875rem', cursor: 'pointer', padding: '6px 12px', border: `1px solid ${selectedProviders.includes(p.id) ? 'var(--interactive)' : 'var(--border-subtle)'}`, background: selectedProviders.includes(p.id) ? 'var(--info-bg)' : 'var(--layer-01)' }}>
                                <input type="checkbox" checked={selectedProviders.includes(p.id)} onChange={() => toggleProvider(p.id)} style={{ accentColor: 'var(--interactive)' }} />
                                {p.label}
                            </label>
                        ))}
                    </div>
                }
            </div>

            <div style={{ padding: '16px 24px', borderBottom: result ? '1px solid var(--border-subtle)' : 'none' }}>
                <button className="primary" onClick={run} disabled={busy || !selectedProviders.length || !prompts.filter(Boolean).length} style={{ height: 40, paddingRight: 16 }}>
                    <Zap size={16} />{busy ? 'Running monitor…' : 'Run AI monitor'}
                </button>
                {error && <div className="error" style={{ marginTop: 12 }} role="alert">{error}</div>}
            </div>

            {result && (
                <div style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
                        {[
                            { label: 'Mention rate', value: result.mentionRate !== null ? result.mentionRate + '%' : '—' },
                            { label: 'Citation rate', value: result.citationRate !== null ? result.citationRate + '%' : '—' },
                            { label: 'Prompts fired', value: result.prompts.length },
                            { label: 'Responses', value: result.results.length },
                        ].map(m => (
                            <div key={m.label}>
                                <div style={{ fontSize: '.6875rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>{m.label}</div>
                                <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.value}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.results.map((r, i) => (
                            <details key={i} style={{ border: '1px solid var(--border-subtle)', background: 'var(--layer-01)' }}>
                                <summary style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>{r.prompt.length > 80 ? r.prompt.slice(0, 80) + '…' : r.prompt}</span>
                                    <span style={{ fontSize: '.75rem', color: r.brandMentioned ? 'var(--score-good)' : 'var(--text-secondary)', marginLeft: 12, flexShrink: 0 }}>
                                        {r.brandMentioned ? '✓ Mentioned' : '✗ Not mentioned'}
                                    </span>
                                </summary>
                                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '.875rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                                    <div style={{ marginBottom: 8, fontSize: '.75rem', color: 'var(--text-secondary)' }}>{r.engine} · {r.model}</div>
                                    {r.response}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
