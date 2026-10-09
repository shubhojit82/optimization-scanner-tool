"use client";
import {useState} from 'react';
import {Trash2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Loader} from 'lucide-react';
import type {Audit} from '../src/core/contracts';
import {del} from './workbench-api';

type Props = {
    audits: Audit[];
    clientId: string;
    onDeleted: () => void;
};

function Delta({prev, curr}: {prev: number; curr: number}) {
    const diff = curr - prev;
    if (diff === 0) return <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:11,fontWeight:600,color:'#57606a',background:'#f0f0f0',borderRadius:20,padding:'2px 8px'}}><Minus size={10}/> No change</span>;
    const up = diff > 0;
    return (
        <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:11,fontWeight:700,color:up?'#15803d':'#b91c1c',background:up?'#dcfce7':'#fee2e2',borderRadius:20,padding:'2px 8px'}}>
            {up ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
            {up ? '+' : ''}{diff} pts
        </span>
    );
}

function DimensionMini({d}: {d: Audit['dimensions'][number]}) {
    const color = d.score === null ? '#cfdae2' : d.score >= 75 ? '#57e3c2' : d.score >= 40 ? '#f59e0b' : '#f87171';
    return (
        <div style={{display:'grid',gridTemplateColumns:'140px 1fr 90px',gap:'8px 12px',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #f3f4f6',fontSize:13}}>
            <span style={{color:'#213f50',fontWeight:500}}>{d.name}<br/><small style={{fontWeight:400,color:'#57606a',fontSize:11}}>{d.weight}% weight</small></span>
            <div style={{background:'#e8eef2',borderRadius:4,height:6,overflow:'hidden'}}>
                <div style={{width:d.score === null ? '0%' : d.score+'%',height:'100%',background:color,borderRadius:4,transition:'width .4s'}}/>
            </div>
            <span style={{fontWeight:600,color:d.score===null?'#8b9aa6':'#213f50',textAlign:'right',fontSize:12}}>
                {d.score === null ? 'Not assessed' : d.score}
            </span>
        </div>
    );
}

export function AuditLedger({audits, clientId, onDeleted}: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    async function handleDelete(auditId: string) {
        if (confirmId !== auditId) { setConfirmId(auditId); return; }
        setConfirmId(null);
        setDeleting(auditId);
        try {
            await del(`clients/${clientId}/audits/${auditId}`);
            onDeleted();
        } finally {
            setDeleting(null);
        }
    }

    // audits arrive newest-first; we want chronological for delta calc
    const chronological = [...audits].reverse();

    return (
        <div style={{padding:'0 0 8px'}}>
            {/* Header row */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 100px 90px 80px 130px 110px 72px',gap:'0 12px',padding:'8px 24px',borderBottom:'1px solid #e5e7eb',fontSize:11,fontWeight:700,letterSpacing:'.07em',color:'#8b9aa6',textTransform:'uppercase'}}>
                <span>Page</span><span>Score</span><span>Change</span><span>Coverage</span><span>Rubric</span><span>Captured</span><span></span>
            </div>
            {/* Audit rows newest first */}
            {audits.map((a, idx) => {
                // find previous audit (next in newest-first = older)
                const prevAudit = audits[idx + 1];
                const isOpen = expanded === a.id;
                const isDeleting = deleting === a.id;
                const isConfirm = confirmId === a.id;
                return (
                    <div key={a.id} style={{borderBottom:'1px solid #f0f2f5'}}>
                        {/* Main row */}
                        <div
                            style={{display:'grid',gridTemplateColumns:'1fr 100px 90px 80px 130px 110px 72px',gap:'0 12px',padding:'13px 24px',alignItems:'center',cursor:'pointer',background:isOpen?'#f7fbfc':'transparent',transition:'background .15s'}}
                            onClick={() => setExpanded(isOpen ? null : a.id)}
                        >
                            {/* Page */}
                            <div style={{minWidth:0}}>
                                <div style={{display:'flex',alignItems:'center',gap:6}}>
                                    {isOpen ? <ChevronDown size={13} color="#57606a"/> : <ChevronRight size={13} color="#b0bec5"/>}
                                    <span style={{fontSize:13,fontWeight:500,color:'#213f50',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.url}</span>
                                </div>
                                <div style={{fontSize:11,color:'#8b9aa6',marginLeft:19,marginTop:2}}>{a.hash.slice(0,12)} · {a.version}</div>
                            </div>
                            {/* Score */}
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                                <div style={{width:32,height:32,borderRadius:'50%',background:`conic-gradient(#57e3c2 ${a.score*3.6}deg,#e8eef2 0)`,display:'grid',placeItems:'center'}}>
                                    <div style={{width:24,height:24,borderRadius:'50%',background:'#fff',display:'grid',placeItems:'center',fontSize:10,fontWeight:700,color:'#213f50'}}>{a.score}</div>
                                </div>
                                <span style={{fontSize:13,fontWeight:700,color:'#213f50'}}>/100</span>
                            </div>
                            {/* Delta */}
                            <div onClick={e=>e.stopPropagation()}>
                                {prevAudit ? <Delta prev={prevAudit.score} curr={a.score}/> : <span style={{fontSize:11,color:'#b0bec5'}}>Baseline</span>}
                            </div>
                            {/* Coverage */}
                            <span style={{fontSize:13,color:'#57606a'}}>{a.coverage}%</span>
                            {/* Rubric */}
                            <span style={{fontSize:11,color:'#57606a',fontFamily:'monospace'}}>{a.version}</span>
                            {/* Captured */}
                            <span style={{fontSize:12,color:'#57606a'}}>{new Date(a.created).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span>
                            {/* Delete */}
                            <div onClick={e=>e.stopPropagation()} style={{display:'flex',justifyContent:'flex-end'}}>
                                {isDeleting ? (
                                    <Loader size={14} style={{animation:'spin 1s linear infinite',color:'#57606a'}}/>
                                ) : isConfirm ? (
                                    <button
                                        style={{fontSize:11,fontWeight:700,color:'#fff',background:'#e05252',border:'none',borderRadius:5,padding:'4px 8px',cursor:'pointer',whiteSpace:'nowrap'}}
                                        onClick={()=>handleDelete(a.id)}
                                    >Confirm</button>
                                ) : (
                                    <button
                                        style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#b0bec5',borderRadius:4,display:'flex'}}
                                        title="Delete this audit run"
                                        onClick={()=>handleDelete(a.id)}
                                    ><Trash2 size={14}/></button>
                                )}
                            </div>
                        </div>
                        {/* Expanded dimension breakdown */}
                        {isOpen && (
                            <div style={{padding:'4px 24px 16px 43px',background:'#f7fbfc'}}>
                                <div style={{marginBottom:8,fontSize:11,fontWeight:700,letterSpacing:'.07em',color:'#8b9aa6',textTransform:'uppercase'}}>Dimension breakdown</div>
                                {a.dimensions.map(d => <DimensionMini key={d.id} d={d}/>)}
                                <div style={{marginTop:12,fontSize:11,color:'#8b9aa6',lineHeight:1.6}}>
                                    Score {a.score}/100 · {a.coverage}% rubric coverage · {a.version}
                                    {prevAudit && (
                                        <> · <strong style={{color: a.score >= prevAudit.score ? '#15803d' : '#b91c1c'}}>
                                            {a.score >= prevAudit.score ? '↑' : '↓'} {Math.abs(a.score - prevAudit.score)} pts vs previous run
                                        </strong></>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
