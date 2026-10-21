"use client";
import { useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, Copy, Lightbulb, Loader, Search, Wand2, Zap, MessageCircle } from 'lucide-react';
import type { Client, Audit, ProviderInfo } from '../src/core/contracts';
import type { SmartPromptsResult, SmartPromptItem } from '../src/application/smart-prompts';
import { api } from './workbench-api';

type Props = {
    client: Client;
    audits: Audit[];
    providers: ProviderInfo[];
    busy: boolean;
    onBusy: (b: boolean) => void;
    /** Called when user wants to fire a prompt into the AI Visibility Probe */
    onRunPrompt?: (prompt: string) => void;
};

const P = '22px 24px';

const INTENT_COLORS: Record<SmartPromptItem['intent'], { bg: string; color: string }> = {
    transactional: { bg: '#fef3c7', color: '#92400e' },
    informational:  { bg: '#dbeafe', color: '#1d4ed8' },
    navigational:   { bg: '#dcfce7', color: '#15803d' },
    comparison:     { bg: '#ede9fe', color: '#6d28d9' },
    evaluation:     { bg: '#fce7f3', color: '#9d174d' },
};

const PRIORITY_COLORS: Record<SmartPromptItem['priority'], { bg: string; color: string }> = {
    high:   { bg: '#fee2e2', color: '#dc2626' },
    medium: { bg: '#fef9c3', color: '#a16207' },
    low:    { bg: '#f3f4f6', color: '#6b7280' },
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
    return (
        <button onClick={copy} title="Copy prompt"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: 5, color: copied ? '#15803d' : '#9ca3af', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, flexShrink: 0 }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

function IntentBadge({ intent }: { intent: SmartPromptItem['intent'] }) {
    const c = INTENT_COLORS[intent] ?? { bg: '#f3f4f6', color: '#6b7280' };
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
            {intent}
        </span>
    );
}

function PriorityDot({ priority }: { priority: SmartPromptItem['priority'] }) {
    const c = PRIORITY_COLORS[priority];
    return (
        <span title={priority + ' priority'} style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0, display: 'inline-block' }} />
    );
}

