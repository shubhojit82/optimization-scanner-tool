"use client";
import {useState} from 'react';
import {Search, Download, AlertTriangle, CheckCircle, Loader, ExternalLink, RefreshCw, ChevronDown, Save, Globe, Bot, Map, Zap, FileText, BarChart2, Cpu, GitCompare} from 'lucide-react';
import type {ScanResult, RawVsRenderedDelta} from '../src/application/scanner';
import type {TechStack} from '../src/core/tech-detect';
import type {RgpsResult, RgpsDimensionResult} from '../src/core/rgps';
import type {AiBotAccess, SitemapInfo} from '../src/server/node-crawler';
import type {SiteScanResult, PageCrawlResult} from '../src/server/site-crawler';
import type {Client} from '../src/core/contracts';
import {api} from './workbench-api';

type Props = {clients: Client[]; busy: boolean; onBusy: (b: boolean) => void; onSaved?: (clientId: string) => void};
type Mode = 'single' | 'site';

function ScoreRing({score, size=80, color='#57e3c2', label}: {score: number|null; size?: number; color?: string; label?: string}) {
    const val = score ?? 0;
    return (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
            <div className="score-ring" style={{width:size,height:size,background:`conic-gradient(${color} ${val*3.6}deg,#284655 0)`}}>
                <div style={{fontSize:size>70?22:14,fontWeight:700}}>
                    {score===null?<span style={{fontSize:size>70?13:9,color:'#8b9aa6'}}>N/A</span>:<>{val}<span style={{fontSize:size>70?11:9}}>/100</span></>}
                </div>
            </div>
            {label&&<span style={{fontSize:11,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',color:'#57606a'}}>{label}</span>}
        </div>
    );
}

function SubScoreBar({seoScore, aeoScore, geoScore}: {seoScore:number|null; aeoScore:number|null; geoScore:number|null}) {
    return (
        <div style={{display:'flex',gap:24,justifyContent:'center',flexWrap:'wrap',padding:'16px 0 4px'}}>
            <ScoreRing score={seoScore} size={72} color='#3b82d4' label='SEO'/>
            <ScoreRing score={aeoScore} size={72} color='#7c5cd8' label='AEO'/>
            <ScoreRing score={geoScore} size={72} color='#57e3c2' label='GEO'/>
        </div>
    );
}

function ScorePill({score, avg}: {score: number; avg: number | null}) {
    const diff = avg !== null ? score - avg : null;
    return (
        <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
            <span style={{fontWeight:700,fontSize:13,color:'#213f50'}}>{score}</span>
            {diff !== null && (
                <span style={{fontSize:11,fontWeight:700,color:diff>0?'#15803d':diff<0?'#b91c1c':'#57606a',background:diff>0?'#dcfce7':diff<0?'#fee2e2':'#f0f0f0',borderRadius:20,padding:'1px 6px'}}>
                    {diff>0?'+':''}{diff}
                </span>
            )}
        </span>
    );
}

// ── Scanner empty state ────────────────────────────────────────────────────────
function ScannerEmptyState({ mode }: { mode: 'single' | 'site' }) {
    const isSingle = mode === 'single';
    return (
        <div style={{
            background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
            border: '1px solid #e4e6ef',
            borderRadius: 10,
            padding: '32px 32px',
            display: 'flex',
            gap: 48,
            alignItems: 'center',
            flexWrap: 'wrap',
        }}>
            {/* SVG illustration */}
            <div style={{ flexShrink: 0 }}>
                {isSingle ? (
                    <svg width={260} height={140} viewBox="0 0 260 140" aria-hidden="true">
                        {/* Page outline */}
                        <rect x={20} y={10} width={100} height={120} rx={6} fill="#fff" stroke="#e4e6ef" strokeWidth={1.5} />
                        {/* Page lines */}
                        {[28, 38, 48, 58, 68, 78, 88, 98, 108].map((y, i) => (
                            <rect key={y} x={30} y={y} width={i % 3 === 2 ? 50 : 72} height={5} rx={2.5} fill="#e4e6ef" />
                        ))}
                        {/* Score ring */}
                        <circle cx={180} cy={70} r={44} fill="none" stroke="#e4e6ef" strokeWidth={8} />
                        <circle cx={180} cy={70} r={44} fill="none" stroke="#4f6ef7" strokeWidth={8}
                            strokeDasharray="193 83" strokeLinecap="round"
                            transform="rotate(-90 180 70)" />
                        <text x={180} y={65} textAnchor="middle" fontSize={22} fontWeight={700} fill="#1a1d2e" fontFamily="IBM Plex Mono, monospace">72</text>
                        <text x={180} y={82} textAnchor="middle" fontSize={10} fill="#6b7280">/100</text>
                        {/* Arrow from page to ring */}
                        <line x1={122} y1={70} x2={132} y2={70} stroke="#4f6ef7" strokeWidth={1.5} strokeDasharray="3 2" />
                        <polygon points="132,66 140,70 132,74" fill="#4f6ef7" />
                        {/* Sub-score dots */}
                        {[['SEO', '#4f6ef7', 155], ['AEO', '#8b5cf6', 180], ['GEO', '#10b981', 205]].map(([lbl, col, cx]) => (
                            <g key={lbl as string}>
                                <circle cx={cx as number} cy={124} r={6} fill={col as string} />
                                <text x={cx as number} y={138} textAnchor="middle" fontSize={8} fill="#6b7280">{lbl}</text>
                            </g>
                        ))}
                    </svg>
                ) : (
                    <svg width={260} height={140} viewBox="0 0 260 140" aria-hidden="true">
                        {/* Site tree */}
                        <rect x={110} y={8} width={44} height={28} rx={4} fill="#4f6ef7" opacity={0.9} />
                        <text x={132} y={27} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={700}>Home</text>
                        {/* Lines down */}
                        <line x1={132} y1={36} x2={132} y2={52} stroke="#c4c8d8" strokeWidth={1.5} />
                        <line x1={50} y1={52} x2={214} y2={52} stroke="#c4c8d8" strokeWidth={1.5} />
                        {[50, 132, 214].map((cx, i) => (
                            <g key={cx}>
                                <line x1={cx} y1={52} x2={cx} y2={64} stroke="#c4c8d8" strokeWidth={1.5} />
                                <rect x={cx - 22} y={64} width={44} height={24} rx={4}
                                    fill={i === 0 ? '#f0fdf4' : i === 1 ? '#eff6ff' : '#fef9c3'}
                                    stroke={i === 0 ? '#86efac' : i === 1 ? '#93c5fd' : '#fde68a'} strokeWidth={1} />
                                <text x={cx} y={80} textAnchor="middle" fontSize={8} fill="#374151">Page {i + 1}</text>
                                {/* Mini score */}
                                <text x={cx} y={105} textAnchor="middle" fontSize={11} fontWeight={700}
                                    fill={i === 0 ? '#15803d' : i === 1 ? '#4f6ef7' : '#b45309'}>
                                    {[81, 72, 55][i]}
                                </text>
                            </g>
                        ))}
                        <text x={132} y={125} textAnchor="middle" fontSize={9} fill="#9ca3af">50 pages · depth 3 · site-wide gaps</text>
                    </svg>
                )}
                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>
                    Illustrative — run a scan to see real scores
                </p>
            </div>

            {/* Feature explainer */}
            <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#4f6ef7', textTransform: 'uppercase', marginBottom: 12 }}>
                    {isSingle ? 'What single-page scan does' : 'What full-site scan does'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {(isSingle ? [
                        { icon: <Globe size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Fetches the live page', text: 'Retrieves HTML via HTTP crawler — the same content search bots see.' },
                        { icon: <BarChart2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Scores SEO · AEO · GEO', text: 'Runs every rubric dimension: structure, schema, content cues, AI-bot access, sitemap.' },
                        { icon: <FileText size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Export & save', text: 'Download an XLSX report or save directly to a client\'s audit history.' },
                    ] : [
                        { icon: <Map size={15} />, color: '#4f6ef7', bg: '#eef2ff', title: 'Crawls up to 50 pages', text: 'Follows internal links depth-first up to depth 3 — polite sequential crawl.' },
                        { icon: <BarChart2 size={15} />, color: '#8b5cf6', bg: '#f5f3ff', title: 'Site-wide gap analysis', text: 'Surfaces dimensions missing across multiple pages for maximum impact.' },
                        { icon: <Zap size={15} />, color: '#10b981', bg: '#ecfdf5', title: 'Per-page scores + XLSX', text: 'Every crawled page scored individually — export all results in one spreadsheet.' },
                    ]).map(item => (
                        <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {item.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1d2e' }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{item.text}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff', border: '1px solid #e4e6ef', borderRadius: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                    {isSingle
                        ? <><strong style={{ color: '#4f6ef7' }}>Tip:</strong> Select a client in <strong>Match client</strong> to save scan results directly to the Overview tab.</>
                        : <><strong style={{ color: '#4f6ef7' }}>Tip:</strong> Site scan takes 1–3 minutes. JavaScript-rendered content is not assessed — use the single-page scan for SPAs.</>
                    }
                </div>
            </div>
        </div>
    );
}

// ── Single page scan panel ────────────────────────────────────────────────────
function SingleScanPanel({clients, busy, onBusy, onSaved}: Props) {
    const [url, setUrl] = useState('');
    const [clientId, setClientId] = useState('');
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    async function runScan(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;
        setError(''); setResult(null); setSaved(false); onBusy(true);
        try {
            const r = await fetch('/api/v1/scan', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url, ...(clientId?{clientId}:{})})});
            const d = await r.json() as ScanResult & {error?: string};
            if (!r.ok) throw new Error(d.error || 'Scan failed');
            setResult(d);
        } catch(e) { setError((e as Error).message); } finally { onBusy(false); }
    }

    async function exportXlsx() {
        if (!result || exporting) return;
        setExporting(true);
        try {
            const r = await fetch('/api/v1/scan/export', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:result.url, ...(clientId?{clientId}:{})})});
            if (!r.ok) throw new Error((await r.json() as {error?:string}).error || 'Export failed');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(await r.blob());
            link.download = `geo-scan-${new URL(result.url).hostname}.xlsx`;
            link.click(); URL.revokeObjectURL(link.href);
        } catch(e) { setError((e as Error).message); } finally { setExporting(false); }
    }

    async function saveToClient() {
        if (!result?.audit || !clientId || saving) return;
        setSaving(true); setError('');
        try {
            await api<{audit:unknown;findings:unknown[]}>('scan/save', {clientId, audit:result.audit});
            setSaved(true); onSaved?.(clientId);
        }
        catch(e) { setError((e as Error).message); } finally { setSaving(false); }
    }

    const opportunities = result?.audit?.dimensions.filter(d => d.score !== null && d.score < 100).sort((a,b) => b.weight*(100-b.score!) - a.weight*(100-a.score!)) ?? [];

    return (
        <div>
            <FormCard url={url} setUrl={setUrl} clientId={clientId} setClientId={setClientId} clients={clients} busy={busy} onSubmit={runScan}
                label="Scan a single page" hint="Fetch, analyse and score one URL instantly." error={error}/>

            {!result && !busy && <ScannerEmptyState mode="single" />}
            {result && (
                <>
                    <ResultBar url={result.url} status={result.status} fetchedAt={result.fetchedAt}
                        clientId={clientId} hasAudit={!!result.audit} saved={saved} saving={saving}
                        exporting={exporting} onSave={saveToClient} onExport={exportXlsx} onClear={()=>{setResult(null);setSaved(false);}}/>
                    {!clientId && result.audit && <SaveHint/>}
                    <FlagSection flags={result.flags}/>
                    {result.aiBotAccess && <AiBotAccessSection access={result.aiBotAccess}/>}
                    {result.techStack && <TechStackSection stack={result.techStack}/>}
                    {result.rgps && <RgpsSection rgps={result.rgps} url={result.url}/>}
                    {result.rawVsRendered && <RawVsRenderedSection delta={result.rawVsRendered}/>}
                    {result.sitemapInfo && <SitemapSection info={result.sitemapInfo}/>}
                    {result.audit ? (
                        <div className="content-grid">
                            <section className="panel">
                                <div className="panel-heading">
                                    <div><h2>Readiness score</h2><p>{result.audit.coverage}% rubric coverage · {result.audit.version}</p></div>
                                    <ScoreRing score={result.audit.score} label='Overall'/>
                                </div>
                                <SubScoreBar seoScore={result.audit.subScores?.seoScore ?? null} aeoScore={result.audit.subScores?.aeoScore ?? null} geoScore={result.audit.subScores?.geoScore ?? null}/>
                                <div style={{display:'flex',gap:16,padding:'8px 24px 4px',fontSize:11,color:'#8b9aa6',lineHeight:1.5}}>
                                    <span><strong style={{color:'#3b82d4'}}>SEO</strong> — Technical crawlability (from HTML)</span>
                                    <span><strong style={{color:'#7c5cd8'}}>AEO</strong> — Content answer-readiness (from HTML)</span>
                                    <span><strong style={{color:'#0d8073'}}>GEO</strong> — Live AI visibility (probe runs required)</span>
                                </div>
                                <div className="dimensions">
                                    {result.audit.dimensions.map(d=>(
                                        <div className="dimension" key={d.id}>
                                            <div><span>{d.name}</span><small>{d.weight}% weight</small></div>
                                            <div className="bar"><i style={{width:d.score===null?'0%':d.score+'%'}}/></div>
                                            <span className={d.score===null?'unknown':'dimension-value'}>{d.score===null?'Not assessed':d.score}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="panel-note">Unknown dimensions require live crawler access or manual review.</div>
                            </section>
                            <section className="panel opportunities">
                                <div className="panel-heading"><div><h2>Priority actions</h2><p>Ordered by weighted implementation gap.</p></div><span className="count">{opportunities.length}</span></div>
                                {opportunities.length ? opportunities.map((d,i)=>(
                                    <details key={d.id} open={i===0}>
                                        <summary><span className="action-number">{String(i+1).padStart(2,'0')}</span><span>{d.name}<small>{(d.weight*(100-d.score!)/100).toFixed(1)} pts unfulfilled</small></span><ChevronDown size={16}/></summary>
                                        <p>{d.action}</p><div className="evidence"><span>EVIDENCE</span>{d.evidence}</div>
                                    </details>
                                )) : <div className="empty"><p>All assessed dimensions at 100. Review unassessed dimensions.</p></div>}
                            </section>
                        </div>
                    ) : (
                        <section className="panel"><div className="empty"><AlertTriangle size={26} color="#e05252"/><p>Page could not be fetched. Resolve blocking flags and scan again.</p><a href={result.url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:5,color:'#0d8073'}}>Open page <ExternalLink size={12}/></a></div></section>
                    )}
                </>
            )}
        </div>
    );
}

// ── Site scan panel ────────────────────────────────────────────────────────────
function SiteScanPanel({clients, busy, onBusy, onSaved}: Props) {
    const [url, setUrl] = useState('');
    const [clientId, setClientId] = useState('');
    const [result, setResult] = useState<SiteScanResult | null>(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<{done:number;total:number;current:string} | null>(null);
    const [exporting, setExporting] = useState(false);
    const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
    const [savingUrl, setSavingUrl] = useState<string | null>(null);
    const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());

    async function runScan(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;
        setError(''); setResult(null); setProgress({done:0, total:1, current:url}); setSavedUrls(new Set()); onBusy(true);
        try {
            // Site scan can take 30-120s — no streaming from server yet, just show spinner with URL
            setProgress({done:0, total:50, current:'Starting crawl…'});
            const r = await fetch('/api/v1/site-scan', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url, ...(clientId?{clientId}:{})})});
            const d = await r.json() as SiteScanResult & {error?:string};
            if (!r.ok) throw new Error(d.error || 'Site scan failed');
            setResult(d);
        } catch(e) { setError((e as Error).message); } finally { setProgress(null); onBusy(false); }
    }

    async function exportXlsx() {
        if (!result || exporting) return;
        setExporting(true);
        try {
            const r = await fetch('/api/v1/site-scan/export', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:result.startUrl, ...(clientId?{clientId}:{})})});
            if (!r.ok) throw new Error((await r.json() as {error?:string}).error || 'Export failed');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(await r.blob());
            link.download = `geo-site-${new URL(result.startUrl).hostname}.xlsx`;
            link.click(); URL.revokeObjectURL(link.href);
        } catch(e) { setError((e as Error).message); } finally { setExporting(false); }
    }

    async function savePage(page: PageCrawlResult) {
        if (!page.audit || !clientId || savingUrl) return;
        setSavingUrl(page.url);
        try {
            await api<{audit:unknown;findings:unknown[]}>('scan/save', {clientId, audit:{...page.audit}});
            setSavedUrls(s => new Set([...s, page.url]));
            onSaved?.(clientId);
        } catch(e) { setError((e as Error).message); } finally { setSavingUrl(null); }
    }

    return (
        <div>
            <FormCard url={url} setUrl={setUrl} clientId={clientId} setClientId={setClientId} clients={clients} busy={busy} onSubmit={runScan}
                label="Scan entire site" hint={`Crawls up to 50 pages, depth 3. Scores every page and produces a site-wide GEO report.`} error={error} submitLabel="Crawl site"/>

            {/* Progress indicator */}
            {busy && progress && (
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',background:'#f0f6f7',borderRadius:8,marginBottom:16,fontSize:13}}>
                    <Loader size={16} style={{animation:'spin 1s linear infinite',flexShrink:0,color:'#0d8073'}}/>
                    <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,color:'#213f50',marginBottom:4}}>Crawling site — polite sequential crawl, may take 1–3 minutes…</div>
                        <div style={{color:'#57606a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{progress.current}</div>
                    </div>
                </div>
            )}

            {!result && !busy && <ScannerEmptyState mode="site" />}
            {result && (
                <>
                    {/* Site summary bar */}
                    <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,padding:'14px 0',borderBottom:'1px solid #e5e7eb',marginBottom:16}}>
                        <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:14}}>{result.startUrl}</div>
                            <div style={{fontSize:12,color:'#57606a',marginTop:2}}>{result.pagesAttempted} pages crawled · {result.pagesScored} scored · {new Date(result.crawledAt).toLocaleString()}</div>
                        </div>
                        <button className="secondary" onClick={exportXlsx} disabled={exporting} style={{gap:7}}>
                            {exporting?<><Loader size={13} style={{animation:'spin 1s linear infinite'}}/> Exporting…</>:<><Download size={13}/> Export .xlsx</>}
                        </button>
                        <button className="secondary" onClick={()=>{setResult(null);setSavedUrls(new Set());}} style={{gap:7}}>
                            <RefreshCw size={13}/> Clear
                        </button>
                    </div>

                    {/* Score cards */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
                        <SummaryCard label="Average GEO Score" value={result.avgScore !== null ? `${result.avgScore}/100` : '—'} accent/>
                        <SummaryCard label="Pages Scored" value={`${result.pagesScored} / ${result.pagesAttempted}`}/>
                        <SummaryCard label="Avg Coverage" value={result.avgCoverage !== null ? `${result.avgCoverage}%` : '—'}/>
                        <SummaryCard label="Top Gap" value={result.commonGaps[0]?.name ?? 'None'} sub={result.commonGaps[0] ? `${result.commonGaps[0].count} pages affected` : ''}/>
                    </div>

                    {/* Common gaps */}
                    {result.commonGaps.length > 0 && (
                        <section className="panel" style={{marginBottom:16}}>
                            <div className="panel-heading"><div><h2>Site-wide gaps</h2><p>Dimensions missing across multiple pages — fix these for maximum site-level impact.</p></div></div>
                            <div style={{padding:'4px 24px 16px',display:'flex',flexWrap:'wrap',gap:8}}>
                                {result.commonGaps.map(g=>(
                                    <div key={g.name} style={{background:'#f0f6f7',borderRadius:7,padding:'8px 14px',fontSize:13}}>
                                        <span style={{fontWeight:650,color:'#213f50'}}>{g.name}</span>
                                        <span style={{color:'#57606a',marginLeft:8}}>{g.count} page{g.count!==1?'s':''}</span>
                                        <span style={{color:'#8b9aa6',marginLeft:6,fontSize:11}}>({g.weight}% weight)</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {!clientId && <SaveHint/>}

                    {/* Page table */}
                    <section className="panel">
                        <div className="panel-heading"><div><h2>Page results</h2><p>Click a row to see the full dimension breakdown. Save individual pages to the client's audit history.</p></div></div>
                        <div style={{padding:'0 0 8px'}}>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 70px 80px 70px 100px',gap:'0 10px',padding:'8px 20px',fontSize:11,fontWeight:700,letterSpacing:'.07em',color:'#8b9aa6',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb'}}>
                                <span>Page</span><span>Score</span><span>vs Avg</span><span>Depth</span><span></span>
                            </div>
                            {result.pages.map(page => {
                                const isOpen = expandedUrl === page.url;
                                const isSaved = savedUrls.has(page.url);
                                const isSaving = savingUrl === page.url;
                                return (
                                    <div key={page.url} style={{borderBottom:'1px solid #f0f2f5'}}>
                                        <div style={{display:'grid',gridTemplateColumns:'1fr 70px 80px 70px 100px',gap:'0 10px',padding:'12px 20px',alignItems:'center',cursor:'pointer',background:isOpen?'#f7fbfc':'transparent'}}
                                            onClick={()=>setExpandedUrl(isOpen?null:page.url)}>
                                            <div style={{minWidth:0,display:'flex',alignItems:'center',gap:6}}>
                                                {isOpen?<ChevronDown size={12} color="#57606a"/>:<span style={{width:12,flexShrink:0}}/>}
                                                <div style={{minWidth:0}}>
                                                    <div style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#213f50'}}>{page.url.replace(/^https?:\/\//,'')}</div>
                                                    {page.flags.length>0&&<span style={{fontSize:10,color:'#b91c1c',background:'#fee2e2',borderRadius:3,padding:'1px 5px',marginTop:2,display:'inline-block'}}>{page.flags[0].code}</span>}
                                                </div>
                                            </div>
                                            <div>{page.audit?<ScorePill score={page.audit.score} avg={result.avgScore}/>:<span style={{fontSize:11,color:'#b0bec5'}}>Failed</span>}</div>
                                            <div style={{fontSize:11,color:page.audit&&result.avgScore!==null?(page.audit.score-result.avgScore>0?'#15803d':page.audit.score-result.avgScore<0?'#b91c1c':'#57606a'):'#b0bec5',fontWeight:600}}>
                                                {page.audit&&result.avgScore!==null?(page.audit.score-result.avgScore>0?'+':'')+(page.audit.score-result.avgScore):''}
                                            </div>
                                            <div style={{fontSize:11,color:'#57606a'}}>Depth {page.depth}</div>
                                            <div onClick={e=>e.stopPropagation()} style={{display:'flex',justifyContent:'flex-end'}}>
                                                {clientId && page.audit && (
                                                    isSaved ? <span style={{fontSize:11,color:'#15803d',display:'flex',alignItems:'center',gap:4}}><CheckCircle size={12}/> Saved</span>
                                                    : <button onClick={()=>savePage(page)} disabled={!!savingUrl} style={{fontSize:11,background:'#0d8073',color:'#fff',border:'none',borderRadius:5,padding:'4px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                                                        {isSaving?<Loader size={11} style={{animation:'spin 1s linear infinite'}}/>:<Save size={11}/>} Save
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {isOpen && page.audit && (
                                            <div style={{padding:'4px 20px 16px 38px',background:'#f7fbfc'}}>
                                                <div className="dimensions" style={{paddingLeft:0,paddingRight:0}}>
                                                    {page.audit.dimensions.map(d=>(
                                                        <div className="dimension" key={d.id}>
                                                            <div><span>{d.name}</span><small>{d.weight}% weight</small></div>
                                                            <div className="bar"><i style={{width:d.score===null?'0%':d.score+'%'}}/></div>
                                                            <span className={d.score===null?'unknown':'dimension-value'}>{d.score===null?'Not assessed':d.score}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {page.flags.length>0&&<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
                                                    {page.flags.map(f=><div key={f.code} style={{fontSize:11,color:'#b91c1c',display:'flex',gap:6,alignItems:'flex-start'}}>
                                                        <span style={{background:'#fee2e2',borderRadius:3,padding:'1px 5px',fontWeight:700,flexShrink:0}}>{f.code}</span>
                                                        <span style={{color:'#57606a'}}>{f.message}</span>
                                                    </div>)}
                                                </div>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function FormCard({url, setUrl, clientId, setClientId, clients, busy, onSubmit, label, hint, error, submitLabel='Run scan'}: {
    url:string; setUrl:(s:string)=>void; clientId:string; setClientId:(s:string)=>void;
    clients:Client[]; busy:boolean; onSubmit:(e:React.FormEvent)=>void;
    label:string; hint:string; error:string; submitLabel?:string;
}) {
    return (
        <section className="panel" style={{marginBottom:16,padding:0,overflow:'hidden'}}>
            <div className="panel-heading">
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <Search size={16} color="var(--interactive)"/>
                    <div>
                        <h2>{label}</h2>
                        <p style={{marginTop:2}}>{hint}</p>
                    </div>
                </div>
            </div>
            <form onSubmit={onSubmit} style={{padding:'16px 24px 20px'}}>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
                    <label style={{flex:'1 1 280px',margin:0}}>
                        <span style={{display:'block',fontSize:11,fontWeight:700,letterSpacing:'.07em',color:'#6b7280',textTransform:'uppercase',marginBottom:6}}>URL</span>
                        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                            <Globe size={14} color="#9ca3af" style={{position:'absolute',left:11,pointerEvents:'none'}}/>
                            <input type="url" value={url} onChange={e=>setUrl(e.target.value)}
                                placeholder="https://example.com" required disabled={busy}
                                style={{width:'100%',border:'1.5px solid #e4e6ef',borderRadius:8,padding:'9px 12px 9px 32px',fontSize:14,background:'#fafafa',color:'#1a1d2e',outline:'none'}}
                                onFocus={e=>(e.currentTarget.style.borderColor='#4f6ef7')}
                                onBlur={e=>(e.currentTarget.style.borderColor='#e4e6ef')}
                            />
                        </div>
                    </label>
                    {clients.length>0&&(
                        <label style={{flex:'0 1 200px',margin:0}}>
                            <span style={{display:'block',fontSize:11,fontWeight:700,letterSpacing:'.07em',color:'#6b7280',textTransform:'uppercase',marginBottom:6}}>
                                Match client <span style={{fontWeight:400,textTransform:'none',fontSize:10}}>(opt.)</span>
                            </span>
                            <div style={{position:'relative'}}>
                                <select value={clientId} onChange={e=>setClientId(e.target.value)} disabled={busy}
                                    style={{width:'100%',appearance:'none',WebkitAppearance:'none',border:'1.5px solid #e4e6ef',borderRadius:8,padding:'9px 36px 9px 12px',fontSize:14,background:'#fafafa',color:'#1a1d2e',outline:'none',cursor:'pointer'}}>
                                    <option value="">— none —</option>
                                    {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <svg viewBox="0 0 20 20" width={15} height={15}
                                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#6b7280'}}
                                    fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="5 8 10 13 15 8"/>
                                </svg>
                            </div>
                        </label>
                    )}
                    <button className="primary" type="submit" disabled={busy}
                        style={{alignSelf:'flex-end',display:'flex',alignItems:'center',gap:7,whiteSpace:'nowrap'}}>
                        {busy?<><Loader size={14} style={{animation:'spin 1s linear infinite'}}/> Working…</>:<><Search size={14}/> {submitLabel}</>}
                    </button>
                </div>
                {error&&<div className="error" role="alert" style={{marginTop:12}}>{error}</div>}
                <p style={{margin:'10px 0 0',fontSize:12,color:'#6b7280',lineHeight:1.5}}>Results reflect what an HTTP crawler sees — JavaScript-rendered content is not assessed.</p>
            </form>
        </section>
    );
}

function ResultBar({url,status,fetchedAt,clientId,hasAudit,saved,saving,exporting,onSave,onExport,onClear}: {
    url:string;status:number;fetchedAt:string;clientId:string;hasAudit:boolean;
    saved:boolean;saving:boolean;exporting:boolean;
    onSave:()=>void;onExport:()=>void;onClear:()=>void;
}) {
    return (
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap',padding:'12px 0',borderBottom:'1px solid #e5e7eb'}}>
            <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,wordBreak:'break-all'}}>{url}</div>
                <div style={{fontSize:11,color:'#57606a',marginTop:2}}>HTTP {status} · {new Date(fetchedAt).toLocaleString()}</div>
            </div>
            {clientId&&hasAudit&&(saved?(
                <span style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#15803d',fontWeight:600}}><CheckCircle size={13}/> Saved</span>
            ):(
                <button className="primary" onClick={onSave} disabled={saving} style={{gap:6,padding:'7px 14px',fontSize:'.83rem'}}>
                    {saving?<><Loader size={12} style={{animation:'spin 1s linear infinite'}}/> Saving…</>:<><Save size={12}/> Save to client</>}
                </button>
            ))}
            <button className="secondary" onClick={onExport} disabled={exporting} style={{gap:6}}>
                {exporting?<><Loader size={12} style={{animation:'spin 1s linear infinite'}}/> Exporting…</>:<><Download size={12}/> Export .xlsx</>}
            </button>
            <button className="secondary" onClick={onClear} style={{gap:6}}><RefreshCw size={12}/> Clear</button>
        </div>
    );
}

function SaveHint() {
    return (
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'9px 13px',background:'#f0f6f7',borderRadius:7,fontSize:12,color:'#0d6e62'}}>
            <Save size={13}/> Select a client in <strong>Match client</strong> to save results to the Overview tab.
        </div>
    );
}

function FlagSection({flags}: {flags: {code:string;message:string}[]}) {
    if (flags.length === 0) return <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14,color:'#15803d',fontWeight:500,fontSize:13}}><CheckCircle size={14}/> No blocking signals detected.</div>;
    return (
        <section className="panel" style={{marginBottom:16,borderLeft:'3px solid #e05252'}}>
            <div className="panel-heading">
                <div><h2 style={{color:'#b91c1c'}}>Blocking flags ({flags.length})</h2><p>Resolve these before rescanning.</p></div>
                <AlertTriangle size={18} color="#e05252"/>
            </div>
            <ul style={{margin:'0 24px 16px',padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:7}}>
                {flags.map(f=>(
                    <li key={f.code} style={{display:'flex',gap:9,alignItems:'flex-start',fontSize:12,lineHeight:1.6}}>
                        <span style={{background:'#fee2e2',color:'#b91c1c',borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:700,flexShrink:0,marginTop:1}}>{f.code}</span>
                        <span>{f.message}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function AiBotAccessSection({access}: {access: AiBotAccess}) {
    if (!access.fetched) return null;
    const blocked = access.bots.filter(b => b.status === 'blocked');
    const allAllowed = blocked.length === 0;
    return (
        <section className="panel" style={{marginBottom:16,borderLeft:`3px solid ${allAllowed ? '#15803d' : '#e05252'}`}}>
            <div className="panel-heading">
                <div>
                    <h2 style={{color: allAllowed ? '#15803d' : '#b91c1c', display:'flex',alignItems:'center',gap:7}}>
                        <Bot size={15}/> AI Bot Access ({blocked.length} blocked)
                    </h2>
                    <p>robots.txt rules for AI crawlers that may index your content for LLM training and search.</p>
                </div>
                {allAllowed ? <CheckCircle size={18} color="#15803d"/> : <AlertTriangle size={18} color="#e05252"/>}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'4px 24px 16px'}}>
                {access.bots.map(b => (
                    <div key={b.name} style={{
                        display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                        background: b.status === 'allowed' ? '#dcfce7' : b.status === 'blocked' ? '#fee2e2' : '#f0f2f5',
                        color: b.status === 'allowed' ? '#15803d' : b.status === 'blocked' ? '#b91c1c' : '#57606a',
                    }}>
                        {b.status === 'allowed' ? <CheckCircle size={11}/> : b.status === 'blocked' ? <AlertTriangle size={11}/> : null}
                        {b.name}
                    </div>
                ))}
            </div>
            {blocked.length > 0 && (
                <div style={{margin:'0 24px 16px',padding:'10px 14px',background:'#fff7ed',borderRadius:7,fontSize:12,color:'#92400e',lineHeight:1.6}}>
                    <strong>Action:</strong> Add <code>User-agent: {blocked[0].name}</code> with <code>Allow: /</code> to robots.txt to permit AI crawling and content indexing.
                </div>
            )}
        </section>
    );
}


// ── RGPS Section ─────────────────────────────────────────────────────────────

const STEP_COLORS = ['#3b82d4', '#7c5cd8', '#0d8073'] as const;
const STEP_LABELS = ['Lift it out cleanly', 'Match it to the question', 'Trust it and cite it'];

function RgpsScoreMeter({total, passBar, passed, mandatoryFail}: {total: number; passBar: number; passed: boolean; mandatoryFail: string | null}) {
    const pct = Math.min(100, (total / 25) * 100);
    const passLinePct = (passBar / 25) * 100;
    const color = passed ? '#15803d' : mandatoryFail ? '#b91c1c' : '#d97706';
    const bg = passed ? '#dcfce7' : mandatoryFail ? '#fee2e2' : '#fef3c7';
    return (
        <div style={{display:'flex',alignItems:'center',gap:20,padding:'16px 24px 12px',flexWrap:'wrap'}}>
            <div style={{textAlign:'center',minWidth:72}}>
                <div style={{fontSize:'2rem',fontWeight:800,color,fontFamily:'IBM Plex Mono,monospace',lineHeight:1}}>{total}</div>
                <div style={{fontSize:11,color:'#57606a',fontWeight:600}}>/25 pts</div>
                <div style={{marginTop:5,padding:'3px 10px',background:bg,color,borderRadius:20,fontSize:11,fontWeight:700,display:'inline-block'}}>
                    {passed ? 'PASS' : mandatoryFail ? `FAIL — ${mandatoryFail} zero` : 'FAIL'}
                </div>
            </div>
            <div style={{flex:1,minWidth:200}}>
                <div style={{position:'relative',height:10,background:'#f0f2f5',borderRadius:5,overflow:'visible',marginBottom:6}}>
                    <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:5,transition:'width .4s'}}/>
                    {/* Pass bar marker */}
                    <div style={{position:'absolute',top:-4,left:`${passLinePct}%`,width:2,height:18,background:'#374151',borderRadius:1}}/>
                    <div style={{position:'absolute',top:14,left:`${passLinePct}%`,fontSize:9,color:'#374151',fontWeight:700,transform:'translateX(-50%)',whiteSpace:'nowrap'}}>bar {passBar}</div>
                </div>
                <div style={{display:'flex',gap:6,fontSize:11,color:'#57606a',marginTop:14}}>
                    {[8,11,6].map((max,i)=>(
                        <span key={i} style={{padding:'2px 8px',borderRadius:12,background:'#f7f8fa',border:`1px solid #e4e6ef`,color:STEP_COLORS[i],fontWeight:600}}>
                            Step {i+1}: {STEP_LABELS[i].split(' ').slice(0,2).join(' ')} · {max}pts max
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RgpsDimPill({d}: {d: RgpsDimensionResult}) {
    const pct = d.weight > 0 ? (d.score / d.weight) * 100 : 0;
    const isZeroMandatory = d.mandatory && d.score === 0;
    const bg = isZeroMandatory ? '#fee2e2' : pct === 100 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#f7f8fa';
    const textColor = isZeroMandatory ? '#b91c1c' : pct === 100 ? '#15803d' : pct >= 50 ? '#b45309' : '#374151';
    const borderColor = isZeroMandatory ? '#fca5a5' : pct === 100 ? '#86efac' : pct >= 50 ? '#fde68a' : '#e4e6ef';
    return (
        <div style={{background:bg,border:`1px solid ${borderColor}`,borderRadius:8,padding:'10px 12px',minWidth:100,flex:'0 0 auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:800,color:textColor,fontFamily:'IBM Plex Mono,monospace'}}>{d.id}</span>
                {d.mandatory && <span style={{fontSize:9,fontWeight:700,letterSpacing:'.06em',color:isZeroMandatory?'#b91c1c':'#57606a',background:isZeroMandatory?'#fecaca':'#f0f2f5',borderRadius:10,padding:'1px 5px'}}>MANDATORY</span>}
                {!d.mandatory && <span style={{fontSize:9,fontWeight:700,letterSpacing:'.06em',color:'#4f6ef7',background:'#eef2ff',borderRadius:10,padding:'1px 5px'}}>REC</span>}
            </div>
            <div style={{fontSize:11,fontWeight:600,color:'#1a1d2e',marginBottom:3,lineHeight:1.3}}>{d.name}</div>
            <div style={{fontSize:13,fontWeight:700,color:textColor,fontFamily:'IBM Plex Mono,monospace'}}>{d.score}<span style={{fontSize:10,fontWeight:400,color:'#57606a'}}>/{d.weight}</span></div>
        </div>
    );
}

type RgpsRewriteState = {status:'idle'|'loading'|'done'|'error'; rewritten?:string; scoreBefore?:RgpsResult; scoreAfter?:RgpsResult; pointsGained?:number; dimensionsMoved?:number; error?:string};

function RgpsSection({rgps, url}: {rgps: RgpsResult; url?: string}) {
    const [expanded, setExpanded] = useState(false);
    const [rewrite, setRewrite] = useState<RgpsRewriteState>({status:'idle'});
    const [copied, setCopied] = useState(false);

    async function runRewrite() {
        if (!url) return;
        setRewrite({status:'loading'});
        try {
            const r = await fetch('/api/v1/rgps/rewrite', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({url, provider:'openai'}),
            });
            const d = await r.json() as RgpsRewriteState & {error?:string};
            if (!r.ok) { setRewrite({status:'error', error:d.error||'Rewrite failed'}); return; }
            setRewrite({status:'done', rewritten:d.rewritten, scoreBefore:d.scoreBefore, scoreAfter:d.scoreAfter, pointsGained:d.pointsGained, dimensionsMoved:d.dimensionsMoved});
        } catch(e) { setRewrite({status:'error', error:(e as Error).message}); }
    }

    function copyRewrite() {
        if (!rewrite.rewritten) return;
        navigator.clipboard.writeText(rewrite.rewritten);
        setCopied(true); setTimeout(()=>setCopied(false), 2000);
    }

    return (
        <section className="panel" style={{marginBottom:16,borderLeft:`3px solid ${rgps.passed ? '#15803d' : '#b91c1c'}`}}>
            <div className="panel-heading">
                <div>
                    <h2 style={{display:'flex',alignItems:'center',gap:7}}>
                        <FileText size={15}/> Retrieval-Grade Passage Standard
                        <span style={{fontSize:11,fontWeight:600,color:'#57606a',background:'#f0f2f5',borderRadius:10,padding:'2px 8px',marginLeft:4}}>{rgps.version}</span>
                        {rgps.ymyl && <span style={{fontSize:11,fontWeight:700,color:'#d97706',background:'#fef3c7',borderRadius:10,padding:'2px 8px'}}>YMYL</span>}
                    </h2>
                    <p>Passage-level AI retrieval readiness — 12 dimensions, 25 points. Pass bar: {rgps.passBar}/25.</p>
                </div>
                {rgps.passed ? <CheckCircle size={18} color="#15803d"/> : <AlertTriangle size={18} color="#b91c1c"/>}
            </div>
            <RgpsScoreMeter total={rgps.total} passBar={rgps.passBar} passed={rgps.passed} mandatoryFail={rgps.mandatoryFail}/>

            {/* Step breakdown bars */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,borderTop:'1px solid #f0f2f5',borderBottom:'1px solid #f0f2f5',margin:'0 0 0'}}>
                {rgps.stepBreakdown.map((s,i)=>(
                    <div key={s.step} style={{padding:'10px 16px',borderRight:i<2?'1px solid #f0f2f5':'none'}}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:STEP_COLORS[i],marginBottom:4}}>{s.label}</div>
                        <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                            <span style={{fontSize:'1.25rem',fontWeight:800,color:'#1a1d2e',fontFamily:'IBM Plex Mono,monospace'}}>{s.score}</span>
                            <span style={{fontSize:12,color:'#57606a'}}>/{s.max} pts</span>
                        </div>
                        <div style={{marginTop:5,background:'#f0f2f5',borderRadius:3,height:4,overflow:'hidden'}}>
                            <div style={{width:`${(s.score/s.max)*100}%`,height:'100%',background:STEP_COLORS[i],borderRadius:3}}/>
                        </div>
                    </div>
                ))}
            </div>

            {/* Mandatory fail call-out */}
            {rgps.mandatoryFail && (
                <div style={{margin:'12px 24px 0',padding:'10px 14px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,fontSize:12,color:'#991b1b',lineHeight:1.6}}>
                    <strong>Automatic fail:</strong> {rgps.mandatoryFail} scored zero — passage fails regardless of total. Fix this first.
                </div>
            )}

            {/* Dimension pills — top issues */}
            <div style={{padding:'12px 24px 4px'}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'#6b7280',marginBottom:8}}>
                    {expanded ? 'All 12 dimensions' : 'Lowest-scoring dimensions'}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {(expanded
                        ? rgps.dimensions
                        : [...rgps.dimensions].sort((a,b)=>a.score/a.weight - b.score/b.weight).slice(0,6)
                    ).map(d => <RgpsDimPill key={d.id} d={d}/>)}
                </div>
                <button onClick={()=>setExpanded(v=>!v)} style={{marginTop:8,background:'none',border:'none',color:'#4f6ef7',fontSize:12,fontWeight:600,cursor:'pointer',padding:'4px 0'}}>
                    {expanded ? 'Show fewer' : 'Show all 12 dimensions'}
                </button>
            </div>

            {/* Top action items */}
            {rgps.dimensions.filter(d=>d.action).length > 0 && (
                <div style={{padding:'4px 24px 16px'}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'#6b7280',marginBottom:8}}>Top remediation actions</div>
                    {rgps.dimensions
                        .filter(d=>d.action)
                        .sort((a,b)=> (b.weight - b.score) - (a.weight - a.score))
                        .slice(0,4)
                        .map(d=>(
                            <div key={d.id} style={{display:'flex',gap:10,padding:'7px 0',borderTop:'1px solid #f0f2f5',alignItems:'flex-start'}}>
                                <span style={{fontSize:11,fontWeight:700,color:d.mandatory&&d.score===0?'#b91c1c':'#57606a',fontFamily:'IBM Plex Mono,monospace',minWidth:28,paddingTop:1}}>{d.id}</span>
                                <div>
                                    <div style={{fontSize:12,fontWeight:600,color:'#1a1d2e',marginBottom:2}}>{d.action}</div>
                                    <div style={{fontSize:11,color:'#57606a'}}>{d.evidence}</div>
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* RGPS Rewrite Assistant */}
            {!rgps.passed && url && (
                <div style={{padding:'0 24px 16px',borderTop:'1px solid #f0f2f5',marginTop:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,paddingTop:12,flexWrap:'wrap'}}>
                        <button
                            onClick={runRewrite}
                            disabled={rewrite.status==='loading'}
                            style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',background:'#4f6ef7',color:'#fff',border:'none',borderRadius:7,fontSize:12,fontWeight:700,cursor:rewrite.status==='loading'?'wait':'pointer',opacity:rewrite.status==='loading'?0.7:1}}>
                            {rewrite.status==='loading' ? <><Loader size={13}/> Rewriting…</> : <><Zap size={13}/> Rewrite with AI</>}
                        </button>
                        <span style={{fontSize:11,color:'#57606a'}}>Uses only facts already on the page — no hallucination</span>
                    </div>
                    {rewrite.status==='error' && <div style={{marginTop:8,fontSize:12,color:'#b91c1c'}}>{rewrite.error}</div>}
                    {rewrite.status==='done' && rewrite.rewritten && (
                        <div style={{marginTop:12,border:'1px solid #e4e6ef',borderRadius:8,overflow:'hidden'}}>
                            <div style={{background:'#f7f8fa',padding:'8px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                                    <span style={{fontSize:11,fontWeight:700,color:'#57606a',textTransform:'uppercase',letterSpacing:'.06em'}}>AI rewrite</span>
                                    {rewrite.pointsGained !== undefined && rewrite.pointsGained > 0 && (
                                        <span style={{fontSize:11,fontWeight:700,color:'#15803d',background:'#dcfce7',padding:'2px 8px',borderRadius:12}}>
                                            +{rewrite.pointsGained} pts — {rewrite.scoreAfter?.total}/{rewrite.scoreAfter?.passBar} bar {rewrite.scoreAfter?.passed?'PASS':'closer'}
                                        </span>
                                    )}
                                    {rewrite.dimensionsMoved !== undefined && rewrite.dimensionsMoved > 0 && (
                                        <span style={{fontSize:11,color:'#57606a'}}>{rewrite.dimensionsMoved} dimension{rewrite.dimensionsMoved>1?'s':''} improved</span>
                                    )}
                                </div>
                                <button onClick={copyRewrite} style={{fontSize:11,fontWeight:600,color:'#4f6ef7',background:'none',border:'none',cursor:'pointer'}}>
                                    {copied ? 'Copied!' : 'Copy text'}
                                </button>
                            </div>
                            <div style={{padding:'12px 14px',fontSize:13,lineHeight:1.7,color:'#1a1d2e',whiteSpace:'pre-wrap',maxHeight:320,overflowY:'auto'}}>
                                {rewrite.rewritten}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

// ── Raw vs Rendered DOM Section ───────────────────────────────────────────────

function RawVsRenderedSection({delta}: {delta: RawVsRenderedDelta}) {
    const hasIssues = delta.jsOnlyContent || delta.headingsOnlyInRendered.length > 0
        || delta.schemaOnlyInRendered.length > 0 || delta.headingOrderIssues.length > 0;
    const borderColor = hasIssues ? '#d97706' : '#15803d';
    return (
        <section className="panel" style={{marginBottom:16,borderLeft:`3px solid ${borderColor}`}}>
            <div className="panel-heading">
                <div>
                    <h2 style={{display:'flex',alignItems:'center',gap:7}}><GitCompare size={15}/> Raw vs rendered DOM</h2>
                    <p>Compares server HTML with JS-rendered output — flags content only visible after JavaScript runs.</p>
                </div>
                {hasIssues ? <AlertTriangle size={18} color="#d97706"/> : <CheckCircle size={18} color="#15803d"/>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,borderTop:'1px solid #f0f2f5',borderBottom:'1px solid #f0f2f5'}}>
                {[
                    {label:'Raw HTML text', value:`${delta.rawTextLen.toLocaleString()} chars`},
                    {label:'Rendered text', value:`${delta.renderedTextLen.toLocaleString()} chars`},
                ].map((m,i)=>(
                    <div key={m.label} style={{padding:'10px 16px',borderRight:i===0?'1px solid #f0f2f5':'none'}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'#6b7280',marginBottom:3}}>{m.label}</div>
                        <div style={{fontSize:'1.125rem',fontWeight:700,color:'#1a1d2e',fontFamily:'IBM Plex Mono,monospace'}}>{m.value}</div>
                    </div>
                ))}
            </div>
            <div style={{padding:'12px 24px 16px',display:'flex',flexDirection:'column',gap:8}}>
                {delta.jsOnlyContent && (
                    <div style={{padding:'8px 12px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:6,fontSize:12,color:'#92400e'}}>
                        <strong>JS-injected content detected</strong> — rendered page is {Math.round((delta.renderedTextLen/delta.rawTextLen - 1)*100)}% larger than raw HTML. AI crawlers that cannot execute JavaScript will miss this content.
                    </div>
                )}
                {delta.headingOrderIssues.map((issue,i)=>(
                    <div key={i} style={{padding:'8px 12px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:6,fontSize:12,color:'#92400e'}}>
                        <strong>Heading order:</strong> {issue}
                    </div>
                ))}
                {delta.headingsOnlyInRendered.length > 0 && (
                    <div style={{padding:'8px 12px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:6,fontSize:12,color:'#92400e'}}>
                        <strong>{delta.headingsOnlyInRendered.length} heading(s) only in rendered DOM</strong> — AI crawlers on raw HTML will not see: {delta.headingsOnlyInRendered.slice(0,3).join(', ')}
                    </div>
                )}
                {delta.schemaOnlyInRendered.length > 0 && (
                    <div style={{padding:'8px 12px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:6,fontSize:12,color:'#92400e'}}>
                        <strong>Schema types JS-only:</strong> {delta.schemaOnlyInRendered.join(', ')} — move JSON-LD to static HTML.
                    </div>
                )}
                {!hasIssues && (
                    <div style={{padding:'8px 12px',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:6,fontSize:12,color:'#15803d'}}>
                        No JavaScript penalty detected — main content, headings and schema are present in raw server HTML.
                    </div>
                )}
            </div>
        </section>
    );
}


function TechStackSection({stack}: {stack: TechStack}) {
    if (!stack.signals.length) return null;
    const catColor: Record<string, string> = {
        cms: '#4f6ef7', framework: '#7c5cd8', ecommerce: '#d97706',
        hosting: '#0891b2', analytics: '#16a34a', cdn: '#475569', server: '#374151',
    };
    const catBg: Record<string, string> = {
        cms: '#eef2ff', framework: '#f5f3ff', ecommerce: '#fefce8',
        hosting: '#ecfeff', analytics: '#f0fdf4', cdn: '#f8fafc', server: '#f9fafb',
    };
    return (
        <section className="panel" style={{marginBottom:16,borderLeft:'3px solid #4f6ef7'}}>
            <div className="panel-heading">
                <div>
                    <h2 style={{display:'flex',alignItems:'center',gap:7}}><Cpu size={15}/> Tech stack detected</h2>
                    <p>{stack.summary}</p>
                </div>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'4px 24px 16px'}}>
                {stack.signals.map(s => (
                    <div key={s.name} style={{
                        display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                        background: catBg[s.category] ?? '#f0f2f5',
                        color: catColor[s.category] ?? '#374151',
                        border: `1px solid ${catColor[s.category] ?? '#e4e6ef'}22`,
                    }}>
                        {s.name}
                        <span style={{fontSize:10,opacity:.7,textTransform:'uppercase',letterSpacing:'.04em'}}>{s.category}</span>
                        {s.confidence === 'low' && <span style={{fontSize:10,opacity:.6}}>~</span>}
                    </div>
                ))}
            </div>
        </section>
    );
}

function SitemapSection({info}: {info: SitemapInfo}) {
    const good = info.fetched && info.urlCount > 0;
    const warn = info.fetched && (!info.hasLastmod || !info.declaredInRobots);
    const borderColor = good && !warn ? '#15803d' : good ? '#d97706' : '#e05252';
    const chips: {label: string; ok: boolean; neutral?: boolean}[] = [
        {label: `${info.urlCount} URLs`, ok: info.urlCount > 0},
        {label: 'lastmod', ok: info.hasLastmod},
        {label: 'In robots.txt', ok: info.declaredInRobots},
        ...(info.hasImageSitemap ? [{label: 'Image', ok: true, neutral: true}] : []),
        ...(info.hasVideoSitemap ? [{label: 'Video', ok: true, neutral: true}] : []),
        ...(info.hasNewsSitemap ? [{label: 'News', ok: true, neutral: true}] : []),
    ];
    return (
        <section className="panel" style={{marginBottom:16, borderLeft:`3px solid ${borderColor}`}}>
            <div className="panel-heading">
                <div>
                    <h2 style={{display:'flex',alignItems:'center',gap:7,color: good ? (warn ? '#b45309' : '#15803d') : '#b91c1c'}}>
                        <Map size={15}/> Sitemap.xml {good ? (warn ? '— warnings' : '— found') : '— not found'}
                    </h2>
                    <p>{info.url}</p>
                </div>
                {good && !warn ? <CheckCircle size={18} color="#15803d"/> : good ? <AlertTriangle size={18} color="#d97706"/> : <AlertTriangle size={18} color="#e05252"/>}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'4px 24px 16px'}}>
                {chips.map(c => (
                    <span key={c.label} style={{
                        display:'inline-flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                        background: c.neutral ? '#f0f2f5' : c.ok ? '#dcfce7' : '#fee2e2',
                        color: c.neutral ? '#57606a' : c.ok ? '#15803d' : '#b91c1c',
                    }}>
                        {!c.neutral && (c.ok ? <CheckCircle size={11}/> : <AlertTriangle size={11}/>)}
                        {c.label}
                    </span>
                ))}
                {info.sitemapIndexUrls.length > 0 && (
                    <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,background:'#e0f2fe',color:'#0369a1'}}>
                        Sitemap index · {info.sitemapIndexUrls.length} child sitemaps
                    </span>
                )}
            </div>
            {(!info.fetched || !info.hasLastmod || !info.declaredInRobots) && (
                <div style={{margin:'0 24px 16px',padding:'10px 14px',background:'#fffbeb',borderRadius:7,fontSize:12,color:'#92400e',lineHeight:1.7}}>
                    {!info.fetched && <div>⚠ <strong>Create /sitemap.xml</strong> — list all indexable URLs. Declare it in robots.txt: <code>Sitemap: https://your-site.com/sitemap.xml</code></div>}
                    {info.fetched && !info.hasLastmod && <div>⚠ <strong>Add &lt;lastmod&gt;</strong> to each &lt;url&gt; entry — helps crawlers prioritise freshly updated pages.</div>}
                    {info.fetched && !info.declaredInRobots && <div>⚠ <strong>Declare sitemap in robots.txt</strong> — add <code>Sitemap: {info.url}</code> so crawlers discover it automatically.</div>}
                </div>
            )}
            {info.lastmodDates.length > 0 && (
                <div style={{padding:'0 24px 14px',fontSize:11,color:'#8b9aa6'}}>
                    Most recent lastmod: {info.lastmodDates.join(' · ')}
                </div>
            )}
        </section>
    );
}


function SummaryCard({label, value, sub, accent}: {label:string;value:string;sub?:string;accent?:boolean}) {
    return (
        <div style={{background:accent?'#0f3b52':'#fff',border:`1px solid ${accent?'#0f3b52':'#e0e7ed'}`,borderRadius:9,padding:'16px 18px'}}>
            <div style={{fontSize:'.73rem',fontWeight:700,letterSpacing:'.07em',color:accent?'#78ddc6':'#8b9aa6',textTransform:'uppercase',marginBottom:6}}>{label}</div>
            <div style={{fontSize:'1.5rem',fontWeight:700,letterSpacing:'-.03em',color:accent?'#fff':'#213f50'}}>{value}</div>
            {sub&&<div style={{fontSize:'.75rem',color:accent?'#92ded0':'#57606a',marginTop:3}}>{sub}</div>}
        </div>
    );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function ScannerPanel(props: Props) {
    const [mode, setMode] = useState<Mode>('single');
    return (
        <div>
            {/* Mode toggle */}
            <div style={{display:'inline-flex',background:'#f0f2f5',borderRadius:8,padding:3,marginBottom:20,gap:2}}>
                {(['single','site'] as Mode[]).map(m=>(
                    <button key={m} onClick={()=>setMode(m)} style={{background:mode===m?'#fff':'transparent',border:'none',borderRadius:6,padding:'7px 18px',fontSize:'.85rem',fontWeight:mode===m?650:500,color:mode===m?'#0d8073':'#57606a',cursor:'pointer',boxShadow:mode===m?'0 1px 4px #0002':undefined,transition:'all .15s',display:'flex',alignItems:'center',gap:7}}>
                        {m==='single'?<Search size={14}/>:<Globe size={14}/>}
                        {m==='single'?'Single page':'Full site'}
                    </button>
                ))}
            </div>
            {mode==='single'?<SingleScanPanel {...props}/>:<SiteScanPanel {...props}/>}
        </div>
    );
}
