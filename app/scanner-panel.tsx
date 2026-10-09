"use client";
import {useState} from 'react';
import {Search, Download, AlertTriangle, CheckCircle, Loader, ExternalLink, RefreshCw, ChevronDown, Save, Globe, Bot, Map} from 'lucide-react';
import type {ScanResult} from '../src/application/scanner';
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
        try { await api('scan/save', {clientId, audit:result.audit}); setSaved(true); onSaved?.(clientId); }
        catch(e) { setError((e as Error).message); } finally { setSaving(false); }
    }

    const opportunities = result?.audit?.dimensions.filter(d => d.score !== null && d.score < 100).sort((a,b) => b.weight*(100-b.score!) - a.weight*(100-a.score!)) ?? [];

    return (
        <div>
            <FormCard url={url} setUrl={setUrl} clientId={clientId} setClientId={setClientId} clients={clients} busy={busy} onSubmit={runScan}
                label="Scan a single page" hint="Fetch, analyse and score one URL instantly." error={error}/>

            {result && (
                <>
                    <ResultBar url={result.url} status={result.status} fetchedAt={result.fetchedAt}
                        clientId={clientId} hasAudit={!!result.audit} saved={saved} saving={saving}
                        exporting={exporting} onSave={saveToClient} onExport={exportXlsx} onClear={()=>{setResult(null);setSaved(false);}}/>
                    {!clientId && result.audit && <SaveHint/>}
                    <FlagSection flags={result.flags}/>
                    {result.aiBotAccess && <AiBotAccessSection access={result.aiBotAccess}/>}
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
                                    <span><strong style={{color:'#3b82d4'}}>SEO</strong> — Crawl, structure, schema, freshness</span>
                                    <span><strong style={{color:'#7c5cd8'}}>AEO</strong> — Content, entity, evidence</span>
                                    <span><strong style={{color:'#0d8073'}}>GEO</strong> — AI visibility (observations needed)</span>
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
            await api('scan/save', {clientId, audit:{...page.audit}});
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
        <section className="panel" style={{marginBottom:20,padding:0,overflow:'hidden'}}>
            <div style={{padding:'18px 24px 16px',borderBottom:'1px solid #e5e7eb'}}>
                <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:3}}>
                    <Search size={16} color="#0d8073"/>
                    <h2 style={{fontSize:'1rem',fontWeight:650}}>{label}</h2>
                </div>
                <p style={{fontSize:'.83rem',color:'#57606a',margin:0}}>{hint}</p>
            </div>
            <form onSubmit={onSubmit} style={{padding:'18px 24px 20px'}}>
                <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
                    <label style={{flex:'1 1 280px',margin:0}}>
                        <span style={{display:'block',fontSize:'.73rem',fontWeight:700,letterSpacing:'.07em',color:'#57606a',textTransform:'uppercase',marginBottom:5}}>URL</span>
                        <input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" required disabled={busy} style={{width:'100%',border:'1.5px solid #cfdae2',borderRadius:7,padding:'9px 12px',fontSize:'.9rem',background:'#fff'}}/>
                    </label>
                    {clients.length>0&&(
                        <label style={{flex:'0 1 185px',margin:0}}>
                            <span style={{display:'block',fontSize:'.73rem',fontWeight:700,letterSpacing:'.07em',color:'#57606a',textTransform:'uppercase',marginBottom:5}}>Match client <span style={{fontWeight:400,textTransform:'none'}}>(opt.)</span></span>
                            <select value={clientId} onChange={e=>setClientId(e.target.value)} disabled={busy} style={{width:'100%',border:'1.5px solid #cfdae2',borderRadius:7,padding:'9px 12px',fontSize:'.9rem',background:'#fff'}}>
                                <option value="">— none —</option>
                                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </label>
                    )}
                    <button className="primary" type="submit" disabled={busy} style={{alignSelf:'flex-end',display:'flex',alignItems:'center',gap:7,padding:'9px 20px',fontSize:'.9rem',borderRadius:7,fontWeight:600,whiteSpace:'nowrap'}}>
                        {busy?<><Loader size={14} style={{animation:'spin 1s linear infinite'}}/> Working…</>:<><Search size={14}/> {submitLabel}</>}
                    </button>
                </div>
                {error&&<div className="error" role="alert" style={{marginTop:12}}>{error}</div>}
                <p style={{margin:'12px 0 0',fontSize:'.76rem',color:'#8b9aa6',lineHeight:1.5}}>Results reflect what an HTTP crawler sees — JavaScript-rendered content is not assessed.</p>
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
