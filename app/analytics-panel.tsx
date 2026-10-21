import {useEffect,useState} from 'react';
import {BarChart2,TrendingUp,TrendingDown,Minus,Zap,Globe,Link2,Search,AlertTriangle,RefreshCw} from 'lucide-react';
import type {Client,ProbeRun,Audit} from '../src/core/contracts';
import {api} from './workbench-api';

type Props={client:Client;audits:Audit[];busy:boolean;onBusy:(b:boolean)=>void};

function Sparkline({data,color='#4f6ef7',height=32}:{data:(number|null)[];color?:string;height?:number}){
  const valid=data.filter((v):v is number=>v!==null);
  if(valid.length<2)return <span style={{fontSize:'.75rem',color:'#999'}}>No data</span>;
  const min=Math.min(...valid),max=Math.max(...valid);
  const range=max-min||1;
  const w=120,h=height;
  const pts=data.map((v,i)=>{
    const x=(i/(data.length-1))*w;
    const y=v===null?h:h-((v-min)/range)*(h-4)-2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{overflow:'visible'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/>
      {valid.length>0&&<circle cx={(data.length-1)/(data.length-1)*w} cy={h-((valid[valid.length-1]-min)/range)*(h-4)-2} r={2.5} fill={color}/>}
    </svg>
  );
}

function DeltaBadge({value}:{value:number|null}){
  if(value===null)return <span style={{color:'#999',fontSize:'.75rem'}}>—</span>;
  const up=value>0,flat=value===0;
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:'.75rem',fontWeight:600,color:up?'#10b981':flat?'#999':'#ef4444'}}>
      {up?<TrendingUp size={12}/>:flat?<Minus size={12}/>:<TrendingDown size={12}/>}
      {up?'+':''}{value.toFixed(1)}pp
    </span>
  );
}

function KpiCard({label,value,subtitle,sparkData,color}:{label:string;value:string;subtitle:React.ReactNode;sparkData:(number|null)[];color:string}){
  return (
    <div style={{background:'#fff',border:'1px solid #e4e6ef',borderRadius:10,padding:'16px 20px',flex:'1 1 180px',minWidth:160}}>
      <div style={{fontSize:'.75rem',color:'#6b7280',letterSpacing:'.04em',marginBottom:4,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:'1.65rem',fontWeight:700,color:'#1f2328',lineHeight:1.1}}>{value}</div>
      <div style={{fontSize:'.75rem',color:'#6b7280',marginBottom:8}}>{subtitle}</div>
      <Sparkline data={sparkData} color={color} height={28}/>
    </div>
  );
}

