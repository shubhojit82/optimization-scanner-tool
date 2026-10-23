"use client";
import {useEffect,useState} from 'react';
import type {CSSProperties} from 'react';
import {Users,UserCheck,Clock,Check,X,Mail,Copy,Shield,Plus,Send,Inbox} from 'lucide-react';
import type {AppUser,AccessRequest,Client,InviteResult,MailMode,UserRole} from '../src/core/contracts';
import {api,patch} from './workbench-api';

type Overview={users:AppUser[];requests:AccessRequest[];emailEnabled:boolean;mailMode:MailMode;superAdmin:boolean};
type Captured={id:string;to:string;subject:string;text:string;html?:string;created:string};
const BLUE='#4f6ef7',BORDER='#e4e6ef',INK='#1a1d2e',MUTED='#6b7194';
const ROLE_HELP:Record<UserRole,string>={admin:'Manages users and sees every client',member:'Works on the clients assigned to them',viewer:'Read-only access to assigned clients'};

const input:CSSProperties={width:'100%',boxSizing:'border-box',border:'1.5px solid '+BORDER,borderRadius:8,padding:'8px 12px',fontSize:13,background:'#fafafa',color:INK,outline:'none',fontFamily:'inherit'};
const select:CSSProperties={...input,appearance:'none',WebkitAppearance:'none',cursor:'pointer',paddingRight:32,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7194' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center'};
const focus=(e:{currentTarget:HTMLElement},on:boolean)=>{e.currentTarget.style.borderColor=on?BLUE:BORDER};
const card:CSSProperties={background:'#fff',border:'1px solid '+BORDER,borderRadius:10,padding:18};
const when=(iso?:string)=>iso?new Date(iso).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Never';

