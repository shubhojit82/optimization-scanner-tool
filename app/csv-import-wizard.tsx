"use client";
import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Client } from '../src/core/contracts';
import { api } from './workbench-api';

type Row = {
    engine: string; surface: string; model: string;
    prompt: string; response: string;
    citations: string[]; observedAt: string;
    _error?: string;
};

type Props = {
    client: Client;
    onDone: () => void;
    onCancel: () => void;
};

function parseCSV(text: string): Row[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    // Skip header row
    return lines.slice(1).map((line, idx) => {
        // Simple CSV parser — handles quoted fields
        const cols: string[] = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
            else cur += ch;
        }
        cols.push(cur);
        const [engine = '', surface = '', model = '', prompt = '', response = '', citStr = '', observedAt = ''] = cols.map(c => c.trim());
        const citations = citStr ? citStr.split('|').map(u => u.trim()).filter(Boolean) : [];
        let error: string | undefined;
        if (!engine) error = 'Missing engine';
        else if (!prompt) error = 'Missing prompt';
        else if (!response) error = 'Missing response';
        else if (!observedAt || isNaN(Date.parse(observedAt))) error = 'Invalid observedAt date';
        return { engine, surface: surface || 'import', model: model || 'unknown', prompt, response, citations, observedAt, _error: error };
    });
}

export function CsvImportWizard({ client, onDone, onCancel }: Props) {
    const [step, setStep] = useState<'input' | 'preview' | 'done'>('input');
    const [csvText, setCsvText] = useState('');
    const [rows, setRows] = useState<Row[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [imported, setImported] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);

    function handleParse() {
        const parsed = parseCSV(csvText);
        if (!parsed.length) { setError('No data rows found. Ensure the CSV has a header row and at least one data row.'); return; }
        setRows(parsed); setError(''); setStep('preview');
    }

    async function handleImport() {
        const valid = rows.filter(r => !r._error).map(({ engine, surface, model, prompt, response, citations, observedAt }) =>
            ({ engine, surface, model, prompt, response, citations, observedAt }));
        if (!valid.length) { setError('No valid rows to import.'); return; }
        setBusy(true); setError('');
        try {
            // Batch in groups of 20 (API limit per import)
            for (let i = 0; i < valid.length; i += 20) {
                await api(`clients/${client.id}/observations`, valid.slice(i, i + 20));
            }
            setImported(valid.length);
            setStep('done');
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
        onDone();
    }

    const validCount = rows.filter(r => !r._error).length;
    const errorCount = rows.filter(r => r._error).length;

    return (
        <div style={{ padding: '0 24px 24px' }}>
            {step === 'input' && (
                <>
                    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                        <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>Expected CSV format</div>
                        <code style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '.75rem', background: 'var(--layer-01)', padding: '8px 12px', display: 'block', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                            engine,surface,model,prompt,response,citations,observedAt
                        </code>
                        <p style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                            <code style={{ fontFamily: 'IBM Plex Mono,monospace' }}>citations</code> — pipe-separated URLs (e.g. https://a.com|https://b.com) · <code style={{ fontFamily: 'IBM Plex Mono,monospace' }}>observedAt</code> — ISO 8601
                        </p>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <button type="button" className="secondary" onClick={() => fileRef.current?.click()} style={{ marginBottom: 8 }}>
                            <Upload size={15} /> Choose CSV file
                        </button>
                        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                            onChange={async e => {
                                const f = e.target.files?.[0];
                                if (f) { setCsvText(await f.text()); }
                            }} />
                    </div>
                    <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                        Or paste CSV text
                    </label>
                    <textarea
                        value={csvText} onChange={e => setCsvText(e.target.value)}
                        rows={8} placeholder={'engine,surface,model,prompt,response,citations,observedAt\nchatgpt,web,gpt-4o,What is...,Answer text,https://src.com,2024-01-15T12:00:00Z'}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--layer-01)', fontFamily: 'IBM Plex Mono,monospace', fontSize: '.8125rem', color: 'var(--text-primary)', resize: 'vertical', borderRadius: 0 }}
                    />
                    {error && <div className="error" style={{ marginTop: 8 }} role="alert">{error}</div>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button className="primary" onClick={handleParse} disabled={!csvText.trim()} style={{ height: 40, paddingRight: 16 }}>Preview rows</button>
                        <button className="secondary" onClick={onCancel}>Cancel</button>
                    </div>
                </>
            )}

            {step === 'preview' && (
                <>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', color: 'var(--score-good)' }}><CheckCircle size={15} />{validCount} valid</span>
                        {errorCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', color: 'var(--score-danger)' }}><AlertTriangle size={15} />{errorCount} errors (will be skipped)</span>}
                    </div>
                    <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '8px 12px', background: 'var(--layer-01)', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', textAlign: 'left' }}>Engine</th>
                                    <th style={{ padding: '8px 12px', background: 'var(--layer-01)', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', textAlign: 'left' }}>Prompt</th>
                                    <th style={{ padding: '8px 12px', background: 'var(--layer-01)', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '8px 12px', background: 'var(--layer-01)', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', textAlign: 'left' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i} style={{ background: row._error ? '#fff1f1' : undefined }}>
                                        <td style={{ padding: '8px 12px', fontSize: '.8125rem', borderBottom: '1px solid var(--border-subtle)' }}>{row.engine}</td>
                                        <td style={{ padding: '8px 12px', fontSize: '.8125rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)' }}>{row.prompt}</td>
                                        <td style={{ padding: '8px 12px', fontSize: '.75rem', fontFamily: 'IBM Plex Mono,monospace', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{row.observedAt.slice(0, 10)}</td>
                                        <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                                            {row._error
                                                ? <span style={{ color: 'var(--score-danger)' }}>{row._error}</span>
                                                : <span style={{ color: 'var(--score-good)' }}>✓ Valid</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {error && <div className="error" style={{ marginBottom: 12 }} role="alert">{error}</div>}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="primary" onClick={handleImport} disabled={busy || !validCount} style={{ height: 40, paddingRight: 16 }}>
                            {busy ? 'Importing…' : `Import ${validCount} observation${validCount !== 1 ? 's' : ''}`}
                        </button>
                        <button className="secondary" onClick={() => setStep('input')}><X size={15} />Back</button>
                    </div>
                </>
            )}

            {step === 'done' && (
                <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--score-good)', fontSize: '1rem', fontWeight: 600 }}>
                        <CheckCircle size={20} /> {imported} observation{imported !== 1 ? 's' : ''} imported successfully
                    </div>
                    <button className="secondary" onClick={onCancel}>Close</button>
                </div>
            )}
        </div>
    );
}
