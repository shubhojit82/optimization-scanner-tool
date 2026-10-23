"use client";
import {useEffect,useRef,useState} from 'react';
import {Activity,Layers,Globe,Plus,SlidersHorizontal,FileText,Network,Search,Download,X,Upload,Database,Shield,ChevronDown,Link2,TrendingUp,TrendingDown,Minus,Zap,BarChart2,Target,FileBarChart,PenLine,Wand2,LayoutDashboard,Eye,Map,Calendar,Bell,HelpCircle,Rocket,AlertTriangle,Users,LogOut} from 'lucide-react';
import {HelpDrawer} from './help-drawer';
import {OverviewCharts,MiniRing} from './overview-charts';
import type {Audit,Client,Observation,ProviderInfo,SessionInfo} from '../src/core/contracts';
import {queryUniverse,visibility} from '../src/core/scoring';
import {api,del} from './workbench-api';
import {ObservationPanel} from './observation-panel';
import {ScannerPanel} from './scanner-panel';
import {sampleAudit,sampleClient,sampleHtml} from '../src/core/demo';
import {AuditLedger} from './audit-ledger';
import {ScoreDetailView} from './score-detail-view';
import type {ScoreCategory} from './score-detail-view';
import {AIVisibilityPanel} from './ai-visibility-panel';
import {CompetitorPanel} from './competitor-panel';
import {ScoreTrendChart} from './score-trend-chart';
import {ActionPlanPanel} from './action-plan-panel';
import {ExecSummaryPanel} from './exec-summary-panel';
import {BenchmarkPanel} from './benchmark-panel';
import {ContentBriefPanel} from './content-brief-panel';
import {ProgressPanel} from './progress-panel';
import {SmartPromptsPanel} from './smart-prompts-panel';
import {DashboardPanel} from './dashboard-panel';
import {SiteCrawlerPanel} from './site-crawler-panel';
import {AiMonitorPanel} from './ai-monitor-panel';
import {CsvImportWizard} from './csv-import-wizard';
import {ProbeSchedulePanel} from './probe-schedule-panel';
import {AlertsPanel} from './alerts-panel';
import {RoadmapPanel} from './roadmap-panel';
import {FindingsPanel} from './findings-panel';
import {AnalyticsPanel} from './analytics-panel';
import {CmsPanel} from './cms-panel';
import {LoginPage} from './login-page';
import {UserAdminPanel} from './user-admin-panel';
type Detail={client:Client;audits:Audit[];observations:Observation[];queries:{intent:string;prompt:string}[];visibility:ReturnType<typeof visibility>};
const demo:Detail={client:sampleClient,audits:[sampleAudit],observations:[],queries:queryUniverse(sampleClient),visibility:visibility(sampleClient,[])};
const nav=[{name:'Dashboard',icon:LayoutDashboard},{name:'Overview',icon:Activity},{name:'Scanner',icon:Search},{name:'Site Crawler',icon:Map},{name:'Findings',icon:AlertTriangle},{name:'AI Visibility',icon:Zap},{name:'AI Monitor',icon:Eye},{name:'Schedules',icon:Calendar},{name:'Alerts',icon:Bell},{name:'Smart Prompts',icon:Wand2},{name:'Analytics',icon:TrendingUp},{name:'CMS',icon:Link2},{name:'Competitors',icon:BarChart2},{name:'Benchmark',icon:SlidersHorizontal},{name:'Progress',icon:TrendingUp},{name:'Content Brief',icon:PenLine},{name:'Action Plan',icon:Target},{name:'Executive Summary',icon:FileBarChart},{name:'Query universe',icon:Search},{name:'Observations',icon:Globe},{name:'Integrations',icon:Link2},{name:'Architecture',icon:Network},{name:'Roadmap',icon:Rocket}];
const layers=[{name:'Experience & API',status:'Implemented',text:'React workspace and versioned HTTP endpoints. Input validation and identity checks sit at the boundary.'},{name:'Application services',status:'Implemented',text:'Client access, audit orchestration and observation imports depend on repository interfaces, never on a database SDK.'},{name:'Portable domain core',status:'Implemented',text:'Normalized client, audit and observation contracts. Versioned scoring rules and query generation have no framework or vendor dependencies.'},{name:'Infrastructure adapters',status:'Partial',text:'SQLite and D1 repositories implement storage ports. OpenAI implements the AI provider port. Crawler, CMS draft and job queue adapters come next.'}];

