"use client";
import {useEffect,useState} from 'react';
import type {CSSProperties,FormEvent,ReactNode} from 'react';
import {Layers,Mail,Lock,Eye,EyeOff,ArrowRight,User,Building2,FileText,Clock,Check,X,Search,Globe,Zap,TriangleAlert,Info,Key} from 'lucide-react';
import type {SessionInfo} from '../src/core/contracts';
import {api} from './workbench-api';

const BLUE='#4f6ef7',BORDER='#e4e6ef',INK='#12152b',MUTED='#6b7194';
const ROLES=['Consultant','Analyst','Marketing lead','Content strategist','Developer','Executive','Other'];

function Field({label,icon,children}:{label:string;icon:ReactNode;children:ReactNode}){
 return <label style={{display:'block',minWidth:0}}><span style={{display:'block',fontSize:13,fontWeight:600,color:INK,marginBottom:6}}>{label}</span><span style={{position:'relative',display:'block'}}><span style={{position:'absolute',left:12,top:11,color:'#9aa0bd',display:'flex',pointerEvents:'none'}}>{icon}</span>{children}</span></label>;
}
const inputStyle:CSSProperties={width:'100%',boxSizing:'border-box',border:'1.5px solid '+BORDER,borderRadius:8,padding:'10px 12px 10px 38px',fontSize:14,background:'#fff',color:INK,outline:'none',fontFamily:'inherit'};
const focus=(e:{currentTarget:HTMLElement},on:boolean)=>{e.currentTarget.style.borderColor=on?BLUE:BORDER};
function selectStyle():CSSProperties{
 return{...inputStyle,appearance:'none',WebkitAppearance:'none',cursor:'pointer',paddingRight:34,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7194' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center'};
}
function Brand({size=22}:{size?:number}){
 return <div style={{display:'flex',alignItems:'center',gap:10}}><span style={{display:'inline-flex',color:BLUE}}><Layers size={size+8}/></span><span style={{fontSize:size,fontWeight:700,color:INK,letterSpacing:'-0.02em'}}>AI Search<span style={{fontWeight:400,color:'#7b809c'}}> Intelligence</span></span></div>;
}
function Primary({children,busy,type='submit'}:{children:ReactNode;busy?:boolean;type?:'submit'|'button'}){
 return <button type={type} disabled={busy} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:busy?'#a4b2fb':BLUE,color:'#fff',border:'none',borderRadius:8,padding:'12px 16px',fontSize:15,fontWeight:600,cursor:busy?'default':'pointer',fontFamily:'inherit'}}>{children}</button>;
}
function ErrorLine({text}:{text:string}){
 return text?<div role="alert" style={{display:'flex',gap:8,alignItems:'flex-start',background:'#fff1f1',border:'1px solid #ffd0d0',color:'#a31515',borderRadius:8,padding:'9px 12px',fontSize:13,marginTop:12}}><TriangleAlert size={15} style={{flexShrink:0,marginTop:1}}/>{text}</div>:null;
}

const FEATURES=[{icon:Search,t:'SEO',d:'Track visibility in AI search'},{icon:FileText,t:'AEO',d:'Measure answer-readiness'},{icon:Globe,t:'GEO',d:'Understand global reach'},{icon:Zap,t:'AI Visibility',d:'Monitor brand mentions'},{icon:TriangleAlert,t:'Findings',d:'Surface opportunities'},{icon:Layers,t:'Competitors',d:'Benchmark your progress'}];

