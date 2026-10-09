"use client";
import { useState } from 'react';
import { FileText, Zap, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { Client, Audit, ProviderInfo } from '../src/core/contracts';
import type { ContentBrief, ContentBriefSection } from '../src/application/content-brief';

type Props = {
    client: Client;
    audits: Audit[];
    providers: ProviderInfo[];
    busy: boolean;
    onBusy: (b: boolean) => void;
};

const SECTION_META: Record<string, { color: string; emoji: string }> = {
    headings:  { color: '#3b82d4', emoji: '📝' },
    faq:       { color: '#7c5cd8', emoji: '❓' },
    schema:    { color: '#b45309', emoji: '🏷️' },
    entity:    { color: '#0d8073', emoji: '🔗' },
    passage:   { color: '#0369a1', emoji: '📄' },
    reasoning: { color: '#db2777', emoji: '🧠' },
    summary:   { color: '#57606a', emoji: '📋' },
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }
    return (
        <button onClick={copy} title="Copy to clipboard"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 5, color: copied ? '#15803d' : '#8b9aa6', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

function SectionCard({ section }: { section: ContentBriefSection }) {
    const [open, setOpen] = useState(true);
    const meta = SECTION_META[section.type] ?? { color: '#57606a', emoji: '📋' };
    const allText = section.items.join('\n');
    return (
        <div style={{ background: '#fff', border: `1px solid #e5e7eb`, borderRadius: 10, overflow: 'hidden', borderTop: `3px solid ${meta.color}` }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
            >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.emoji}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: '.93rem', color: '#213f50' }}>{section.title}</span>
                <span style={{ fontSize: 11, color: '#8b9aa6', fontWeight: 600 }}>{section.items.length} items</span>
                <CopyButton text={allText} />
                {open ? <ChevronUp size={15} color="#8b9aa6" /> : <ChevronDown size={15} color="#8b9aa6" />}
            </button>
            {open && (
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {section.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#f7f8fa', borderRadius: 7, borderLeft: `3px solid ${meta.color}` }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, minWidth: 20, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{item}</span>
                            <CopyButton text={item} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ContentBriefPanel({ client, audits, providers, busy, onBusy }: Props) {
    const [selectedProvider, setSelectedProvider] = useState(() => {
        const configured = providers.filter(p => p.configured);
        return configured[0]?.id ?? '';
    });
    const [brief, setBrief] = useState<ContentBrief | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const audit = audits[0] ?? null;
    const configuredProviders = providers.filter(p => p.configured);

    async function generate() {
        if (!audit) return;
        setError(''); setGenerating(true); onBusy(true);
        try {
            const r = await fetch('/api/v1/content-brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
                body: JSON.stringify({ clientId: client.id, provider: selectedProvider, auditId: audit.id }),
            });
            if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'Generation failed');
            setBrief(await r.json() as ContentBrief);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setGenerating(false); onBusy(false);
        }
    }

    function exportMarkdown() {
        if (!brief) return;
        const lines = [
            `# GEO Content Brief — ${brief.clientName}`,
            ``,
            `**Page:** ${brief.pageUrl}  `,
            `**Current GEO Score:** ${brief.overallScore ?? 'N/A'}/100  `,
            `**Generated:** ${new Date(brief.generatedAt).toLocaleString()} · ${brief.model}`,
            ``,
            `## Executive Summary`,
            ``,
            brief.executiveSummary,
            ``,
        ];
        for (const s of brief.sections) {
            lines.push(`## ${s.title}`, ``);
            for (const [i, item] of s.items.entries()) lines.push(`${i + 1}. ${item}`);
            lines.push(``);
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `geo-content-brief-${client.name.toLowerCase().replace(/\s+/g, '-')}.md`;
        a.click(); URL.revokeObjectURL(a.href);
    }

    function copyAll() {
        if (!brief) return;
        const lines: string[] = [`GEO Content Brief — ${brief.clientName}\n`];
        for (const s of brief.sections) {
            lines.push(`\n${s.title}`);
            for (const [i, item] of s.items.entries()) lines.push(`${i + 1}. ${item}`);
        }
        navigator.clipboard.writeText(lines.join('\n'));
    }

    if (!audit) {
        return (
            <section className="panel">
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#57606a' }}>
                    <FileText size={32} style={{ color: '#d1d5db', marginBottom: 12 }} />
                    <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#213f50', marginBottom: 8 }}>No audit data yet</p>
                    <p style={{ fontSize: '.88rem' }}>Import a page or run a scan first — the brief is generated from your audit's dimension gaps.</p>
                </div>
            </section>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Config panel ── */}
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>AI Content Brief Generator</h2>
                        <p>Analyses your top dimension gaps and generates a structured content brief — headings, FAQs, schema, entity links, and passage blocks.</p>
                    </div>
                </div>
                <div style={{ padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Audit context */}
                    <div style={{ background: '#f7f8fa', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 3 }}>Audit source</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#213f50' }}>{audit.url}</div>
                            <div style={{ fontSize: 11, color: '#57606a', marginTop: 2 }}>{new Date(audit.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Score {audit.score}/100 · {audit.coverage}% coverage</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#8b9aa6', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 3 }}>Top gaps</div>
                            <div style={{ fontSize: 12, color: '#374151' }}>
                                {audit.dimensions
                                    .filter(d => d.score !== null && d.score < 90 && d.weight > 0)
                                    .sort((a, b) => b.weight * (100 - b.score!) - a.weight * (100 - a.score!))
                                    .slice(0, 4)
                                    .map(d => d.name)
                                    .join(' · ')}
                            </div>
                        </div>
                    </div>

                    {/* Provider selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#57606a' }}>Generate with</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {configuredProviders.map(p => (
                                <button key={p.id} onClick={() => setSelectedProvider(p.id)}
                                    style={{
                                        padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                        border: selectedProvider === p.id ? '2px solid #3b82d4' : '1px solid #e5e7eb',
                                        background: selectedProvider === p.id ? '#eff6ff' : '#fff',
                                        color: selectedProvider === p.id ? '#3b82d4' : '#57606a',
                                    }}
                                    disabled={busy}
                                >
                                    {p.label.split(' ')[0]} <span style={{ fontWeight: 400, fontSize: 11 }}>· {p.model}</span>
                                </button>
                            ))}
                            {configuredProviders.length === 0 && (
                                <span style={{ fontSize: 12, color: '#b91c1c' }}>No AI providers configured — add an API key to .env</span>
                            )}
                        </div>
                        <button className="primary" onClick={generate}
                            disabled={busy || generating || !selectedProvider || configuredProviders.length === 0}
                            style={{ marginLeft: 'auto' }}>
                            <Zap size={15} />
                            {generating ? 'Generating brief…' : 'Generate content brief'}
                        </button>
                    </div>

                    {error && <div className="error" role="alert">{error}</div>}
                </div>
            </section>

            {/* ── Generated brief ── */}
            {brief && (
                <>
                    {/* Header */}
                    <section className="panel" style={{ background: '#0f3b52', border: 'none' }}>
                        <div style={{ padding: '22px 28px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#78ddc6', textTransform: 'uppercase', marginBottom: 6 }}>GEO Content Brief</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{brief.clientName}</div>
                                    <div style={{ fontSize: 12, color: '#92ded0', marginTop: 6 }}>{brief.pageUrl}</div>
                                    <div style={{ fontSize: 11, color: '#6ab8ab', marginTop: 4 }}>
                                        Generated {new Date(brief.generatedAt).toLocaleString()} · {brief.model} · Score {brief.overallScore ?? 'N/A'}/100
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="secondary"
                                        style={{ background: '#1a4a63', border: '1px solid #2a6080', color: '#78ddc6', fontSize: 12 }}
                                        onClick={copyAll}>
                                        <Copy size={13} /> Copy all
                                    </button>
                                    <button className="secondary"
                                        style={{ background: '#1a4a63', border: '1px solid #2a6080', color: '#78ddc6', fontSize: 12 }}
                                        onClick={exportMarkdown}>
                                        <FileText size={13} /> Export Markdown
                                    </button>
                                </div>
                            </div>
                            {brief.executiveSummary && (
                                <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(255,255,255,.06)', borderRadius: 8, fontSize: 13, color: '#b8e8e0', lineHeight: 1.7, borderLeft: '3px solid #57e3c2' }}>
                                    {brief.executiveSummary}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Sections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {brief.sections.map((section, i) => (
                            <SectionCard key={i} section={section} />
                        ))}
                    </div>

                    {/* Footer note */}
                    <div style={{ fontSize: 11, color: '#8b9aa6', lineHeight: 1.6, padding: '0 0 8px' }}>
                        Generated by {brief.model} based on audit gaps from rubric {audit.version}.
                        Content suggestions are AI-generated — validate accuracy and brand voice before use.
                        Re-audit the page after implementing changes to measure score improvement.
                    </div>
                </>
            )}
        </div>
    );
}
