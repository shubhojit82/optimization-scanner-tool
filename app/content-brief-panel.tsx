"use client";
import { useState } from 'react';
import { FileText, Zap, Copy, Check, ChevronDown, ChevronUp, PenLine, BarChart2, TrendingUp, Loader, BookOpen, Star } from 'lucide-react';
import type { Client, Audit, ProviderInfo } from '../src/core/contracts';
import type { ContentBrief, ContentBriefSection } from '../src/application/content-brief';
import type { ArticleDraft } from '../src/application/article-draft';
import { api } from './workbench-api';

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

// ── Article Draft helpers ───────────────────────────────────────────────────

function RgpsScorePill({ score }: { score: number }) {
    const total = 25;
    const pct = Math.round(score / total * 100);
    const color = pct >= 68 ? '#15803d' : pct >= 40 ? '#d97706' : '#dc2626';
    const bg = pct >= 68 ? '#dcfce7' : pct >= 40 ? '#fef9c3' : '#fee2e2';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, background: bg, color, padding: '3px 10px', borderRadius: 10 }}>
            <Star size={11} /> RGPS {score}/{total} ({pct}%)
        </span>
    );
}

function ArticleDraftView({ draft, onClear }: { draft: ArticleDraft; onClear: () => void }) {
    const [copied, setCopied] = useState(false);
    function copyMarkdown() {
        navigator.clipboard.writeText(draft.markdown).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
    function downloadMarkdown() {
        const blob = new Blob([draft.markdown], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `article-draft-${draft.clientName.toLowerCase().replace(/\s+/g, '-')}.md`;
        a.click(); URL.revokeObjectURL(a.href);
    }
    function downloadHtml() {
        const blob = new Blob([`<!doctype html><html><body>${draft.html}</body></html>`], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `article-draft-${draft.clientName.toLowerCase().replace(/\s+/g, '-')}.html`;
        a.click(); URL.revokeObjectURL(a.href);
    }
    const dims = draft.rgpsScore.dimensions ?? [];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header card */}
            <section className="panel">
                <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 6 }}>AI Article Draft</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1d2e', lineHeight: 1.3 }}>{draft.clientName}</div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 5 }}>{draft.pageUrl}</div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                                <RgpsScorePill score={draft.rgpsScore.total} />
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>{draft.wordCount.toLocaleString()} words · {draft.model} · {new Date(draft.generatedAt).toLocaleString()}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="secondary" onClick={copyMarkdown}>
                                {copied ? <><Check size={13} />Copied!</> : <><Copy size={13} />Copy Markdown</>}
                            </button>
                            <button className="secondary" onClick={downloadMarkdown}>
                                <FileText size={13} /> Download .md
                            </button>
                            <button className="secondary" onClick={downloadHtml}>
                                <BookOpen size={13} /> Download HTML
                            </button>
                            <button className="secondary" onClick={onClear} style={{ color: '#dc2626', borderColor: '#fecaca' }}>
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* RGPS dimension pills */}
                    {dims.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>RGPS Dimension Scores</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {dims.map(d => {
                                    const pct = d.weight > 0 ? Math.round(d.score / d.weight * 100) : 0;
                                    const col = pct >= 70 ? '#15803d' : pct >= 40 ? '#d97706' : '#dc2626';
                                    return (
                                        <span key={d.id} title={d.action ?? d.evidence} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: '#f7f8fa', border: `1px solid ${col}30`, color: col, fontWeight: 600 }}>
                                            {d.name} {d.score}/{d.weight}
                                        </span>
                                    );
                                })}
                            </div>
                            {draft.rgpsScore.mandatoryFail && (
                                <div style={{ marginTop: 10, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, color: '#dc2626' }}>
                                    ⚠ Mandatory dimension {draft.rgpsScore.mandatoryFail} scored zero — auto-fail triggered. Review the draft content.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Article preview */}
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Article Preview</h2>
                        <p>Rendered preview — copy Markdown or download to use in your CMS</p>
                    </div>
                    <BookOpen size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                </div>
                <div style={{ padding: '16px 24px 24px' }}>
                    <div
                        style={{
                            fontSize: 14, lineHeight: 1.8, color: '#1f2328',
                            background: '#fafbfc', border: '1px solid #e4e6ef', borderRadius: 8,
                            padding: '24px 28px', maxHeight: 600, overflowY: 'auto',
                        }}
                        dangerouslySetInnerHTML={{ __html: draft.html }}
                    />
                    <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
                        Generated by {draft.model} · RGPS scored · {draft.wordCount} words.
                        Content is AI-generated — validate facts and brand voice before publishing.
                        Re-audit the live page after publishing to measure score improvement.
                    </div>
                </div>
            </section>
        </div>
    );
}

