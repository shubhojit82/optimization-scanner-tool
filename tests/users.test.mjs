import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {settings,createWorkbenchServer} from '../dist/server/server/node-server.js';

const ORIGIN='http://localhost:5173';
const SUPER={email:'boss@example.com',password:'super-admin-password-123'};
const BACKDOOR={email:'breakglass',password:'break-glass-password-0123456789'};
const env=(dir,extra={})=>({GEO_AUTH_MODE:'users',GEO_BIND:'127.0.0.1',PORT:'0',GEO_DATA_DIR:dir,GEO_ALLOWED_ORIGINS:ORIGIN,GEO_SUPERADMIN_EMAIL:SUPER.email,GEO_SUPERADMIN_PASSWORD:SUPER.password,GEO_BACKDOOR_USER:BACKDOOR.email,GEO_BACKDOOR_PASSWORD:BACKDOOR.password,...extra});

async function running(run,extra){
  const dir=mkdtempSync(join(tmpdir(),'geo-users-'));
  const {server,repo}=createWorkbenchServer(settings(env(dir,extra)));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  try{await run(base,repo)}finally{await new Promise(r=>server.close(r));repo.close();rmSync(dir,{recursive:true,force:true})}
}
// A tiny cookie-keeping client.
function agent(base){
  let cookie='';
  const call=async(method,path,body)=>{
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:ORIGIN,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0].endsWith('=')?'':set.split(';')[0];
    let data=null;try{data=await r.json()}catch{}
    return{status:r.status,data,headers:r.headers};
  };
  return{get:p=>call('GET',p),post:(p,b)=>call('POST',p,b??{}),patch:(p,b)=>call('PATCH',p,b),del:p=>call('DELETE',p)};
}
const login=async(base,cred)=>{const a=agent(base);const r=await a.post('/api/v1/auth/login',{email:cred.email,password:cred.password});assert.equal(r.status,200,JSON.stringify(r.data));return a};
const acme={name:'Acme',domain:'https://acme.example',industry:'Software',market:'US',products:['CMS'],competitors:['Peer']};
const globex={...acme,name:'Globex',domain:'https://globex.example'};
const token=url=>new URL(url).searchParams.get('invite');

test('users mode needs a strong Super Admin, and break-glass must differ from it',()=>{
  const dir='/tmp/x';
  assert.throws(()=>settings(env(dir,{GEO_SUPERADMIN_PASSWORD:'short'})),/SUPERADMIN/);
  assert.throws(()=>settings(env(dir,{GEO_SUPERADMIN_EMAIL:'not-an-email'})),/SUPERADMIN/);
  assert.throws(()=>settings(env(dir,{GEO_BACKDOOR_PASSWORD:''})),/both/);
  assert.throws(()=>settings(env(dir,{GEO_BACKDOOR_USER:SUPER.email})),/differ/);
  assert.throws(()=>settings(env(dir,{GEO_BACKDOOR_PASSWORD:'too-short'})),/at least 20/);
});

test('anonymous requests are rejected, but the sign-in page assets, /healthz and session probe are public',()=>running(async base=>{
  assert.equal((await fetch(base+'/api/v1/clients')).status,401);
  assert.equal((await fetch(base+'/healthz')).status,200);
  const s=await (await fetch(base+'/api/v1/session')).json();
  assert.equal(s.authenticated,false);
}));

test('login: wrong password fails, Super Admin and break-glass succeed, cookie is HttpOnly + SameSite=Strict',()=>running(async base=>{
  const bad=await agent(base).post('/api/v1/auth/login',{email:SUPER.email,password:'wrong-password'});
  assert.equal(bad.status,401);assert.equal(bad.data.error,'Invalid email or password');
  const raw=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN},body:JSON.stringify(SUPER)});
  const c=raw.headers.get('set-cookie');assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Strict/);
  const a=await login(base,SUPER);
  const me=await a.get('/api/v1/session');assert.equal(me.data.user.superAdmin,true);assert.equal(me.data.user.role,'admin');
  const b=await login(base,BACKDOOR);
  assert.equal((await b.get('/api/v1/admin/overview')).status,200);
}));

