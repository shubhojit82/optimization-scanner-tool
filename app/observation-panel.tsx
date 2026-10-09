import {useEffect, useRef, useState} from 'react';
import {ChevronDown, Globe, Plus, ExternalLink} from 'lucide-react';
import type {Client, Observation, ProviderInfo} from '../src/core/contracts';
import {api} from './workbench-api';
import {Markdown} from './markdown';

function Answer({observation: o}: {observation: Observation}) {
    return <div className="response"><Markdown text={o.response}/></div>;
}

type Props = {client: Client; queries: {intent: string; prompt: string}[]; observations: Observation[];
    initialPrompt: string; busy: boolean; onBusy: (busy: boolean) => void; onImport: () => void; onSaved: () => Promise<void>};

export function ObservationPanel({client, queries, observations, initialPrompt, busy, onBusy, onImport, onSaved}: Props) {
    const attempt = useRef<{prompt:string;provider:string;requestId:string}|null>(null);
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [providerId, setProviderId] = useState('openai');
    const [prompt, setPrompt] = useState(initialPrompt || queries[0]?.prompt || '');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    useEffect(() => {setPrompt(initialPrompt || queries[0]?.prompt || ''); setStatus(''); setError(''); attempt.current=null;}, [client.id, initialPrompt]);
    useEffect(() => {
        let alive = true;
        api<ProviderInfo[]>('providers').then(rows => {if (alive) setProviders(rows);})
            .catch(e => {if (alive) setError(e.message);}).finally(() => {if (alive) setLoading(false);});
        return () => {alive = false;};
    }, []);
    const provider = providers.find(p => p.id === providerId);
    async function run(e: React.FormEvent) {
        e.preventDefault(); onBusy(true); setError(''); setStatus('Searching the web and collecting an answer…');
        try {
            if(!attempt.current || attempt.current.prompt!==prompt || attempt.current.provider!==providerId) attempt.current={prompt,provider:providerId,requestId:crypto.randomUUID()};
            await api<Observation>(`clients/${client.id}/observation-runs`, attempt.current);
            attempt.current=null;
            setStatus('Observation saved. Refreshing the evidence view…');
            try {await onSaved(); setStatus('Observation saved. Expand it below to review the answer and citations.');}
            catch {setError('Observation was saved, but the evidence view could not refresh. Reload the page to see it.'); setStatus('');}
        } catch (e) {setError((e as Error).message); setStatus('');}
        finally {onBusy(false);}
    }
    return <>
        <div className="banner">API web-search results are a distinct sample from consumer ChatGPT or Google AI answers. Each run sends the question and target market to the selected provider.</div>
        <section className="panel observation-runner">
            <div className="panel-heading"><div><h2>Collect an observation</h2><p>Choose one relevant question. Review the answer before running more.</p></div><span className="chip">{loading?'Checking provider…':provider?.configured?'Configured':'Setup required'}</span></div>
            <form onSubmit={run} className="runner-form">
                <div className="form-grid"><label>AI provider<select value={providerId} onChange={e=>setProviderId(e.target.value)} disabled={busy||loading}>{providers.length?providers.map(p=><option key={p.id} value={p.id}>{p.label} · {p.model}</option>):<option value="openai">OpenAI web search</option>}</select></label>
                <label>Start from query universe<select value="" disabled={busy} onChange={e=>setPrompt(e.target.value)}><option value="">Choose a question…</option>{queries.map((q,i)=><option key={i} value={q.prompt}>{q.prompt}</option>)}</select></label></div>
                <label>Question<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} required minLength={5} maxLength={2000} rows={3} disabled={busy}/></label>
                {!loading && !provider?.configured && <div className="provider-setup"><strong>Connect the provider on your server</strong><p>Add your key to the existing <code>.env</code> file in the project root:</p><pre>{'OPENAI_API_KEY=your_api_key\nGEO_OPENAI_MODEL=gpt-4.1'}</pre><p>Stop the app, restart with <code>npm run dev</code>, then reload this page. Keep your key out of Git and chat.</p></div>}
                <div className="runner-actions"><button className="primary" disabled={busy||loading||!provider?.configured||client.id==='demo'}>{busy?'Collecting…':'Run query & save'}</button><span className="muted">Paid API usage · up to 60 seconds · no automatic retries</span></div>
                {client.id==='demo'&&<p className="muted">Select your client to collect real evidence.</p>}
                {status&&<p className="runner-status" role="status">{status}</p>}{error&&<div className="error" role="alert">{error}</div>}
            </form>
        </section>
        <section className="panel">
            <div className="panel-heading"><div><h2>Saved observations</h2><p>Rates describe the latest 200 observations across API runs and imports. Repeat samples count separately. Mentions use the current brand name and configured aliases.</p></div><button className="secondary" disabled={busy} onClick={onImport}><Plus size={16}/>Import observations</button></div>
            {observations.length?observations.map(o=>(
                <details className="observation" key={o.id}>
                    <summary>
                        <div>
                            <span className="intent">{o.engine} · {o.surface}</span>
                            <strong>{o.prompt}</strong>
                            <small>{o.model} · {new Date(o.observedAt).toLocaleString()} · {o.source==='ai-provider'?'API collection':'manual import'}</small>
                        </div>
                        <ChevronDown size={18}/>
                    </summary>
                    <Answer observation={o}/>
                    {o.citations.length>0&&(
                        <div style={{padding:'12px 24px 18px',borderTop:'1px solid #e5e7eb'}}>
                            <div style={{fontSize:'.72rem',fontWeight:700,letterSpacing:'.08em',color:'#8b9aa6',textTransform:'uppercase',marginBottom:8}}>Sources cited ({o.citations.length})</div>
                            <div style={{display:'flex',flexDirection:'column',gap:5}}>
                                {o.citations.map((u,i)=>{
                                    let host='';try{host=new URL(u).hostname.replace(/^www\./,'');}catch{}
                                    return <a key={i} href={u} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'#f4f7fa',borderRadius:6,fontSize:'.82rem',color:'#0d7a6b',textDecoration:'none',border:'1px solid #e0e8ed',overflow:'hidden'}}>
                                        <ExternalLink size={12} style={{flexShrink:0,color:'#57a89a'}}/>
                                        <span style={{fontWeight:600,flexShrink:0,color:'#213f50'}}>{host}</span>
                                        <span style={{color:'#57606a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{u}</span>
                                    </a>;
                                })}
                            </div>
                        </div>
                    )}
                    {o.citations.length===0&&<p style={{padding:'8px 24px 16px',fontSize:'.85rem',color:'#8b9aa6',margin:0}}>No citations were included in this answer.</p>}
                </details>
            )):<div className="empty large"><Globe size={34}/><h3>No observations yet</h3><p>Connect a provider and run your first question above. Mention and citation rates appear after a successful collection.</p></div>}
        </section>
    </>;
}