function Pill({text,color,bg}:{text:string;color:string;bg:string}){return <span style={{fontSize:11,fontWeight:700,color,background:bg,borderRadius:999,padding:'2px 9px',textTransform:'capitalize'}}>{text}</span>}
function ClientPicker({clients,value,onChange}:{clients:Client[];value:string[];onChange:(v:string[])=>void}){
 if(!clients.length)return <p style={{margin:0,fontSize:12,color:MUTED}}>No clients exist yet. Users can create their own, and you can grant access later.</p>;
 return <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{clients.map(c=>{const on=value.includes(c.id);return <button key={c.id} type="button" onClick={()=>onChange(on?value.filter(x=>x!==c.id):[...value,c.id])} aria-pressed={on} style={{border:'1.5px solid '+(on?BLUE:BORDER),background:on?'#eef2ff':'#fff',color:on?BLUE:INK,borderRadius:999,padding:'4px 11px',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>{on&&<Check size={12}/>}{c.name}</button>})}</div>;
}
function InviteBanner({invite,onClose}:{invite:InviteResult;onClose:()=>void}){
 const [copied,setCopied]=useState(false);
 return <div role="status" style={{...card,borderColor:'#bcd0ff',background:'#f3f7ff',marginBottom:14}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong style={{color:INK,fontSize:14}}>{invite.mail==='sent'?`Invitation emailed to ${invite.user.email}`:invite.mail==='captured'?`Invitation saved to the local outbox for ${invite.user.email}`:`Invitation created for ${invite.user.email}`}</strong><button aria-label="Dismiss" onClick={onClose} style={{border:'none',background:'transparent',cursor:'pointer',color:MUTED}}><X size={16}/></button></div>
  {invite.mail!=='sent'&&<p style={{margin:'6px 0',fontSize:12.5,color:'#7a4b00'}}>{invite.mail==='captured'?'Local mail mode: nothing was sent. Open the Email tab to read it, or copy this link.':invite.mail==='failed'?'The email could not be delivered. Check the Email tab, then send this link to the user yourself.':'Email is off on this server (GEO_MAIL_MODE). Send this link to the user yourself.'} The link works once and expires in 7 days.</p>}
  <div style={{display:'flex',gap:8,marginTop:6}}><input readOnly value={invite.inviteUrl} onFocus={e=>e.currentTarget.select()} style={{...input,fontFamily:'ui-monospace,monospace',fontSize:12}}/><button className="secondary" onClick={()=>{navigator.clipboard?.writeText(invite.inviteUrl);setCopied(true);setTimeout(()=>setCopied(false),1500)}}><Copy size={14}/>{copied?'Copied':'Copy'}</button></div>
 </div>;
}

function RequestCard({r,clients,canAdmin,onDone}:{r:AccessRequest;clients:Client[];canAdmin:boolean;onDone:(invite?:InviteResult)=>void}){
 const [role,setRole]=useState<UserRole>('member'),[ids,setIds]=useState<string[]>([]),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function decide(decision:'approve'|'reject'){setBusy(true);setError('');try{const out=await api<{invite?:InviteResult}>(`admin/access-requests/${r.id}/decision`,{decision,role:decision==='approve'?role:undefined,clientIds:decision==='approve'&&ids.length?ids:undefined,note:note||undefined});onDone(out.invite)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div style={{...card,borderLeft:'4px solid #f5a524'}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
   <div><strong style={{fontSize:15,color:INK}}>{r.name}</strong><div style={{fontSize:12.5,color:MUTED}}>{r.email} · {r.company} · {r.role}</div></div>
   <span style={{fontSize:12,color:MUTED}}>{when(r.created)}</span>
  </div>
  <p style={{margin:'10px 0',fontSize:13,color:INK,background:'#f7f8fc',borderRadius:8,padding:'8px 12px',lineHeight:1.5}}>{r.reason}</p>
  <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:12,alignItems:'start'}}>
   <div><label style={{fontSize:12,fontWeight:600,color:MUTED}}>Role</label><select value={role} onChange={e=>setRole(e.target.value as UserRole)} style={select} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}><option value="member">Member</option><option value="viewer">Viewer</option>{canAdmin&&<option value="admin">Administrator</option>}</select></div>
   <div><label style={{fontSize:12,fontWeight:600,color:MUTED,display:'block',marginBottom:4}}>Clients this user can access</label><ClientPicker clients={clients} value={ids} onChange={setIds}/></div>
  </div>
  <input placeholder="Optional note (included in the rejection email)" value={note} onChange={e=>setNote(e.target.value)} style={{...input,marginTop:10}} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/>
  <div style={{display:'flex',gap:8,marginTop:10}}>
   <button className="primary" disabled={busy} onClick={()=>decide('approve')}><Check size={15}/>Approve and invite</button>
   <button className="secondary danger" disabled={busy} onClick={()=>decide('reject')}><X size={15}/>Reject</button>
  </div>
  {error&&<div className="error" role="alert" style={{marginTop:8}}>{error}</div>}
 </div>;
}

function UserRow({u,clients,canAdmin,onChanged,onInvite}:{u:AppUser;clients:Client[];canAdmin:boolean;onChanged:()=>void;onInvite:(i:InviteResult)=>void}){
 const [open,setOpen]=useState(false),[ids,setIds]=useState(u.clientIds),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setIds(u.clientIds),[u.clientIds.join(',')]);
 const locked=!canAdmin&&u.role==='admin';
 async function run(fn:()=>Promise<unknown>){setBusy(true);setError('');try{await fn();onChanged()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div style={{...card,padding:'12px 16px'}}>
  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
   <div style={{flex:1,minWidth:200}}><strong style={{color:INK,fontSize:14}}>{u.name}</strong><div style={{fontSize:12.5,color:MUTED}}>{u.email}</div></div>
   <Pill text={u.role} color={u.role==='admin'?'#7c3aed':u.role==='viewer'?'#6b7194':BLUE} bg={u.role==='admin'?'#f3e8ff':u.role==='viewer'?'#eef0f6':'#eef2ff'}/>
   <Pill text={u.status==='disabled'?'Disabled':u.passwordSet?'Active':'Invite pending'} color={u.status==='disabled'?'#a31515':u.passwordSet?'#14804a':'#8a5a00'} bg={u.status==='disabled'?'#fdeaea':u.passwordSet?'#e5f7ec':'#fff4d6'}/>
   <span style={{fontSize:12,color:MUTED,minWidth:120}}>Last sign-in: {when(u.lastLogin)}</span>
   {!locked&&<button className="secondary" onClick={()=>setOpen(v=>!v)}>{open?'Close':'Manage'}</button>}
  </div>
  {open&&!locked&&<div style={{marginTop:12,paddingTop:12,borderTop:'1px solid '+BORDER}}>
   <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:14,alignItems:'start'}}>
    <div><label style={{fontSize:12,fontWeight:600,color:MUTED}}>Role</label>
     <select value={u.role} disabled={busy} onChange={e=>run(()=>patch(`admin/users/${u.id}`,{role:e.target.value}))} style={select} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}><option value="member">Member</option><option value="viewer">Viewer</option>{canAdmin&&<option value="admin">Administrator</option>}</select>
     <p style={{fontSize:11.5,color:MUTED,margin:'4px 0 0'}}>{ROLE_HELP[u.role]}</p></div>
    <div><label style={{fontSize:12,fontWeight:600,color:MUTED,display:'block',marginBottom:4}}>Clients this user can access{u.role==='admin'?' (administrators see all)':''}</label>
     <ClientPicker clients={clients} value={ids} onChange={setIds}/>
     <button className="primary" style={{marginTop:8}} disabled={busy||u.role==='admin'} onClick={()=>run(()=>patch(`admin/users/${u.id}`,{clientIds:ids}))}>Save access</button></div>
   </div>
   <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
    {!u.passwordSet&&<button className="secondary" disabled={busy} onClick={()=>run(async()=>onInvite(await api<InviteResult>(`admin/users/${u.id}/invite`,{})))}><Send size={14}/>Send a new invitation</button>}
    {u.passwordSet&&<button className="secondary" disabled={busy} onClick={()=>run(async()=>onInvite(await api<InviteResult>(`admin/users/${u.id}/invite`,{})))}><Mail size={14}/>Send password reset link</button>}
    <button className={u.status==='active'?'secondary danger':'secondary'} disabled={busy} onClick={()=>run(()=>patch(`admin/users/${u.id}`,{status:u.status==='active'?'disabled':'active'}))}>{u.status==='active'?'Disable account':'Re-enable account'}</button>
   </div>
  </div>}
  {error&&<div className="error" role="alert" style={{marginTop:8}}>{error}</div>}
 </div>;
}

function AddUser({clients,canAdmin,onCreated}:{clients:Client[];canAdmin:boolean;onCreated:(i:InviteResult)=>void}){
 const [f,setF]=useState({name:'',email:'',role:'member' as UserRole}),[ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function add(){setBusy(true);setError('');try{onCreated(await api<InviteResult>('admin/users',{...f,clientIds:ids}));setF({name:'',email:'',role:'member'});setIds([])}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div style={card}>
  <h3 style={{margin:'0 0 10px',fontSize:15,color:INK}}>Add a user</h3>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 160px',gap:10}}>
   <input placeholder="Full name" value={f.name} onChange={e=>setF({...f,name:e.target.value})} style={input} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/>
   <input placeholder="Work email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} style={input} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/>
   <select value={f.role} onChange={e=>setF({...f,role:e.target.value as UserRole})} style={select} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}><option value="member">Member</option><option value="viewer">Viewer</option>{canAdmin&&<option value="admin">Administrator</option>}</select>
  </div>
  <label style={{fontSize:12,fontWeight:600,color:MUTED,display:'block',margin:'10px 0 4px'}}>Clients this user can access</label>
  <ClientPicker clients={clients} value={ids} onChange={setIds}/>
  <button className="primary" style={{marginTop:12}} disabled={busy||!f.name||!f.email} onClick={add}><Plus size={15}/>Add and send invitation</button>
  {error&&<div className="error" role="alert" style={{marginTop:8}}>{error}</div>}
 </div>;
}

function EmailTab({mode}:{mode:MailMode}){
 const [msgs,setMsgs]=useState<Captured[]>([]),[open,setOpen]=useState(''),[to,setTo]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<{ok:boolean;message:string}|null>(null);
 const load=()=>{if(mode==='local')api<{messages:Captured[]}>('admin/outbox').then(d=>setMsgs(d.messages)).catch(()=>{})};
 useEffect(()=>{load()},[mode]);
 async function test(){setBusy(true);setResult(null);try{const r=await api<{ok:boolean;message:string}>('admin/mail/test',to?{to}:{});setResult(r);load()}catch(e){setResult({ok:false,message:(e as Error).message})}finally{setBusy(false)}}
 const label=mode==='smtp'?'SMTP: real emails are sent':mode==='local'?'Local: emails are saved here, not sent':'Off: no emails are sent';
 const hint=mode==='smtp'?'Set by GEO_MAIL_MODE=smtp with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.':mode==='local'?'Set by GEO_MAIL_MODE=local. Switch to GEO_MAIL_MODE=smtp and restart to send real mail.':'Set GEO_MAIL_MODE=local to try it on your machine, or smtp to send real mail, then restart.';
 return <div style={{display:'grid',gap:14}}>
  <div style={card}>
   <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><Pill text={mode} color={mode==='smtp'?'#14804a':mode==='local'?BLUE:'#8a5a00'} bg={mode==='smtp'?'#e5f7ec':mode==='local'?'#eef2ff':'#fff4d6'}/><strong style={{color:INK,fontSize:14}}>{label}</strong></div>
   <p style={{margin:'6px 0 12px',fontSize:12.5,color:MUTED}}>{hint}</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <input placeholder="Send the test to (blank = your address)" value={to} onChange={e=>setTo(e.target.value)} style={{...input,maxWidth:320}} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/>
    <button className="primary" disabled={busy||mode==='off'} onClick={test}><Send size={14}/>{busy?'Testing...':mode==='smtp'?'Check connection and send test':'Send test email'}</button>
   </div>
   {result&&<div role="status" style={{marginTop:10,fontSize:13,color:result.ok?'#14804a':'#a31515',background:result.ok?'#e5f7ec':'#fdeaea',borderRadius:8,padding:'8px 12px'}}>{result.message}</div>}
  </div>
  {mode==='local'&&<div style={card}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><h3 style={{margin:0,fontSize:15,color:INK}}>Local outbox</h3><button className="secondary" onClick={load}>Refresh</button></div>
   {!msgs.length&&<div style={{textAlign:'center',color:MUTED,padding:'22px 0'}}><Inbox size={26} style={{color:'#b4bbd8'}}/><p style={{margin:'8px 0 0',fontSize:13.5}}>No emails yet. Add a user or approve a request and the message appears here.</p></div>}
   {msgs.map(m=><div key={m.id} style={{borderTop:'1px solid #f0f1f7',padding:'9px 0'}}>
    <button onClick={()=>setOpen(open===m.id?'':m.id)} style={{display:'flex',width:'100%',gap:10,textAlign:'left',border:'none',background:'transparent',cursor:'pointer',padding:0,alignItems:'baseline',flexWrap:'wrap'}}><strong style={{fontSize:13.5,color:INK}}>{m.subject}</strong><span style={{fontSize:12.5,color:MUTED,flex:1}}>to {m.to}</span><span style={{fontSize:12,color:MUTED}}>{when(m.created)}</span></button>
    {open===m.id&&(m.html?<iframe title={m.subject} sandbox="" srcDoc={m.html} style={{width:'100%',height:560,border:'1px solid '+BORDER,borderRadius:8,marginTop:8,background:'#f1f3fb'}}/>:<pre style={{margin:'8px 0 0',whiteSpace:'pre-wrap',wordBreak:'break-word',background:'#f7f8fc',borderRadius:8,padding:'10px 12px',fontSize:12.5,color:INK,fontFamily:'inherit',lineHeight:1.5}}>{m.text}</pre>)}
   </div>)}
  </div>}
 </div>;
}

export function UserAdminPanel({clients}:{clients:Client[]}){
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[invite,setInvite]=useState<InviteResult|null>(null),[tab,setTab]=useState<'requests'|'users'|'email'>('requests');
 const load=()=>api<Overview>('admin/overview').then(d=>{setData(d);setError('')}).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 if(error)return <div className="error" role="alert">{error}</div>;
 if(!data)return <div className="panel loading" role="status">Loading users...</div>;
 const pending=data.requests.filter(r=>r.status==='pending'),decided=data.requests.filter(r=>r.status!=='pending');
 const tabBtn=(k:'requests'|'users'|'email',label:string,count:number,icon:React.ReactNode)=><button onClick={()=>setTab(k)} style={{display:'flex',alignItems:'center',gap:7,border:'none',background:'transparent',padding:'10px 4px',marginRight:20,fontSize:14,fontWeight:700,color:tab===k?BLUE:MUTED,borderBottom:'2px solid '+(tab===k?BLUE:'transparent'),cursor:'pointer'}}>{icon}{label}{count>=0&&<span style={{background:tab===k?'#eef2ff':'#eef0f6',color:tab===k?BLUE:MUTED,borderRadius:999,fontSize:11,padding:'1px 8px'}}>{count}</span>}</button>;
 return <div style={{display:'grid',gap:14}}>
  {data.mailMode==='off'&&<div style={{display:'flex',gap:8,background:'#fff8e6',border:'1px solid #ffe2a0',borderRadius:8,padding:'9px 12px',fontSize:12.5,color:'#7a4b00'}}><Mail size={15} style={{flexShrink:0,marginTop:1}}/>Email is off (GEO_MAIL_MODE). Invitation links are shown here for you to send manually. Open the Email tab for options.</div>}
  {data.mailMode==='local'&&<div style={{display:'flex',gap:8,background:'#f0f5ff',border:'1px solid #d6e2ff',borderRadius:8,padding:'9px 12px',fontSize:12.5,color:'#2a3a7a'}}><Inbox size={15} style={{flexShrink:0,marginTop:1}}/>Local mail mode: emails are saved to the Email tab and not delivered to anyone.</div>}
  {invite&&<InviteBanner invite={invite} onClose={()=>setInvite(null)}/>}
  <div style={{borderBottom:'1px solid '+BORDER,display:'flex'}}>{tabBtn('requests','Access requests',pending.length,<Clock size={15}/>)}{tabBtn('users','Users',data.users.length,<Users size={15}/>)}{tabBtn('email','Email',-1,<Mail size={15}/>)}</div>
  {tab==='requests'&&<>
   {!pending.length&&<div style={{...card,textAlign:'center',color:MUTED,padding:'28px 18px'}}><UserCheck size={28} style={{color:'#b4bbd8'}}/><p style={{margin:'8px 0 0',fontSize:14}}>No requests waiting for review.</p></div>}
   {pending.map(r=><RequestCard key={r.id} r={r} clients={clients} canAdmin={data.superAdmin} onDone={i=>{if(i)setInvite(i);setTab(i?'users':'requests');load()}}/>)}
   {!!decided.length&&<div style={card}><h3 style={{margin:'0 0 8px',fontSize:14,color:INK}}>Decided</h3>{decided.map(r=><div key={r.id} style={{display:'flex',gap:10,alignItems:'center',padding:'7px 0',borderTop:'1px solid #f0f1f7',fontSize:13,flexWrap:'wrap'}}><span style={{flex:1,minWidth:180,color:INK}}>{r.name} <span style={{color:MUTED}}>{r.email}</span></span><Pill text={r.status} color={r.status==='approved'?'#14804a':'#a31515'} bg={r.status==='approved'?'#e5f7ec':'#fdeaea'}/><span style={{fontSize:12,color:MUTED}}>{when(r.decidedAt)} by {r.decidedBy}</span></div>)}</div>}
  </>}
  {tab==='email'&&<EmailTab mode={data.mailMode}/>}
  {tab==='users'&&<>
   <AddUser clients={clients} canAdmin={data.superAdmin} onCreated={i=>{setInvite(i);load()}}/>
   {!data.users.length&&<div style={{...card,textAlign:'center',color:MUTED,padding:'28px 18px'}}><Shield size={28} style={{color:'#b4bbd8'}}/><p style={{margin:'8px 0 0',fontSize:14}}>No users yet. You are signed in as the Super Admin; add people above or approve access requests.</p></div>}
   {data.users.map(u=><UserRow key={u.id} u={u} clients={clients} canAdmin={data.superAdmin} onChanged={load} onInvite={setInvite}/>)}
  </>}
 </div>;
}