export function ContentBriefPanel({ client, audits, providers, busy, onBusy }: Props) {
    const [activeTab, setActiveTab] = useState<'brief' | 'article'>('brief');
    const [selectedProvider, setSelectedProvider] = useState(() => {
        const configured = providers.filter(p => p.configured);
        return configured[0]?.id ?? '';
    });
    const [brief, setBrief] = useState<ContentBrief | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    // Article draft state
    const [draft, setDraft] = useState<ArticleDraft | null>(null);
    const [generatingDraft, setGeneratingDraft] = useState(false);
    const [draftError, setDraftError] = useState('');

    const audit = audits[0] ?? null;
    const configuredProviders = providers.filter(p => p.configured);

    async function generate() {
        if (!audit) return;
        setError(''); setGenerating(true); onBusy(true);
        try {
            const result = await api<ContentBrief>('content-brief', {
                clientId: client.id,
                provider: selectedProvider,
                auditId: audit.id,
            });
            setBrief(result);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setGenerating(false); onBusy(false);
        }
    }

    async function generateDraft() {
        if (!audit) return;
        setDraftError(''); setGeneratingDraft(true); onBusy(true);
        try {
            const result = await api<ArticleDraft>('article-draft', {
                clientId: client.id,
                provider: selectedProvider,
                auditId: audit.id,
            });
            setDraft(result);
        } catch (e) {
            setDraftError((e as Error).message);
        } finally {
            setGeneratingDraft(false); onBusy(false);
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

    function exportFullReport() {
        if (!brief) return;
        const topGaps = audit.dimensions
            .filter(d => d.score !== null && d.score < 90 && d.weight > 0)
            .sort((a, b) => b.weight * (100 - b.score!) - a.weight * (100 - a.score!));
        const lines: string[] = [
            `# GEO Marketing Report — ${brief.clientName}`,
            ``,
            `**Page:** ${brief.pageUrl}`,
            `**Current GEO Score:** ${brief.overallScore ?? 'N/A'}/100`,
            `**Rubric version:** ${audit.version}`,
            `**Generated:** ${new Date(brief.generatedAt).toLocaleString()} · ${brief.model}`,
            ``,
            `---`,
            ``,
            `## Executive Summary`,
            ``,
            brief.executiveSummary ?? '',
            ``,
            `---`,
            ``,
            `## Dimension Gap Analysis`,
            ``,
            `| Dimension | Score | Weight | Gap | Action |`,
            `|-----------|------:|-------:|----:|--------|`,
            ...topGaps.map(d =>
                `| ${d.name} | ${d.score}/100 | ${d.weight} | ${100 - d.score!} pts | ${d.action ?? '—'} |`
            ),
            ``,
            `---`,
            ``,
        ];
        for (const s of brief.sections) {
            lines.push(`## ${s.title}`, ``);
            for (const [i, item] of s.items.entries()) lines.push(`${i + 1}. ${item}`);
            lines.push(``);
        }
        lines.push(`---`, ``, `*Report generated by GEO Workbench. Validate all AI-generated recommendations against brand guidelines before publishing.*`);
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `geo-marketing-report-${client.name.toLowerCase().replace(/\s+/g, '-')}.md`;
        a.click(); URL.revokeObjectURL(a.href);
    }

    if (!audit) {
        return (
            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>AI Content Brief Generator</h2>
                        <p>Structured content recommendations from your audit gap analysis.</p>
                    </div>
                    <PenLine size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                </div>
                <div style={{ padding: '0 24px 28px' }}>
                    <div style={{ background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)', border: '1px solid #e4e6ef', borderRadius: 10, padding: '32px 32px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* SVG: page with structured sections */}
                        <div style={{ flexShrink: 0 }}>
                            <svg width={180} height={130} viewBox="0 0 180 130" aria-hidden="true">
                                {/* Document outline */}
                                <rect x={20} y={8} width={90} height={114} rx={8} fill="#fff" stroke="#e4e6ef" strokeWidth={1.5} />
                                {/* Header band */}
                                <rect x={20} y={8} width={90} height={22} rx={8} fill="#4f6ef7" />
                                <rect x={20} y={22} width={90} height={8} fill="#4f6ef7" />
                                <rect x={30} y={16} width={50} height={6} rx={3} fill="rgba(255,255,255,.5)" />
                                {/* Section blocks */}
                                <rect x={28} y={38} width={74} height={6} rx={3} fill="#e4e6ef" />
                                <rect x={28} y={49} width={60} height={4} rx={2} fill="#f0f4ff" />
                                <rect x={28} y={56} width={66} height={4} rx={2} fill="#f0f4ff" />
                                <rect x={28} y={68} width={74} height={6} rx={3} fill="#e4e6ef" />
                                <rect x={28} y={79} width={55} height={4} rx={2} fill="#fef9c3" />
                                <rect x={28} y={86} width={62} height={4} rx={2} fill="#fef9c3" />
                                <rect x={28} y={97} width={74} height={6} rx={3} fill="#e4e6ef" />
                                <rect x={28} y={108} width={48} height={4} rx={2} fill="#dcfce7" />
                                {/* Section color dots */}
                                <circle cx={24} cy={41} r={3} fill="#4f6ef7" />
                                <circle cx={24} cy={71} r={3} fill="#8b5cf6" />
                                <circle cx={24} cy={100} r={3} fill="#10b981" />
                                {/* Right: export arrow */}
                                <rect x={128} y={48} width={36} height={36} rx={8} fill="#eef2ff" stroke="#c7d2fe" strokeWidth={1.5} />
                                <path d="M138 70l8-8 8 8M146 62v16" stroke="#4f6ef7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Run a scan or audit first to unlock</p>
                        </div>
                        {/* Explainer tiles */}
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>What the content brief includes</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {[
                                    { icon: <FileText size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Heading & FAQ recommendations', text: 'AI-generated H2/H3 questions and FAQ items based on your highest-weight dimension gaps.' },
                                    { icon: <BarChart2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Schema & entity suggestions', text: 'Structured data types and entity links to improve AI-source grounding and citation potential.' },
                                    { icon: <TrendingUp size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Passage blocks & reasoning', text: 'Paragraph templates optimised for direct AI answer extraction — export to Markdown in one click.' },
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
                                <strong style={{ color: '#4f6ef7' }}>To get started:</strong> Import a page audit or run a scan, then return here to generate your brief.
                            </div>
                        </div>
                    </div>
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
                        <h2>AI Content Studio</h2>
                        <p>Generate a structured content brief or a full RGPS-scored article draft from your audit gaps.</p>
                    </div>
                </div>
                <div style={{ padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Tab switcher */}
                    <div style={{ display: 'inline-flex', background: '#f0f2f5', borderRadius: 8, padding: 3, gap: 2, alignSelf: 'flex-start' }}>
                        <button onClick={() => setActiveTab('brief')} style={{ background: activeTab === 'brief' ? '#fff' : 'transparent', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '.85rem', fontWeight: activeTab === 'brief' ? 650 : 500, color: activeTab === 'brief' ? '#4f6ef7' : '#57606a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <PenLine size={14} /> Content Brief
                        </button>
                        <button onClick={() => setActiveTab('article')} style={{ background: activeTab === 'article' ? '#fff' : 'transparent', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '.85rem', fontWeight: activeTab === 'article' ? 650 : 500, color: activeTab === 'article' ? '#8b5cf6' : '#57606a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BookOpen size={14} /> Article Draft
                        </button>
                    </div>

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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Generate with</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {configuredProviders.map(p => (
                                    <button key={p.id} onClick={() => setSelectedProvider(p.id)}
                                        disabled={busy}
                                        style={{
                                            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                            border: `1.5px solid ${selectedProvider === p.id ? '#4f6ef7' : '#e4e6ef'}`,
                                            background: selectedProvider === p.id ? '#eef2ff' : '#fafafa',
                                            color: selectedProvider === p.id ? '#3730a3' : '#57606a',
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                        }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedProvider === p.id ? '#4f6ef7' : '#d1d5db', flexShrink: 0 }} />
                                        {p.label.split(' ')[0]}
                                        {selectedProvider === p.id && <span style={{ fontSize: 11 }}>✓</span>}
                                    </button>
                                ))}
                                {configuredProviders.length === 0 && (
                                    <span style={{ fontSize: 12, color: '#b91c1c' }}>No AI providers configured — add an API key to .env</span>
                                )}
                            </div>
                        </div>
                        {activeTab === 'brief' ? (
                            <button className="primary" onClick={generate}
                                disabled={busy || generating || !selectedProvider || configuredProviders.length === 0}>
                                {generating
                                    ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />Generating brief…</>
                                    : <><Zap size={15} />Generate content brief</>}
                            </button>
                        ) : (
                            <button className="primary" onClick={generateDraft}
                                disabled={busy || generatingDraft || !selectedProvider || configuredProviders.length === 0}
                                style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}>
                                {generatingDraft
                                    ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />Writing article…</>
                                    : <><BookOpen size={15} />Generate article draft</>}
                            </button>
                        )}
                    </div>

                    {activeTab === 'brief' && error && <div className="error" role="alert">{error}</div>}
                    {activeTab === 'article' && draftError && <div className="error" role="alert">{draftError}</div>}
                </div>
            </section>

            {/* ── BRIEF TAB ── */}
            {activeTab === 'brief' && (
                <>
                    {/* Ready-to-generate empty state */}
                    {!brief && !generating && (
                        <div style={{ background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)', border: '1px solid #e4e6ef', borderRadius: 10, padding: '32px 36px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ flexShrink: 0 }}>
                                <svg width={200} height={140} viewBox="0 0 200 140" aria-hidden="true">
                                    <rect x={18} y={10} width={96} height={120} rx={8} fill="#fff" stroke="#e4e6ef" strokeWidth={1.5} />
                                    <rect x={18} y={10} width={96} height={24} rx={8} fill="#4f6ef7" />
                                    <rect x={18} y={26} width={96} height={8} fill="#4f6ef7" />
                                    <rect x={28} y={17} width={52} height={7} rx={3} fill="rgba(255,255,255,.55)" />
                                    <circle cx={26} cy={47} r={4} fill="#4f6ef7" />
                                    <rect x={34} y={43} width={58} height={6} rx={3} fill="#e4e6ef" />
                                    <rect x={34} y={53} width={44} height={4} rx={2} fill="#f0f4ff" />
                                    <rect x={34} y={60} width={50} height={4} rx={2} fill="#f0f4ff" />
                                    <circle cx={26} cy={75} r={4} fill="#8b5cf6" />
                                    <rect x={34} y={71} width={58} height={6} rx={3} fill="#e4e6ef" />
                                    <rect x={34} y={81} width={40} height={4} rx={2} fill="#ede9fe" />
                                    <rect x={34} y={88} width={52} height={4} rx={2} fill="#ede9fe" />
                                    <circle cx={26} cy={103} r={4} fill="#10b981" />
                                    <rect x={34} y={99} width={58} height={6} rx={3} fill="#e4e6ef" />
                                    <rect x={34} y={109} width={48} height={4} rx={2} fill="#dcfce7" />
                                    <rect x={34} y={116} width={36} height={4} rx={2} fill="#dcfce7" />
                                    <rect x={130} y={38} width={52} height={52} rx={10} fill="#eef2ff" stroke="#c7d2fe" strokeWidth={1.5} />
                                    <line x1={148} y1={78} x2={168} y2={58} stroke="#4f6ef7" strokeWidth={2.5} strokeLinecap="round" />
                                    <circle cx={168} cy={58} r={5} fill="#4f6ef7" />
                                    <line x1={173} y1={52} x2={177} y2={48} stroke="#8b5cf6" strokeWidth={1.5} strokeLinecap="round" />
                                    <line x1={174} y1={58} x2={179} y2={58} stroke="#8b5cf6" strokeWidth={1.5} strokeLinecap="round" />
                                    <line x1={168} y1={52} x2={168} y2={47} stroke="#8b5cf6" strokeWidth={1.5} strokeLinecap="round" />
                                    <circle cx={143} cy={50} r={2.5} fill="#4f6ef7" opacity={0.6} />
                                    <circle cx={152} cy={44} r={2} fill="#8b5cf6" opacity={0.5} />
                                    <circle cx={160} cy={75} r={2} fill="#10b981" opacity={0.5} />
                                    <path d="M152 100l4 6 4-6" stroke="#4f6ef7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                    <line x1={156} y1={94} x2={156} y2={106} stroke="#4f6ef7" strokeWidth={1.5} strokeLinecap="round" />
                                </svg>
                                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>Select a provider above, then click Generate</p>
                            </div>
                            <div style={{ flex: 1, minWidth: 240 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 14 }}>What gets generated</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { icon: <FileText size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Headings & FAQs', text: 'Specific H2/H3 questions and 6-10 FAQ items derived from your highest-weight audit gaps.' },
                                        { icon: <BarChart2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Schema markup & entity links', text: 'Structured data types to add and sameAs entity links for AI grounding.' },
                                        { icon: <TrendingUp size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Passage blocks & reasoning cues', text: 'Ready-to-write content block descriptions that help AI engines cite your page.' },
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
                            </div>
                        </div>
                    )}

                    {/* Generated brief */}
                    {brief && (
                        <>
                            <section className="panel">
                                <div style={{ padding: '20px 24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 6 }}>GEO Content Brief</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1d2e', lineHeight: 1.3 }}>{brief.clientName}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>{brief.pageUrl}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                                                Generated {new Date(brief.generatedAt).toLocaleString()} · {brief.model} · Score {brief.overallScore ?? 'N/A'}/100
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button className="secondary" onClick={copyAll}>
                                                <Copy size={13} /> Copy all
                                            </button>
                                            <button className="secondary" onClick={exportMarkdown}>
                                                <FileText size={13} /> Export brief
                                            </button>
                                            <button className="secondary" onClick={exportFullReport} title="Full marketing report with dimension gap table + all brief sections">
                                                <TrendingUp size={13} /> Full report
                                            </button>
                                        </div>
                                    </div>
                                    {brief.executiveSummary && (
                                        <div style={{ marginTop: 14, padding: '12px 16px', background: '#f7f8fa', borderRadius: 8, fontSize: 13, color: '#374151', lineHeight: 1.7, borderLeft: '3px solid #4f6ef7' }}>
                                            {brief.executiveSummary}
                                        </div>
                                    )}
                                </div>
                            </section>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {brief.sections.map((section, i) => (
                                    <SectionCard key={i} section={section} />
                                ))}
                            </div>
                            <div style={{ fontSize: 11, color: '#8b9aa6', lineHeight: 1.6, padding: '0 0 8px' }}>
                                Generated by {brief.model} based on audit gaps from rubric {audit.version}.
                                Content suggestions are AI-generated — validate accuracy and brand voice before use.
                                Re-audit the page after implementing changes to measure score improvement.
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ── ARTICLE DRAFT TAB ── */}
            {activeTab === 'article' && (
                <>
                    {/* Empty state */}
                    {!draft && !generatingDraft && (
                        <div style={{ background: 'linear-gradient(135deg,#fdf4ff 0%,#f5f3ff 100%)', border: '1px solid #e9d5ff', borderRadius: 10, padding: '32px 36px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ flexShrink: 0 }}>
                                <svg width={180} height={130} viewBox="0 0 180 130" aria-hidden="true">
                                    <rect x={18} y={8} width={86} height={114} rx={8} fill="#fff" stroke="#e9d5ff" strokeWidth={1.5} />
                                    <rect x={18} y={8} width={86} height={22} rx={8} fill="#8b5cf6" />
                                    <rect x={18} y={22} width={86} height={8} fill="#8b5cf6" />
                                    <rect x={26} y={14} width={48} height={6} rx={3} fill="rgba(255,255,255,.5)" />
                                    <rect x={26} y={40} width={70} height={5} rx={2} fill="#e4e6ef" />
                                    <rect x={26} y={49} width={62} height={4} rx={2} fill="#f3e8ff" />
                                    <rect x={26} y={56} width={66} height={4} rx={2} fill="#f3e8ff" />
                                    <rect x={26} y={65} width={70} height={5} rx={2} fill="#e4e6ef" />
                                    <rect x={26} y={74} width={54} height={4} rx={2} fill="#f3e8ff" />
                                    <rect x={26} y={81} width={60} height={4} rx={2} fill="#f3e8ff" />
                                    <rect x={26} y={90} width={70} height={5} rx={2} fill="#e4e6ef" />
                                    <rect x={26} y={99} width={44} height={4} rx={2} fill="#dcfce7" />
                                    <rect x={26} y={106} width={52} height={4} rx={2} fill="#dcfce7" />
                                    <rect x={120} y={40} width={44} height={44} rx={9} fill="#f5f3ff" stroke="#c4b5fd" strokeWidth={1.5} />
                                    <circle cx={142} cy={56} r={10} fill="#8b5cf6" opacity={0.15} />
                                    <text x={142} y={61} textAnchor="middle" fontSize={14} fontWeight={700} fill="#8b5cf6">A</text>
                                    <circle cx={132} cy={74} r={3} fill="#8b5cf6" opacity={0.4} />
                                    <circle cx={142} cy={78} r={2} fill="#6d28d9" opacity={0.3} />
                                    <circle cx={152} cy={72} r={3} fill="#a78bfa" opacity={0.5} />
                                </svg>
                                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>Select a provider above, then click Generate</p>
                            </div>
                            <div style={{ flex: 1, minWidth: 240 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 14 }}>What gets generated</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        { icon: <BookOpen size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Full article in Markdown', text: 'A complete, publishable article with heading structure, body paragraphs, and FAQ section.' },
                                        { icon: <Star size={15} />, color: '#d97706', bg: '#fffbeb', title: 'RGPS score preview', text: 'The draft is automatically scored against all 12 RGPS dimensions before you publish.' },
                                        { icon: <FileText size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'HTML + Markdown download', text: 'Download as .md for any CMS or as HTML for direct preview and editing.' },
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
                                <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff', border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                                    <strong style={{ color: '#8b5cf6' }}>Tip:</strong> The article is seeded from your content brief gaps — generate a brief first for the best results.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Article draft result */}
                    {draft && <ArticleDraftView draft={draft} onClear={() => setDraft(null)} />}
                </>
            )}
        </div>
    );
}