test('five failed attempts lock further sign-ins, even with the right password',()=>running(async base=>{
  for(let i=0;i<5;i++)assert.equal((await agent(base).post('/api/v1/auth/login',{email:SUPER.email,password:'nope-'+i})).status,401);
  assert.equal((await agent(base).post('/api/v1/auth/login',SUPER)).status,429);
}));

test('sign-out invalidates the session',()=>running(async base=>{
  const a=await login(base,SUPER);
  assert.equal((await a.get('/api/v1/clients')).status,200);
  await a.post('/api/v1/auth/logout');
  assert.equal((await a.get('/api/v1/clients')).status,401);
}));

test('mutations still require an allowed Origin',()=>running(async base=>{
  const r=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify(SUPER)});
  assert.equal(r.status,403);
}));

test('access request -> admin rejects: no account is created and a repeat request is accepted again',()=>running(async base=>{
  const pub=agent(base);
  const form={name:'Jane Smith',email:'Jane@Corp.com',company:'Corp',role:'Consultant',reason:'Evaluating AI search visibility for a client.'};
  assert.equal((await pub.post('/api/v1/auth/request-access',form)).status,200);
  assert.equal((await pub.post('/api/v1/auth/request-access',{...form,reason:'duplicate while pending'})).status,200);
  assert.equal((await pub.post('/api/v1/auth/request-access',{...form,reason:'short'})).status,400);
  const admin=await login(base,SUPER);
  let o=(await admin.get('/api/v1/admin/overview')).data;
  assert.equal(o.requests.length,1,'duplicate pending request must not create a second row');
  assert.equal(o.requests[0].email,'jane@corp.com');
  const dec=await admin.post(`/api/v1/admin/access-requests/${o.requests[0].id}/decision`,{decision:'reject',note:'Not a client engagement'});
  assert.equal(dec.data.request.status,'rejected');
  assert.equal((await admin.post(`/api/v1/admin/access-requests/${o.requests[0].id}/decision`,{decision:'approve'})).status,409);
  o=(await admin.get('/api/v1/admin/overview')).data;assert.equal(o.users.length,0);
  assert.equal((await pub.post('/api/v1/auth/request-access',form)).status,200);
  assert.equal((await admin.get('/api/v1/admin/overview')).data.requests.filter(r=>r.status==='pending').length,1);
}));

test('approve -> invite link works once -> user signs in; without SMTP the link is returned to the admin',()=>running(async base=>{
  const pub=agent(base);
  await pub.post('/api/v1/auth/request-access',{name:'Sam Lee',email:'sam@corp.com',company:'Corp',role:'Analyst',reason:'Needs to review client dashboards.'});
  const admin=await login(base,SUPER);
  const req=(await admin.get('/api/v1/admin/overview')).data.requests[0];
  const ok=await admin.post(`/api/v1/admin/access-requests/${req.id}/decision`,{decision:'approve',role:'member'});
  assert.equal(ok.status,200);assert.equal(ok.data.invite.emailSent,false);
  const t=token(ok.data.invite.inviteUrl);
  assert.equal((await pub.get('/api/v1/auth/invite?token='+t)).data.valid,true);
  assert.equal((await agent(base).post('/api/v1/auth/login',{email:'sam@corp.com',password:'anything-at-all-12'})).status,401,'cannot sign in before setting a password');
  assert.equal((await pub.post('/api/v1/auth/accept-invite',{token:t,password:'short'})).status,400);
  const acc=agent(base);
  const done=await acc.post('/api/v1/auth/accept-invite',{token:t,password:'a-very-good-passphrase'});
  assert.equal(done.status,200);assert.equal(done.data.user.email,'sam@corp.com');
  assert.equal((await acc.get('/api/v1/clients')).status,200);
  assert.equal((await pub.post('/api/v1/auth/accept-invite',{token:t,password:'another-good-passphrase'})).status,400,'invite is single use');
  const again=await login(base,{email:'sam@corp.com',password:'a-very-good-passphrase'});
  assert.equal((await again.get('/api/v1/session')).data.user.role,'member');
}));