function IntentGroup({ intent, prompts, onRunPrompt }: {
    intent: SmartPromptItem['intent'];
    prompts: SmartPromptItem[];
    onRunPrompt?: (p: string) => void;
}) {
    const [open, setOpen] = useState(true);
    const c = INTENT_COLORS[intent] ?? { bg: '#f3f4f6', color: '#6b7280' };
    const highCount = prompts.filter(p => p.priority === 'high').length;

    return (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', borderTop: `3px solid ${c.color}` }}>
            <button onClick={() => setOpen(o => !o)}
                style={{ width: '100%', padding: '13px 18px', background: '#fafbfc', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.color, textTransform: 'capitalize' }}>{intent}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{prompts.length} prompt{prompts.length !== 1 ? 's' : ''}</span>
                    {highCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 7px', borderRadius: 10 }}>
                            {highCount} high priority
                        </span>
                    )}
                </span>
                {open ? <ChevronUp size={15} color="#c0c8d0" /> : <ChevronDown size={15} color="#c0c8d0" />}
            </button>

            {open && (
                <div style={{ background: '#fff', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {prompts.map((p, i) => (
                        <div key={i} style={{
                            padding: '14px 18px',
                            borderTop: '1px solid #f3f4f6',
                            display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                            {/* Prompt text + actions */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <PriorityDot priority={p.priority} />
                                <p style={{ flex: 1, margin: 0, fontSize: 13.5, fontWeight: 500, color: '#1f2328', lineHeight: 1.6 }}>
                                    {p.prompt}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    <CopyButton text={p.prompt} />
                                    {onRunPrompt && (
                                        <button onClick={() => onRunPrompt(p.prompt)} title="Fire this prompt in AI Visibility Probe"
                                            style={{ background: 'none', border: '1px solid #d1d5db', cursor: 'pointer', padding: '3px 9px', borderRadius: 5, fontSize: 11, color: '#3b82d4', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                            <ArrowRight size={11} />Probe
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Persona + rationale */}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingLeft: 16 }}>
                                <span style={{ fontSize: 11, color: '#57606a', background: '#f3f4f6', padding: '2px 9px', borderRadius: 10, fontWeight: 500 }}>
                                    👤 {p.persona}
                                </span>
                                {p.rationale && (
                                    <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.5 }}>
                                        {p.rationale}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ExportButton({ result }: { result: SmartPromptsResult }) {
    function exportMd() {
        const lines = [
            `# Smart Prompts — ${new Date(result.generatedAt).toLocaleDateString()}`,
            `Generated by: ${result.provider} / ${result.model}`,
            `Total: ${result.totalCount} prompts`,
            '',
        ];
        const byIntent = new Map<string, SmartPromptItem[]>();
        for (const p of result.prompts) {
            if (!byIntent.has(p.intent)) byIntent.set(p.intent, []);
            byIntent.get(p.intent)!.push(p);
        }
        for (const [intent, prompts] of byIntent) {
            lines.push(`## ${intent.charAt(0).toUpperCase() + intent.slice(1)}`);
            for (const p of prompts) {
                lines.push(`- [${p.priority.toUpperCase()}] **${p.prompt}**`);
                lines.push(`  _Persona: ${p.persona}_ — ${p.rationale}`);
            }
            lines.push('');
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'smart-prompts.md';
        a.click();
    }
    return (
        <button onClick={exportMd} className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <BookOpen size={14} />Export markdown
        </button>
    );
}

export function SmartPromptsPanel({ client, audits, providers, busy, onBusy, onRunPrompt }: Props) {
    const [result, setResult] = useState<SmartPromptsResult | null>(null);
    const [selectedProvider, setSelectedProvider] = useState(() =>
        providers.find(p => p.configured)?.id ?? ''
    );
    const [selectedAudit, setSelectedAudit] = useState<string>('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const configuredProviders = providers.filter(p => p.configured);
    const latestAudit = audits[0];

    async function generate() {
        setError('');
        if (!selectedProvider) { setError('Select an AI provider to generate prompts.'); return; }
        if (!latestAudit) { setError('Import a page audit first — the prompt advisor needs audit gap data.'); return; }
        const auditId = selectedAudit || undefined;
        onBusy(true); setLoading(true);
        try {
            const r = await api<SmartPromptsResult>('smart-prompts', { clientId: client.id, provider: selectedProvider, auditId });
            setResult(r);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            onBusy(false); setLoading(false);
        }
    }

    // Group prompts by intent for display
    const byIntent = result
        ? (['transactional', 'informational', 'navigational', 'comparison', 'evaluation'] as const)
            .map(intent => ({ intent, prompts: result.prompts.filter(p => p.intent === intent) }))
            .filter(g => g.prompts.length > 0)
        : [];

    const highCount = result?.prompts.filter(p => p.priority === 'high').length ?? 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Setup card ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Smart Prompt Advisor</h2>
                        <p style={{ marginTop: 4, fontSize: 13, color: '#57606a' }}>
                            AI generates 15–20 intent-matched probe prompts from your audit gaps — covering transactional, informational, comparison, evaluation, and navigational intent across enterprise buyer, analyst, press, and technical evaluator personas.
                        </p>
                    </div>
                    <Wand2 size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                </div>

                <div style={{ padding: P, display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {configuredProviders.length === 0 && (
                        <div className="banner">
                            No AI providers configured. Add <code>OPENAI_API_KEY</code>, <code>GEMINI_API_KEY</code> or <code>ANTHROPIC_API_KEY</code> to your <code>.env</code> and restart.
                        </div>
                    )}

                    {!latestAudit && (
                        <div className="banner">Import a page audit first — the advisor analyses your top 5 weighted gap dimensions to design relevant prompts.</div>
                    )}

                    {/* Provider selector */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Generate with</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {providers.map(p => (
                                <button key={p.id} type="button"
                                    onClick={p.configured ? () => setSelectedProvider(p.id) : undefined}
                                    disabled={!p.configured}
                                    style={{
                                        padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                                        border: `1.5px solid ${selectedProvider === p.id && p.configured ? '#7c5cd8' : '#e0e7ed'}`,
                                        background: selectedProvider === p.id && p.configured ? '#7c5cd814' : '#fafbfc',
                                        color: selectedProvider === p.id && p.configured ? '#7c5cd8' : '#57606a',
                                        cursor: p.configured ? 'pointer' : 'not-allowed', opacity: p.configured ? 1 : 0.45,
                                        display: 'inline-flex', alignItems: 'center', gap: 7,
                                    }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.configured ? '#7c5cd8' : '#d1d5db', flexShrink: 0 }} />
                                    {p.label}
                                    {!p.configured && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 400 }}>· not set up</span>}
                                    {selectedProvider === p.id && p.configured && <span style={{ fontSize: 11 }}>✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Audit selector */}
                    {audits.length > 1 && (
                        <div style={{ maxWidth: 380 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Audit to analyse</div>
                            <div style={{ position: 'relative' }}>
                                <select value={selectedAudit} onChange={e => setSelectedAudit(e.target.value)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#4f6ef7')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#e4e6ef')}
                                    style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', fontSize: 13, padding: '8px 32px 8px 12px', borderRadius: 8, border: '1.5px solid #e4e6ef', background: '#fafafa', color: '#1a1d2e', outline: 'none', cursor: 'pointer' }}>
                                    <option value="">Latest audit ({latestAudit ? new URL(latestAudit.url).hostname : '—'})</option>
                                    {audits.map(a => (
                                        <option key={a.id} value={a.id}>
                                            {new URL(a.url).hostname} · {new Date(a.created).toLocaleDateString()} · {a.score}/100
                                        </option>
                                    ))}
                                </select>
                                <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={12} height={12} viewBox="0 0 12 12" fill="none">
                                    <path d="M2 4l4 4 4-4" stroke="#6b7280" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    )}

                    {error && <div className="error" role="alert">{error}</div>}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button className="primary" onClick={generate}
                            disabled={busy || loading || configuredProviders.length === 0 || !latestAudit}
                            style={{ minWidth: 210 }}>
                            {loading
                                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />Generating prompts…</>
                                : <><Wand2 size={15} />Generate smart prompts</>}
                        </button>
                        {result && !loading && (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                {result.totalCount} prompts · {result.provider} / {result.model}
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Results ── */}
            {result && (
                <>
                    {/* Summary strip */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                            {[
                                { label: 'Total prompts', value: result.totalCount, color: '#7c5cd8' },
                                { label: 'High priority', value: highCount, color: '#dc2626' },
                                { label: 'Intent types', value: byIntent.length, color: '#3b82d4' },
                            ].map(s => (
                                <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 20px', minWidth: 120, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                                </div>
                            ))}
                        </div>
                        <ExportButton result={result} />
                    </div>

                    {/* How-to hint */}
                    <div style={{ padding: '12px 18px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 13, color: '#0369a1', display: 'flex', gap: 10, alignItems: 'center', lineHeight: 1.5 }}>
                        <Lightbulb size={15} style={{ flexShrink: 0 }} />
                        <span>Review the prompts below and click <strong>Probe</strong> next to any prompt to fire it directly into the AI Visibility Probe tab, or copy all and run a batch probe.</span>
                    </div>

                    {/* Priority legend */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Priority</span>
                        {(['high', 'medium', 'low'] as const).map(p => (
                            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[p].color, display: 'inline-block' }} />
                                <span style={{ fontSize: 12, color: '#57606a', textTransform: 'capitalize' }}>{p}</span>
                            </div>
                        ))}
                    </div>

                    {/* Grouped prompt cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {byIntent.map(g => (
                            <IntentGroup key={g.intent} intent={g.intent} prompts={g.prompts} onRunPrompt={onRunPrompt} />
                        ))}
                    </div>

                    {/* Timestamp */}
                    <p style={{ fontSize: 11, color: '#c0c8d0', margin: 0, textAlign: 'right' }}>
                        Generated {new Date(result.generatedAt).toLocaleString()} · {result.provider} / {result.model}
                    </p>
                </>
            )}

            {/* ── Empty state — has audit + provider but nothing generated yet ── */}
            {!result && !loading && latestAudit && configuredProviders.length > 0 && (
                <div style={{ background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)', border: '1px solid #e4e6ef', borderRadius: 10, padding: '32px 32px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* SVG: magnifier scanning text with intent tags */}
                    <div style={{ flexShrink: 0 }}>
                        <svg width={200} height={130} viewBox="0 0 200 130" aria-hidden="true">
                            {/* Document */}
                            <rect x={20} y={10} width={100} height={110} rx={8} fill="#fff" stroke="#e4e6ef" strokeWidth={1.5} />
                            {/* Text lines */}
                            {[28, 40, 52, 64, 76, 88].map((y, i) => (
                                <rect key={y} x={32} y={y} width={i % 3 === 2 ? 55 : 76} height={6} rx={3} fill="#e4e6ef" />
                            ))}
                            {/* Intent tag badges */}
                            <rect x={32} y={100} width={34} height={12} rx={6} fill="#dbeafe" />
                            <text x={49} y={109} textAnchor="middle" fontSize={7} fontWeight={700} fill="#1d4ed8">INFO</text>
                            <rect x={70} y={100} width={38} height={12} rx={6} fill="#ede9fe" />
                            <text x={89} y={109} textAnchor="middle" fontSize={7} fontWeight={700} fill="#6d28d9">EVAL</text>
                            {/* Magnifier */}
                            <circle cx={148} cy={62} r={28} fill="none" stroke="#4f6ef7" strokeWidth={2.5} />
                            <circle cx={148} cy={62} r={22} fill="#eef2ff" opacity={0.6} />
                            <line x1={169} y1={83} x2={182} y2={96} stroke="#4f6ef7" strokeWidth={3} strokeLinecap="round" />
                            {/* Wand spark */}
                            <circle cx={155} cy={55} r={3} fill="#8b5cf6" />
                            <line x1={155} y1={49} x2={155} y2={44} stroke="#8b5cf6" strokeWidth={1.5} />
                            <line x1={160} y1={52} x2={164} y2={49} stroke="#8b5cf6" strokeWidth={1.5} />
                            <line x1={161} y1={58} x2={166} y2={58} stroke="#8b5cf6" strokeWidth={1.5} />
                        </svg>
                        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Illustrative — generate to see real prompts</p>
                    </div>
                    {/* Explainer tiles */}
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>What smart prompts are</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { icon: <Wand2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: '15-20 AI-crafted prompts', text: 'Generated from your top audit gap dimensions — transactional, informational, comparison, evaluation, and navigational intent.' },
                                { icon: <MessageCircle size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Persona-matched', text: 'Each prompt targets a specific buyer persona — enterprise evaluator, analyst, press, or technical lead.' },
                                { icon: <Zap size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Fire straight into AI Visibility', text: 'Click Probe next to any prompt to run it immediately against your configured AI engines.' },
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
                            <strong style={{ color: '#4f6ef7' }}>To get started:</strong> Select a provider above and click <strong>Generate smart prompts</strong>.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
