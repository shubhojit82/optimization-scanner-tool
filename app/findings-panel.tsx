"use client";
import {useState, useEffect, useCallback} from 'react';
import {CheckCircle2, ChevronDown, ChevronRight, RefreshCw, ThumbsUp, ThumbsDown, Loader, Wrench, BarChart2, User, ArrowRight} from 'lucide-react';
import type {Finding, FindingStatus, FindingSeverity, Recommendation, Client} from '../src/core/contracts';
import {api, patch} from './workbench-api';

type Props = {client: Client; busy: boolean; onBusy: (b: boolean) => void; onRetested?: () => void};

// ── Helpers ────────────────────────────────────────────────────────────────

function severityColor(s: FindingSeverity): {bg: string; color: string; border: string} {
    if (s === 'critical') return {bg:'#fef2f2', color:'#dc2626', border:'#fca5a5'};
    if (s === 'high')     return {bg:'#fff7ed', color:'#ea580c', border:'#fdba74'};
    if (s === 'medium')   return {bg:'#fefce8', color:'#ca8a04', border:'#fde047'};
    if (s === 'low')      return {bg:'#f0fdf4', color:'#16a34a', border:'#86efac'};
    return                      {bg:'#f8faff', color:'#6366f1', border:'#c7d2fe'};
}

function statusBadge(s: FindingStatus): {label: string; color: string; bg: string} {
    if (s === 'open')        return {label:'Open',        color:'#dc2626', bg:'#fee2e2'};
    if (s === 'approved')    return {label:'Approved',    color:'#16a34a', bg:'#dcfce7'};
    if (s === 'rejected')    return {label:'Rejected',    color:'#9ca3af', bg:'#f3f4f6'};
    if (s === 'implemented') return {label:'Implemented', color:'#2563eb', bg:'#dbeafe'};
    return                          {label:'Resolved',    color:'#10b981', bg:'#d1fae5'};
}

function recStatusBadge(s: string): {label: string; color: string; bg: string} {
    if (s === 'approved')    return {label:'Approved',    color:'#16a34a', bg:'#dcfce7'};
    if (s === 'rejected')    return {label:'Rejected',    color:'#9ca3af', bg:'#f3f4f6'};
    if (s === 'implemented') return {label:'Implemented', color:'#2563eb', bg:'#dbeafe'};
    return                          {label:'Draft',       color:'#f59e0b', bg:'#fef3c7'};
}

const OWNER_OPTIONS = ['content','engineering','seo','devops','marketing'];
const EFFORT_OPTIONS: Array<'low'|'medium'|'high'> = ['low','medium','high'];
const IMPACT_OPTIONS: Array<'low'|'medium'|'high'> = ['low','medium','high'];

// ── Empty state ────────────────────────────────────────────────────────────