test('users only see clients granted to them or created by them; deletes are limited to the creator',()=>running(async base=>{
  const admin=await login(base,SUPER);
  const a=(await admin.post('/api/v1/clients',acme)).data,g=(await admin.post('/api/v1/clients',globex)).data;
  const inv=(await admin.post('/api/v1/admin/users',{email:'uma@corp.com',name:'Uma Rao',role:'member',clientIds:[a.id]})).data;
  const uma=agent(base);await uma.post('/api/v1/auth/accept-invite',{token:token(inv.inviteUrl),password:'uma-long-passphrase-1'});

  const list=(await uma.get('/api/v1/clients')).data;
  assert.deepEqual(list.map(c=>c.name),['Acme']);
  assert.equal((await uma.get('/api/v1/clients/'+a.id)).status,200);
  for(const p of [`/api/v1/clients/${g.id}`,`/api/v1/probe-history/${g.id}`,`/api/v1/alerts/${g.id}`,`/api/v1/schedules/${g.id}`,`/api/v1/findings?clientId=${g.id}`,`/api/v1/recommendations?clientId=${g.id}`,`/api/v1/clients/${g.id}/export`,`/api/v1/clients/${g.id}/prompts`,`/api/v1/exec-summary/${g.id}`])
    assert.equal((await uma.get(p)).status,404,'GET '+p);
  assert.equal((await uma.post('/api/v1/alerts',{clientId:g.id,metric:'score',threshold:50,direction:'below'})).status,404);
  assert.equal((await uma.post('/api/v1/probe',{clientId:g.id,prompts:['What is Globex?'],providers:['openai']})).status,404);
  assert.equal((await uma.post('/api/v1/schedules',{clientId:g.id,cadence:'daily',providers:['openai'],prompts:['What is Globex?']})).status,404);
  assert.equal((await uma.get('/api/v1/audit-log')).status,403);
  assert.equal((await uma.get('/api/v1/admin/overview')).status,403);

  assert.equal((await uma.del('/api/v1/clients/'+a.id)).status,403,'granted but not creator');
  const mine=(await uma.post('/api/v1/clients',{...acme,name:'Mine',domain:'https://mine.example'})).data;
  assert.deepEqual((await uma.get('/api/v1/clients')).data.map(c=>c.name).sort(),['Acme','Mine']);
  assert.equal((await admin.get('/api/v1/clients')).data.length,3,'admin sees everything');
  assert.equal((await uma.del('/api/v1/clients/'+mine.id)).status,200,'creator may delete');

  await admin.patch('/api/v1/admin/users/'+inv.user.id,{clientIds:[g.id]});
  assert.deepEqual((await uma.get('/api/v1/clients')).data.map(c=>c.name),['Globex']);
  assert.equal((await uma.get('/api/v1/clients/'+a.id)).status,404);
}));

