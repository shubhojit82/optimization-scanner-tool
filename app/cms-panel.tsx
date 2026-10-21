import {useEffect,useState} from 'react';
import {Link2,Check,Clock,AlertTriangle,Copy,ChevronDown,ChevronRight,Code,FileText,Terminal,Info} from 'lucide-react';
import type {Client,Finding} from '../src/core/contracts';
import {api} from './workbench-api';

type CmsAdapter={id:string;name:string;category:string;status:string;apiStyle:string;capabilities:string[];envVars:string[];description:string};
type ChangeProposal={adapterId:string;findingId:string;title:string;instructions:string;fieldPath?:string;codeSnippet?:string;owner:string};

type Props={client:Client;busy:boolean;onBusy:(b:boolean)=>void};

const STATUS_META:{[k:string]:{label:string;color:string;bg:string;icon:React.ReactNode}}={
  'available':   {label:'Available',   color:'#065f46',bg:'#d1fae5',icon:<Check size={11}/>},
  'port-defined':{label:'Port defined',color:'#92400e',bg:'#fef3c7',icon:<Clock size={11}/>},
  'planned':     {label:'Planned',     color:'#6b7280',bg:'#f3f4f6',icon:<Clock size={11}/>},
};

const CAP_LABEL:{[k:string]:string}={
  read:'Read',draft:'Draft',publish:'Publish',preview:'Preview',localize:'Localise',
};

function CopyButton({text}:{text:string}){
  const [copied,setCopied]=useState(false);
  return (
    <button
      onClick={()=>{navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500)}).catch(()=>{})}}
      style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',border:'1px solid #e4e6ef',borderRadius:5,background:'#f8faff',fontSize:'.75rem',color:'#4f6ef7',cursor:'pointer',fontWeight:500}}
    >
      <Copy size={11}/>{copied?'Copied!':'Copy'}
    </button>
  );
}

/** Minimal markdown-to-JSX renderer for the instructions string */
function MdBlock({text}:{text:string}){
  const lines=text.split('\n');
  const out:React.ReactNode[]=[];
  let i=0;
  while(i<lines.length){
    const line=lines[i];
    // h2
    if(line.startsWith('## ')){out.push(<h3 key={i} style={{margin:'14px 0 4px',fontSize:'.875rem',fontWeight:700,color:'#1f2328'}}>{inline(line.slice(3))}</h3>);i++;continue;}
    // h3
    if(line.startsWith('### ')){out.push(<h4 key={i} style={{margin:'10px 0 3px',fontSize:'.8125rem',fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'.03em'}}>{inline(line.slice(4))}</h4>);i++;continue;}
    // code fence
    if(line.startsWith('```')){
      const fenceLines:string[]=[];
      i++;
      while(i<lines.length&&!lines[i].startsWith('```')){fenceLines.push(lines[i]);i++;}
      out.push(<pre key={i} style={{background:'#1e2a3a',color:'#e2e8f0',padding:'12px 14px',borderRadius:7,fontSize:'.75rem',overflowX:'auto',margin:'8px 0',lineHeight:1.5}}>{fenceLines.join('\n')}</pre>);
      i++;continue;
    }
    // bullet
    if(line.startsWith('- ')){out.push(<li key={i} style={{fontSize:'.8125rem',color:'#374151',lineHeight:1.6,marginLeft:16}}>{inline(line.slice(2))}</li>);i++;continue;}
    // numbered step
    if(/^\d+\. /.test(line)){out.push(<li key={i} style={{fontSize:'.8125rem',color:'#374151',lineHeight:1.6,marginLeft:16,listStyleType:'decimal'}}>{inline(line.replace(/^\d+\. /,''))}</li>);i++;continue;}
    // blank
    if(line.trim()===''){out.push(<div key={i} style={{height:4}}/>);i++;continue;}
    // paragraph
    out.push(<p key={i} style={{fontSize:'.8125rem',color:'#374151',lineHeight:1.6,margin:'2px 0'}}>{inline(line)}</p>);
    i++;
  }
  return <div>{out}</div>;
}

