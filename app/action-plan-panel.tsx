"use client";
import type { Audit, Client } from '../src/core/contracts';

type ActionItem = {
    id: string;
    category: 'SEO' | 'AEO' | 'GEO';
    dimension: string;
    title: string;
    description: string;
    effort: 'low' | 'medium' | 'high';
    impact: number;   // 0-100 weighted points to gain
    score: number | null;
    weight: number;
};

const EFFORT_COLOR = {low: '#dcfce7', medium: '#fef9c3', high: '#fee2e2'};
const EFFORT_TEXT = {low: '#15803d', medium: '#854d0e', high: '#b91c1c'};
const EFFORT_LABEL = {low: 'Low effort', medium: 'Medium effort', high: 'High effort'};

const EFFORT_MAP: Record<string, 'low' | 'medium' | 'high'> = {
    'technical': 'low',
    'schema': 'medium',
    'entity': 'low',
    'content': 'medium',
    'evidence': 'low',
    'query': 'low',
    'freshness': 'low',
    'reasoning-cues': 'medium',
    'passage-density': 'medium',
    'entity-links': 'medium',
    'crawl': 'high',
    'authority': 'high',
    'measurement': 'medium',
    'accessibility': 'medium',
    'best-practices': 'low',
    'performance': 'medium',
};

const SEO_IDS = new Set(['crawl','technical','schema','freshness']);
const AEO_IDS = new Set(['content','entity','evidence','query','reasoning-cues','passage-density','entity-links']);
const GEO_IDS = new Set(['measurement','authority']);

function dimCategory(id: string): 'SEO' | 'AEO' | 'GEO' {
    if (SEO_IDS.has(id)) return 'SEO';
    if (AEO_IDS.has(id)) return 'AEO';
    if (GEO_IDS.has(id)) return 'GEO';
    return 'AEO';
}

function buildActions(audit: Audit): ActionItem[] {
    return audit.dimensions
        .filter(d => d.score !== null && d.score < 100 && d.weight > 0)
        .map(d => ({
            id: d.id,
            category: dimCategory(d.id),
            dimension: d.name,
            title: d.name,
            description: d.action,
            effort: EFFORT_MAP[d.id] ?? 'medium',
            impact: Math.round(d.weight * (100 - d.score!) / 100),
            score: d.score,
            weight: d.weight,
        }))
        .sort((a, b) => b.impact - a.impact);
}

const CAT_COLOR: Record<string, string> = {SEO: '#3b82d4', AEO: '#7c5cd8', GEO: '#0d8073'};

type MatrixCell = {effort: 'low'|'medium'|'high'; impactLevel: 'high'|'medium'|'low'};
function matrixLabel(cell: MatrixCell): string {
    if (cell.impactLevel === 'high' && cell.effort === 'low') return '🚀 Quick wins';
    if (cell.impactLevel === 'high' && cell.effort === 'medium') return '📈 Major projects';
    if (cell.impactLevel === 'high' && cell.effort === 'high') return '🏔 Long bets';
    if (cell.impactLevel === 'medium' && cell.effort === 'low') return '✅ Easy fills';
    if (cell.impactLevel === 'medium' && cell.effort === 'medium') return '⚙ Scheduled work';
    if (cell.impactLevel === 'medium' && cell.effort === 'high') return '🔄 Review later';
    if (cell.impactLevel === 'low' && cell.effort === 'low') return '🔧 Nice to have';
    return '⏳ Low priority';
}

type Props = {client: Client; audits: Audit[]};