test('viewer is read-only; disabling a user ends their session; only the Super Admin manages admins',()=>running(async base=>{
  const admin=await login(base,SUPER);
  const c=(await admin.post('/api/v1/clients',acme)).data;
  const v=(await admin.post('/api/v1/admin/users',{email:'vic@corp.com',name:'Vic Viewer',role:'viewer',clientIds:[c.id]})).data;
  const vic=agent(base);await vic.post('/api/v1/auth/accept-invite',{token:token(v.inviteUrl),password:'vic-long-passphrase-12'});
  assert.equal((await vic.get('/api/v1/clients/'+c.id)).status,200);
  assert.equal((await vic.post('/api/v1/clients',acme)).status,403);
  assert.equal((await vic.del('/api/v1/clients/'+c.id)).status,403);

  await admin.patch('/api/v1/admin/users/'+v.user.id,{status:'disabled'});
  assert.equal((await vic.get('/api/v1/clients')).status,401);
  assert.equal((await agent(base).post('/api/v1/auth/login',{email:'vic@corp.com',password:'vic-long-passphrase-12'})).status,401);

  const ad=(await admin.post('/api/v1/admin/users',{email:'ann@corp.com',name:'Ann Admin',role:'admin'})).data;
  const ann=agent(base);await ann.post('/api/v1/auth/accept-invite',{token:token(ad.inviteUrl),password:'ann-long-passphrase-12'});
  assert.equal((await ann.get('/api/v1/admin/overview')).status,200);
  assert.equal((await ann.post('/api/v1/admin/users',{email:'bob@corp.com',name:'Bob Two',role:'admin'})).status,403);
  assert.equal((await ann.post('/api/v1/admin/users',{email:'bob@corp.com',name:'Bob Two',role:'member'})).status,200);
  assert.equal((await ann.patch('/api/v1/admin/users/'+ad.user.id,{role:'member'})).status,403);
  assert.equal((await ann.post('/api/v1/admin/users',{email:SUPER.email,name:'Imposter',role:'member'})).status,409);
}));

test('data created in basic mode stays reachable: the users-mode owner is the configured data owner',()=>running(async base=>{
  const admin=await login(base,SUPER);
  await admin.post('/api/v1/clients',acme);
  assert.equal((await admin.get('/api/v1/clients')).data.length,1);
},{GEO_DATA_OWNER:'legacy-admin'}));

test('mail mode: defaults, validation, and local is refused in production',()=>{
  const dir='/tmp/x';
  assert.equal(settings(env(dir)).mail.mode,'off');
  assert.equal(settings(env(dir,{SMTP_HOST:'smtp.example.com'})).mail.mode,'smtp','SMTP_HOST alone keeps the old behaviour');
  assert.equal(settings(env(dir,{GEO_MAIL_MODE:'local',SMTP_HOST:'smtp.example.com'})).mail.mode,'local','flag wins over SMTP_HOST');
  assert.throws(()=>settings(env(dir,{GEO_MAIL_MODE:'smtp'})),/SMTP_HOST/);
  assert.throws(()=>settings(env(dir,{GEO_MAIL_MODE:'bogus'})),/off, local or smtp/);
  assert.throws(()=>settings(env(dir,{GEO_MAIL_MODE:'local',NODE_ENV:'production'})),/production/);
  assert.throws(()=>settings(env(dir,{GEO_MAIL_MODE:'smtp',SMTP_HOST:'h',SMTP_PORT:'99999'})),/SMTP_PORT/);
});

test('local mail mode captures invites and decisions in an admin-only outbox instead of sending',()=>running(async(base)=>{
  const admin=await login(base,SUPER);
  const inv=(await admin.post('/api/v1/admin/users',{email:'lena@corp.com',name:'Lena Ray',role:'member'})).data;
  assert.equal(inv.mail,'captured');assert.equal(inv.emailSent,false);
  await agent(base).post('/api/v1/auth/request-access',{name:'Kai Moss',email:'kai@corp.com',company:'Corp',role:'Analyst',reason:'Needs to review client dashboards.'});
  const box=(await admin.get('/api/v1/admin/outbox')).data;
  assert.equal(box.mode,'local');
  const subjects=box.messages.map(m=>m.subject).join('|');
  assert.match(subjects,/invited/);assert.match(subjects,/Access request from Kai Moss/);
  const mail=box.messages.find(m=>m.to==='lena@corp.com');
  assert.ok(mail.text.includes(inv.inviteUrl),'the captured mail carries the working invite link');
  const t=await admin.post('/api/v1/admin/mail/test',{});
  assert.equal(t.data.ok,true);assert.match(t.data.message,/local outbox/);
  // not available to anonymous or non-admin users
  assert.equal((await agent(base).get('/api/v1/admin/outbox')).status,401);
  const u=agent(base);await u.post('/api/v1/auth/accept-invite',{token:token(inv.inviteUrl),password:'lena-long-passphrase-1'});
  assert.equal((await u.get('/api/v1/admin/outbox')).status,403);
  // the requester is not promised an email in local mode
  const r=await agent(base).post('/api/v1/auth/request-access',{name:'Zed Fox',email:'zed@corp.com',company:'Corp',role:'Analyst',reason:'Needs to review client dashboards.'});
  assert.equal(r.data.emailNotifications,false);
},{GEO_MAIL_MODE:'local'}));