function inline(text:string):React.ReactNode{
  // bold **...**
  const parts=text.split(/(\*\*[^*]+\*\*)/g);
  if(parts.length===1)return text;
  return <>{parts.map((p,i)=>p.startsWith('**')&&p.endsWith('**')?<strong key={i} style={{fontWeight:700,color:'#1f2328'}}>{p.slice(2,-2)}</strong>:<span key={i}>{p}</span>)}</>;
}

function ProposalCard({proposal,onClose}:{proposal:ChangeProposal;onClose:()=>void}){
  const [showCode,setShowCode]=useState(false);
  return (
    <div style={{background:'#fafbff',border:'1px solid #dde3f5',borderRadius:8,padding:'16px 20px',marginTop:0}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <FileText size={14} style={{color:'#4f6ef7',flexShrink:0}}/>
          <span style={{fontWeight:600,fontSize:'.875rem',color:'#1f2328'}}>{proposal.title}</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          <span style={{fontSize:'.7rem',padding:'2px 8px',borderRadius:12,background:'#eef2ff',color:'#4f6ef7',fontWeight:700,textTransform:'uppercase'}}>{proposal.owner}</span>
          <CopyButton text={proposal.instructions}/>
          <button onClick={onClose} style={{padding:'3px 8px',border:'1px solid #e4e6ef',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:'.75rem',color:'#6b7280'}}>Dismiss</button>
        </div>
      </div>
      {proposal.fieldPath&&(
        <div style={{marginBottom:12,padding:'7px 12px',background:'#eef2ff',borderRadius:6,fontSize:'.8125rem',color:'#374151',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontWeight:700,color:'#6b7280',fontSize:'.7rem',textTransform:'uppercase',flexShrink:0}}>Field path</span>
          <code style={{background:'#fff',border:'1px solid #c7d2fe',padding:'1px 7px',borderRadius:4,color:'#4338ca',fontFamily:'monospace'}}>{proposal.fieldPath}</code>
        </div>
      )}
      <div style={{background:'#fff',border:'1px solid #e4e6ef',borderRadius:8,padding:'14px 16px',maxHeight:400,overflowY:'auto'}}>
        <MdBlock text={proposal.instructions}/>
      </div>
      {proposal.codeSnippet&&(
        <div style={{marginTop:10}}>
          <button onClick={()=>setShowCode(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:5,background:'none',border:'none',padding:0,cursor:'pointer',fontSize:'.8125rem',color:'#4f6ef7',fontWeight:600}}>
            <Code size={13}/>{showCode?'Hide snippet':'Show code snippet'}
            {showCode?<ChevronDown size={12}/>:<ChevronRight size={12}/>}
          </button>
          {showCode&&(
            <div style={{marginTop:8,position:'relative'}}>
              <pre style={{background:'#1e2a3a',color:'#e2e8f0',padding:'14px 16px',borderRadius:8,fontSize:'.75rem',overflowX:'auto',margin:0,lineHeight:1.5}}>{proposal.codeSnippet}</pre>
              <div style={{position:'absolute',top:8,right:8}}><CopyButton text={proposal.codeSnippet}/></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdapterCard({adapter,selected,onSelect}:{adapter:CmsAdapter;selected:boolean;onSelect:()=>void}){
  const meta=STATUS_META[adapter.status]??STATUS_META['planned'];
  return (
    <div
      onClick={onSelect}
      style={{
        background:selected?'#eef2ff':'#fff',
        border:`1.5px solid ${selected?'#4f6ef7':'#e4e6ef'}`,
        borderRadius:10,padding:'14px 16px',cursor:'pointer',
        display:'flex',flexDirection:'column',gap:0,
        transition:'border-color .15s,background .15s',
      }}
    >
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
        <div style={{fontWeight:700,fontSize:'.875rem',color:'#1f2328',lineHeight:1.3}}>{adapter.name}</div>
        <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:'2px 7px',borderRadius:10,fontSize:'.68rem',fontWeight:700,background:meta.bg,color:meta.color,whiteSpace:'nowrap',flexShrink:0}}>
          {meta.icon}{meta.label}
        </span>
      </div>
      <p style={{fontSize:'.8rem',color:'#6b7280',margin:'0 0 10px',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{adapter.description}</p>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:adapter.envVars.length>0?10:0}}>
        {adapter.capabilities.map(cap=>(
          <span key={cap} style={{fontSize:'.68rem',padding:'1px 6px',borderRadius:4,background:'#f0f4ff',color:'#4f6ef7',fontWeight:600}}>{CAP_LABEL[cap]??cap}</span>
        ))}
      </div>
      {adapter.envVars.length>0&&(
        <div style={{marginTop:'auto',paddingTop:8,borderTop:'1px solid #f0f0f0'}}>
          <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
            <Terminal size={11} style={{color:'#9ca3af'}}/>
            <span style={{fontSize:'.68rem',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.04em'}}>Required env vars</span>
          </div>
          {adapter.envVars.map(v=>(
            <div key={v} style={{fontFamily:'monospace',fontSize:'.75rem',color:'#374151',background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginBottom:2,display:'inline-block',marginRight:4}}>{v}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SetupBanner({adapter}:{adapter:CmsAdapter|undefined}){
  if(!adapter||adapter.envVars.length===0)return null;
  return (
    <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'12px 16px',display:'flex',gap:12,alignItems:'flex-start',marginBottom:16}}>
      <Info size={16} style={{color:'#d97706',flexShrink:0,marginTop:1}}/>
      <div>
        <div style={{fontWeight:600,fontSize:'.875rem',color:'#92400e',marginBottom:4}}>Connect {adapter.name}</div>
        <p style={{fontSize:'.8125rem',color:'#78350f',margin:'0 0 8px',lineHeight:1.5}}>
          Add the following variables to your <code style={{background:'#fef3c7',borderRadius:3,padding:'0 4px'}}>
          .env</code> file, then restart the server (<code style={{background:'#fef3c7',borderRadius:3,padding:'0 4px'}}>npm run dev</code>).
        </p>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {adapter.envVars.map(v=>(
            <div key={v} style={{display:'flex',alignItems:'center',gap:6,background:'#fff',border:'1px solid #fde68a',borderRadius:6,padding:'4px 10px'}}>
              <code style={{fontFamily:'monospace',fontSize:'.8125rem',color:'#374151'}}>{v}=<span style={{color:'#9ca3af'}}>your_value_here</span></code>
              <CopyButton text={`${v}=your_value_here`}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CmsPanel({client,busy,onBusy}:Props){
  const [adapters,setAdapters]=useState<CmsAdapter[]>([]);
  const [findings,setFindings]=useState<Finding[]>([]);
  const [selectedAdapter,setSelectedAdapter]=useState('generic');
  const [proposals,setProposals]=useState<Record<string,ChangeProposal>>({});
  const [generating,setGenerating]=useState<string|null>(null);
  const [error,setError]=useState('');
  const isDemo=client.id==='demo';

  useEffect(()=>{
    api<CmsAdapter[]>('cms/adapters').then(d=>{setAdapters(d);}).catch(()=>{});
    if(!isDemo){
      api<Finding[]>(`findings?clientId=${client.id}`)
        .then(rows=>setFindings(rows.filter(f=>f.status==='open'||f.status==='approved')))
        .catch(e=>setError(e.message));
    }
  },[client.id,isDemo]);

  async function generateProposal(finding:Finding){
    const key=`${finding.id}:${selectedAdapter}`;
    if(proposals[key]){
      setProposals(p=>{const n={...p};delete n[key];return n;});
      return;
    }
    setGenerating(finding.id);
    setError('');
    try{
      const result=await api<ChangeProposal>('cms/change-instructions',{clientId:client.id,findingId:finding.id,adapterId:selectedAdapter});
      setProposals(p=>({...p,[key]:result}));
    }catch(e){setError((e as Error).message);}
    finally{setGenerating(null);}
  }

  if(isDemo){
    return (
      <section className="panel">
        <div style={{padding:'48px 32px',textAlign:'center'}}>
          <Link2 size={40} style={{color:'#fed7aa',margin:'0 auto 12px'}}/>
          <h3 style={{margin:'0 0 8px',color:'#1f2328'}}>CMS Integration</h3>
          <p style={{color:'#6b7280',maxWidth:420,margin:'0 auto'}}>Create a real client, run a scan, and open findings to generate platform-specific change instructions for your CMS.</p>
        </div>
      </section>
    );
  }

  const activeAdapter=adapters.find(a=>a.id===selectedAdapter);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {error&&<div className="error">{error}</div>}

      {/* Adapter selector */}
      <section className="panel">
        <div className="panel-heading">
          <div><h2>CMS adapters</h2><p>Select your platform to get implementation instructions tailored to your CMS workflow</p></div>
          <Link2 size={18} style={{color:'#ea580c'}}/>
        </div>
        <div style={{padding:'16px 20px 20px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {adapters.map(a=>(
              <AdapterCard key={a.id} adapter={a} selected={selectedAdapter===a.id} onSelect={()=>setSelectedAdapter(a.id)}/>
            ))}
          </div>
        </div>
      </section>

      {/* Change proposals */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Change instructions</h2>
            <p>{activeAdapter?.name??selectedAdapter} — click a finding to generate platform-specific fix instructions</p>
          </div>
          <span className="count">{findings.length}</span>
        </div>
        <div style={{padding:'16px 20px 20px'}}>
          <SetupBanner adapter={activeAdapter}/>
          {findings.length===0?(
            <div className="empty" style={{margin:0}}>
              <AlertTriangle size={28}/>
              <p>No open findings for this client. Run a scan and save it to generate findings.</p>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {findings.map(finding=>{
                const key=`${finding.id}:${selectedAdapter}`;
                const proposal=proposals[key];
                const isGenerating=generating===finding.id;
                const sevColor:{[k:string]:string}={critical:'#ef4444',high:'#f97316',medium:'#f59e0b',low:'#6b7280',info:'#3b82f6'};
                return (
                  <div key={finding.id} style={{border:'1px solid #e4e6ef',borderRadius:10,overflow:'hidden'}}>
                    <div
                      onClick={()=>generateProposal(finding)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',background:proposal?'#f8f9ff':'#fafbff',borderBottom:proposal?'1px solid #e4e6ef':'none',transition:'background .1s'}}
                    >
                      <div style={{width:8,height:8,borderRadius:'50%',background:sevColor[finding.severity]??'#6b7280',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:500,fontSize:'.875rem',color:'#1f2328',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{finding.title}</div>
                        <div style={{fontSize:'.75rem',color:'#6b7280',marginTop:2}}>{finding.dimensionName} · {finding.url.replace(/https?:\/\//,'').slice(0,55)}</div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                        <span style={{fontSize:'.68rem',padding:'2px 7px',borderRadius:4,background:'#f3f4f6',color:'#6b7280',fontWeight:600,textTransform:'uppercase'}}>{finding.status}</span>
                        {isGenerating
                          ?<span style={{fontSize:'.75rem',color:'#4f6ef7',fontStyle:'italic'}}>Generating…</span>
                          :proposal
                            ?<ChevronDown size={14} style={{color:'#4f6ef7'}}/>
                            :<ChevronRight size={14} style={{color:'#9ca3af'}}/>
                        }
                      </div>
                    </div>
                    {proposal&&(
                      <div style={{padding:'12px 16px 16px'}}>
                        <ProposalCard proposal={proposal} onClose={()=>setProposals(p=>{const n={...p};delete n[key];return n;})}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