function Showcase(){
 const bars=[34,12,22,48,30,70];
 return <div style={{position:'relative',padding:'48px 56px',display:'flex',flexDirection:'column',gap:28,background:'linear-gradient(160deg,#f4f7ff 0%,#e6edff 100%)',overflow:'hidden',minHeight:'100vh',boxSizing:'border-box'}}>
  <svg aria-hidden="true" width="260" height="200" style={{position:'absolute',right:40,top:150,opacity:0.55}}>{Array.from({length:70}).map((_,i)=><circle key={i} cx={(i%10)*26+6} cy={Math.floor(i/10)*26+6} r="2.2" fill="#b9c6f5"/>)}</svg>
  <svg aria-hidden="true" width="520" height="520" style={{position:'absolute',right:-180,bottom:-200,opacity:0.5}}><circle cx="260" cy="260" r="250" fill="none" stroke="#c9d6ff" strokeWidth="1.5"/><circle cx="260" cy="260" r="190" fill="none" stroke="#d6e0ff" strokeWidth="1.5"/><circle cx="260" cy="260" r="130" fill="#dfe8ff" opacity="0.6"/></svg>
  <div style={{position:'relative'}}><Brand/></div>
  <div style={{position:'relative'}}>
   <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.22em',color:MUTED,marginBottom:14}}>GENERATIVE SEARCH INTELLIGENCE</div>
   <h1 style={{fontSize:52,lineHeight:1.05,margin:0,color:INK,fontWeight:800,letterSpacing:'-0.03em',maxWidth:560}}>Turn AI search signals into action.</h1>
   <p style={{fontSize:18,lineHeight:1.5,color:MUTED,marginTop:18,maxWidth:520}}>Monitor SEO, AEO, GEO, citations, and implementation gaps across AI-driven search experiences.</p>
  </div>
  <div style={{position:'relative',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,maxWidth:640}}>
   {FEATURES.map(f=><div key={f.t} style={{display:'flex',gap:10,alignItems:'center',background:'rgba(255,255,255,0.8)',border:'1px solid #dfe6fb',borderRadius:10,padding:'10px 12px'}}><span style={{width:30,height:30,borderRadius:'50%',background:'#eef2ff',color:BLUE,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><f.icon size={15}/></span><span style={{minWidth:0}}><span style={{display:'block',fontSize:13,fontWeight:700,color:INK}}>{f.t}</span><span style={{display:'block',fontSize:11,color:MUTED,lineHeight:1.3}}>{f.d}</span></span></div>)}
  </div>
  <div style={{position:'relative',background:'#fff',border:'1px solid #dfe6fb',borderRadius:14,padding:18,boxShadow:'0 20px 50px rgba(79,110,247,0.14)',maxWidth:640}}>
   <div style={{fontSize:20,fontWeight:700,color:INK}}>Welcome back</div>
   <div style={{fontSize:12,color:MUTED,marginBottom:14}}>Track performance, uncover opportunities, and improve your presence in AI search.</div>
   <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr 1fr',gap:12}}>
    <div style={{background:'linear-gradient(135deg,#1b2350,#23306b)',borderRadius:10,padding:14,color:'#fff',position:'relative'}}>
     <div style={{fontSize:11,opacity:0.8}}>Assessed Readiness</div>
     <div style={{fontSize:34,fontWeight:800}}>53<span style={{fontSize:14,opacity:0.7}}>/100</span></div>
     <svg width="62" height="62" viewBox="0 0 62 62" style={{position:'absolute',right:12,bottom:12}}><circle cx="31" cy="31" r="25" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7"/><circle cx="31" cy="31" r="25" fill="none" stroke="#6f8bff" strokeWidth="7" strokeDasharray="157" strokeDashoffset="74" strokeLinecap="round" transform="rotate(-90 31 31)"/></svg>
    </div>
    <div style={{border:'1px solid '+BORDER,borderRadius:10,padding:14}}>
     <div style={{fontSize:11,color:MUTED}}>AI Mention Rate</div><div style={{fontSize:30,fontWeight:800,color:INK}}>50%</div>
     <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">{bars.map((b,i)=><rect key={i} x={i*20+3} y={40-b*0.55} width="13" height={b*0.55} rx="2" fill={i>2?BLUE:'#c7d1fb'}/>)}</svg>
    </div>
    <div style={{border:'1px solid '+BORDER,borderRadius:10,padding:14}}>
     <div style={{fontSize:11,color:MUTED}}>Implementation Gaps</div><div style={{fontSize:30,fontWeight:800,color:INK}}>9</div>
     {['Missing brand mentions','Incomplete structured data','Optimize content depth'].map((t,i)=><div key={t} style={{fontSize:11,color:MUTED,display:'flex',gap:6,alignItems:'center',marginTop:3}}><span style={{background:'#eef2ff',color:BLUE,borderRadius:4,padding:'0 5px',fontWeight:700}}>{4-i}</span>{t}</div>)}
    </div>
   </div>
  </div>
 </div>;
}

function Steps(){
 const item=(icon:ReactNode,color:string,bg:string,t:string,d:string)=><div style={{display:'flex',gap:8,alignItems:'flex-start',flex:1,minWidth:0}}><span style={{width:26,height:26,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{icon}</span><span><span style={{display:'block',fontSize:11.5,fontWeight:700,color:INK}}>{t}</span><span style={{display:'block',fontSize:11,color:MUTED,lineHeight:1.3}}>{d}</span></span></div>;
 return <div style={{display:'flex',gap:12,marginTop:18}}>
  {item(<Clock size={14}/>,BLUE,'#eef2ff','Pending review','We will review your request')}
  {item(<Check size={14}/>,'#14804a','#e5f7ec','Approved','You receive an email with a link to set your password')}
  {item(<X size={14}/>,'#c0392b','#fdeaea','Rejected','You will be notified by email')}
 </div>;
}

function SignInForm({onSignedIn}:{onSignedIn:(s:SessionInfo)=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[remember,setRemember]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[forgot,setForgot]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{onSignedIn(await api<SessionInfo>('auth/login',{email,password,remember}))}catch(x){setError((x as Error).message)}finally{setBusy(false)}}
 return <form onSubmit={submit} noValidate>
  <h2 style={{fontSize:26,margin:'0 0 4px',color:INK,letterSpacing:'-0.02em'}}>Sign in to your workspace</h2>
  <p style={{margin:'0 0 18px',color:MUTED,fontSize:14}}>Use your approved work account to continue.</p>
  <div style={{display:'grid',gap:14}}>
   <Field label="Work email" icon={<Mail size={16}/>}><input type="text" autoComplete="username" inputMode="email" placeholder="name@yourcompany.com" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/></Field>
   <Field label="Password" icon={<Lock size={16}/>}>
    <input type={show?'text':'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} style={{...inputStyle,paddingRight:40}} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/>
    <button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)} style={{position:'absolute',right:6,top:5,border:'none',background:'transparent',color:'#7b809c',cursor:'pointer',padding:6,display:'flex'}}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
   </Field>
  </div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'12px 0 16px'}}>
   <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:INK,cursor:'pointer'}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:BLUE,width:15,height:15}}/>Remember me for 30 days</label>
   <button type="button" onClick={()=>setForgot(v=>!v)} style={{border:'none',background:'transparent',color:BLUE,fontWeight:600,fontSize:13,cursor:'pointer',padding:0}}>Forgot password?</button>
  </div>
  {forgot&&<div style={{display:'flex',gap:8,background:'#f0f5ff',border:'1px solid #d6e2ff',borderRadius:8,padding:'9px 12px',fontSize:12.5,color:'#2a3a7a',marginBottom:12}}><Info size={15} style={{flexShrink:0,marginTop:1}}/>Ask your administrator to resend your invitation. The link lets you set a new password.</div>}
  <Primary busy={busy}>{busy?'Signing in...':'Sign in'}{!busy&&<ArrowRight size={16}/>}</Primary>
  <ErrorLine text={error}/>
 </form>;
}