test('mail off: invite is created with the link, test endpoint explains, outbox is empty',()=>running(async(base)=>{
  const admin=await login(base,SUPER);
  const inv=(await admin.post('/api/v1/admin/users',{email:'olu@corp.com',name:'Olu Ade',role:'member'})).data;
  assert.equal(inv.mail,'off');assert.ok(inv.inviteUrl.includes('invite='));
  assert.equal((await admin.post('/api/v1/admin/mail/test',{})).data.ok,false);
  assert.deepEqual((await admin.get('/api/v1/admin/outbox')).data.messages,[]);
}));

test('smtp mode: an unreachable server is reported, the invite still succeeds with the link, nothing crashes',()=>running(async(base)=>{
  const admin=await login(base,SUPER);
  const inv=(await admin.post('/api/v1/admin/users',{email:'pia@corp.com',name:'Pia Ng',role:'member'})).data;
  assert.equal(inv.mail,'failed');assert.equal(inv.emailSent,false);assert.ok(inv.inviteUrl.includes('invite='));
  const t=await admin.post('/api/v1/admin/mail/test',{});
  assert.equal(t.data.ok,false);assert.match(t.data.message,/SMTP server/);
},{GEO_MAIL_MODE:'smtp',SMTP_HOST:'127.0.0.1',SMTP_PORT:'1'}));

