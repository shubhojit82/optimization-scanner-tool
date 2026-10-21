"use client";
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart2, CheckCircle2, ChevronDown, ChevronUp, Clock, DollarSign, Globe, History, MessageCircle, Search, TrendingUp, Users, XCircle, Zap } from 'lucide-react';
import type { Client, ProbeRun, ProbeResult } from '../src/core/contracts';
import { queryUniverse } from '../src/core/scoring';
import { api } from './workbench-api';

type Props = {
    client: Client;
    busy: boolean;
    onBusy: (b: boolean) => void;
    availableProviders: { id: string; label: string; configured: boolean }[];
    /** Prompts sent from Smart Prompts; pre-filled into custom prompts on mount */
    queuedPrompts?: string[];
    onQueuedConsumed?: () => void;
};

const ENGINE_COLORS: Record<string, string> = { openai: '#15803d', gemini: '#1a73e8', perplexity: '#7c5cd8' };
const ENGINE_LABELS: Record<string, string> = { openai: 'OpenAI', gemini: 'Gemini', perplexity: 'Perplexity' };
const P = '22px 24px'; // standard panel body padding — matches .panel-heading

function sentimentColor(s: string) {
    if (s === 'positive') return '#15803d';
    if (s === 'negative') return '#dc2626';
    if (s === 'absent') return '#9ca3af';
    return '#b45309';
}
function sentimentBg(s: string) {
    if (s === 'positive') return '#dcfce7';
    if (s === 'negative') return '#fee2e2';
    if (s === 'absent') return '#f3f4f6';
    return '#fef9c3';
}
function sentimentLabel(s: string) {
    if (s === 'positive') return 'Positive';
    if (s === 'negative') return 'Negative';
    if (s === 'absent') return 'Not mentioned';
    return 'Neutral';
}

function KpiCard({ value, label, sub, color, icon }: {
    value: number | null; label: string; sub: string; color: string; icon: React.ReactNode;
}) {
    return (
        <div style={{ flex: '1 1 180px', minWidth: 160, background: '#fff', border: '1px solid #e0e7ed', borderRadius: 9, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                <span style={{ color, opacity: 0.6 }}>{icon}</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: value === null ? '#9ca3af' : color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {value === null ? '—' : `${value}%`}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{sub}</div>
            <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (value ?? 0) + '%', background: color, borderRadius: 2, transition: 'width .6s ease' }} />
            </div>
        </div>
    );
}

function ProviderToggle({ id, label, selected, configured, onToggle }: {
    id: string; label: string; selected: boolean; configured: boolean; onToggle: () => void;
}) {
    const color = ENGINE_COLORS[id] ?? '#57606a';
    return (
        <button
            type="button"
            onClick={configured ? onToggle : undefined}
            disabled={!configured}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 16px',
                border: `1.5px solid ${selected && configured ? color : '#e0e7ed'}`,
                borderRadius: 20,
                background: selected && configured ? color + '10' : '#fafbfc',
                cursor: configured ? 'pointer' : 'not-allowed',
                opacity: configured ? 1 : 0.45,
                fontSize: 13, fontWeight: 600,
                color: selected && configured ? color : '#57606a',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: configured ? color : '#d1d5db', flexShrink: 0 }} />
            {label}
            {!configured && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 400 }}>· not set up</span>}
            {selected && configured && <span style={{ fontSize: 11 }}>✓</span>}
        </button>
    );
}