function RequestForm(){
 const [f,setF]=useState({name:'',email:'',company:'',role:'',reason:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState<{email:boolean}|null>(null);
 const set=(k:keyof typeof f)=>(e:{target:{value:string}})=>setF(v=>({...v,[k]:e.target.value}));
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await api<{emailNotifications:boolean}>('auth/request-access',f);setDone({email:r.emailNotifications})}catch(x){setError((x as Error).message)}finally{setBusy(false)}}
 if(done)return <div style={{textAlign:'center',padding:'18px 6px'}}>
  <div style={{width:48,height:48,borderRadius:'50%',background:'#e5f7ec',color:'#14804a',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Check size={24}/></div>
  <h3 style={{margin:'12px 0 4px',color:INK,fontSize:18}}>Request received</h3>
  <p style={{margin:0,color:MUTED,fontSize:13.5,lineHeight:1.5}}>An administrator will review it. {done.email?'You will get an email when it is decided.':'Your administrator will contact you once it is decided.'}</p>
 </div>;
 return <form onSubmit={submit} noValidate>
  <h2 style={{fontSize:24,margin:'0 0 4px',color:INK,letterSpacing:'-0.02em'}}>Request access</h2>
  <p style={{margin:'0 0 16px',color:MUTED,fontSize:14}}>Do not have access yet? Request access to your organization workspace.</p>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
   <Field label="Full name" icon={<User size={16}/>}><input placeholder="Jane Smith" value={f.name} onChange={set('name')} style={inputStyle} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/></Field>
   <Field label="Work email" icon={<Mail size={16}/>}><input placeholder="name@yourcompany.com" inputMode="email" value={f.email} onChange={set('email')} style={inputStyle} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/></Field>
   <Field label="Company" icon={<Building2 size={16}/>}><input placeholder="Your company name" value={f.company} onChange={set('company')} style={inputStyle} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/></Field>
   <Field label="Role" icon={<User size={16}/>}><select value={f.role} onChange={set('role')} style={selectStyle()} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}><option value="">Select your role</option>{ROLES.map(r=><option key={r} value={r}>{r}</option>)}</select></Field>
  </div>
  <div style={{marginTop:12}}><Field label="Reason for access" icon={<FileText size={16}/>}><textarea rows={3} placeholder="Tell us how you plan to use AI Search Intelligence..." value={f.reason} onChange={set('reason')} style={{...inputStyle,resize:'vertical',minHeight:76,lineHeight:1.4}} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/></Field></div>
  <div style={{marginTop:14}}><Primary busy={busy}>{busy?'Sending...':'Submit request'}</Primary></div>
  <ErrorLine text={error}/>
  <p style={{display:'flex',gap:6,justifyContent:'center',alignItems:'center',margin:'12px 0 0',fontSize:12,color:MUTED}}><Info size={13}/>Access requests are reviewed by an administrator.</p>
  <Steps/>
 </form>;
}

function AcceptInvite({token,onSignedIn,onCancel}:{token:string;onSignedIn:(s:SessionInfo)=>void;onCancel:()=>void}){
 const [info,setInfo]=useState<{valid:boolean;email?:string;name?:string}|null>(null),[pw,setPw]=useState(''),[pw2,setPw2]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{api<{valid:boolean;email?:string;name?:string}>('auth/invite?token='+encodeURIComponent(token)).then(setInfo).catch(()=>setInfo({valid:false}))},[token]);
 async function submit(e:FormEvent){e.preventDefault();setError('');if(pw.length<12)return setError('Password must be at least 12 characters');if(pw!==pw2)return setError('The two passwords do not match');setBusy(true);try{onSignedIn(await api<SessionInfo>('auth/accept-invite',{token,password:pw}))}catch(x){setError((x as Error).message)}finally{setBusy(false)}}
 if(!info)return <p style={{color:MUTED}}>Checking your invitation...</p>;
 if(!info.valid)return <div><h2 style={{fontSize:24,margin:'0 0 6px',color:INK}}>Invitation not valid</h2><p style={{color:MUTED,fontSize:14,lineHeight:1.5}}>This link was already used or has expired. Ask your administrator to send a new one.</p><button className="secondary" onClick={onCancel} style={{marginTop:8}}>Back to sign in</button></div>;
 return <form onSubmit={submit} noValidate>
  <h2 style={{fontSize:26,margin:'0 0 4px',color:INK,letterSpacing:'-0.02em'}}>Welcome, {info.name}</h2>
  <p style={{margin:'0 0 18px',color:MUTED,fontSize:14}}>Choose a password for <strong style={{color:INK}}>{info.email}</strong> to activate your account.</p>
  <div style={{display:'grid',gap:14}}>
   <Field label="New password" icon={<Key size={16}/>}><input type={show?'text':'password'} autoComplete="new-password" placeholder="At least 12 characters" value={pw} onChange={e=>setPw(e.target.value)} style={inputStyle} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/></Field>
   <Field label="Confirm password" icon={<Lock size={16}/>}><input type={show?'text':'password'} autoComplete="new-password" placeholder="Repeat the password" value={pw2} onChange={e=>setPw2(e.target.value)} style={inputStyle} onFocus={e=>focus(e,true)} onBlur={e=>focus(e,false)}/></Field>
  </div>
  <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:INK,margin:'12px 0 16px',cursor:'pointer'}}><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} style={{accentColor:BLUE}}/>Show passwords</label>
  <Primary busy={busy}>{busy?'Activating...':'Activate and sign in'}{!busy&&<ArrowRight size={16}/>}</Primary>
  <ErrorLine text={error}/>
 </form>;
}