function FindingsEmpty() {
    return (
        <div style={{background:'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)',border:'1px solid #e4e6ef',borderRadius:10,padding:'40px 32px',display:'flex',gap:32,alignItems:'flex-start'}}>
            <div style={{flexShrink:0,width:64,height:64,background:'#eef1ff',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <CheckCircle2 size={30} style={{color:'#4f6ef7'}}/>
            </div>
            <div style={{flex:1}}>
                <h3 style={{margin:'0 0 8px',fontSize:17,fontWeight:700,color:'#1e2a3a'}}>No findings yet</h3>
                <p style={{margin:'0 0 16px',fontSize:13,color:'#6b7280',lineHeight:1.6}}>
                    Findings are generated automatically when you scan a URL and save it to this client.
                    Each failing audit dimension becomes a structured finding with severity, evidence and a recommended fix.
                </p>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    {['Scan a URL in the Scanner tab','Save the result to this client','Come back here to review findings'].map((s,i)=>(
                        <span key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,padding:'5px 12px',borderRadius:20,background:'#fff',border:'1px solid #c7d2fe',color:'#4f6ef7',fontWeight:600}}>
                            <span style={{width:18,height:18,borderRadius:'50%',background:'#4f6ef7',color:'#fff',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                            {s}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Recommendation card ────────────────────────────────────────────────────

function RecCard({rec, onPatch}: {rec: Recommendation; onPatch: (id: string, patch: Partial<Recommendation>) => Promise<void>}) {
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const badge = recStatusBadge(rec.status);

    async function act(status: 'approved'|'rejected'|'implemented') {
        setBusy(true);
        try { await onPatch(rec.id, {status, reviewNote: note||undefined}); }
        finally { setBusy(false); }
    }

    return (
        <div style={{background:'#fff',border:'1px solid #e4e6ef',borderRadius:8,padding:'14px 16px',marginTop:8}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
                <Wrench size={14} style={{color:'#6366f1',marginTop:2,flexShrink:0}}/>
                <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                        <span style={{fontSize:13,fontWeight:600,color:'#1e2a3a'}}>{rec.title}</span>
                        <span style={{fontSize:11,padding:'1px 8px',borderRadius:20,background:badge.bg,color:badge.color,fontWeight:600}}>{badge.label}</span>
                    </div>
                    <p style={{margin:'0 0 8px',fontSize:13,color:'#374151',lineHeight:1.5}}>{rec.proposal}</p>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#f3f4f6',color:'#374151'}}>
                            <User size={10} style={{marginRight:3,verticalAlign:'middle'}}/>{rec.owner}
                        </span>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#f3f4f6',color:'#374151'}}>Effort: {rec.effort}</span>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#f3f4f6',color:'#374151'}}>Impact: {rec.impact}</span>
                    </div>
                    {rec.reviewNote && <p style={{margin:'8px 0 0',fontSize:12,color:'#6b7280',fontStyle:'italic'}}>Note: {rec.reviewNote}</p>}
                </div>
            </div>
            {rec.status === 'draft' && (
                <div style={{borderTop:'1px solid #f0f1f5',paddingTop:10,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    <input value={note} onChange={e=>setNote(e.target.value)}
                        placeholder="Optional review note…"
                        style={{flex:1,minWidth:160,height:32,padding:'0 10px',border:'1px solid #e4e6ef',borderRadius:6,fontSize:12,color:'#374151',background:'#fafbff'}}/>
                    <button className="primary" style={{height:32,padding:'0 14px',fontSize:12}} disabled={busy} onClick={()=>act('approved')}>
                        {busy?<Loader size={12} style={{animation:'spin 1s linear infinite'}}/>:<ThumbsUp size={12}/>} Approve
                    </button>
                    <button className="secondary" style={{height:32,padding:'0 14px',fontSize:12}} disabled={busy} onClick={()=>act('rejected')}>
                        <ThumbsDown size={12}/> Reject
                    </button>
                </div>
            )}
            {rec.status === 'approved' && (
                <div style={{borderTop:'1px solid #f0f1f5',paddingTop:10}}>
                    <button className="secondary" style={{height:32,padding:'0 14px',fontSize:12}} disabled={busy} onClick={()=>act('implemented')}>
                        <CheckCircle2 size={12}/> Mark implemented
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Finding row ────────────────────────────────────────────────────────────

function FindingRow({
    finding, recs, onStatusChange, onAddRec, onPatchRec, onRetest, retesting,
}: {
    finding: Finding;
    recs: Recommendation[];
    onStatusChange: (id: string, status: FindingStatus) => Promise<void>;
    onAddRec: (f: Finding) => Promise<void>;
    onPatchRec: (id: string, patch: Partial<Recommendation>) => Promise<void>;
    onRetest: (f: Finding) => void;
    retesting: string | null;
}) {
    const [open, setOpen] = useState(false);
    const sev = severityColor(finding.severity);
    const badge = statusBadge(finding.status);
    const isRetesting = retesting === finding.id;
    const hasRec = recs.length > 0;
    const approved = recs.find(r => r.status === 'approved' || r.status === 'implemented');

    return (
        <div style={{border:`1px solid ${sev.border}`,borderRadius:9,overflow:'hidden',marginBottom:10}}>
            <button onClick={()=>setOpen(v=>!v)}
                style={{width:'100%',display:'flex',alignItems:'flex-start',gap:12,padding:'13px 16px',background:sev.bg,border:'none',cursor:'pointer',textAlign:'left'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:sev.color,marginTop:5,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:3}}>
                        <span style={{fontSize:13,fontWeight:700,color:'#1e2a3a'}}>{finding.title}</span>
                        <span style={{fontSize:11,padding:'1px 7px',borderRadius:20,background:badge.bg,color:badge.color,fontWeight:600}}>{badge.label}</span>
                        <span style={{fontSize:11,padding:'1px 7px',borderRadius:20,background:'#f3f4f6',color:'#6b7280',textTransform:'capitalize'}}>{finding.severity}</span>
                        <span style={{fontSize:11,padding:'1px 7px',borderRadius:20,background:'#f3f4f6',color:'#6b7280'}}>{finding.dimensionName}</span>
                    </div>
                    <div style={{fontSize:12,color:'#6b7280',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',maxWidth:600}}>{finding.evidence}</div>
                </div>
                {open ? <ChevronDown size={15} style={{color:'#9ca3af',flexShrink:0,marginTop:3}}/> : <ChevronRight size={15} style={{color:'#9ca3af',flexShrink:0,marginTop:3}}/>}
            </button>

            {open && (
                <div style={{padding:'16px 18px',background:'#fff',borderTop:`1px solid ${sev.border}`}}>
                    {/* Evidence + action */}
                    <div style={{marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.06em',color:'#9ca3af',marginBottom:4}}>EVIDENCE</div>
                        <p style={{margin:'0 0 10px',fontSize:13,color:'#374151',lineHeight:1.5}}>{finding.evidence}</p>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.06em',color:'#9ca3af',marginBottom:4}}>RECOMMENDED ACTION</div>
                        <p style={{margin:'0 0 10px',fontSize:13,color:'#374151',lineHeight:1.5}}>{finding.action}</p>
                        {finding.missing.length > 0 && (
                            <>
                                <div style={{fontSize:11,fontWeight:700,letterSpacing:'.06em',color:'#9ca3af',marginBottom:4}}>MISSING</div>
                                <ul style={{margin:'0 0 10px',padding:'0 0 0 16px'}}>
                                    {finding.missing.map((m,i) => <li key={i} style={{fontSize:12,color:'#374151',lineHeight:1.6}}>{m}</li>)}
                                </ul>
                            </>
                        )}
                        {(finding.scoreBefore !== undefined || finding.scoreAfter !== undefined) && (
                            <div style={{display:'flex',gap:12,alignItems:'center',padding:'8px 12px',background:'#f8faff',borderRadius:7,border:'1px solid #e4e6ef',marginBottom:10}}>
                                <BarChart2 size={14} style={{color:'#4f6ef7',flexShrink:0}}/>
                                <span style={{fontSize:12,color:'#374151'}}>
                                    Score: <strong>{finding.scoreBefore ?? '—'}</strong>
                                    {finding.scoreAfter !== undefined && (
                                        <> <ArrowRight size={11} style={{verticalAlign:'middle',color:'#9ca3af'}}/> <strong style={{color:finding.scoreAfter > (finding.scoreBefore??0)?'#16a34a':'#dc2626'}}>{finding.scoreAfter}</strong></>
                                    )}
                                    {finding.scoreAfter !== undefined && finding.scoreBefore !== undefined && (
                                        <span style={{marginLeft:6,fontSize:11,padding:'1px 6px',borderRadius:20,
                                            background:finding.scoreAfter>finding.scoreBefore?'#dcfce7':'#fee2e2',
                                            color:finding.scoreAfter>finding.scoreBefore?'#16a34a':'#dc2626',fontWeight:600}}>
                                            {finding.scoreAfter>finding.scoreBefore?'+':''}{finding.scoreAfter-finding.scoreBefore}
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Recommendations */}
                    {hasRec && (
                        <div style={{marginBottom:12}}>
                            <div style={{fontSize:11,fontWeight:700,letterSpacing:'.06em',color:'#9ca3af',marginBottom:6}}>RECOMMENDATIONS</div>
                            {recs.map(r => <RecCard key={r.id} rec={r} onPatch={onPatchRec}/>)}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',borderTop:'1px solid #f0f1f5',paddingTop:12}}>
                        {finding.status === 'open' && !hasRec && (
                            <button className="primary" style={{height:32,padding:'0 14px',fontSize:12}}
                                onClick={()=>onAddRec(finding)}>
                                <Wrench size={12}/> Create recommendation
                            </button>
                        )}
                        {finding.status === 'open' && (
                            <button className="secondary" style={{height:32,padding:'0 14px',fontSize:12}}
                                onClick={()=>onStatusChange(finding.id,'rejected')}>
                                Dismiss
                            </button>
                        )}
                        {(finding.status === 'open' || finding.status === 'implemented') && (
                            <button className="secondary" style={{height:32,padding:'0 14px',fontSize:12}}
                                disabled={isRetesting} onClick={()=>onRetest(finding)}>
                                {isRetesting
                                    ? <><Loader size={12} style={{animation:'spin 1s linear infinite'}}/> Retesting…</>
                                    : <><RefreshCw size={12}/> Retest</>}
                            </button>
                        )}
                        {finding.status === 'approved' && (
                            <button className="secondary" style={{height:32,padding:'0 14px',fontSize:12}}
                                onClick={()=>onStatusChange(finding.id,'implemented')}>
                                <CheckCircle2 size={12}/> Mark implemented
                            </button>
                        )}
                        {finding.status === 'resolved' && (
                            <span style={{fontSize:12,color:'#10b981',fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
                                <CheckCircle2 size={14}/> Resolved
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main panel ─────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{value: FindingStatus | 'all'; label: string}> = [
    {value:'all',     label:'All'},
    {value:'open',    label:'Open'},
    {value:'approved',label:'Approved'},
    {value:'implemented',label:'Implemented'},
    {value:'resolved',label:'Resolved'},
    {value:'rejected',label:'Dismissed'},
];

export function FindingsPanel({client, busy, onBusy, onRetested}: Props) {
    const [findings, setFindings] = useState<Finding[]>([]);
    const [recs, setRecs] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<FindingStatus | 'all'>('open');
    const [retesting, setRetesting] = useState<string | null>(null);
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [f, r] = await Promise.all([
                api<Finding[]>(`findings?clientId=${client.id}`),
                api<Recommendation[]>(`recommendations?clientId=${client.id}`),
            ]);
            setFindings(f);
            setRecs(r);
        } catch(e) { setError((e as Error).message); }
        finally { setLoading(false); }
    }, [client.id]);

    useEffect(() => { load(); }, [load]);

    const visible = filter === 'all' ? findings : findings.filter(f => f.status === filter);

    const counts = {
        open: findings.filter(f => f.status === 'open').length,
        approved: findings.filter(f => f.status === 'approved').length,
        implemented: findings.filter(f => f.status === 'implemented').length,
        resolved: findings.filter(f => f.status === 'resolved').length,
    };

    async function onStatusChange(id: string, status: FindingStatus) {
        try {
            const updated = await patch<Finding>(`findings/${id}`, {status});
            setFindings(prev => prev.map(f => f.id === id ? updated : f));
        } catch(e) { setError((e as Error).message); }
    }

    async function onAddRec(finding: Finding) {
        try {
            const rec = await api<Recommendation>('recommendations', {clientId: client.id, findingId: finding.id});
            setRecs(prev => [...prev, rec]);
            await onStatusChange(finding.id, 'approved');
        } catch(e) { setError((e as Error).message); }
    }

    async function onPatchRec(id: string, recPatch: Partial<Recommendation>) {
        try {
            const updated = await patch<Recommendation>(`recommendations/${id}`, recPatch);
            setRecs(prev => prev.map(r => r.id === id ? updated : r));
            // If rec approved → mark finding approved; if implemented → mark finding implemented
            if (recPatch.status === 'approved' || recPatch.status === 'implemented') {
                const rec = recs.find(r => r.id === id);
                if (rec) {
                    const newFindingStatus: FindingStatus = recPatch.status === 'implemented' ? 'implemented' : 'approved';
                    await onStatusChange(rec.findingId, newFindingStatus);
                }
            }
        } catch(e) { setError((e as Error).message); }
    }

    async function onRetest(finding: Finding) {
        setRetesting(finding.id); setError('');
        onBusy(true);
        try {
            const result = await api<{finding: Finding; resolved: boolean; scoreAfter: number|null; scoreBefore: number|null}>(
                `findings/${finding.id}/retest`, {clientId: client.id}
            );
            setFindings(prev => prev.map(f => f.id === finding.id ? result.finding : f));
            await load(); // reload to pick up new audit + new findings
            const msg = result.resolved
                ? `Finding resolved. Score improved from ${result.scoreBefore} to ${result.scoreAfter}.`
                : `Retest complete. Score: ${result.scoreBefore} → ${result.scoreAfter ?? 'N/A'}. Finding remains open.`;
            setNotice(msg);
            onRetested?.();
        } catch(e) { setError((e as Error).message); }
        finally { setRetesting(null); onBusy(false); }
    }

    if (loading) return <div className="panel loading" role="status">Loading findings…</div>;

    return (
        <section className="panel" style={{padding:0,overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'20px 24px 16px',borderBottom:'1px solid #e4e6ef',background:'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:14}}>
                    <div>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',color:'#6366f1',marginBottom:4}}>AUDIT FINDINGS</div>
                        <h2 style={{margin:0,fontSize:18,fontWeight:700,color:'#1e2a3a'}}>Findings &amp; Remediation</h2>
                        <p style={{margin:'4px 0 0',fontSize:13,color:'#6b7280'}}>
                            Open findings are created automatically when you save a scan. Review, approve and retest each one to close the loop.
                        </p>
                    </div>
                    <button className="secondary" onClick={load} style={{height:34,padding:'0 14px',fontSize:13}}>
                        <RefreshCw size={13}/> Refresh
                    </button>
                </div>
                {/* KPI row */}
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {[
                        {label:'Open',      count:counts.open,        color:'#dc2626', bg:'#fee2e2'},
                        {label:'Approved',  count:counts.approved,    color:'#16a34a', bg:'#dcfce7'},
                        {label:'Implemented',count:counts.implemented,color:'#2563eb', bg:'#dbeafe'},
                        {label:'Resolved',  count:counts.resolved,    color:'#10b981', bg:'#d1fae5'},
                    ].map(k => (
                        <div key={k.label} style={{padding:'7px 14px',borderRadius:8,background:k.bg,border:`1px solid ${k.color}22`}}>
                            <span style={{fontSize:18,fontWeight:800,color:k.color}}>{k.count}</span>
                            <span style={{fontSize:11,color:k.color,marginLeft:6,fontWeight:600}}>{k.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filter tabs */}
            <div style={{display:'flex',gap:4,padding:'12px 24px 0',borderBottom:'1px solid #e4e6ef',background:'#fff'}}>
                {STATUS_FILTERS.map(f => (
                    <button key={f.value} onClick={()=>setFilter(f.value as FindingStatus|'all')}
                        style={{padding:'6px 14px',border:'none',borderBottom:`2px solid ${filter===f.value?'#4f6ef7':'transparent'}`,
                            background:'transparent',fontSize:13,fontWeight:600,cursor:'pointer',
                            color:filter===f.value?'#4f6ef7':'#6b7280',marginBottom:-1}}>
                        {f.label}
                        <span style={{marginLeft:5,fontSize:11,padding:'1px 6px',borderRadius:20,
                            background:filter===f.value?'#eef1ff':'#f3f4f6',
                            color:filter===f.value?'#4f6ef7':'#9ca3af',fontWeight:700}}>
                            {f.value==='all'?findings.length:findings.filter(x=>x.status===f.value).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Body */}
            <div style={{padding:'20px 24px'}}>
                {error && <div className="error" role="alert" style={{marginBottom:12}}>{error}</div>}
                {notice && (
                    <div className="notice" role="status" style={{marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        {notice}
                        <button style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#6b7280'}} onClick={()=>setNotice('')}>×</button>
                    </div>
                )}
                {findings.length === 0 ? (
                    <FindingsEmpty/>
                ) : visible.length === 0 ? (
                    <div style={{padding:'32px 0',textAlign:'center',color:'#9ca3af',fontSize:13}}>
                        No findings with status &quot;{filter}&quot;.
                    </div>
                ) : (
                    visible.map(f => (
                        <FindingRow
                            key={f.id}
                            finding={f}
                            recs={recs.filter(r => r.findingId === f.id)}
                            onStatusChange={onStatusChange}
                            onAddRec={onAddRec}
                            onPatchRec={onPatchRec}
                            onRetest={onRetest}
                            retesting={retesting}
                        />
                    ))
                )}
            </div>
        </section>
    );
}