type IntegrationItem = {
  title: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  state: 'Available' | 'Port defined';
  text: string;
  items: {label: string; done: boolean}[];
};
const INTEGRATIONS: IntegrationItem[] = [
  {
    title: 'Page evidence', icon: FileText, iconBg: '#eef2ff', iconColor: '#4f6ef7', state: 'Available',
    text: 'Import HTML from any site or CMS. Bounded payloads, evidence hashes and transparent cue scoring.',
    items: [
      {label: 'HTML import', done: true},
      {label: 'HTTP crawler', done: true},
      {label: 'Sitemap.xml detection', done: true},
      {label: 'AI-bot robots.txt check (GPTBot, Googlebot-Extended, ClaudeBot)', done: true},
      {label: 'Rendered browser capture', done: false},
    ],
  },
  {
    title: 'AI observations', icon: Globe, iconBg: '#f0fdf4', iconColor: '#10b981', state: 'Available',
    text: 'Normalize answers and citations while retaining the collection surface and model.',
    items: [
      {label: 'JSON observation import', done: true},
      {label: 'OpenAI web-search API', done: true},
      {label: 'Gemini grounded search', done: true},
      {label: 'Perplexity / Anthropic', done: false},
    ],
  },
  {
    title: 'AI Visibility Probe', icon: Zap, iconBg: '#fef9c3', iconColor: '#a16207', state: 'Available',
    text: 'Fire prompts at AI engines and measure brand mention rate, sentiment, share-of-voice, and probe run history.',
    items: [
      {label: 'Live AI probing', done: true},
      {label: 'Competitor share-of-voice', done: true},
      {label: 'Citation source tracking', done: true},
      {label: 'Probe run persistence & history trends', done: true},
      {label: 'Scheduled re-probe', done: false},
    ],
  },
  {
    title: 'Structured data & entity', icon: Database, iconBg: '#f0fdfa', iconColor: '#0d9488', state: 'Available',
    text: 'Schema.org completeness scoring, sameAs entity authority links, and per-type required/recommended property checks.',
    items: [
      {label: 'JSON-LD schema completeness', done: true},
      {label: 'sameAs entity-link scoring (Wikidata, Wikipedia, LinkedIn)', done: true},
      {label: 'Per-type required/recommended property gap analysis', done: true},
    ],
  },
  {
    title: 'Exports & reports', icon: FileBarChart, iconBg: '#f5f3ff', iconColor: '#8b5cf6', state: 'Available',
    text: 'Lighthouse-style HTML report, XLSX data export, and PDF-ready executive summary for client delivery.',
    items: [
      {label: 'Lighthouse-style HTML audit report', done: true},
      {label: 'XLSX export with SEO/AEO/GEO sub-scores', done: true},
      {label: 'Executive summary PDF-ready HTML report', done: true},
      {label: 'Site-wide multi-page XLSX export', done: true},
    ],
  },
  {
    title: 'CMS connectors', icon: Link2, iconBg: '#fff7ed', iconColor: '#ea580c', state: 'Port defined',
    text: 'Read content and stage drafts through a common contract. Publishing requires a future approval workflow.',
    items: [
      {label: 'AEM / Contentstack', done: false},
      {label: 'WordPress / Contentful', done: false},
      {label: 'Sitecore / Drupal', done: false},
    ],
  },
];