export function LoginPage({onSignedIn}:{onSignedIn:(s:SessionInfo)=>void}){
 const [invite,setInvite]=useState(()=>new URLSearchParams(window.location.search).get('invite')||'');
 const [wide,setWide]=useState(()=>window.innerWidth>=1000);
 useEffect(()=>{const h=()=>setWide(window.innerWidth>=1000);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h)},[]);
 function signedIn(s:SessionInfo){if(invite)window.history.replaceState(null,'',window.location.pathname);onSignedIn(s)}
 function leaveInvite(){window.history.replaceState(null,'',window.location.pathname);setInvite('')}
 return <div style={{display:'grid',gridTemplateColumns:wide?'minmax(0,1.15fr) minmax(0,1fr)':'1fr',minHeight:'100vh',background:'#f5f6fa',fontFamily:'inherit'}}>
  {wide&&<Showcase/>}
  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'center',padding:wide?'28px 36px':'20px 16px',overflowY:'auto'}}>
   <div style={{width:'100%',maxWidth:520,background:'#fff',border:'1px solid '+BORDER,borderRadius:16,padding:'28px 30px',boxShadow:'0 10px 40px rgba(31,41,90,0.08)',boxSizing:'border-box'}}>
    <div style={{marginBottom:18}}><Brand size={20}/></div>
    {invite?<AcceptInvite token={invite} onSignedIn={signedIn} onCancel={leaveInvite}/>:<>
     <SignInForm onSignedIn={signedIn}/>
     <div style={{borderTop:'1px solid '+BORDER,margin:'24px 0'}}/>
     <RequestForm/>
    </>}
   </div>
  </div>
 </div>;
}