export function AnalyticsPanel({client,audits,busy,onBusy}:Props){
  const [runs,setRuns]=useState<ProbeRun[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [selectedAuditA,setSelectedAuditA]=useState('');
  const [selectedAuditB,setSelectedAuditB]=useState('');

  useEffect(()=>{
    if(client.id==='demo')return;
    setLoading(true);
    api<ProbeRun[]>(`probe-history/${client.id}`)
      .then(setRuns)
      .catch(e=>setError(e.message))
      .finally(()=>setLoading(false));
  },[client.id]);

  useEffect(()=>{
    if(audits.length>=2){setSelectedAuditA(audits[audits.length-1].id);setSelectedAuditB(audits[0].id);}
    else if(audits.length===1){setSelectedAuditA(audits[0].id);setSelectedAuditB('');}
  },[audits]);

  const mentionTrend=runs.slice().reverse().map(r=>r.mentionRate);
  const citationTrend=runs.slice().reverse().map(r=>r.citationRate);
  const latestRun=runs[0]??null;
  const prevRun=runs[1]??null;
  const mentionDelta=latestRun&&prevRun&&latestRun.mentionRate!==null&&prevRun.mentionRate!==null?latestRun.mentionRate-prevRun.mentionRate:null;
  const citationDelta=latestRun&&prevRun&&latestRun.citationRate!==null&&prevRun.citationRate!==null?latestRun.citationRate-prevRun.citationRate:null;

  // Aggregate share-of-voice across all runs
  const sovMap=new Map<string,number[]>();
  for(const run of runs){
    for(const e of run.shareOfVoice){
      if(!sovMap.has(e.competitor))sovMap.set(e.competitor,[]);
      sovMap.get(e.competitor)!.push(e.mentionRate);
    }
  }
  const sovAvg=Array.from(sovMap.entries()).map(([name,vals])=>({name,avg:vals.reduce((s,v)=>s+v,0)/vals.length})).sort((a,b)=>b.avg-a.avg).slice(0,6);

  // Citation sources
  const srcMap=new Map<string,number>();
  for(const run of runs){
    for(const s of run.citingSources){
      srcMap.set(s.domain,(srcMap.get(s.domain)||0)+s.count);
    }
  }
  const topSources=Array.from(srcMap.entries()).map(([domain,count])=>({domain,count})).sort((a,b)=>b.count-a.count).slice(0,8);

  // Change impact analysis
  const auditA=audits.find(a=>a.id===selectedAuditA);
  const auditB=audits.find(a=>a.id===selectedAuditB);
  const dimChanges=auditA&&auditB?auditA.dimensions.map(dA=>{
    const dB=auditB.dimensions.find(d=>d.id===dA.id);
    const scoreB=dB?.score??null;
    return {id:dA.id,name:dA.name,scoreA:dA.score,scoreB,delta:dA.score!==null&&scoreB!==null?dA.score-scoreB:null};
  }).filter(d=>d.delta!==null&&d.delta!==0).sort((a,b)=>Math.abs(b.delta!)-Math.abs(a.delta!)).slice(0,10):[];

  const isDemo=client.id==='demo';

  if(isDemo){
    return (
      <section className="panel">
        <div style={{padding:'48px 32px',textAlign:'center'}}>
          <BarChart2 size={40} style={{color:'#c7d2fe',margin:'0 auto 12px'}}/>
          <h3 style={{margin:'0 0 8px',color:'#1f2328'}}>Analytics &amp; Trends</h3>
          <p style={{color:'#6b7280',maxWidth:420,margin:'0 auto'}}>Create a real client and run AI visibility probes to see historical trends, share-of-voice evolution, and change impact analysis here.</p>
        </div>
      </section>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {error&&<div className="error">{error}</div>}

      {/* KPI row */}
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <KpiCard
          label="Brand mention rate"
          value={latestRun?.mentionRate!==null&&latestRun?.mentionRate!==undefined?`${latestRun.mentionRate}%`:'—'}
          subtitle={mentionDelta!==null?<span style={{display:'inline-flex',alignItems:'center',gap:4}}>vs prev run <DeltaBadge value={mentionDelta}/></span>:`${runs.length} runs recorded`}
          sparkData={mentionTrend}
          color="#4f6ef7"
        />
        <KpiCard
          label="Citation rate"
          value={latestRun?.citationRate!==null&&latestRun?.citationRate!==undefined?`${latestRun.citationRate}%`:'—'}
          subtitle={citationDelta!==null?<span style={{display:'inline-flex',alignItems:'center',gap:4}}>vs prev run <DeltaBadge value={citationDelta}/></span>:`${topSources.length} unique sources`}
          sparkData={citationTrend}
          color="#10b981"
        />
        <KpiCard
          label="Total probe runs"
          value={String(runs.length)}
          subtitle={runs[0]?`Last: ${new Date(runs[0].created).toLocaleDateString()}`:'No probes yet'}
          sparkData={runs.slice().reverse().map((_,i)=>i+1)}
          color="#8b5cf6"
        />
        <KpiCard
          label="Engines sampled"
          value={latestRun?String(new Set(latestRun.engines).size):'—'}
          subtitle={latestRun?latestRun.engines.join(', '):'Run a probe first'}
          sparkData={runs.slice().reverse().map(r=>new Set(r.engines).size)}
          color="#f59e0b"
        />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
        {/* Share-of-voice bar chart */}
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Share of voice</h2><p>Average brand mention rate across all probe runs</p></div>
            <BarChart2 size={18} style={{color:'#4f6ef7'}}/>
          </div>
          {sovAvg.length===0?(
            <div className="empty"><p>{loading?'Loading…':'No probe runs yet. Use AI Visibility to run probes.'}</p></div>
          ):(
            <div style={{padding:'4px 20px 8px'}}>
              {sovAvg.map((item,i)=>{
                const pct=Math.round(item.avg);
                const isClient=item.name===client.name||item.name===client.domain;
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                    <div style={{flex:'0 0 160px',fontSize:'.8125rem',color:isClient?'#4f6ef7':'#374151',fontWeight:isClient?600:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                    <div style={{flex:1,height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden',minWidth:0}}>
                      <div style={{height:'100%',width:`${Math.max(pct,2)}%`,background:isClient?'#4f6ef7':'#d1d5db',borderRadius:4,transition:'width .3s'}}/>
                    </div>
                    <div style={{flex:'0 0 42px',fontSize:'.8125rem',fontWeight:600,color:'#374151',textAlign:'right'}}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Citation sources */}
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Top citation sources</h2><p>Domains most cited by AI engines in your probes</p></div>
            <Link2 size={18} style={{color:'#10b981'}}/>
          </div>
          {topSources.length===0?(
            <div className="empty"><p>{loading?'Loading…':'No citation data yet.'}</p></div>
          ):(
            <div style={{padding:'4px 20px 8px'}}>
              {topSources.map((src,i)=>{
                const maxCount=topSources[0].count;
                const isClient=src.domain.includes(new URL(client.domain).hostname)||client.domain.includes(src.domain);
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                    <div style={{flex:'0 0 160px',fontSize:'.8125rem',color:isClient?'#10b981':'#374151',fontWeight:isClient?600:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{src.domain}</div>
                    <div style={{flex:1,height:6,background:'#f3f4f6',borderRadius:3,overflow:'hidden',minWidth:0}}>
                      <div style={{height:'100%',width:`${(src.count/maxCount)*100}%`,background:isClient?'#10b981':'#d1d5db',borderRadius:3}}/>
                    </div>
                    <div style={{flex:'0 0 28px',fontSize:'.8125rem',fontWeight:600,color:'#374151',textAlign:'right'}}>{src.count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Probe run history table */}
      <section className="panel">
        <div className="panel-heading">
          <div><h2>Probe run history</h2><p>Detailed log of all AI visibility probe runs</p></div>
          <button className="secondary" onClick={()=>{
            setLoading(true);
            api<ProbeRun[]>(`probe-history/${client.id}`).then(setRuns).catch(e=>setError(e.message)).finally(()=>setLoading(false));
          }} disabled={loading||busy}><RefreshCw size={14}/>{loading?'Loading…':'Refresh'}</button>
        </div>
        {runs.length===0?(
          <div className="empty">
            <Zap size={28}/>
            <p>{loading?'Loading probe history…':'No probe runs recorded yet. Run a probe from the AI Visibility tab.'}</p>
          </div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Engines</th>
                  <th>Prompts</th>
                  <th>Mention rate</th>
                  <th>Citation rate</th>
                  <th>Sentiment</th>
                  <th>Top citing source</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run,i)=>{
                  const prev=runs[i+1]??null;
                  const mDelta=run.mentionRate!==null&&prev?.mentionRate!==null&&prev?.mentionRate!==undefined?run.mentionRate-prev.mentionRate:null;
                  const topSrc=run.citingSources[0]?.domain??'—';
                  return (
                    <tr key={run.id}>
                      <td style={{whiteSpace:'nowrap'}}>{new Date(run.created).toLocaleDateString()}<br/><span style={{fontSize:'.7rem',color:'#999'}}>{new Date(run.created).toLocaleTimeString()}</span></td>
                      <td>{run.engines.join(', ') || '—'}</td>
                      <td>{run.prompts.length}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontWeight:600}}>{run.mentionRate!==null?`${run.mentionRate}%`:'—'}</span>
                          <DeltaBadge value={mDelta}/>
                        </div>
                      </td>
                      <td style={{fontWeight:600}}>{run.citationRate!==null?`${run.citationRate}%`:'—'}</td>
                      <td>
                        <div style={{display:'flex',gap:4,fontSize:'.7rem'}}>
                          {run.sentimentBreakdown.positive>0&&<span style={{background:'#d1fae5',color:'#065f46',borderRadius:4,padding:'1px 5px'}}>+{run.sentimentBreakdown.positive}</span>}
                          {run.sentimentBreakdown.neutral>0&&<span style={{background:'#f3f4f6',color:'#6b7280',borderRadius:4,padding:'1px 5px'}}>{run.sentimentBreakdown.neutral}n</span>}
                          {run.sentimentBreakdown.negative>0&&<span style={{background:'#fee2e2',color:'#991b1b',borderRadius:4,padding:'1px 5px'}}>-{run.sentimentBreakdown.negative}</span>}
                        </div>
                      </td>
                      <td style={{fontSize:'.8125rem',color:'#6b7280'}}>{topSrc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Change impact analysis */}
      {audits.length>=2&&(
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Change impact analysis</h2><p>Dimension score changes between two audits</p></div>
            <AlertTriangle size={18} style={{color:'#f59e0b'}}/>
          </div>
          <div style={{display:'flex',gap:12,padding:'16px 20px',flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:'.75rem',color:'#6b7280',fontWeight:600}}>BASELINE (older)</label>
              <select value={selectedAuditA} onChange={e=>setSelectedAuditA(e.target.value)} style={{padding:'6px 10px',border:'1px solid #e4e6ef',borderRadius:6,fontSize:'.875rem',background:'#fff',minWidth:220}}>
                {audits.map(a=><option key={a.id} value={a.id}>{new Date(a.created).toLocaleDateString()} — score {a.score}</option>)}
              </select>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:'.75rem',color:'#6b7280',fontWeight:600}}>LATEST (newer)</label>
              <select value={selectedAuditB} onChange={e=>setSelectedAuditB(e.target.value)} style={{padding:'6px 10px',border:'1px solid #e4e6ef',borderRadius:6,fontSize:'.875rem',background:'#fff',minWidth:220}}>
                {audits.map(a=><option key={a.id} value={a.id}>{new Date(a.created).toLocaleDateString()} — score {a.score}</option>)}
              </select>
            </div>
          </div>
          {dimChanges.length===0?(
            <div className="empty"><p>{!auditA||!auditB?'Select two different audits above.':'No dimension score changes between these two audits.'}</p></div>
          ):(
            <table>
              <thead>
                <tr><th>Dimension</th><th>Baseline</th><th>Latest</th><th>Change</th><th>Direction</th></tr>
              </thead>
              <tbody>
                {dimChanges.map(d=>{
                  const improved=(d.delta??0)>0;
                  return (
                    <tr key={d.id}>
                      <td style={{fontWeight:500}}>{d.name}</td>
                      <td style={{color:'#6b7280'}}>{d.scoreB??'—'}</td>
                      <td style={{fontWeight:600}}>{d.scoreA??'—'}</td>
                      <td><DeltaBadge value={d.delta}/></td>
                      <td>{improved?<span style={{color:'#10b981',display:'flex',alignItems:'center',gap:4}}><TrendingUp size={14}/>Improved</span>:<span style={{color:'#ef4444',display:'flex',alignItems:'center',gap:4}}><TrendingDown size={14}/>Regressed</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