export function ActionPlanPanel({client, audits}: Props) {
    const audit = audits[audits.length - 1] ?? null;
    if (!audit) {
        return (
            <section className="panel">
                <div style={{padding:'32px 24px',textAlign:'center',color:'#57606a'}}>
                    <p style={{fontSize:'1.05rem',fontWeight:600,color:'#213f50',marginBottom:8}}>No audit data yet</p>
                    <p style={{fontSize:'.88rem'}}>Import a page or run a scan to generate the GEO action plan for {client.name}.</p>
                </div>
            </section>
        );
    }

    const actions = buildActions(audit);
    const totalGap = actions.reduce((n, a) => n + a.impact, 0);
    const quickWins = actions.filter(a => a.effort === 'low' && a.impact >= 5);

    // Matrix buckets
    function impactLevel(impact: number): 'high'|'medium'|'low' {
        if (impact >= 10) return 'high';
        if (impact >= 4) return 'medium';
        return 'low';
    }

    const matrixCells: MatrixCell[] = [
        {effort:'low', impactLevel:'high'},
        {effort:'medium', impactLevel:'high'},
        {effort:'high', impactLevel:'high'},
        {effort:'low', impactLevel:'medium'},
        {effort:'medium', impactLevel:'medium'},
        {effort:'high', impactLevel:'medium'},
        {effort:'low', impactLevel:'low'},
        {effort:'medium', impactLevel:'low'},
        {effort:'high', impactLevel:'low'},
    ];

    return (
        <div>
            {/* Header summary */}
            <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
                <SummaryCard label="Overall score" value={`${audit.score}/100`} accent/>
                <SummaryCard label="GEO gap" value={`${totalGap} pts`} sub="Weighted points to gain"/>
                <SummaryCard label="Quick wins" value={String(quickWins.length)} sub="Low effort, high impact"/>
                <SummaryCard label="Actions" value={String(actions.length)} sub="Dimensions below 100"/>
            </div>

            {/* Quick wins callout */}
            {quickWins.length > 0 && (
                <section className="panel" style={{marginBottom:16,borderLeft:'3px solid #15803d'}}>
                    <div className="panel-heading">
                        <div><h2 style={{color:'#15803d'}}>🚀 Quick wins — start here</h2><p>High-impact changes that require minimal technical effort.</p></div>
                    </div>
                    <div style={{padding:'4px 24px 16px',display:'flex',flexDirection:'column',gap:10}}>
                        {quickWins.map((a, i) => (
                            <div key={a.id} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'12px 14px',background:'#f0fdf4',borderRadius:8,border:'1px solid #bbf7d0'}}>
                                <div style={{width:26,height:26,borderRadius:'50%',background:'#15803d',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</div>
                                <div style={{flex:1,minWidth:0}}>
                                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                                        <span style={{fontWeight:650,fontSize:'.92rem',color:'#213f50'}}>{a.dimension}</span>
                                        <span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:20,background:CAT_COLOR[a.category],color:'#fff'}}>{a.category}</span>
                                        <span style={{fontSize:11,color:'#15803d',fontWeight:600}}>+{a.impact} pts</span>
                                    </div>
                                    <p style={{margin:0,fontSize:'.83rem',color:'#374151',lineHeight:1.55}}>{a.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Effort / Impact matrix */}
            <section className="panel" style={{marginBottom:16}}>
                <div className="panel-heading">
                    <div><h2>Effort × Impact matrix</h2><p>Each fix plotted by implementation effort and weighted score gain.</p></div>
                </div>
                <div style={{padding:'12px 24px 20px',overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                            <tr>
                                <th style={{textAlign:'left',padding:'6px 10px',background:'#f7f8fa',borderRadius:'6px 0 0 0',fontWeight:700,fontSize:11,color:'#57606a',textTransform:'uppercase',letterSpacing:'.06em'}}>Impact ↓ / Effort →</th>
                                {(['low','medium','high'] as const).map(e => (
                                    <th key={e} style={{textAlign:'center',padding:'6px 10px',background:'#f7f8fa',fontWeight:700,fontSize:11,color:'#57606a',textTransform:'uppercase',letterSpacing:'.06em'}}>{e.charAt(0).toUpperCase()+e.slice(1)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(['high','medium','low'] as const).map(il => (
                                <tr key={il}>
                                    <td style={{padding:'10px',fontWeight:700,fontSize:11,color:'#57606a',textTransform:'uppercase',letterSpacing:'.05em',background:'#f7f8fa',verticalAlign:'top',whiteSpace:'nowrap'}}>
                                        {il === 'high' ? 'High (≥10 pts)' : il === 'medium' ? 'Medium (4–9 pts)' : 'Low (<4 pts)'}
                                    </td>
                                    {(['low','medium','high'] as const).map(ef => {
                                        const cell = matrixCells.find(m => m.effort === ef && m.impactLevel === il)!;
                                        const items = actions.filter(a => a.effort === ef && impactLevel(a.impact) === il);
                                        return (
                                            <td key={ef} style={{padding:'10px',verticalAlign:'top',border:'1px solid #e5e7eb',minWidth:160}}>
                                                {items.length === 0 ? (
                                                    <span style={{color:'#c5cdd4',fontSize:11}}>—</span>
                                                ) : (
                                                    <div>
                                                        <div style={{fontSize:10,fontWeight:700,color:'#57606a',marginBottom:6,fontStyle:'italic'}}>{matrixLabel(cell)}</div>
                                                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                                                            {items.map(a => (
                                                                <div key={a.id} style={{display:'flex',alignItems:'center',gap:6}}>
                                                                    <span style={{fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:10,background:CAT_COLOR[a.category],color:'#fff',flexShrink:0}}>{a.category}</span>
                                                                    <span style={{fontSize:11,color:'#213f50'}}>{a.dimension}</span>
                                                                    <span style={{fontSize:10,color:'#57606a',marginLeft:'auto',whiteSpace:'nowrap'}}>+{a.impact}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Full prioritized list */}
            <section className="panel">
                <div className="panel-heading">
                    <div><h2>Full action list</h2><p>Ordered by weighted GEO impact. Each fix addresses one rubric dimension.</p></div>
                    <span className="count">{actions.length}</span>
                </div>
                <div style={{padding:'8px 0 12px'}}>
                    {actions.map((a, i) => (
                        <details key={a.id} style={{borderBottom:'1px solid #f0f2f5'}}>
                            <summary style={{display:'flex',alignItems:'center',gap:10,padding:'12px 24px',cursor:'pointer',userSelect:'none',listStyle:'none'}}>
                                <span style={{width:22,height:22,borderRadius:'50%',background:'#f0f2f5',color:'#57606a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{i+1}</span>
                                <div style={{flex:1,minWidth:0}}>
                                    <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                                        <span style={{fontWeight:650,fontSize:'.88rem',color:'#213f50'}}>{a.dimension}</span>
                                        <span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:20,background:CAT_COLOR[a.category],color:'#fff'}}>{a.category}</span>
                                        <span style={{fontSize:10,fontWeight:700,padding:'1px 8px',borderRadius:20,background:EFFORT_COLOR[a.effort],color:EFFORT_TEXT[a.effort]}}>{EFFORT_LABEL[a.effort]}</span>
                                    </div>
                                </div>
                                <div style={{display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
                                    <div style={{textAlign:'right'}}>
                                        <div style={{fontSize:13,fontWeight:700,color:'#213f50'}}>+{a.impact} pts</div>
                                        <div style={{fontSize:10,color:'#8b9aa6'}}>Current: {a.score}/100</div>
                                    </div>
                                    <div style={{width:60,height:6,background:'#e5e7eb',borderRadius:3,overflow:'hidden'}}>
                                        <div style={{width:`${a.score ?? 0}%`,height:'100%',background: a.score && a.score >= 70 ? '#0d8073' : a.score && a.score >= 40 ? '#d97706' : '#ef4444',borderRadius:3}}/>
                                    </div>
                                </div>
                            </summary>
                            <div style={{padding:'4px 24px 16px 56px',background:'#f7fbfc',borderTop:'1px solid #f0f2f5'}}>
                                <p style={{margin:'0 0 8px',fontSize:'.83rem',color:'#374151',lineHeight:1.6}}><strong>Fix:</strong> {a.description}</p>
                                <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:11,color:'#57606a'}}>
                                    <span>Weight: {a.weight}%</span>
                                    <span>Score: {a.score}/100</span>
                                    <span>Gap: +{a.impact} weighted pts</span>
                                    <span>Effort: {EFFORT_LABEL[a.effort]}</span>
                                    <span>Pillar: {a.category}</span>
                                </div>
                            </div>
                        </details>
                    ))}
                    {actions.length === 0 && (
                        <div style={{padding:'32px 24px',textAlign:'center',color:'#57606a',fontSize:'.88rem'}}>
                            All assessed dimensions are at 100. Review unassessed areas in the Scanner tab.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function SummaryCard({label, value, sub, accent}: {label:string;value:string;sub?:string;accent?:boolean}) {
    return (
        <div style={{flex:'1 1 140px',background:accent?'#0f3b52':'#fff',border:`1px solid ${accent?'#0f3b52':'#e0e7ed'}`,borderRadius:9,padding:'14px 18px'}}>
            <div style={{fontSize:'.71rem',fontWeight:700,letterSpacing:'.07em',color:accent?'#78ddc6':'#8b9aa6',textTransform:'uppercase',marginBottom:5}}>{label}</div>
            <div style={{fontSize:'1.4rem',fontWeight:700,letterSpacing:'-.03em',color:accent?'#fff':'#213f50'}}>{value}</div>
            {sub&&<div style={{fontSize:'.73rem',color:accent?'#92ded0':'#57606a',marginTop:2}}>{sub}</div>}
        </div>
    );
}