test('emails are branded HTML with a plain-text fallback, escape user input, and carry the exact invite link',()=>running(async(base)=>{
  const admin=await login(base,SUPER);
  const c=(await admin.post('/api/v1/clients',acme)).data;
  const inv=(await admin.post('/api/v1/admin/users',{email:'ivy@corp.com',name:'Ivy <b>Stone</b>',role:'viewer',clientIds:[c.id]})).data;
  const m=(await admin.get('/api/v1/admin/outbox')).data.messages.find(x=>x.to==='ivy@corp.com');
  assert.ok(m.html.startsWith('<!doctype html>'));
  assert.ok(m.html.includes('href="'+inv.inviteUrl+'"'),'button links to the invite');
  assert.ok(m.text.includes(inv.inviteUrl),'plain-text part has the link too');
  assert.ok(!m.html.includes('<b>Stone</b>'),'user-supplied name is HTML-escaped');
  assert.match(m.html,/Viewer \(read-only\)/);assert.match(m.html,/Acme/,'lists the granted clients');
  assert.ok(!/<script|javascript:/i.test(m.html));
  // admin notes and requester text are escaped in the other messages
  await agent(base).post('/api/v1/auth/request-access',{name:'Eve',email:'eve@corp.com',company:'Corp <i>X</i>',role:'Analyst',reason:'Needs access <script>alert(1)</script> to review.'});
  const req=(await admin.get('/api/v1/admin/overview')).data.requests[0];
  await admin.post('/api/v1/admin/access-requests/'+req.id+'/decision',{decision:'reject',note:'No <em>engagement</em>'});
  const box=(await admin.get('/api/v1/admin/outbox')).data.messages;
  const notify=box.find(x=>/Access request from Eve/.test(x.subject)),rej=box.find(x=>x.to==='eve@corp.com');
  assert.ok(!notify.html.includes('<script>')&&notify.html.includes('&lt;script&gt;'));
  assert.ok(rej.html.includes('not approved')&&rej.html.includes('No &lt;em&gt;engagement&lt;/em&gt;')&&rej.text.includes('No <em>engagement</em>'));
  // resend to someone who already has a password is worded as a reset
  const u=agent(base);await u.post('/api/v1/auth/accept-invite',{token:token(inv.inviteUrl),password:'ivy-long-passphrase-123'});
  await admin.post('/api/v1/admin/users/'+inv.user.id+'/invite',{});
  const reset=(await admin.get('/api/v1/admin/outbox')).data.messages.find(x=>/Reset your/.test(x.subject));
  assert.ok(reset&&/Choose a New Password/i.test(reset.html));
  // every scenario: table layout, Outlook button, no scripts, no remote images, a text part, and the bundled images resolve
  const all=(await admin.get('/api/v1/admin/outbox')).data.messages;
  assert.ok(all.length>=4);
  for(const x of all){
    assert.ok(x.text.length>20,'plain-text part');
    assert.ok(!/<script|javascript:|<iframe|<form/i.test(x.html),'no active content');
    assert.ok(!/<img[^>]+src="(?!data:image\/png;base64,)/i.test(x.html),'images are bundled, never remote');
    assert.ok(/<table/i.test(x.html)&&/v:roundrect/.test(x.html)||!/class="btn"/.test(x.html),'table layout and VML button');
    assert.ok(!/cid:/.test(x.html),'cid references are swapped for the preview');
  }
},{GEO_MAIL_MODE:'local'}));

test('templates reference only bundled images, and smtp sends them as inline CID attachments', async()=>{
  const {pathToFileURL}=await import('node:url');
  const dist=pathToFileURL(join(process.cwd(),'dist/server/server/')).href;
  const {EMAIL_IMAGES}=await import(dist+'email-assets.js');
  const T=await import(dist+'email-templates.js');
  const {cidImages,inlineCidImages}=await import(dist+'mailer.js');
  const msgs=[
    T.testEmail({mode:'smtp',from:'a@b.c',dashboardUrl:'https://x.example'}),
    T.inviteEmail({name:'A',email:'a@b.c',url:'https://x.example/?invite=t&x=1',days:7,kind:'invited',role:'member',clientNames:['Acme']}),
    T.inviteEmail({name:'A',email:'a@b.c',url:'https://x.example/?invite=t',days:7,kind:'approved',role:'viewer'}),
    T.inviteEmail({name:'A',email:'a@b.c',url:'https://x.example/?invite=t',days:7,kind:'reset',role:'admin'}),
    T.rejectionEmail({name:'A',note:'n'}),
    T.requestNotificationEmail({name:'A',email:'a@b.c',company:'C',role:'R',reason:'why',reviewUrl:'https://x.example'}),
  ];
  for(const m of msgs){
    assert.ok(m.html&&m.text&&m.subject);
    const refs=[...m.html.matchAll(/cid:([a-z0-9-]+)@geo/gi)].map(r=>r[1]);
    assert.ok(refs.length>=2,'logo and illustration');
    for(const r of refs)assert.ok(EMAIL_IMAGES[r],'unknown image '+r);
    assert.deepEqual(cidImages(m.html).sort(),[...new Set(refs)].sort());
    assert.ok(!/cid:/.test(inlineCidImages(m.html)));
    assert.ok(!/<script|javascript:/i.test(m.html));
  }
  assert.ok(msgs[1].html.includes('invite=t&amp;x=1'),'link ampersands are escaped in the HTML');
  assert.ok(msgs[1].text.includes('invite=t&x=1'),'text part keeps the raw link');
});