function download(data:unknown,name:string){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
export default function WorkbenchUI(){
 const [session,setSession]=useState<SessionInfo|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{api<SessionInfo>('session').then(setSession).catch(()=>setFailed(true))},[]);
 async function signOut(){try{await api('auth/logout',{})}catch{/* the cookie is cleared server-side; reload either way */}setSession(null);window.location.assign('/')}
 if(failed)return <div className="banner" role="alert" style={{margin:24}}>Could not reach the server. <a href="/">Reload</a></div>;
 if(!session)return <div className="panel loading" role="status" style={{margin:24}}>Loading...</div>;
 if(!session.authenticated)return <LoginPage onSignedIn={setSession}/>;
 return <Workspace session={session} onSignOut={session.user?signOut:undefined}/>;
}
function Workspace({session,onSignOut}:{session:SessionInfo;onSignOut?:()=>void}){
 const isAdminUser=!!session.user&&(session.user.superAdmin||session.user.role==='admin');
 const navItems=isAdminUser?[...nav,{name:'Users',icon:Users}]:nav;
 const [clients,setClients]=useState<Client[]>([]),[detail,setDetail]=useState<Detail>(demo),[tab,setTab]=useState('Overview'),[modal,setModal]=useState<'client'|'audit'|'observation'|'identity'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[auth,setAuth]=useState(false),[loading,setLoading]=useState(true),[selectedLayer,setSelectedLayer]=useState(2),[confirmDelete,setConfirmDelete]=useState(false);
 const [readOnly,setReadOnly]=useState(false);
 const [helpOpen,setHelpOpen]=useState(false);
 const [observationPrompt,setObservationPrompt]=useState('');
 const [queuedProbePrompts,setQueuedProbePrompts]=useState<string[]>([]);
 const [providers,setProviders]=useState<ProviderInfo[]>([]);
 const [csvWizardOpen,setCsvWizardOpen]=useState(false);
 const [customPrompts,setCustomPrompts]=useState<string[]>([]);
 const [customPromptsDirty,setCustomPromptsDirty]=useState(false);
 const [html,setHtml]=useState(''),[pageUrl,setPageUrl]=useState(''),[json,setJson]=useState('');const dialog=useRef<HTMLDialogElement>(null),generation=useRef(0);
 const c=detail.client,isDemo=c.id==='demo',audit=detail.audits[0];
 useEffect(()=>{api<Client[]>('clients').then((rows:Client[])=>{setClients(rows);if(rows[0])return api<Detail>('clients/'+rows[0].id).then(setDetail)}).catch(e=>{if(e.message==='Sign in required')setAuth(true);else setError(e.message)}).finally(()=>setLoading(false));api<ProviderInfo[]>('providers').then(setProviders).catch(()=>{});api<{readOnly:boolean}>('session').then(s=>setReadOnly(s.readOnly)).catch(()=>{})},[]);
 useEffect(()=>{if(modal)dialog.current?.showModal();else dialog.current?.close()},[modal]);
 async function select(id:string){setConfirmDelete(false);const g=++generation.current;setError('');setLoading(true);try{const d=id==='demo'?demo:await api<Detail>('clients/'+id);if(g===generation.current){setDetail(d);if(id!=='demo'){try{const cp=await api<string[]>(`clients/${id}/prompts`);setCustomPrompts(cp);setCustomPromptsDirty(false);}catch{setCustomPrompts([]);}}}}catch(e){setError((e as Error).message)}finally{if(g===generation.current)setLoading(false)}}
 function open(type:'client'|'audit'|'observation'|'identity'){setError('');if(type!=='client'&&isDemo){setNotice('Create a client to save your own evidence. The sample is read-only.');return}setPageUrl(c.domain);setModal(type)}
 async function deleteClient(){if(!confirmDelete){setConfirmDelete(true);return}setConfirmDelete(false);setBusy(true);setError('');try{await del(`clients/${c.id}`);const remaining=clients.filter(x=>x.id!==c.id);setClients(remaining);if(remaining[0])setDetail(await api<Detail>('clients/'+remaining[0].id));else setDetail(demo);setNotice('Client deleted.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}

 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);try{if(modal==='identity'){const n=await api<Client>(`clients/${c.id}/identity`,{name:f.get('name'),brandAliases:String(f.get('brandAliases')||'').split(',').map(s=>s.trim()).filter(Boolean)});setClients(rows=>rows.map(row=>row.id===n.id?n:row));setDetail(await api<Detail>('clients/'+n.id));setNotice('Brand identity saved. Mention rates were recalculated from your saved answers. Existing audit snapshots are unchanged; import the page again to reassess brand cues.')}else if(modal==='client'){const split=(k:string)=>String(f.get(k)||'').split(',').map(s=>s.trim()).filter(Boolean);const n=await api<Client>('clients',{name:f.get('name'),domain:f.get('domain'),industry:f.get('industry'),market:f.get('market'),products:split('products'),competitors:split('competitors')});setClients(s=>[n,...s]);await select(n.id);setNotice('Client created. Import a page to establish the first baseline.')}else if(modal==='audit'){await api(`clients/${c.id}/audits`,{url:pageUrl,html});await select(c.id);setHtml('');setNotice('Audit saved with its evidence hash and rubric version.')}else{await api(`clients/${c.id}/observations`,JSON.parse(json));await select(c.id);setJson('');setNotice('Observations saved. Rates describe the latest 200 observations.')}setModal(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const opportunities=audit?.dimensions.filter(d=>d.score!==null&&d.score<100).sort((a,b)=>b.weight*(100-b.score!)-a.weight*(100-a.score!))||[];
 const [scoreView,setScoreView]=useState<ScoreCategory|null>(null);
 return <div className="shell">
 <aside className="sidebar"><a className="brand" href="/"><span className="brand-icon"><Layers size={20}/></span><span>AI Search<span className="brand-light"> Intelligence</span></span></a><div className="workspace-label">Client Intelligence</div><nav>{navItems.map(n=><button key={n.name} className={tab===n.name?'nav active':'nav'} onClick={()=>setTab(n.name)} title={n.name}><n.icon size={16}/><span className="nav-label">{n.name}</span></button>)}</nav><div className="sidebar-bottom"><span className="phase">AI SEARCH · V0.3</span><p>Evidence before inference.</p><span>GEO Intelligence workspace</span></div></aside>
 <div className="main"><header className="topbar"><span className="breadcrumb">Workspace <span>/</span> {tab}</span><div style={{display:'flex',alignItems:'center',gap:10}}><span className="private"><Shield size={15}/> {session.user?session.user.name:'Workspace'}</span>{onSignOut&&<button className="help-trigger" onClick={onSignOut} aria-label="Sign out"><LogOut size={14}/>Sign out</button>}<button className={`help-trigger${helpOpen?' active':''}`} onClick={()=>setHelpOpen(v=>!v)} aria-label="Feature guide"><HelpCircle size={14}/>Help</button></div></header>
 <HelpDrawer open={helpOpen} onClose={()=>setHelpOpen(false)}/>
 <main><div className="heading"><div><div className="eyebrow">GENERATIVE SEARCH INTELLIGENCE</div><h1>{tab==='Overview'?'Client overview':tab}</h1><p className="subtitle">{tab==='Overview'?'Turn implementation evidence into a focused action plan.':tab==='Scanner'?'Scan any public URL for GEO readiness. Flags blocking signals and exports a recommendation report.':tab==='AI Visibility'?'Fire customer-intent prompts at live AI engines. Measure brand mention rate, sentiment, and share-of-voice vs competitors.':tab==='Competitors'?'Scan competitor URLs and compare SEO / AEO / GEO scores side-by-side.':tab==='Action Plan'?'Prioritized fix list with effort vs impact matrix. Start with quick wins.':tab==='Executive Summary'?'Client-ready GEO readiness report — 5-pillar readiness scores, AI visibility KPIs, top recommendations, and projected uplift.':tab==='Query universe'?'A repeatable starting set of questions by intent.':tab==='Observations'?'Inspect the answers and citations behind measured visibility.':tab==='Benchmark'?'Score up to 6 URLs side-by-side against the GEO rubric. Ranked league table with SEO / AEO / GEO sub-scores and gap analysis vs the leader.':tab==='Progress'?'Before-and-after dimension comparison across any two audits — track which fixes landed and what regressed.':tab==='Smart Prompts'?'AI-generated probe prompts from your audit gaps — intent-matched, persona-targeted questions designed to test brand visibility in AI engines.':tab==='Content Brief'?'AI-generated content brief from your audit gaps — specific headings, FAQ questions, schema markup, entity links, and passage blocks to write.':tab==='Analytics'?'Probe run trends, share-of-voice evolution, citation sources, and change impact analysis across audits.':tab==='CMS'?'Platform-specific fix instructions for every open finding — tailored to your CMS and ready to copy to your team.':tab==='Integrations'?'One evidence model. Multiple sources.':tab==='Users'?'Approve access requests, add users and choose which clients each person can see.': 'A portable core with replaceable adapters.'}</p></div><button className="primary" onClick={()=>open('client')} disabled={busy}><Plus size={17}/>Add client</button></div>
 {auth&&<div className="banner">Authentication required. Reload to sign in. <a href="/">Reload workspace</a></div>}
 {readOnly&&<div className="banner" style={{borderLeftColor:'var(--warning)',background:'var(--warning-bg)',color:'var(--text-primary)'}}><Shield size={15}/> Read-only mode — you can view data but cannot make changes.</div>}
 {error&&!modal&&<div className="error" role="alert">{error} <button onClick={()=>select(c.id)}>Retry</button></div>}{notice&&<div className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
 {tab!=='Roadmap'&&tab!=='Findings'&&tab!=='Analytics'&&tab!=='CMS'&&tab!=='Users'&&<div className="clientbar"><div className="client-avatar">{c.name.slice(0,1)}</div><div className="client-name"><label className="sr-only" htmlFor="client-select">Selected client</label><select id="client-select" disabled={loading||busy} value={c.id} onChange={e=>select(e.target.value)}><option value="demo">Northstar · sample client</option>{clients.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select><span>{c.domain.replace('https://','')} <span className="divider">|</span> {c.market}</span></div><span className="chip">{isDemo?'ILLUSTRATIVE SAMPLE':'CLIENT WORKSPACE'}</span><button className="secondary" onClick={()=>open('identity')} disabled={loading||busy||isDemo}>Edit client</button><button className="secondary" onClick={()=>open('audit')} disabled={loading||busy}><Upload size={16}/>Import page</button>{!isDemo&&<button className="secondary" title="Export all client data as JSON" disabled={loading||busy} onClick={()=>{const a=document.createElement('a');a.href=`/api/v1/clients/${c.id}/export`;a.download=`geo-export-${c.name.toLowerCase().replace(/[^a-z0-9]/g,'-')}.json`;a.click();}}><Download size={15}/>Export data</button>}{!isDemo&&<button className={confirmDelete?'secondary danger':'secondary'} onClick={deleteClient} disabled={loading||busy} title={confirmDelete?'Click again to confirm permanent deletion':'Delete this client and all its data'}><X size={15}/>{confirmDelete?'Confirm delete':'Delete client'}</button>}</div>}
 {loading?<div className="panel loading" role="status">Loading your workspace…</div>:<>
 {tab==='Overview'&&scoreView&&<ScoreDetailView category={scoreView} audits={detail.audits} observations={detail.observations} onBack={()=>setScoreView(null)}/>}
 {tab==='Overview'&&!scoreView&&<><div className="metrics"><section className="score-card"><div><span className="metric-label">Assessed readiness</span><div className="score-value">{audit?audit.score:'—'}<small>/100</small></div><p>{audit?`${audit.coverage}% rubric coverage`:'No page audit yet'}</p></div><div className="score-ring" style={{background:`conic-gradient(#4f6ef7 ${(audit?.score||0)*3.6}deg,rgba(255,255,255,0.15) 0)`}}><div><Layers size={22}/><span>AI</span></div></div><footer>Page-level implementation cues · not a ranking</footer></section><section className="metric-card"><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><span className="metric-label">AI mention rate</span><MiniRing value={detail.visibility.mentionRate} color="#4f6ef7"/></div><div className="metric-number">{detail.visibility.mentionRate===null?'—':detail.visibility.mentionRate+'%'}</div><p>{detail.visibility.sample?`${detail.visibility.sample} observations`:'Not measured'}</p><button className="text-button" onClick={()=>{setTab('Observations')}}>Review observations</button></section><section className="metric-card"><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><span className="metric-label">Client citation rate</span><MiniRing value={detail.visibility.citationRate} color="#10b981"/></div><div className="metric-number">{detail.visibility.citationRate===null?'—':detail.visibility.citationRate+'%'}</div><p>{detail.visibility.sample?'Matched to client domain':'No engine evidence yet'}</p><span className="muted">Observed sample only</span></section><section className="metric-card"><span className="metric-label">Implementation gaps</span><div className="metric-number">{audit?opportunities.length:'—'}</div><p>{audit?'Assessed areas with missing cues':'Establish a baseline'}</p><span className="muted">{detail.queries.length} candidate prompts</span></section></div>
 <div className="content-grid"><div>{audit?<OverviewCharts audit={audit} onScoreView={setScoreView}/>:<section className="panel"><div className="panel-heading"><div><h2>Readiness breakdown</h2><p>Import HTML to assess the first page.</p></div><SlidersHorizontal size={19}/></div><div className="empty"><FileText size={30}/><p>No evidence imported.</p><button className="primary" onClick={()=>open('audit')}>Import page</button></div></section>}</div>
 <section className="panel opportunities"><div className="panel-heading"><div><h2>Priority actions</h2><p>Ordered by weighted implementation gap.</p></div><span className="count">{opportunities.length}</span></div>{opportunities.length?opportunities.map((d,i)=><details key={d.id} open={i===0}><summary><span className="action-number">{String(i+1).padStart(2,'0')}</span><span>{d.name}<small>{d.weight*(100-d.score!)/100} weighted points unfulfilled</small></span><ChevronDown size={16}/></summary><p>{d.action}</p><div className="evidence"><span>EVIDENCE</span>{d.evidence}</div></details>):<div className="empty"><p>{audit?'No missing cues in assessed dimensions. Review unassessed areas next.':'Your action plan will appear after the first audit.'}</p></div>}</section></div>
 <section className="panel history"><div className="panel-heading"><div><h2>Evidence ledger</h2><p>Track score improvements over time. Click any row to see the full dimension breakdown.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{!isDemo&&detail.audits[0]&&<button className="primary" onClick={async()=>{setBusy(true);try{const r=await fetch('/api/v1/report',{method:'POST',headers:{'Content-Type':'application/json','Origin':window.location.origin},body:JSON.stringify({clientId:c.id,auditId:detail.audits[0].id})});if(!r.ok)throw new Error((await r.json() as {error?:string}).error||'Export failed');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`geo-report-${c.name.toLowerCase().replace(/\s+/g,'-')}.html`;a.click();URL.revokeObjectURL(a.href);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>&#8681; Export full report</button>}{!isDemo&&detail.audits[0]&&<button className="secondary" onClick={async()=>{setBusy(true);try{const r=await fetch('/api/v1/report',{method:'POST',headers:{'Content-Type':'application/json','Origin':window.location.origin},body:JSON.stringify({clientId:c.id,auditId:detail.audits[0].id})});if(!r.ok)throw new Error((await r.json() as {error?:string}).error||'Export failed');const b=await r.blob();const u=URL.createObjectURL(b);window.open(u,'_blank');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><FileText size={15}/>Print to PDF</button>}<button className="secondary" onClick={()=>download(detail,`geo-${c.name.toLowerCase()}-report.json`)}><Download size={16}/>Export JSON</button></div></div>
 {detail.audits.length?<AuditLedger audits={detail.audits} clientId={c.id} onDeleted={async()=>{setDetail(await api<Detail>('clients/'+c.id));setNotice('Audit deleted.')}}/>:<div className="empty">No audits yet.</div>}
 </section>
 {detail.audits.length>=2&&<ScoreTrendChart audits={detail.audits}/>}
 </>}
 {tab==='Dashboard'&&<DashboardPanel clients={clients} onSelect={(id)=>{select(id);setTab('Overview')}}/>}
 {tab==='Site Crawler'&&<SiteCrawlerPanel clients={clients} busy={busy} onBusy={setBusy}/>}
 {tab==='Findings'&&(isDemo?<div className="panel"><div className="banner">Create a real client and save a scan to generate findings.</div></div>:<FindingsPanel client={c} busy={busy} onBusy={setBusy} onRetested={async()=>{setDetail(await api<Detail>('clients/'+c.id));setNotice('Retest complete. Overview updated.');}}/>)}
 {tab==='Analytics'&&<AnalyticsPanel client={c} audits={detail.audits} busy={busy} onBusy={setBusy}/>}
 {tab==='CMS'&&<CmsPanel client={c} busy={busy} onBusy={setBusy}/>}
 {tab==='AI Monitor'&&(isDemo?<div className="panel"><div className="banner">Create a real client first to run AI monitoring.</div></div>:<AiMonitorPanel client={c} providers={providers} busy={busy} onBusy={setBusy}/>)}
 {tab==='Schedules'&&(isDemo?<div className="panel"><div className="banner">Create a real client first to configure schedules.</div></div>:<ProbeSchedulePanel client={c} providers={providers} queries={detail.queries} busy={busy} onBusy={setBusy}/>)}
 {tab==='Alerts'&&(isDemo?<div className="panel"><div className="banner">Create a real client first to configure alerts.</div></div>:<AlertsPanel client={c} busy={busy} onBusy={setBusy}/>)}
 {tab==='AI Visibility'&&(isDemo?<div className="panel"><div className="banner">Create a real client first to run AI visibility probes.</div></div>:<AIVisibilityPanel client={c} busy={busy} onBusy={setBusy} availableProviders={providers} queuedPrompts={queuedProbePrompts} onQueuedConsumed={()=>setQueuedProbePrompts([])}/>)}
 {tab==='Competitors'&&<CompetitorPanel client={c} busy={busy} onBusy={setBusy}/>}
 {tab==='Benchmark'&&<BenchmarkPanel client={c} busy={busy} onBusy={setBusy}/>}
 {tab==='Progress'&&<ProgressPanel audits={detail.audits}/>}
 {tab==='Smart Prompts'&&<SmartPromptsPanel client={c} audits={detail.audits} providers={providers} busy={busy} onBusy={setBusy} onRunPrompt={(p)=>{setQueuedProbePrompts([p]);setTab('AI Visibility')}}/>}
  {tab==='Content Brief'&&<ContentBriefPanel client={c} audits={detail.audits} providers={providers} busy={busy} onBusy={setBusy}/>}
 {tab==='Action Plan'&&<ActionPlanPanel client={c} audits={detail.audits}/>}
 {tab==='Executive Summary'&&<ExecSummaryPanel client={c} audits={detail.audits} observations={detail.observations}/>}
 {tab==='Query universe'&&<><section className="panel"><div className="panel-heading"><div><h2>{detail.queries.length} auto-generated questions</h2><p>Generated from products, market and competitors. Validate relevance before measurement.</p></div><button className="secondary" onClick={()=>download(detail.queries,'geo-query-universe.json')}><Download size={16}/>Export prompts</button></div><table><thead><tr><th>Intent</th><th>Prompt</th><th>Execution</th></tr></thead><tbody>{detail.queries.map((q,i)=><tr key={i}><td><span className="intent">{q.intent}</span></td><td>{q.prompt}</td><td><button className="text-button" disabled={busy||isDemo} onClick={()=>{setObservationPrompt(q.prompt);setTab('Observations')}}>{detail.observations.some(o=>o.prompt===q.prompt)?'Run again':'Run query'}</button></td></tr>)}</tbody></table></section>
 <section className="panel"><div className="panel-heading"><div><h2>Custom prompts</h2><p>Saved custom prompts are combined with auto-generated queries when running probes</p></div><div style={{display:'flex',gap:8}}>{customPromptsDirty&&!isDemo&&<button className="primary" style={{height:36,paddingRight:12}} disabled={busy} onClick={async()=>{setBusy(true);try{await api(`clients/${c.id}/prompts`,customPrompts);setCustomPromptsDirty(false);setNotice('Custom prompts saved.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Download size={14}/>Save</button>}<button className="secondary" style={{height:36}} disabled={isDemo} onClick={()=>{setCustomPrompts(p=>[...p,'']);setCustomPromptsDirty(true);}}><Plus size={14}/>Add prompt</button></div></div>
 {customPrompts.length===0?<div className="empty" style={{padding:24}}><p>No custom prompts saved for this client yet.</p></div>:<div style={{padding:'8px 0'}}>{customPrompts.map((p,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 24px',borderBottom:'1px solid var(--border-subtle)'}}><input value={p} onChange={e=>{const cp=[...customPrompts];cp[i]=e.target.value;setCustomPrompts(cp);setCustomPromptsDirty(true);}} style={{flex:1,height:34,padding:'0 10px',border:'none',borderBottom:'1px solid var(--border-subtle)',background:'var(--layer-01)',fontSize:'.875rem',color:'var(--text-primary)',borderRadius:0}}/><button className="text-button" style={{color:'var(--score-danger)',flexShrink:0}} onClick={()=>{setCustomPrompts(cp=>cp.filter((_,j)=>j!==i));setCustomPromptsDirty(true);}}><X size={14}/></button></div>)}</div>}
 </section></>}
 {tab==='Scanner'&&<ScannerPanel clients={clients} busy={busy} onBusy={setBusy} onSaved={async(id)=>{setDetail(await api<Detail>('clients/'+id));setNotice('Scan saved. Overview updated.')}}/>}
 {tab==='Observations'&&<>{csvWizardOpen?<section className="panel"><div className="panel-heading"><div><h2>Import CSV observations</h2><p>Bulk-import observations from a CSV file</p></div><button className="secondary" onClick={()=>setCsvWizardOpen(false)}><X size={15}/>Close</button></div><CsvImportWizard client={c} onDone={async()=>{setCsvWizardOpen(false);setDetail(await api<Detail>('clients/'+c.id));setNotice('CSV observations imported.')}} onCancel={()=>setCsvWizardOpen(false)}/></section>:<><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="secondary" onClick={()=>setCsvWizardOpen(true)} disabled={isDemo}><Upload size={15}/>Import CSV</button></div><ObservationPanel client={c} queries={detail.queries} observations={detail.observations} initialPrompt={observationPrompt} busy={busy} onBusy={setBusy} onImport={()=>open('observation')} onSaved={async()=>{setDetail(await api<Detail>('clients/'+c.id))}}/></>}</> }
 {tab==='Integrations'&&<>
 <div className="banner" style={{marginBottom:20}}>Configure AI providers in the server <code>.env</code> file. Add <code>OPENAI_API_KEY</code> and/or <code>GEMINI_API_KEY</code> to enable the AI Visibility Probe tab.</div>
 <div className="integration-grid">
   {INTEGRATIONS.map(card=>{
     const Icon=card.icon;
     const stateClass='state '+(card.state==='Available'?'state-available':'state-planned');
     return (
       <div key={card.title} className="integration-card">
         <div className="integration-card-header">
           <div className="integration-card-icon" style={{background:card.iconBg,color:card.iconColor}}>
             <Icon size={18}/>
           </div>
           <div className="integration-card-title">
             <h3>{card.title}</h3>
             <span className={stateClass}>{card.state}</span>
           </div>
         </div>
         <div className="integration-card-body">
           <p>{card.text}</p>
           <ul>
             {card.items.map((it,i)=>(
               <li key={i} className={it.done?'implemented':'planned'}>{it.label}{it.done?'':' — planned'}</li>
             ))}
           </ul>
         </div>
       </div>
     );
   })}
 </div>
 </> }
 {tab==='Architecture'&&<><section className="architecture-intro"><span className="phase">MODULAR MONOLITH FIRST</span><h2>Keep the domain stable.<br/>Replace what surrounds it.</h2><p>The first deployment runs together. Collection and evaluation can become independent workers without moving business rules into vendor integrations.</p></section><div className="content-grid architecture-grid"><section className="panel architecture-map">{layers.map((l,i)=><button key={l.name} className={selectedLayer===i?'layer selected':'layer'} onClick={()=>setSelectedLayer(i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{l.name}</strong><small>{l.status}</small></button>)}<p>Dependencies point inward to contracts and domain rules.</p></section><section className="panel layer-detail"><Network size={27}/><h2>{layers[selectedLayer].name}</h2><span className="chip">{layers[selectedLayer].status}</span><p>{layers[selectedLayer].text}</p><div className="evidence"><span>SCALING SEQUENCE</span>1. Evidence and scoring baseline<br/>2. Queued crawl + provider sampling<br/>3. Tenant teams + connector approvals<br/>4. Isolate busy services using measured load</div></section></div><section className="panel guardrails"><h2>Foundation decisions</h2><div><p><Shield size={19}/><span><strong>Identity-scoped records</strong>Every read and write is scoped to the signed-in user. Organization roles come later.</span></p><p><FileText size={19}/><span><strong>Versioned evidence</strong>Audit history retains source hashes and rubric versions. Raw HTML is discarded after analysis.</span></p><p><Layers size={19}/><span><strong>Vendor-neutral contracts</strong>Provider and CMS SDKs belong in adapters. A connector is an implementation, not a change to the core.</span></p></div></section></>}
 {tab==='Roadmap'&&<RoadmapPanel/>}
 {tab==='Users'&&isAdminUser&&<UserAdminPanel clients={clients}/>}
 </>}<footer className="footer"><span>AI Search Intelligence <span>·</span> v0.3.0</span><span>{isDemo?'Sample data. No live client claims.':'No ranking guarantees. Evidence-based assessment.'}</span></footer></main></div>
 <dialog ref={dialog} onCancel={e=>{if(busy)e.preventDefault();else setModal(null)}}><form onSubmit={submit}><div className="modal-heading"><h2>{modal==='identity'?'Edit client identity':modal==='client'?'Create a client':modal==='audit'?'Import page evidence':'Import AI observations'}</h2><button type="button" aria-label="Close dialog" onClick={()=>setModal(null)} disabled={busy}><X size={21}/></button></div>{modal==='identity'?<><p className="muted">Use the public brand name and verified aliases. Saved answers are re-evaluated using this identity. Historical audit scores stay unchanged.</p><label>Brand name<input name="name" required minLength={2} maxLength={100} defaultValue={c.name}/></label><label>Brand aliases <small>Comma separated · up to 10</small><input name="brandAliases" defaultValue={(c.brandAliases||[]).join(', ')} placeholder="WFG, WorldFinancialgroup"/></label><small>Website: {c.domain}. This update preserves your client ID, audits and observations.</small></>:modal==='client'?<><label>Brand name<input name="name" required minLength={2} maxLength={100} placeholder="Client or brand name"/></label><label>Website URL<input name="domain" required type="url" placeholder="https://client.com"/></label><div className="form-grid"><label>Industry<input name="industry" required minLength={2} maxLength={120} placeholder="Enterprise software"/></label><label>Target market<input name="market" required defaultValue="United States" minLength={2} maxLength={100}/></label></div><label>Products or services <small>Comma separated · up to 10</small><input name="products" placeholder="Enterprise CMS, Digital asset management"/></label><label>Competitor brands <small>Comma separated · up to 5</small><input name="competitors" placeholder="Competitor one, Competitor two"/></label></>:modal==='audit'?<><p className="muted">Paste exported or rendered HTML. This audits one page; live crawler access and site-wide authority remain unassessed.</p><label>Original page URL<input required type="url" value={pageUrl} onChange={e=>setPageUrl(e.target.value)}/></label><label>HTML evidence<textarea required minLength={20} maxLength={250000} value={html} onChange={e=>setHtml(e.target.value)} placeholder="Paste page HTML…" rows={10}/></label><label className="file-label"><Upload size={16}/>Or choose an HTML file<input type="file" accept=".html,.htm,text/html" onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>250000){setError('HTML file exceeds 250 KB.');return}setHtml(await f.text())}}}/></label><small>HTML is analyzed as text and never rendered. Only findings and its SHA-256 hash are stored.</small></>:<><p className="muted">JSON array, up to 20 observations per import. Required fields: engine, surface, model, prompt, response, citations (URL array), observedAt (ISO timestamp).</p><textarea aria-label="Observation JSON" required value={json} onChange={e=>setJson(e.target.value)} rows={13} placeholder='[{"engine":"…","surface":"…","model":"…","prompt":"…","response":"…","citations":[],"observedAt":"…"}]'/><button className="text-button" type="button" onClick={()=>setJson(JSON.stringify([{engine:'Your provider',surface:'API',model:'Exact model',prompt:'The original question',response:'The original response',citations:[],observedAt:new Date().toISOString()}],null,2))}>Insert template</button></>}{error&&<div className="error" role="alert">{error}</div>}<div className="modal-footer"><button type="button" className="secondary" onClick={()=>setModal(null)} disabled={busy}>Cancel</button><button className="primary" disabled={busy||auth}>{busy?'Saving…':modal==='identity'?'Save identity':modal==='client'?'Create client':modal==='audit'?'Analyze & save':'Import & save'}</button></div></form></dialog>
 </div>
}