export function AIVisibilityPanel({ client, busy, onBusy, availableProviders, queuedPrompts, onQueuedConsumed }: Props) {
    const [probeRun, setProbeRun] = useState<ProbeRun | null>(null);
    const [history, setHistory] = useState<ProbeRun[]>([]);
    const [historyTab, setHistoryTab] = useState<'current' | 'history' | 'spend'>('current');
    const [error, setError] = useState('');
    const [selectedProviders, setSelectedProviders] = useState<string[]>(
        availableProviders.filter(p => p.configured).map(p => p.id)
    );
    const [customPrompts, setCustomPrompts] = useState((queuedPrompts ?? []).join('\n'));
    const [useQueryUniverse, setUseQueryUniverse] = useState(!queuedPrompts?.length);
    useEffect(() => { if (queuedPrompts?.length) onQueuedConsumed?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const [expandedResult, setExpandedResult] = useState<number | null>(null);
    const [running, setRunning] = useState(false);

    // Load probe history on mount / client change
    useEffect(() => {
        if (!client.id || client.id === 'demo') return;
        fetch(`/api/v1/probe-history/${encodeURIComponent(client.id)}`, {
            headers: { 'Accept': 'application/json' },
        })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((runs: ProbeRun[]) => setHistory(runs))
            .catch(() => {});
    }, [client.id]);

    const suggestedPrompts = queryUniverse(client).slice(0, 6);
    const configuredProviders = availableProviders.filter(p => p.configured);

    function toggleProvider(id: string) {
        setSelectedProviders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }

    async function runProbe() {
        setError('');
        const prompts: string[] = [];
        if (useQueryUniverse) prompts.push(...suggestedPrompts.map(q => q.prompt));
        if (customPrompts.trim()) prompts.push(...customPrompts.split('\n').map(s => s.trim()).filter(s => s.length > 4));
        if (!prompts.length) { setError('Add at least one prompt to probe.'); return; }
        if (!selectedProviders.length) { setError('Select at least one AI provider.'); return; }
        onBusy(true); setRunning(true);
        try {
            const run = await api<ProbeRun>('probe', { clientId: client.id, prompts, providers: selectedProviders });
            setProbeRun(run);
            // Optimistically prepend to history
            setHistory(h => [run, ...h].slice(0, 20));
            setHistoryTab('current');
        } catch (e) {
            setError((e as Error).message);
        } finally {
            onBusy(false); setRunning(false);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Setup card ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>AI Visibility Probe</h2>
                        <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>
                            Fire customer-intent prompts at live AI engines — measure brand mention rate, sentiment, and share-of-voice vs competitors.
                        </p>
                    </div>
                    <Zap size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                </div>

                <div style={{ padding: P, display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {configuredProviders.length === 0 && (
                        <div className="banner">
                            No AI providers configured. Add <code>OPENAI_API_KEY</code> or <code>GEMINI_API_KEY</code> to your <code>.env</code> and restart.
                        </div>
                    )}

                    {/* Provider toggles */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>AI Engines</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {availableProviders.map(p => (
                                <ProviderToggle key={p.id} id={p.id}
                                    label={ENGINE_LABELS[p.id] ?? p.label}
                                    selected={selectedProviders.includes(p.id)}
                                    configured={p.configured}
                                    onToggle={() => toggleProvider(p.id)} />
                            ))}
                        </div>
                    </div>

                    {/* Prompts section */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Prompts</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                            {/* Query Universe toggle card */}
                            <label style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '12px 16px',
                                border: `1.5px solid ${useQueryUniverse ? '#3b82d4' : '#e0e7ed'}`,
                                borderRadius: 8,
                                background: useQueryUniverse ? '#f0f6ff' : '#fafbfc',
                                cursor: 'pointer', transition: 'all .15s',
                            }}>
                                <input type="checkbox" checked={useQueryUniverse}
                                    onChange={e => setUseQueryUniverse(e.target.checked)}
                                    style={{ width: 16, height: 16, accentColor: '#3b82d4', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2328' }}>Query Universe prompts</div>
                                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                        {suggestedPrompts.length} auto-generated prompts based on {client.name}'s products, market and competitors
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: 12, fontWeight: 700, color: '#3b82d4',
                                    background: '#dbeafe', padding: '3px 10px', borderRadius: 12, flexShrink: 0,
                                }}>{suggestedPrompts.length}</span>
                            </label>

                            {/* Custom prompts */}
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                                    Custom prompts <span style={{ fontWeight: 400 }}>(one per line, optional)</span>
                                </label>
                                <textarea
                                    rows={3}
                                    style={{
                                        width: '100%', fontFamily: 'inherit', fontSize: 13,
                                        padding: '10px 14px',
                                        border: '1.5px solid #e0e7ed', borderRadius: 8,
                                        resize: 'vertical', background: '#fafbfc', color: '#1f2328',
                                        outline: 'none', lineHeight: 1.6,
                                    }}
                                    placeholder={`e.g. Who are the top providers of ${client.products[0] || client.industry} in ${client.market}?`}
                                    value={customPrompts}
                                    onChange={e => setCustomPrompts(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {error && <div className="error" role="alert">{error}</div>}

                    {/* Run button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
                        <button className="primary" onClick={runProbe}
                            disabled={busy || running || configuredProviders.length === 0}
                            style={{ minWidth: 190 }}>
                            {running
                                ? <><Activity size={15} style={{ animation: 'spin 1s linear infinite' }} />Probing AI engines…</>
                                : <><Search size={15} />Run AI Visibility Probe</>}
                        </button>
                        {!running && probeRun && (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                Last run · {probeRun.results.length} responses · {probeRun.engines.join(', ')}
                                {probeRun.totalTokens ? ` · ${probeRun.totalTokens.toLocaleString()} tokens` : ''}
                                {probeRun.totalEstimatedCostUsd ? ` · ~$${probeRun.totalEstimatedCostUsd.toFixed(4)}` : ''}
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Empty state (no probes run yet) ── */}
            {!probeRun && history.length === 0 && !running && (
                <div style={{ background:'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)', border:'1px solid #e4e6ef', borderRadius:10, padding:'32px 32px', display:'flex', gap:48, alignItems:'center', flexWrap:'wrap' }}>
                    <div style={{ flexShrink:0 }}>
                        <svg width={240} height={130} viewBox="0 0 240 130" aria-hidden="true">
                            {/* 3 engine nodes */}
                            {[['OpenAI','#15803d',30],['Gemini','#1a73e8',110],['Perplexity','#7c5cd8',190]].map(([lbl,col,cx])=>(
                                <g key={lbl as string}>
                                    <circle cx={cx as number} cy={40} r={22} fill={(col as string)+'15'} stroke={col as string} strokeWidth={1.5}/>
                                    <text x={cx as number} y={45} textAnchor="middle" fontSize={9} fontWeight={700} fill={col as string}>{lbl}</text>
                                    <line x1={cx as number} y1={62} x2={120} y2={90} stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 2"/>
                                </g>
                            ))}
                            {/* Brand node */}
                            <rect x={88} y={88} width={64} height={28} rx={6} fill="#4f6ef7"/>
                            <text x={120} y={106} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">Your brand</text>
                            {/* Mention badges */}
                            {[[35,72,'✓'],[115,72,'✓'],[195,72,'✗']].map(([bx,by,t],i)=>(
                                <g key={i}>
                                    <circle cx={bx as number} cy={by as number} r={9} fill={t==='✓'?'#dcfce7':'#fee2e2'}/>
                                    <text x={bx as number} y={(by as number)+4} textAnchor="middle" fontSize={9} fontWeight={700} fill={t==='✓'?'#15803d':'#b91c1c'}>{t}</text>
                                </g>
                            ))}
                            <text x={120} y={125} textAnchor="middle" fontSize={9} fill="#9ca3af">Fire prompts · measure mentions · track sentiment</text>
                        </svg>
                        <p style={{ fontSize:11, color:'#9ca3af', textAlign:'center', marginTop:4 }}>Illustrative — run a probe to see real data</p>
                    </div>
                    <div style={{ flex:1, minWidth:220 }}>
                        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.08em', color:'#4f6ef7', textTransform:'uppercase', marginBottom:12 }}>What AI Visibility Probe does</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                            {[
                                { icon:<Zap size={15}/>, color:'#4f6ef7', bg:'#eef2ff', title:'Fires real prompts at AI engines', text:'Sends your client-intent queries to OpenAI, Gemini, and Perplexity simultaneously.' },
                                { icon:<MessageCircle size={15}/>, color:'#8b5cf6', bg:'#f5f3ff', title:'Measures brand mention rate', text:'Detects brand mentions and domain citations in every AI-generated response.' },
                                { icon:<TrendingUp size={15}/>, color:'#10b981', bg:'#ecfdf5', title:'Sentiment & share of voice', text:'Classifies each mention as positive, neutral, negative, or absent. Compares against competitors.' },
                                { icon:<History size={15}/>, color:'#d97706', bg:'#fffbeb', title:'Tracks trends over time', text:'Every run is saved to history — view KPI trends across multiple probe dates.' },
                            ].map(item=>(
                                <div key={item.title} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                                    <div style={{ width:30, height:30, borderRadius:8, background:item.bg, color:item.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{item.icon}</div>
                                    <div>
                                        <div style={{ fontSize:13, fontWeight:600, color:'#1a1d2e' }}>{item.title}</div>
                                        <div style={{ fontSize:12, color:'#6b7280', marginTop:2, lineHeight:1.5 }}>{item.text}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop:16, padding:'10px 14px', background:'#fff', border:'1px solid #e4e6ef', borderRadius:8, fontSize:12, color:'#374151', lineHeight:1.5 }}>
                            <strong style={{ color:'#4f6ef7' }}>Ready to run.</strong> Select providers and prompts above, then hit <strong>Run AI Visibility Probe</strong>.
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tab switcher (shown once there's history) ── */}
            {(probeRun || history.length > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', background: '#f0f2f5', borderRadius: 8, padding: 3, gap: 2 }}>
                        <button onClick={() => setHistoryTab('current')} style={{ background: historyTab === 'current' ? '#fff' : 'transparent', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '.85rem', fontWeight: historyTab === 'current' ? 650 : 500, color: historyTab === 'current' ? '#0d8073' : '#57606a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BarChart2 size={14} /> Current run
                        </button>
                        <button onClick={() => setHistoryTab('history')} style={{ background: historyTab === 'history' ? '#fff' : 'transparent', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '.85rem', fontWeight: historyTab === 'history' ? 650 : 500, color: historyTab === 'history' ? '#0d8073' : '#57606a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <History size={14} /> History {history.length > 0 && <span style={{ background: '#0d8073', color: '#fff', borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{history.length}</span>}
                        </button>
                        <button onClick={() => setHistoryTab('spend')} style={{ background: historyTab === 'spend' ? '#fff' : 'transparent', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '.85rem', fontWeight: historyTab === 'spend' ? 650 : 500, color: historyTab === 'spend' ? '#d97706' : '#57606a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <DollarSign size={14} /> Spend
                        </button>
                    </div>
                    {history.length >= 2 && historyTab === 'history' && (
                        <span style={{ fontSize: 12, color: '#57606a' }}>
                            <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {history.length} probe runs tracked
                        </span>
                    )}
                </div>
            )}

            {/* ── Spend tab ── */}
            {historyTab === 'spend' && (
                <SpendDashboard runs={history} currentRun={probeRun} />
            )}

            {/* ── History tab: KPI trend + run list ── */}
            {historyTab === 'history' && history.length > 0 && (
                <>
                    <KpiTrendChart runs={history} />
                    <ProbeHistoryList runs={history} onSelect={run => { setProbeRun(run); setHistoryTab('current'); }} />
                </>
            )}

            {(historyTab === 'current' && probeRun) && (<>

                {/* ── KPI strip ── */}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <KpiCard value={probeRun.mentionRate} label="Mention Rate"
                        sub="% of prompts where brand is mentioned by AI"
                        color="#3b82d4" icon={<BarChart2 size={16} />} />
                    <KpiCard value={probeRun.citationRate} label="Citation Rate"
                        sub="% of prompts where your domain is cited"
                        color="#7c5cd8" icon={<Globe size={16} />} />
                    <KpiCard
                        value={probeRun.sentimentBreakdown.positive > 0 ? Math.round(probeRun.sentimentBreakdown.positive / probeRun.results.length * 100) : 0}
                        label="Positive Sentiment"
                        sub="of all responses mentioning your brand"
                        color="#15803d" icon={<CheckCircle2 size={16} />} />
                    <KpiCard
                        value={probeRun.sentimentBreakdown.negative > 0 ? Math.round(probeRun.sentimentBreakdown.negative / probeRun.results.length * 100) : 0}
                        label="Negative Sentiment"
                        sub="responses flagging issues — review below"
                        color="#dc2626" icon={<XCircle size={16} />} />
                </div>

                {/* ── Sentiment breakdown ── */}
                <section className="panel">
                    <div style={{ padding: P }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                            Sentiment breakdown · {probeRun.results.length} responses
                        </div>
                        <div style={{ height: 10, borderRadius: 6, overflow: 'hidden', background: '#f0f0f0', display: 'flex' }}>
                            {(['positive', 'neutral', 'negative', 'absent'] as const).map(s => {
                                const count = probeRun.sentimentBreakdown[s];
                                const pct = Math.round(count / probeRun.results.length * 100);
                                if (!count) return null;
                                return <div key={s} style={{ flex: pct, background: sentimentColor(s), minWidth: 4, transition: 'flex .4s ease' }}
                                    title={`${sentimentLabel(s)}: ${count} (${pct}%)`} />;
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                            {(['positive', 'neutral', 'negative', 'absent'] as const).map(s => {
                                const count = probeRun.sentimentBreakdown[s];
                                return (
                                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: sentimentColor(s), flexShrink: 0 }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: sentimentColor(s) }}>{sentimentLabel(s)}</span>
                                        <span style={{ fontSize: 12, color: '#9ca3af' }}>— {count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ── Share of Voice ── */}
                {probeRun.shareOfVoice.length > 0 && (
                    <section className="panel">
                        <div className="panel-heading">
                            <div>
                                <h2>Share of Voice</h2>
                                <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>% of probes where each brand was mentioned by AI engines</p>
                            </div>
                            <Users size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                        </div>
                        <div style={{ padding: P, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                { name: client.name, rate: probeRun.mentionRate ?? 0, isClient: true },
                                ...probeRun.shareOfVoice.map(sv => ({ name: sv.competitor, rate: sv.mentionRate, isClient: false })),
                            ].sort((a, b) => b.rate - a.rate).map((item, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                            {item.isClient
                                                ? <span style={{ fontSize: 10, fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, letterSpacing: '0.05em' }}>YOU</span>
                                                : <span style={{ fontSize: 10, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 10, letterSpacing: '0.05em' }}>COMPETITOR</span>}
                                            <span style={{ fontSize: 14, fontWeight: item.isClient ? 700 : 500, color: '#1f2328' }}>{item.name}</span>
                                        </div>
                                        <span style={{ fontSize: 15, fontWeight: 800, color: item.isClient ? '#3b82d4' : item.rate > (probeRun.mentionRate ?? 0) ? '#dc2626' : '#6b7280' }}>
                                            {item.rate}%
                                        </span>
                                    </div>
                                    <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: item.rate + '%', borderRadius: 4,
                                            transition: 'width .5s ease',
                                            background: item.isClient ? '#3b82d4' : item.rate > (probeRun.mentionRate ?? 0) ? '#fca5a5' : '#d1d5db',
                                        }} />
                                    </div>
                                </div>
                            ))}
                            {probeRun.shareOfVoice.some(sv => sv.mentionRate > (probeRun.mentionRate ?? 0)) && (
                                <div style={{ marginTop: 4, padding: '12px 16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                                    ⚠ One or more competitors are mentioned more often than {client.name}. Review the AI responses below to understand what they're being recommended for.
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* ── Top citing sources ── */}
                {probeRun.citingSources.length > 0 && (
                    <section className="panel">
                        <div className="panel-heading">
                            <div>
                                <h2>Top Citing Sources</h2>
                                <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>Domains AI engines cited most — earning coverage here increases your citation probability</p>
                            </div>
                            <Globe size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                        </div>
                        <div style={{ padding: P, display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {probeRun.citingSources.slice(0, 10).map((s, i) => {
                                const isOwned = client.domain.includes(s.domain) || s.domain.includes(new URL(client.domain).hostname.replace('www.', ''));
                                const barW = Math.round(s.count / probeRun.citingSources[0].count * 100);
                                return (
                                    <div key={s.domain} style={{
                                        display: 'grid', gridTemplateColumns: '28px 1fr 160px 80px',
                                        alignItems: 'center', gap: 14, padding: '10px 0',
                                        borderBottom: i < Math.min(probeRun.citingSources.length, 10) - 1 ? '1px solid #f3f4f6' : 'none',
                                    }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#c0c8d0', textAlign: 'right' }}>{i + 1}</span>
                                        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: barW + '%', background: isOwned ? '#15803d' : '#3b82d4', borderRadius: 3 }} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: isOwned ? '#15803d' : '#1f2328', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {s.domain}
                                            </span>
                                            {isOwned && <span style={{ fontSize: 9, fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 8, letterSpacing: '0.04em', flexShrink: 0 }}>YOU</span>}
                                        </div>
                                        <span style={{ fontSize: 12, color: '#9ca3af', textAlign: 'right', whiteSpace: 'nowrap' }}>{s.count} citation{s.count !== 1 ? 's' : ''}</span>
                                    </div>
                                );
                            })}
                            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 13, color: '#0369a1', display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.6 }}>
                                <TrendingUp size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                                <span>Target the non-owned domains above for earned media placements, thought leadership articles, and product reviews to improve your AI citation probability.</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Individual probe results ── */}
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <h2>AI Responses</h2>
                            <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>Full responses from each engine — expand any row to read what AI said about your brand</p>
                        </div>
                        <MessageCircle size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    </div>
                    <div style={{ padding: '14px 24px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {probeRun.results.map((r, i) => {
                                const engineColor = ENGINE_COLORS[r.engine] ?? '#57606a';
                                const isOpen = expandedResult === i;
                                return (
                                    <div key={i} style={{
                                        border: `1px solid ${isOpen ? '#d1d5db' : '#edf0f3'}`,
                                        borderRadius: 9, overflow: 'hidden', transition: 'border-color .15s',
                                    }}>
                                        <button
                                            onClick={() => setExpandedResult(isOpen ? null : i)}
                                            style={{
                                                width: '100%', display: 'grid',
                                                gridTemplateColumns: '100px 1fr 26px',
                                                alignItems: 'center', gap: 14,
                                                padding: '12px 16px',
                                                background: isOpen ? '#fafbfc' : '#fff',
                                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                            }}
                                        >
                                            {/* Engine badge */}
                                            <span style={{
                                                fontSize: 11, fontWeight: 700, color: engineColor,
                                                background: engineColor + '14', padding: '4px 10px',
                                                borderRadius: 6, textAlign: 'center',
                                            }}>
                                                {ENGINE_LABELS[r.engine] ?? r.engine}
                                            </span>

                                            {/* Prompt + status tags */}
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, color: '#1f2328', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                                                    {r.prompt}
                                                </div>
                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 600,
                                                        background: r.brandMentioned ? '#dcfce7' : '#fee2e2',
                                                        color: r.brandMentioned ? '#15803d' : '#dc2626',
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                    }}>
                                                        {r.brandMentioned ? <><CheckCircle2 size={10} />Mentioned</> : <><XCircle size={10} />Not mentioned</>}
                                                    </span>
                                                    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 600, background: sentimentBg(r.sentiment), color: sentimentColor(r.sentiment) }}>
                                                        {sentimentLabel(r.sentiment)}
                                                    </span>
                                                    {r.citesClientDomain && (
                                                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 600, background: '#e0f2fe', color: '#0369a1' }}>
                                                            ✓ Domain cited
                                                        </span>
                                                    )}
                                                    {r.competitorsMentioned.length > 0 && (
                                                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                                                            vs {r.competitorsMentioned.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Chevron */}
                                            <span style={{ color: '#c0c8d0', flexShrink: 0 }}>
                                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </span>
                                        </button>

                                        {isOpen && (
                                            <div style={{ padding: '16px 20px 20px', borderTop: '1px solid #edf0f3', background: '#fff' }}>
                                                {r.response ? (
                                                    <>
                                                        <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#374151', margin: 0, marginBottom: r.citations.length ? 16 : 0 }}>
                                                            {r.response}
                                                        </p>
                                                        {r.citations.length > 0 && (
                                                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                                                                    Sources cited
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                                    {r.citations.map((c, ci) => (
                                                                        <a key={ci} href={c} target="_blank" rel="noopener noreferrer"
                                                                            style={{ fontSize: 12, color: '#3b82d4', wordBreak: 'break-all', textDecoration: 'none', display: 'flex', gap: 6 }}>
                                                                            <span style={{ color: '#c0c8d0', flexShrink: 0, fontWeight: 600 }}>{ci + 1}.</span>
                                                                            <span>{c}</span>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>Provider returned no response for this prompt.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ── Answer Snippet Extractor + Hallucination Detector ── */}
                <SnippetExtractor probeRun={probeRun} clientName={client.name} clientDomain={client.domain} />

                {/* ── Competitive Narrative Monitor ── */}
                {probeRun.shareOfVoice.length > 0 && (
                    <NarrativeMonitor probeRun={probeRun} clientName={client.name} />
                )}

            </>)}
        </div>
    );
}

// ── Spend Dashboard ──────────────────────────────────────────────────────────

const ENGINE_COLORS_FULL: Record<string, string> = {
    openai: '#15803d',
    gemini: '#1a73e8',
    claude: '#d97706',
    perplexity: '#7c5cd8',
};

function SpendDashboard({ runs, currentRun }: { runs: ProbeRun[]; currentRun: ProbeRun | null }) {
    const allRuns = currentRun && !runs.find(r => r.id === currentRun.id)
        ? [currentRun, ...runs]
        : runs;

    // Aggregate across all runs
    const totalTokens = allRuns.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const totalCost = allRuns.reduce((s, r) => s + (r.totalEstimatedCostUsd ?? 0), 0);
    const totalFailed = allRuns.reduce((s, r) => s + (r.failedCount ?? 0), 0);
    const totalProbes = allRuns.reduce((s, r) => s + r.results.length, 0);

    // Per-engine aggregates
    const engineMap: Record<string, { tokens: number; cost: number; runs: number }> = {};
    for (const r of allRuns) {
        for (const e of (r.costByEngine ?? [])) {
            if (!engineMap[e.engine]) engineMap[e.engine] = { tokens: 0, cost: 0, runs: 0 };
            engineMap[e.engine].tokens += e.tokens;
            engineMap[e.engine].cost += e.estimatedCostUsd;
            engineMap[e.engine].runs += 1;
        }
    }
    const engines = Object.entries(engineMap).sort((a, b) => b[1].cost - a[1].cost);
    const maxCost = engines[0]?.[1].cost ?? 0;

    if (allRuns.length === 0) {
        return (
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Spend Dashboard</h2><p>Run a probe to start tracking AI token usage and estimated cost.</p></div>
                    <DollarSign size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                </div>
            </section>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPI strip */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total Estimated Cost', value: `$${totalCost.toFixed(4)}`, sub: `${allRuns.length} probe run${allRuns.length !== 1 ? 's' : ''}`, color: '#d97706', icon: <DollarSign size={16} /> },
                    { label: 'Total Tokens Used', value: totalTokens.toLocaleString(), sub: `${Math.round(totalTokens / Math.max(totalProbes, 1)).toLocaleString()} avg per probe`, color: '#4f6ef7', icon: <Zap size={16} /> },
                    { label: 'Failed Probes', value: totalFailed.toString(), sub: `${Math.round(totalFailed / Math.max(totalProbes, 1) * 100)}% failure rate`, color: totalFailed > 0 ? '#dc2626' : '#15803d', icon: <XCircle size={16} /> },
                    { label: 'Cost Per Probe', value: `$${(totalCost / Math.max(totalProbes, 1)).toFixed(5)}`, sub: `across ${totalProbes} total probes`, color: '#7c5cd8', icon: <TrendingUp size={16} /> },
                ].map(card => (
                    <div key={card.label} style={{ flex: '1 1 180px', minWidth: 160, background: '#fff', border: '1px solid #e0e7ed', borderRadius: 9, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{card.label}</span>
                            <span style={{ color: card.color, opacity: 0.6 }}>{card.icon}</span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{card.value}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* Per-engine breakdown */}
            {engines.length > 0 && (
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Cost by Provider</h2>
                            <p>Estimated cost breakdown across all probe runs, per AI engine</p>
                        </div>
                        <DollarSign size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    </div>
                    <div style={{ padding: '14px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {engines.map(([engine, data]) => {
                            const color = ENGINE_COLORS_FULL[engine] ?? '#57606a';
                            const barW = maxCost > 0 ? Math.round(data.cost / maxCost * 100) : 0;
                            return (
                                <div key={engine}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2328', textTransform: 'capitalize' }}>{engine}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, color: '#6b7280' }}>{data.tokens.toLocaleString()} tokens</span>
                                            <span style={{ fontSize: 15, fontWeight: 800, color }}>${data.cost.toFixed(5)}</span>
                                        </div>
                                    </div>
                                    <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: barW + '%', background: color, borderRadius: 4, transition: 'width .5s ease' }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                                        {data.runs} run{data.runs !== 1 ? 's' : ''} · avg ${(data.cost / data.runs).toFixed(5)} per run
                                    </div>
                                </div>
                            );
                        })}
                        <div style={{ marginTop: 6, padding: '11px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                            Costs are estimates based on published token pricing at the time of each run.
                            Actual billed amounts may differ — check your provider dashboards for authoritative usage.
                        </div>
                    </div>
                </section>
            )}

            {/* Per-run cost table */}
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Run-by-run Cost Log</h2><p>Token and cost totals for every probe run</p></div>
                    <Clock size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f7f8fa' }}>
                                {['Date', 'Engines', 'Prompts', 'Tokens', 'Est. Cost', 'Failed'].map(h => (
                                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '2px solid #e4e6ef', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allRuns.map((r, i) => (
                                <tr key={r.id ?? i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '9px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                                        {new Date(r.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '9px 14px' }}>
                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                            {r.engines.map(e => (
                                                <span key={e} style={{ fontSize: 10, fontWeight: 700, background: (ENGINE_COLORS_FULL[e] ?? '#57606a') + '14', color: ENGINE_COLORS_FULL[e] ?? '#57606a', padding: '2px 7px', borderRadius: 6, textTransform: 'capitalize' }}>{e}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{ padding: '9px 14px', color: '#374151' }}>{r.results.length}</td>
                                    <td style={{ padding: '9px 14px', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                                        {r.totalTokens ? r.totalTokens.toLocaleString() : '—'}
                                    </td>
                                    <td style={{ padding: '9px 14px', fontWeight: 700, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                                        {r.totalEstimatedCostUsd != null ? `$${r.totalEstimatedCostUsd.toFixed(5)}` : '—'}
                                    </td>
                                    <td style={{ padding: '9px 14px', color: (r.failedCount ?? 0) > 0 ? '#dc2626' : '#9ca3af', fontWeight: (r.failedCount ?? 0) > 0 ? 700 : 400 }}>
                                        {r.failedCount ?? 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

// ── Answer Snippet Extractor + Hallucination Detector ────────────────────────
const P_INNER = '22px 24px';

/** Normalise text for fuzzy sentence matching: lowercase, strip punctuation */
function normalise(s: string) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

/** Return sentences from `response` that mention the brand (case-insensitive). */
function extractBrandSentences(response: string, clientName: string): string[] {
    const name = clientName.toLowerCase().trim();
    return response
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 20 && s.toLowerCase().includes(name));
}

/** Check if a response sentence is roughly present in the page text (fuzzy substring). */
function confirmedOnPage(sentence: string, pageText: string): boolean {
    if (!pageText) return false;
    // Use a 6-word sliding window from the sentence as the needle
    const words = normalise(sentence).split(' ');
    if (words.length < 4) return normalise(pageText).includes(normalise(sentence));
    for (let i = 0; i <= words.length - 6; i++) {
        const needle = words.slice(i, i + 6).join(' ');
        if (normalise(pageText).includes(needle)) return true;
    }
    return false;
}

function SnippetExtractor({ probeRun, clientName, clientDomain }: { probeRun: ProbeRun; clientName: string; clientDomain: string }) {
    const [pageText, setPageText] = useState('');
    const [pageUrl, setPageUrl] = useState('');
    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [open, setOpen] = useState(true);

    // Build snippets from all results that mention the brand
    type Snippet = { sentence: string; engine: string; prompt: string; confirmed: boolean };
    const snippets: Snippet[] = [];
    for (const r of probeRun.results) {
        if (!r.brandMentioned || !r.response) continue;
        for (const s of extractBrandSentences(r.response, clientName)) {
            snippets.push({ sentence: s, engine: r.engine, prompt: r.prompt, confirmed: confirmedOnPage(s, pageText) });
        }
    }

    const confirmed = snippets.filter(s => s.confirmed).length;
    const possible = snippets.filter(s => !s.confirmed && pageText).length;

    async function fetchPage() {
        const url = pageUrl.trim();
        if (!url) return;
        setFetchError(''); setFetching(true);
        try {
            // Use the workbench scan endpoint to get page text; fall back to empty
            const res = await fetch(`/api/v1/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ url }),
            });
            if (!res.ok) throw new Error('Scan failed');
            const data = await res.json() as { pageText?: string };
            setPageText(data.pageText ?? '');
            if (!data.pageText) setFetchError('Page text could not be extracted from the scan. Hallucination check unavailable.');
        } catch {
            setFetchError('Could not fetch page. Hallucination check unavailable — enter page text manually.');
        } finally {
            setFetching(false);
        }
    }

    return (
        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>Answer Snippet Extractor</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>
                        Sentences the AI said about {clientName} — with optional hallucination detection against the live page.
                    </p>
                </div>
                <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0c8d0', padding: 4 }}>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {open && (
                <div style={{ padding: P_INNER, display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {snippets.length === 0 && (
                        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                            No brand mentions found in the current probe run. Run a probe first or add more prompts that reference {clientName} directly.
                        </p>
                    )}

                    {snippets.length > 0 && (
                        <>
                            {/* Hallucination check setup */}
                            <div style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: 9, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Hallucination check <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional — compare AI claims against your live page)</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                        type="url"
                                        placeholder={clientDomain}
                                        value={pageUrl}
                                        onChange={e => setPageUrl(e.target.value)}
                                        style={{ flex: '1 1 280px', fontSize: 13, padding: '8px 12px', borderRadius: 7, border: '1.5px solid #e0e7ed', background: '#fff', color: '#1f2328', outline: 'none' }}
                                    />
                                    <button onClick={fetchPage} disabled={fetching || !pageUrl.trim()} className="secondary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 140 }}>
                                        {fetching ? <><Activity size={13} style={{ animation: 'spin 1s linear infinite' }} />Scanning…</> : <><Search size={13} />Check page</>}
                                    </button>
                                </div>
                                {fetchError && <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>{fetchError}</p>}
                                {pageText && !fetchError && (
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>✓ {confirmed} confirmed on page</span>
                                        {possible > 0 && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠ {possible} not found — possible hallucination{possible !== 1 ? 's' : ''}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Snippet list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {snippets.map((s, i) => {
                                    const engineColor = ENGINE_COLORS[s.engine] ?? '#57606a';
                                    const hasCheck = !!pageText;
                                    return (
                                        <div key={i} style={{
                                            border: `1px solid ${hasCheck && !s.confirmed ? '#fecaca' : '#e5e7eb'}`,
                                            borderLeft: `4px solid ${hasCheck ? (s.confirmed ? '#15803d' : '#dc2626') : '#e5e7eb'}`,
                                            borderRadius: 8, padding: '13px 16px',
                                            background: hasCheck && !s.confirmed ? '#fff8f8' : '#fff',
                                        }}>
                                            {/* Header: engine + verdict badge */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, background: engineColor + '14', color: engineColor, padding: '2px 8px', borderRadius: 6 }}>
                                                    {ENGINE_LABELS[s.engine] ?? s.engine}
                                                </span>
                                                {hasCheck && (
                                                    s.confirmed
                                                        ? <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 9px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <CheckCircle2 size={11} />Confirmed on page
                                                        </span>
                                                        : <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 9px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <AlertTriangle size={11} />Not found on page — possible hallucination
                                                        </span>
                                                )}
                                            </div>
                                            {/* Sentence */}
                                            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: '#1f2328', fontStyle: 'italic' }}>"{s.sentence}"</p>
                                            {/* Prompt context */}
                                            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af' }}>
                                                In response to: <span style={{ color: '#57606a' }}>{s.prompt}</span>
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

// ── Competitive Narrative Monitor ─────────────────────────────────────────────

/** Extract attribute phrases AI associates with a brand from all probe results */
function extractBrandAttributes(results: ProbeResult[], brand: string): string[] {
    const ATTR_PATTERNS = [
        /(?:known for|famous for|recognized for|described as|specializes in|focuses on|is (?:a|an|the)|offers|provides|delivers|enables|helps|best for|ideal for|trusted for|leading|top|enterprise)\s+([^,.;!?]+)/gi,
    ];
    const freqMap = new Map<string, number>();
    const nameLower = brand.toLowerCase();

    for (const r of results) {
        if (!r.response) continue;
        const response = r.response;
        // Find sentences containing the brand
        const sentences = response.split(/(?<=[.!?])\s+/).filter(s => s.toLowerCase().includes(nameLower));
        for (const sentence of sentences) {
            for (const pattern of ATTR_PATTERNS) {
                pattern.lastIndex = 0;
                const match = pattern.exec(sentence);
                if (match) {
                    const attr = match[1].trim().replace(/\s+/g, ' ').slice(0, 60);
                    if (attr.length > 3 && attr.length < 60) {
                        freqMap.set(attr, (freqMap.get(attr) ?? 0) + 1);
                    }
                }
            }
        }
    }
    // Return top 6 by frequency
    return [...freqMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
}

type BrandNarrative = { name: string; isClient: boolean; attributes: string[]; mentionRate: number };

function NarrativeMonitor({ probeRun, clientName }: { probeRun: ProbeRun; clientName: string }) {
    const [open, setOpen] = useState(true);

    const narratives: BrandNarrative[] = [
        {
            name: clientName,
            isClient: true,
            attributes: extractBrandAttributes(probeRun.results, clientName),
            mentionRate: probeRun.mentionRate ?? 0,
        },
        ...probeRun.shareOfVoice.map(sv => ({
            name: sv.competitor,
            isClient: false,
            attributes: extractBrandAttributes(probeRun.results, sv.competitor),
            mentionRate: sv.mentionRate,
        })),
    ].filter(n => n.attributes.length > 0 || n.isClient);

    const clientNarrative = narratives.find(n => n.isClient);
    const competitorNarratives = narratives.filter(n => !n.isClient);

    return (
        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>Competitive Narrative Monitor</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>
                        How AI engines describe each brand — attribute phrases extracted from probe responses
                    </p>
                </div>
                <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0c8d0', padding: 4 }}>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {open && (
                <div style={{ padding: P_INNER, display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {narratives.every(n => n.attributes.length === 0) && (
                        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                            Not enough brand-specific attribute phrases found in the current probe run. Try adding more comparison and evaluation prompts.
                        </p>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                        {/* Client card */}
                        {clientNarrative && (
                            <div style={{ border: '2px solid #3b82d4', borderRadius: 10, padding: '18px 20px', background: '#f0f6ff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <div>
                                        <span style={{ fontSize: 10, fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, marginRight: 8, letterSpacing: '0.05em' }}>YOU</span>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2328' }}>{clientNarrative.name}</span>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82d4' }}>{clientNarrative.mentionRate}%</span>
                                </div>
                                {clientNarrative.attributes.length > 0
                                    ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {clientNarrative.attributes.map((attr, i) => (
                                            <span key={i} style={{ fontSize: 12, background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 12, fontWeight: 500 }}>{attr}</span>
                                        ))}
                                    </div>
                                    : <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>No attribute phrases extracted yet — run more comparison-type probes.</p>
                                }
                            </div>
                        )}

                        {/* Competitor cards */}
                        {competitorNarratives.map((n, i) => (
                            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px', background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <div>
                                        <span style={{ fontSize: 10, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 10, marginRight: 8, letterSpacing: '0.05em' }}>COMPETITOR</span>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{n.name}</span>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: n.mentionRate > (clientNarrative?.mentionRate ?? 0) ? '#dc2626' : '#9ca3af' }}>{n.mentionRate}%</span>
                                </div>
                                {n.attributes.length > 0
                                    ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {n.attributes.map((attr, j) => (
                                            <span key={j} style={{ fontSize: 12, background: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: 12, fontWeight: 500 }}>{attr}</span>
                                        ))}
                                    </div>
                                    : <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>No attribute phrases extracted for this competitor.</p>
                                }
                            </div>
                        ))}
                    </div>

                    {competitorNarratives.some(n => n.attributes.length > 0) && clientNarrative && clientNarrative.attributes.length > 0 && (
                        <div style={{ padding: '13px 17px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                            💡 <strong>Positioning insight:</strong> Compare how AI describes you vs competitors above. If competitors hold stronger attribute phrases in your key areas, use the Smart Prompt Advisor and Content Brief to close those narrative gaps.
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

// ── KPI Trend Chart ──────────────────────────────────────────────────────────
function KpiTrendChart({ runs }: { runs: ProbeRun[] }) {
    // Runs are newest-first; chart needs oldest-first
    const ordered = [...runs].reverse();
    const W = 560, H = 160, PAD_L = 36, PAD_B = 28, PAD_T = 16, PAD_R = 12;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const yLines = [0, 25, 50, 75, 100];
    const xStep = ordered.length > 1 ? chartW / (ordered.length - 1) : chartW;

    function toY(v: number | null) {
        return PAD_T + chartH - ((v ?? 0) / 100) * chartH;
    }
    function toX(i: number) {
        return PAD_L + (ordered.length > 1 ? i * xStep : chartW / 2);
    }

    function polyline(values: (number | null)[], color: string) {
        const pts = values.map((v, i) => `${toX(i)},${toY(v)}`);
        return <polyline key={color} points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
    }
    function dots(values: (number | null)[], color: string) {
        return values.map((v, i) => v !== null
            ? <circle key={i} cx={toX(i)} cy={toY(v)} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
            : null
        );
    }

    const mentionRates = ordered.map(r => r.mentionRate);
    const citationRates = ordered.map(r => r.citationRate);
    const positivePcts = ordered.map(r => r.results.length ? Math.round(r.sentimentBreakdown.positive / r.results.length * 100) : null);

    return (
        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>KPI Trend</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>Mention rate, citation rate, and positive sentiment across all probe runs for this client</p>
                </div>
                <TrendingUp size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
            </div>
            <div style={{ padding: P, overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
                    {/* Y grid lines + labels */}
                    {yLines.map(y => (
                        <g key={y}>
                            <line x1={PAD_L} y1={toY(y)} x2={W - PAD_R} y2={toY(y)} stroke="#e5e7eb" strokeWidth={1} strokeDasharray={y === 0 ? 'none' : '3 3'} />
                            <text x={PAD_L - 4} y={toY(y) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{y}</text>
                        </g>
                    ))}
                    {/* X axis labels */}
                    {ordered.map((r, i) => (
                        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
                            {new Date(r.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </text>
                    ))}
                    {/* Lines */}
                    {polyline(mentionRates, '#3b82d4')}
                    {polyline(citationRates, '#7c5cd8')}
                    {polyline(positivePcts, '#15803d')}
                    {/* Dots */}
                    {dots(mentionRates, '#3b82d4')}
                    {dots(citationRates, '#7c5cd8')}
                    {dots(positivePcts, '#15803d')}
                </svg>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
                    {[['#3b82d4', 'Mention Rate'], ['#7c5cd8', 'Citation Rate'], ['#15803d', 'Positive Sentiment']].map(([color, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#57606a' }}>
                            <span style={{ width: 18, height: 2.5, background: color, display: 'inline-block', borderRadius: 2, flexShrink: 0 }} />
                            {label}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Probe History List ───────────────────────────────────────────────────────
function ProbeHistoryList({ runs, onSelect }: { runs: ProbeRun[]; onSelect: (r: ProbeRun) => void }) {
    return (
        <section className="panel">
            <div className="panel-heading">
                <div><h2>Run history</h2><p>Click any row to load that run into the Current Run view</p></div>
                <span className="count">{runs.length}</span>
            </div>
            <div style={{ padding: '8px 0 12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px 80px', gap: '0 10px', padding: '6px 24px', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>
                    <span>Date</span><span>Mention</span><span>Citation</span><span>Engines</span><span>Prompts</span>
                </div>
                {runs.map((r, i) => {
                    const trend = i < runs.length - 1 ? (r.mentionRate ?? 0) - (runs[i + 1].mentionRate ?? 0) : null;
                    return (
                        <button key={r.id} onClick={() => onSelect(r)} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px 80px', gap: '0 10px', padding: '11px 24px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid #f0f2f5', textAlign: 'left', alignItems: 'center', fontSize: 12 }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f7fbfc'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                            <div>
                                <div style={{ fontWeight: 600, color: '#213f50' }}>{new Date(r.created).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                                <div style={{ fontSize: 10, color: '#8b9aa6', marginTop: 1 }}>{r.results.length} responses</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontWeight: 700, color: '#213f50' }}>{r.mentionRate ?? '—'}{r.mentionRate !== null ? '%' : ''}</span>
                                {trend !== null && Math.abs(trend) >= 1 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: trend > 0 ? '#15803d' : '#dc2626' }}>{trend > 0 ? '↑' : '↓'}{Math.abs(trend)}%</span>
                                )}
                            </div>
                            <span style={{ fontWeight: 700, color: '#7c5cd8' }}>{r.citationRate ?? '—'}{r.citationRate !== null ? '%' : ''}</span>
                            <span style={{ fontSize: 11, color: '#57606a' }}>{r.engines.join(', ')}</span>
                            <span style={{ fontSize: 11, color: '#57606a' }}>{r.prompts.length}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'IBM Plex Mono,monospace' }}>
                                {r.totalEstimatedCostUsd ? `$${r.totalEstimatedCostUsd.toFixed(4)}` : '—'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
