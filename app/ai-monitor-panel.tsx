"use client";
import { useState } from 'react';
import { Zap, Edit3, BarChart2, TrendingUp, History, MessageCircle } from 'lucide-react';
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
            const r = await api<ProbeRun>('probe', {
                clientId: client.id,
                prompts: prompts.filter(Boolean),
                providers: selectedProviders,
            });
            setResult(r);
        } catch (e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    const configuredProviders = providers.filter(p => p.configured);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>AI Search Monitor</h2>
                        <p>Passive brand monitoring — measures what AI engines say about {client.name} without user-query framing</p>
                    </div>
                    <Zap size={18} color="var(--text-secondary)" />
                </div>

                {/* Prompts */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>
                        Monitor prompts <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>— edit before running</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {prompts.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <Edit3 size={13} style={{ marginTop: 11, flexShrink: 0, color: '#9ca3af' }} />
                                <input
                                    value={p}
                                    onChange={e => updatePrompt(i, e.target.value)}
                                    style={{ flex: 1, height: 38, padding: '0 12px', border: '1.5px solid #e4e6ef', borderRadius: 7, background: '#fafafa', fontSize: 13, color: '#1a1d2e', outline: 'none' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#4f6ef7')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#e4e6ef')}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Providers */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>AI engines</div>
                    {configuredProviders.length === 0
                        ? <p style={{ fontSize: 13, color: '#6b7280' }}>No AI providers configured. Add API keys in your .env file.</p>
                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {configuredProviders.map(p => (
                                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '7px 14px', border: `1.5px solid ${selectedProviders.includes(p.id) ? '#4f6ef7' : '#e4e6ef'}`, borderRadius: 8, background: selectedProviders.includes(p.id) ? '#eef2ff' : '#fafafa', fontWeight: selectedProviders.includes(p.id) ? 600 : 400 }}>
                                    <input type="checkbox" checked={selectedProviders.includes(p.id)} onChange={() => toggleProvider(p.id)} style={{ accentColor: '#4f6ef7' }} />
                                    {p.label}
                                </label>
                            ))}
                        </div>
                    }
                </div>

                {/* Run button */}
                <div style={{ padding: '16px 24px' }}>
                    <button className="primary" onClick={run} disabled={busy || !selectedProviders.length || !prompts.filter(Boolean).length}>
                        <Zap size={15} />{busy ? 'Running monitor…' : 'Run AI monitor'}
                    </button>
                    {error && <div className="error" style={{ marginTop: 12 }} role="alert">{error}</div>}
                </div>
            </section>

            {/* ── Empty state ── */}
            {!result && !busy && (
                <div style={{ background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)', border: '1px solid #e4e6ef', borderRadius: 10, padding: '32px 32px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flexShrink: 0 }}>
                        <svg width={220} height={120} viewBox="0 0 220 120" aria-hidden="true">
                            {/* Radar pulse rings */}
                            {[40, 56, 72].map((r, i) => (
                                <circle key={r} cx={110} cy={60} r={r} fill="none" stroke="#4f6ef7" strokeWidth={1} opacity={0.15 + i * 0.12} />
                            ))}
                            {/* Centre brand dot */}
                            <circle cx={110} cy={60} r={12} fill="#4f6ef7" />
                            <text x={110} y={64} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">Brand</text>
                            {/* Engine dots */}
                            {[[55, 28, '#15803d', 'AI'], [175, 30, '#1a73e8', 'AI'], [55, 92, '#7c5cd8', 'AI'], [175, 90, '#d97706', 'AI']].map(([ex, ey, col, lbl], i) => (
                                <g key={i}>
                                    <circle cx={ex as number} cy={ey as number} r={10} fill={(col as string) + '20'} stroke={col as string} strokeWidth={1.5} />
                                    <text x={ex as number} y={(ey as number) + 4} textAnchor="middle" fontSize={7} fill={col as string}>{lbl}</text>
                                    <line x1={ex as number} y1={ey as number} x2={110} y2={60} stroke={col as string} strokeWidth={1} strokeDasharray="3 2" opacity={0.4} />
                                </g>
                            ))}
                        </svg>
                        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Illustrative — run monitor to see real responses</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>What AI Monitor does</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { icon: <Zap size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Passive brand monitoring', text: 'Fires monitoring prompts at all configured AI engines simultaneously.' },
                                { icon: <MessageCircle size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Measures mention & citation rate', text: 'Detects brand mentions and domain citations across all AI-generated responses.' },
                                { icon: <BarChart2 size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Sentiment summary', text: 'Classifies each response as positive, neutral, negative, or not mentioned.' },
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
                            <strong style={{ color: '#4f6ef7' }}>Tip:</strong> Unlike AI Visibility Probe, monitor prompts are broad brand-awareness questions — not user-intent queries.
                        </div>
                    </div>
                </div>
            )}

            {/* ── Results ── */}
            {result && (
                <section className="panel">
                    <div className="panel-heading">
                        <div><h2>Monitor results</h2><p>{result.results.length} responses · {result.engines.join(', ')}</p></div>
                    </div>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Mention rate', value: result.mentionRate !== null ? result.mentionRate + '%' : '—' },
                                { label: 'Citation rate', value: result.citationRate !== null ? result.citationRate + '%' : '—' },
                                { label: 'Prompts fired', value: String(result.prompts.length) },
                                { label: 'Responses', value: String(result.results.length) },
                            ].map(m => (
                                <div key={m.label}>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                                    <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>{m.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ padding: '8px 24px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.results.map((r, i) => (
                            <details key={i} style={{ border: '1px solid #e4e6ef', borderRadius: 8, overflow: 'hidden' }}>
                                <summary style={{ padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
                                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.prompt.length > 80 ? r.prompt.slice(0, 80) + '…' : r.prompt}
                                    </span>
                                    <span style={{ fontSize: 12, color: r.brandMentioned ? '#15803d' : '#9ca3af', marginLeft: 12, flexShrink: 0, fontWeight: 600 }}>
                                        {r.brandMentioned ? '✓ Mentioned' : '✗ Not mentioned'}
                                    </span>
                                </summary>
                                <div style={{ padding: '12px 16px', borderTop: '1px solid #e4e6ef', fontSize: 13, lineHeight: 1.6, color: '#374151' }}>
                                    <div style={{ marginBottom: 8, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{r.engine} · {r.model}</div>
                                    {r.response}
                                </div>
                            </details>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
