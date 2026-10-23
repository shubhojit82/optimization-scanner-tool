import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {SqliteRepository} from './sqlite-repository';
import {Workbench} from '../application/workbench';
import {ClientIdentityService} from '../application/client-identity';
import {ObservationRunner} from '../application/observation-runner';
import {ProbeRunner} from '../application/probe-runner';
import {OpenAIProvider} from './providers/openai-provider';
import {GeminiProvider} from './providers/gemini-provider';
import {ClaudeProvider} from './providers/claude-provider';
import {PerplexityProvider} from './providers/perplexity-provider';
import {NodeCrawler} from './node-crawler';
import {buildScanResult} from '../application/scanner';
import {buildXlsx} from './xlsx-export';
import {crawlSite} from './site-crawler';
import {buildSiteXlsx} from './site-xlsx-export';
import {CollectionError, type AIProvider, type ProviderInfo, type Audit, type CompetitorScanResult} from '../core/contracts';
import {clientSchema,auditSchema,observationSchema,identitySchema,scanSchema,probeSchema,competitorScanSchema,benchmarkSchema,smartPromptsSchema,customPromptsSchema,contentfulFetchSchema,scheduleSchema,alertSchema,findingPatchSchema,recommendationPatchSchema} from '../adapters/validation';
import {deriveFindings, proposalFromFinding, ownerFromDimension} from '../application/findings';
import {mapQuestionsToPage} from '../core/question-mapping';
import {extractText as extractPageText} from '../core/question-mapping-util';
import {queryUniverse} from '../core/scoring';
import {Scheduler} from './scheduler';
import {ContentfulConnector} from './cms/contentful-connector';
import {CMS_ADAPTERS,generateChangeInstructions} from './cms/adapter-registry';
import {BrowserCrawler} from './browser-crawler';
import {buildFullReport} from '../core/report-analysis';
import {buildHtmlReport} from './html-report';
import {buildExecSummaryReport} from './exec-summary-report';
import {analyzeHtml,aggregate,subScores} from '../core/scoring';
import {ScanCache} from './scan-cache';
import {AuthService,SESSION_COOKIE} from './auth-service';
import {Mailer,mailConfig,type MailConfig} from './mailer';
import {handlePublicRoutes,handleAdminRoutes,clientGuard,readCookie,type RouteCtx} from './users-routes';
import {ContentBriefService} from '../application/content-brief';
import {SmartPromptsService} from '../application/smart-prompts';
import {RgpsRewriteService} from '../application/rgps-rewrite';
import {ArticleDraftService} from '../application/article-draft';
export type UsersConfig={superEmail:string;superPassword:string;backdoorUser?:string;backdoorPassword?:string;publicUrl:string;trustProxy:boolean};
export type Settings={users?:UsersConfig;mail:MailConfig;mode:'local'|'basic'|'users';bind:string;port:number;dataDir:string;origins:string[];username:string;password:string;viewerPassword?:string;clientDir:string;openaiKey?:string;openaiModel?:string;geminiKey?:string;geminiModel?:string;claudeKey?:string;claudeModel?:string;perplexityKey?:string;perplexityModel?:string;contentfulSpaceId?:string;contentfulToken?:string;useBrowser?:boolean};
export function settings(e:NodeJS.ProcessEnv=process.env):Settings {
 const rawMode=e.GEO_AUTH_MODE||'local';if(rawMode!=='local'&&rawMode!=='basic'&&rawMode!=='users')throw new Error('GEO_AUTH_MODE must be local, basic or users');const mode:Settings['mode']=rawMode;
 const bind=e.GEO_BIND||(mode==='local'?'127.0.0.1':'0.0.0.0');
 if(mode==='local'&&!['127.0.0.1','::1','localhost'].includes(bind))throw new Error('Local authentication may only bind to loopback');
 const port=Number(e.PORT||8080);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid PORT');
 const username=mode==='local'?(e.GEO_LOCAL_USER||'local-admin'):mode==='users'?(e.GEO_DATA_OWNER?.trim()||e.GEO_ADMIN_USERNAME?.trim()||'local-admin'):(e.GEO_ADMIN_USERNAME||'');const password=e.GEO_ADMIN_PASSWORD||'';
 if(mode==='basic'&&(!username||username.includes(':')||password.length<16||password.includes('REPLACE_')))throw new Error('Basic authentication requires a username and a unique password of at least 16 characters');
 const origins=(e.GEO_ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080').split(',').map(s=>s.trim()).filter(Boolean);
 for(const o of origins){const u=new URL(o);if(u.origin!==o||!['http:','https:'].includes(u.protocol))throw new Error('Allowed origins must be exact HTTP(S) origins')}
 const viewerPassword=e.GEO_VIEWER_PASSWORD?.trim()||undefined;
 if(mode==='basic'&&viewerPassword&&password&&equal(viewerPassword,password))throw new Error('GEO_VIEWER_PASSWORD must differ from GEO_ADMIN_PASSWORD');
 let users:UsersConfig|undefined;
 if(mode==='users'){
  const superEmail=(e.GEO_SUPERADMIN_EMAIL||'').trim().toLowerCase(),superPassword=e.GEO_SUPERADMIN_PASSWORD||'';
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(superEmail)||superPassword.length<16||superPassword.includes('REPLACE_'))throw new Error('Users authentication requires GEO_SUPERADMIN_EMAIL and a unique GEO_SUPERADMIN_PASSWORD of at least 16 characters');
  const backdoorUser=e.GEO_BACKDOOR_USER?.trim().toLowerCase()||undefined,backdoorPassword=e.GEO_BACKDOOR_PASSWORD||undefined;
  if(!!backdoorUser!==!!backdoorPassword)throw new Error('Set both GEO_BACKDOOR_USER and GEO_BACKDOOR_PASSWORD, or neither');
  if(backdoorUser&&backdoorPassword){if(backdoorPassword.length<20||backdoorPassword.includes('REPLACE_'))throw new Error('GEO_BACKDOOR_PASSWORD must be unique and at least 20 characters');if(backdoorUser===superEmail||equal(backdoorPassword,superPassword))throw new Error('The break-glass credential must differ from the Super Admin credential')}
  users={superEmail,superPassword,backdoorUser,backdoorPassword,publicUrl:(e.GEO_PUBLIC_URL?.trim()||origins[0]).replace(/\/+$/,''),trustProxy:e.GEO_TRUST_PROXY==='true'};
 }
 return {users,mail:mailConfig(e),mode,bind,port,dataDir:resolve(e.GEO_DATA_DIR||'data'),origins,username,password,viewerPassword,clientDir:resolve('dist/client'),openaiKey:e.OPENAI_API_KEY?.trim()||undefined,openaiModel:e.GEO_OPENAI_MODEL?.trim()||'gpt-4o-mini',geminiKey:e.GEMINI_API_KEY?.trim()||undefined,geminiModel:e.GEO_GEMINI_MODEL?.trim()||'gemini-3.8-flash',claudeKey:e.ANTHROPIC_API_KEY?.trim()||undefined,claudeModel:e.GEO_CLAUDE_MODEL?.trim()||'claude-opus-4-5-20251101',perplexityKey:e.PERPLEXITY_API_KEY?.trim()||undefined,perplexityModel:e.GEO_PERPLEXITY_MODEL?.trim()||'sonar',contentfulSpaceId:e.CONTENTFUL_SPACE_ID?.trim()||undefined,contentfulToken:e.CONTENTFUL_ACCESS_TOKEN?.trim()||undefined,useBrowser:e.GEO_USE_BROWSER==='true'};
}
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest())}
function decodeBasic(req:IncomingMessage):{ok:boolean;creds:string}{const a=req.headers.authorization;if(!a||!a.startsWith('Basic '))return{ok:false,creds:''};try{return{ok:true,creds:Buffer.from(a.slice(6),'base64').toString('utf8')}}catch{return{ok:false,creds:''}}}
function authenticated(req:IncomingMessage,s:Settings){if(s.mode==='local')return true;const{ok,creds}=decodeBasic(req);if(!ok)return false;return equal(creds,s.username+':'+s.password)}
function isViewer(req:IncomingMessage,s:Settings):boolean{if(!s.viewerPassword||s.mode!=='basic')return false;const{ok,creds}=decodeBasic(req);if(!ok)return false;return equal(creds,s.username+':'+s.viewerPassword)}
const bodies=new WeakMap<IncomingMessage,Promise<any>>();
// A request stream can be read once. The client guard and the route handler both need the parsed body, so it is cached per request.
function body(req:IncomingMessage):Promise<any>{let p=bodies.get(req);if(!p){p=readBody(req);bodies.set(req,p)}return p}
function json(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function readBody(req:IncomingMessage){const chunks:Buffer[]=[];let bytes=0;for await(const chunk of req){const b=Buffer.from(chunk);bytes+=b.length;if(bytes>600000)throw new Error('Request too large');chunks.push(b)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
// cmp-3: extract external citation domains from HTML (sameAs, external links)
function extractCitationSources(html:string,pageUrl:string):string[]{
  const base=new URL(pageUrl).hostname.replace(/^www\./,'');
  const domains=new Set<string>();
  for(const m of html.matchAll(/"sameAs"\s*:\s*\[([^\]]+)\]/g)){for(const u of m[1].matchAll(/"(https?:\/\/[^"]+)"/g)){try{const h=new URL(u[1]).hostname.replace(/^www\./,'');if(h!==base)domains.add(h)}catch{}}}
  for(const m of html.matchAll(/<a\b[^>]+href=["']?(https?:\/\/[^\s"'>]+)/gi)){try{const h=new URL(m[1]).hostname.replace(/^www\./,'');if(h!==base&&!h.endsWith('.'+base))domains.add(h)}catch{}}
  const authority=['wikipedia.org','linkedin.com','twitter.com','facebook.com','instagram.com','youtube.com','trustpilot.com','g2.com','capterra.com','bbb.org'];
  const sorted=[...domains].sort((a,b)=>(authority.some(d=>a.includes(d))?-1:0)-(authority.some(d=>b.includes(d))?-1:0));
  return sorted.slice(0,10);
}
// cmp-4: extract topic clusters from headings
function extractTopTopics(html:string):string[]{
  const topics:string[]=[];
  for(const m of html.matchAll(/<h[2-3]\b[^>]*>([\s\S]*?)<\/h[2-3]>/gi)){
    const t=m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    if(t.length>4)topics.push(t);
  }
  return topics.slice(0,12);
}

export function createWorkbenchServer(s:Settings, supplied?:{providers:Map<string,AIProvider>;info:ProviderInfo[]}){const repo=new SqliteRepository(s.dataDir);const app=new Workbench(repo);
 const auth=s.users?new AuthService(repo.db,s.users,new Mailer(s.mail,join(s.dataDir,'outbox'))):null;
 const providers=supplied?.providers||new Map<string,AIProvider>();
 if(!supplied&&s.openaiKey)providers.set('openai',new OpenAIProvider(s.openaiKey,s.openaiModel));
 if(!supplied&&s.geminiKey)providers.set('gemini',new GeminiProvider(s.geminiKey,s.geminiModel));
 if(!supplied&&s.claudeKey)providers.set('claude',new ClaudeProvider(s.claudeKey,s.claudeModel));
 if(!supplied&&s.perplexityKey)providers.set('perplexity',new PerplexityProvider(s.perplexityKey,s.perplexityModel));
 const info=supplied?.info||[
   {id:'openai',label:'OpenAI web search',model:s.openaiModel||'gpt-4o-mini',configured:!!s.openaiKey},
   {id:'gemini',label:'Google Gemini grounded search',model:s.geminiModel||'gemini-3.8-flash',configured:!!s.geminiKey},
   {id:'claude',label:'Anthropic Claude web search',model:s.claudeModel||'claude-opus-4-5-20251101',configured:!!s.claudeKey},
   {id:'perplexity',label:'Perplexity Sonar web search',model:s.perplexityModel||'sonar',configured:!!s.perplexityKey},
 ];
 const runner=new ObservationRunner(repo,providers);
 const probeRunner=new ProbeRunner(providers);
 const identities=new ClientIdentityService(repo);
 const crawler=new NodeCrawler(25000);
 const browserCrawler=s.useBrowser?new BrowserCrawler():null;
 const contentfulConnector=s.contentfulSpaceId&&s.contentfulToken?new ContentfulConnector(s.contentfulSpaceId,s.contentfulToken):null;
 const scheduler=new Scheduler(repo,probeRunner);scheduler.start();
 // 5-minute TTL, 50-entry LRU caches — avoids redundant HTTP fetches
 const snapCache=new ScanCache<Awaited<ReturnType<NodeCrawler['captureWithFlags']>>>(5*60*1000,50);
 const competitorCache=new ScanCache<CompetitorScanResult>(5*60*1000,50);
 // Evict expired entries every 10 minutes
 setInterval(()=>{snapCache.evictExpired();competitorCache.evictExpired();},10*60*1000).unref();
 const briefService=new ContentBriefService({openaiKey:s.openaiKey,openaiModel:s.openaiModel,geminiKey:s.geminiKey,geminiModel:s.geminiModel,claudeKey:s.claudeKey,claudeModel:s.claudeModel});
 const smartPromptsService=new SmartPromptsService({openaiKey:s.openaiKey,openaiModel:s.openaiModel,geminiKey:s.geminiKey,geminiModel:s.geminiModel,claudeKey:s.claudeKey,claudeModel:s.claudeModel});
 const rgpsRewriteService=new RgpsRewriteService({openaiKey:s.openaiKey,openaiModel:s.openaiModel,geminiKey:s.geminiKey,geminiModel:s.geminiModel,claudeKey:s.claudeKey,claudeModel:s.claudeModel});
 const articleDraftService=new ArticleDraftService({openaiKey:s.openaiKey,openaiModel:s.openaiModel,geminiKey:s.geminiKey,geminiModel:s.geminiModel,claudeKey:s.claudeKey,claudeModel:s.claudeModel});
 const runSchema=z.object({provider:z.string().min(1).max(60),prompt:z.string().trim().min(5).max(2000),requestId:z.string().uuid()}).strict();
 const server=createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 if(s.mode==='local'){let h='';try{h=new URL('http://'+(req.headers.host||'')).hostname}catch{}if(!['127.0.0.1','localhost','[::1]'].includes(h))return json(res,403,{error:'Host denied'})}
 let path:string;try{path=new URL(req.url||'/', 'http://app.internal').pathname}catch{return json(res,400,{error:'Invalid URL'})}
 // Liveness probe for the container healthcheck. It reveals nothing, so it is served before authentication.
 if(path==='/healthz'&&(req.method==='GET'||req.method==='HEAD'))return json(res,200,{status:'ok'});
 // users mode: a signed-in session cookie. The page bundle itself is public so the sign-in screen can load.
 const principal=auth?auth.principalFromToken(readCookie(req,SESSION_COOKIE)):null;
 const viewerOnly=auth?!!principal?.readOnly:(!authenticated(req,s)&&isViewer(req,s));
 if(!auth&&!authenticated(req,s)&&!viewerOnly){res.setHeader('WWW-Authenticate','Basic realm="AI Search Intelligence", charset="UTF-8"');return json(res,401,{error:'Sign in required'})}
 // Identity comes only from configured authentication. Client identity headers are ignored.
 const owner=s.username;
 try {
 if(path.startsWith('/api/')){
 if(!['GET','POST','DELETE','PATCH'].includes(req.method||''))return json(res,405,{error:'Method not allowed'});
 if(['POST','DELETE','PATCH'].includes(req.method||'')&&!s.origins.includes(req.headers.origin||''))return json(res,403,{error:'Origin denied'});
 if(auth){
  const ctx:RouteCtx={req,res,path,method:req.method||'GET',principal,auth,repo,owner,secure:s.users!.publicUrl.startsWith('https://'),json,body};
  if(await handlePublicRoutes(ctx))return;
  if(!principal){res.setHeader('Cache-Control','no-store');return json(res,401,{error:'Sign in required'})}
  if(path.startsWith('/api/v1/admin/')){if(!auth.isAdmin(principal))return json(res,403,{error:'Administrator access required'});if(principal.readOnly)return json(res,403,{error:'Read-only mode'});if(await handleAdminRoutes(ctx))return}
  // The audit log spans every client, so only administrators may read it.
  if(path==='/api/v1/audit-log'&&!auth.isAdmin(principal))return json(res,403,{error:'Administrator access required'});
  if(!viewerOnly||req.method==='GET'){const denied=await clientGuard(ctx);if(denied)return json(res,denied.status,{error:denied.error})}
 }
 if(viewerOnly&&['POST','DELETE','PATCH'].includes(req.method||''))return json(res,403,{error:'Read-only mode'});
 if(path==='/api/v1/session')return req.method==='GET'?json(res,200,{mode:s.mode,authenticated:true,readOnly:viewerOnly,username:s.username}):json(res,405,{error:'Method not allowed'});
 if(path==='/api/v1/providers')return req.method==='GET'?json(res,200,info):json(res,405,{error:'Method not allowed'});
 const identityMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/identity$/);
 if(identityMatch){if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});const input=identitySchema.parse(await body(req));return json(res,200,await identities.update(owner,decodeURIComponent(identityMatch[1]),input));}
 const runMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/observation-runs$/);
 if(runMatch){if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});const input=runSchema.parse(await body(req));return json(res,200,await runner.run(owner,decodeURIComponent(runMatch[1]),input.provider,input.prompt,input.requestId));}
 if(path==='/api/v1/clients'){
 if(req.method==='GET'){const all=await repo.listClients(owner);const scope=auth&&principal?auth.scopeClientIds(principal):null;return json(res,200,scope?all.filter(x=>scope.has(x.id)):all)}
 const data=clientSchema.parse(await body(req));const c={...data,domain:new URL(data.domain).origin,id:crypto.randomUUID(),created:new Date().toISOString()};await repo.saveClient(owner,c);if(auth&&principal&&!auth.isAdmin(principal))auth.store.grantCreator(principal.id,c.id);repo.logEvent({id:crypto.randomUUID(),owner,action:'client.create',entityType:'client',entityId:c.id,clientId:c.id,detail:{name:c.name,domain:c.domain},created:c.created});return json(res,200,c)}
 const recordMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/(audits|observations)\/([^/]+)$/);
 if(recordMatch){const[,cId,kind,rId]=[...recordMatch].map(decodeURIComponent);if(req.method!=='DELETE')return json(res,405,{error:'Method not allowed'});const ok=await repo.deleteRecord(owner,cId,kind as 'audit'|'observation',rId);return json(res,ok?200:404,ok?{deleted:rId}:{error:'Record not found'});}
 // sec-8: full client data export
 const exportMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/export$/);
 if(exportMatch&&req.method==='GET'){
   const expId=decodeURIComponent(exportMatch[1]);
   const expClient=await repo.getClient(owner,expId);
   if(!expClient)return json(res,404,{error:'Client not found'});
   const[expAudits,expObs,expFindings,expProbes]=await Promise.all([
     repo.listRecords<import('../core/contracts').Audit>(owner,expId,'audit'),
     repo.listRecords<import('../core/contracts').Observation>(owner,expId,'observation'),
     Promise.resolve(repo.listFindings(owner,expId,'open').concat(repo.listFindings(owner,expId,'resolved'))),
     repo.listProbeRuns(owner,expId,50),
   ]);
   const exportPayload={exportedAt:new Date().toISOString(),schemaVersion:'1.0',client:expClient,audits:expAudits,observations:expObs,findings:expFindings,probeRuns:expProbes};
   res.setHeader('Content-Type','application/json');
   res.setHeader('Content-Disposition',`attachment; filename="geo-export-${expClient.name.replace(/[^a-z0-9]/gi,'-').toLowerCase()}.json"`);
   res.end(JSON.stringify(exportPayload,null,2));
   return;
 }
 const m=path.match(/^\/api\/v1\/clients\/([^/]+)(?:\/(audits|observations))?$/);
 if(m){const id=decodeURIComponent(m[1]);if(req.method==='GET'&&!m[2])return json(res,200,await app.detail(owner,id));if(req.method==='DELETE'&&!m[2]){const ok=await repo.deleteClient(owner,id);return json(res,ok?200:404,ok?{deleted:id}:{error:'Client not found'})}if(req.method==='POST'&&m[2]==='audits'){const d=auditSchema.parse(await body(req));return json(res,200,await app.audit(owner,id,d.url,d.html))}if(req.method==='POST'&&m[2]==='observations')return json(res,200,await app.observations(owner,id,observationSchema.parse(await body(req))));return json(res,405,{error:'Method not allowed'})}
 if(path==='/api/v1/scan'&&req.method==='POST'){
   const {url,clientId}=scanSchema.parse(await body(req));
   const client=clientId?(await repo.getClient(owner,clientId)||null):null;
   const dummyClient=client||{id:'anon',name:'',brandAliases:[],domain:url,industry:'',products:[],competitors:[],market:'',created:new Date().toISOString()};
   let snap=snapCache.get(url)??await(async()=>{const s=await crawler.captureWithFlags(url);snapCache.set(url,s);return s;})();
   if(browserCrawler&&snap.html&&!snap.renderedHtml){
     try{const bSnap=await browserCrawler.capture(url);snap={...snap,renderedHtml:bSnap.html};}catch{/* browser render optional */}
   }
   const result=buildScanResult(snap,dummyClient);
   return json(res,200,result);
 }
 if(path==='/api/v1/scan/save'&&req.method==='POST'){
    const b=await body(req);
    const cId=z.string().uuid().parse(b.clientId);
    const client=await repo.getClient(owner,cId);
    if(!client)return json(res,404,{error:'Client not found'});
    const audit=b.audit;
    if(!audit||typeof audit!=='object')return json(res,400,{error:'audit required'});
    // Deduplicate: skip save if an identical hash+url already exists for this client
    const existing=await repo.listRecords<Audit>(owner,cId,'audit');
    const dupe=existing.find((a:Audit)=>a.hash===audit.hash&&a.url===audit.url);
    if(dupe)return json(res,200,{audit:dupe,findings:repo.listFindings(owner,cId,'open').filter((f:import('../core/contracts').Finding)=>f.auditId===dupe.id)});
    // Assign a fresh id and stamp it to this client
    const record={...audit,id:crypto.randomUUID(),clientId:cId,created:new Date().toISOString(),source:'html-import'};
    await repo.saveRecords(owner,cId,'audit',[record]);
    // Derive and persist findings from the audit dimensions
    const findings=deriveFindings(record,cId);
    if(findings.length)repo.saveFindings(owner,cId,findings);
    repo.logEvent({id:crypto.randomUUID(),owner,action:'scan.save',entityType:'audit',entityId:record.id,clientId:cId,detail:{url:record.url,score:record.score},created:record.created});
    return json(res,200,{audit:record,findings});
  }
 if(path==='/api/v1/scan/export'&&req.method==='POST'){
   const {url,clientId}=scanSchema.parse(await body(req));
   const client=clientId?(await repo.getClient(owner,clientId)||null):null;
   const dummyClient=client||{id:'anon',name:url,brandAliases:[],domain:new URL(url).origin,industry:'',products:[],competitors:[],market:'',created:new Date().toISOString()};
   const snap=snapCache.get(url)??await(async()=>{const s=await crawler.captureWithFlags(url);snapCache.set(url,s);return s;})();
   const result=buildScanResult(snap,dummyClient);
   const buf=await buildXlsx(dummyClient,result);
   res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="geo-scan-${new URL(url).hostname}.xlsx"`,'Cache-Control':'no-store'});
   res.end(buf);
   return;
 }
 if(path==='/api/v1/site-scan'&&req.method==='POST'){
   const {url,clientId}=scanSchema.parse(await body(req));
   const client=clientId?(await repo.getClient(owner,clientId)||null):null;
   const siteClient=client||{id:'anon',name:new URL(url).hostname,brandAliases:[],domain:new URL(url).origin,industry:'',products:[],competitors:[],market:'',created:new Date().toISOString()};
   const result=await crawlSite(url,siteClient);
   return json(res,200,result);
 }
 if(path==='/api/v1/site-scan/export'&&req.method==='POST'){
   const {url,clientId}=scanSchema.parse(await body(req));
   const client=clientId?(await repo.getClient(owner,clientId)||null):null;
   const siteClient=client||{id:'anon',name:new URL(url).hostname,brandAliases:[],domain:new URL(url).origin,industry:'',products:[],competitors:[],market:'',created:new Date().toISOString()};
   const result=await crawlSite(url,siteClient);
   const buf=await buildSiteXlsx(siteClient,result);
   res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="geo-site-${new URL(url).hostname}.xlsx"`,'Cache-Control':'no-store'});
   res.end(buf);
   return;
 }
 if(path==='/api/v1/report'&&req.method==='POST'){
   const b=await body(req);
   const clientId=z.string().uuid().parse(b.clientId);
   const auditId=z.string().optional().parse(b.auditId);
   const client=await repo.getClient(owner,clientId);
   if(!client)return json(res,404,{error:'Client not found'});
   const audits=await repo.listRecords<Audit>(owner,clientId,'audit');
   const audit=auditId?audits.find(a=>a.id===auditId):audits[0];
   if(!audit)return json(res,404,{error:'No audit found for this client'});
   // Try to fetch fresh HTML for accessibility/best-practices; fall back gracefully
   let freshHtml='';let freshHeaders:Record<string,string>={};
   try{const snap=await crawler.captureWithFlags(audit.url);freshHtml=snap.html;freshHeaders=snap.headers;}catch{}
   const report=buildFullReport(audit,client,freshHeaders,freshHtml);
   const html=buildHtmlReport(report);
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="geo-report-${new URL(audit.url).hostname}.html"`,'Cache-Control':'no-store'});
   res.end(html);return;
 }
 const execSummaryMatch=path.match(/^\/api\/v1\/exec-summary\/([^/]+)$/);
 if(execSummaryMatch){
   if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
   const cId=decodeURIComponent(execSummaryMatch[1]);
   const client=await repo.getClient(owner,cId);
   if(!client)return json(res,404,{error:'Client not found'});
   const audits=await repo.listRecords<Audit>(owner,cId,'audit');
   if(!audits[0])return json(res,404,{error:'No audit found for this client'});
   let latestRun=null;
   try{const runs=await repo.listProbeRuns(owner,cId,1);latestRun=runs[0]??null;}catch{}
   const html=buildExecSummaryReport(client,audits[0],latestRun);
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="geo-exec-summary-${client.name.toLowerCase().replace(/\s+/g,'-')}.html"`,'Cache-Control':'no-store'});
   res.end(html);return;
 }
 if(path==='/api/v1/probe'&&req.method==='POST'){
   const {clientId,prompts,providers:pids}=probeSchema.parse(await body(req));
   const client=await repo.getClient(owner,clientId);
   if(!client)return json(res,404,{error:'Client not found'});
   const priorRuns=await repo.listProbeRuns(owner,clientId,50);
   const run=await probeRunner.runProbes(client,prompts,pids,priorRuns);
   // Persist for history/trend tracking (best-effort — don't fail the response)
   try{await repo.saveProbeRun(owner,clientId,run);const alerts=repo.listEnabledAlerts(owner,clientId);const now=new Date().toISOString();for(const a of alerts){const v=a.metric==='mentionRate'?run.mentionRate:a.metric==='citationRate'?run.citationRate:null;if(v===null)continue;const triggered=a.direction==='below'?v<a.threshold:v>a.threshold;if(triggered)repo.updateAlertTriggered(a.id,now);}}catch(e){console.error('probe-run save failed',e)}
   return json(res,200,run);
 }
 const probeHistoryMatch=path.match(/^\/api\/v1\/probe-history\/([^/]+)$/);
 if(probeHistoryMatch){
   if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
   const cId=decodeURIComponent(probeHistoryMatch[1]);
   const runs=await repo.listProbeRuns(owner,cId,20);
   return json(res,200,runs);
 }
 if(path==='/api/v1/competitors'&&req.method==='POST'){
   const {competitorUrls,clientId}=competitorScanSchema.parse(await body(req));
   const refClient=clientId?await repo.getClient(owner,clientId):null;
   const results=await Promise.allSettled(competitorUrls.map(async url=>{
     // Check competitor cache first (keyed by url) to avoid repeated fetches
     const cached=competitorCache.get(url);if(cached)return cached;
     const dummyClient={id:'anon',name:new URL(url).hostname,brandAliases:[],domain:new URL(url).origin,industry:refClient?.industry||'',products:refClient?.products||[],competitors:[],market:refClient?.market||'',created:new Date().toISOString()};
     const snap=snapCache.get(url)??await(async()=>{const s=await crawler.captureWithFlags(url);snapCache.set(url,s);return s;})();
     const dims=analyzeHtml(snap.html,dummyClient);
     const {score,coverage}=aggregate(dims);
     const sub=subScores(dims);
     const topGaps=dims.filter(d=>d.score!==null&&d.score<100).sort((a,b)=>b.weight*(100-b.score!)-a.weight*(100-a.score!)).slice(0,3).map(d=>d.name);
     // cmp-3: extract external domains cited in page (sameAs, links, JSON-LD)
     const citationSources=extractCitationSources(snap.html,url);
     // cmp-4: extract topic clusters from headings
     const topTopics=extractTopTopics(snap.html);
     // dimension scores for gap comparison
     const dimensionScores=dims.map(d=>({id:d.id,name:d.name,score:d.score}));
     const result:CompetitorScanResult={url,name:new URL(url).hostname,score,coverage,subScores:sub,topGaps,citationSources,topTopics,dimensionScores};
     competitorCache.set(url,result);
     return result;
   }));
   const data=results.map(r=>r.status==='fulfilled'?r.value:{url:'',name:'Error',score:0,coverage:0,subScores:{seoScore:null,aeoScore:null,geoScore:null},topGaps:['Scan failed']});
   return json(res,200,data);
 }
 if(path==='/api/v1/benchmark'&&req.method==='POST'){
   const {urls,labels}=benchmarkSchema.parse(await body(req));
   const rows=await Promise.allSettled(urls.map(async(url,i)=>{
     const label=labels?.[i]||new URL(url).hostname;
     const cached=competitorCache.get(url);
     if(cached)return {...cached,label};
     const snap=snapCache.get(url)??await(async()=>{const s=await crawler.captureWithFlags(url);snapCache.set(url,s);return s;})();
     const dims=analyzeHtml(snap.html,{id:'anon',name:label,brandAliases:[],domain:new URL(url).origin,industry:'',products:[],competitors:[],market:'',created:new Date().toISOString()});
     const {score,coverage}=aggregate(dims);
     const sub=subScores(dims);
     const topGaps=dims.filter(d=>d.score!==null&&d.score<100).sort((a,b)=>b.weight*(100-b.score!)-a.weight*(100-a.score!)).slice(0,3).map(d=>d.name);
     const result:CompetitorScanResult={url,name:new URL(url).hostname,score,coverage,subScores:sub,topGaps};
     competitorCache.set(url,result);
     return {...result,label};
   }));
   const data=rows.map((r,i)=>r.status==='fulfilled'?r.value:{url:urls[i],name:'Error',label:labels?.[i]||urls[i],score:0,coverage:0,subScores:{seoScore:null,aeoScore:null,geoScore:null},topGaps:['Scan failed']});
   return json(res,200,data);
 }
 if(path==='/api/v1/smart-prompts'&&req.method==='POST'){
   const b=smartPromptsSchema.parse(await body(req));
   const client=await repo.getClient(owner,b.clientId);
   if(!client)return json(res,404,{error:'Client not found'});
   const audits=await repo.listRecords<Audit>(owner,b.clientId,'audit');
   const audit=b.auditId?audits.find(a=>a.id===b.auditId):audits[0];
   if(!audit)return json(res,404,{error:'No audit found for this client — import a page first'});
   try{const result=await smartPromptsService.generate(client,audit,b.provider);return json(res,200,result);}
   catch(e){const msg=e instanceof Error?e.message:'Generation failed';console.error('smart-prompts failed',e);return json(res,502,{error:msg});}
 }
 if(path==='/api/v1/content-brief'&&req.method==='POST'){
   const b=await body(req);
   const clientId=z.string().uuid().parse(b.clientId);
   const providerId=z.string().min(1).max(60).parse(b.provider);
   const auditId=z.string().optional().parse(b.auditId);
   const client=await repo.getClient(owner,clientId);
   if(!client)return json(res,404,{error:'Client not found'});
   const audits=await repo.listRecords<Audit>(owner,clientId,'audit');
   const audit=auditId?audits.find(a=>a.id===auditId):audits[0];
   if(!audit)return json(res,404,{error:'No audit found for this client — import a page first'});
   try{const brief=await briefService.generate(client,audit,providerId);return json(res,200,brief);}
   catch(e){const msg=e instanceof Error?e.message:'Generation failed';console.error('content-brief failed',e);return json(res,502,{error:msg});}
 }
 if(path==='/api/v1/article-draft'&&req.method==='POST'){
   const b=await body(req);
   const clientId=z.string().uuid().parse(b.clientId);
   const providerId=z.string().min(1).max(60).parse(b.provider);
   const auditId=z.string().optional().parse(b.auditId);
   const client=await repo.getClient(owner,clientId);
   if(!client)return json(res,404,{error:'Client not found'});
   const audits=await repo.listRecords<Audit>(owner,clientId,'audit');
   const audit=auditId?audits.find(a=>a.id===auditId):audits[0];
   if(!audit)return json(res,404,{error:'No audit found for this client — import a page first'});
   try{const draft=await articleDraftService.generate(client,audit,null,providerId);return json(res,200,draft);}
   catch(e){const msg=e instanceof Error?e.message:'Draft generation failed';console.error('article-draft failed',e);return json(res,502,{error:msg});}
 }
 if(path==='/api/v1/rgps/rewrite'&&req.method==='POST'){
   const b=await body(req);
   const url=z.string().url().parse(b.url);
   const provider=z.enum(['openai','gemini','claude']).parse(b.provider??'openai');
   try{
     // Fetch HTML server-side (use cache if available)
     const snap=snapCache.get(url)??await(async()=>{const s=await crawler.captureWithFlags(url);snapCache.set(url,s);return s;})();
     if(!snap.html)return json(res,422,{error:'Page could not be fetched for rewrite'});
     const result=await rgpsRewriteService.rewrite({html:snap.html,url,provider});
     return json(res,200,result);
   }
   catch(e){const msg=e instanceof Error?e.message:'Rewrite failed';console.error('rgps-rewrite failed',e);return json(res,e instanceof CollectionError?(e.status??502):502,{error:msg});}
 }
 // Custom prompts endpoints
 const promptsMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/prompts$/);
 if(promptsMatch){const cId=decodeURIComponent(promptsMatch[1]);if(req.method==='GET')return json(res,200,repo.listCustomPrompts(owner,cId));if(req.method==='POST'){const prompts=customPromptsSchema.parse(await body(req));repo.saveCustomPrompts(owner,cId,prompts);return json(res,200,{saved:prompts.length});}return json(res,405,{error:'Method not allowed'});}
 // Schedule endpoints
 const schedMatch=path.match(/^\/api\/v1\/schedules\/([^/]+)$/);
 if(path==='/api/v1/schedules'&&req.method==='POST'){const b=scheduleSchema.parse(await body(req));const client=await repo.getClient(owner,b.clientId);if(!client)return json(res,404,{error:'Client not found'});const now=new Date();const cd=b.cadence;const next=cd==='daily'?new Date(now.getTime()+86400000):cd==='weekly'?new Date(now.getTime()+7*86400000):new Date(now.getFullYear(),now.getMonth()+1,now.getDate());const s2={id:crypto.randomUUID(),owner,clientId:b.clientId,cadence:b.cadence,providers:b.providers,prompts:b.prompts,nextRunAt:next.toISOString(),enabled:b.enabled??true,created:now.toISOString()};repo.saveSchedule(s2);return json(res,200,s2);}
 if(schedMatch){const cId=decodeURIComponent(schedMatch[1]);if(req.method==='GET')return json(res,200,repo.listSchedules(owner,cId));if(req.method==='DELETE'){const n=repo.deleteSchedule(owner,cId);return json(res,200,{deleted:n});}return json(res,405,{error:'Method not allowed'});}
 // Alert endpoints
 const alertMatch=path.match(/^\/api\/v1\/alerts\/([^/]+)$/);
 if(path==='/api/v1/alerts'&&req.method==='POST'){const b=alertSchema.parse(await body(req));const client=await repo.getClient(owner,b.clientId);if(!client)return json(res,404,{error:'Client not found'});const al={id:crypto.randomUUID(),owner,clientId:b.clientId,metric:b.metric,threshold:b.threshold,direction:b.direction,enabled:b.enabled??true,created:new Date().toISOString()};repo.saveAlert(al);return json(res,200,al);}
 if(alertMatch){const cId=decodeURIComponent(alertMatch[1]);if(req.method==='GET')return json(res,200,repo.listAlerts(owner,cId));if(req.method==='DELETE'&&path.match(/\/alerts\/[^/]+\/[^/]+$/)){const aId=path.split('/').at(-1)!;const ok=repo.deleteAlert(owner,decodeURIComponent(aId));return json(res,ok?200:404,ok?{deleted:aId}:{error:'Alert not found'});}return json(res,405,{error:'Method not allowed'});}
 // Contentful endpoint
 if(path==='/api/v1/cms/contentful/fetch'&&req.method==='POST'){if(!contentfulConnector)return json(res,503,{error:'Contentful not configured. Set CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN.'});const b=contentfulFetchSchema.parse(await body(req));const spaceId=b.spaceId;if(spaceId){const alt=new ContentfulConnector(spaceId,s.contentfulToken!);const snap=await alt.readPage(b.entryId);return json(res,200,snap);}const snap=await contentfulConnector.readPage(b.entryId);return json(res,200,snap);}
 // Findings endpoints
 const findingsMatch=path.match(/^\/api\/v1\/findings\/([^/]+)$/);
 if(path==='/api/v1/findings'&&req.method==='GET'){const cId=z.string().uuid().parse(new URL('http://x'+req.url!).searchParams.get('clientId'));return json(res,200,repo.listFindings(owner,cId));}
 if(findingsMatch&&req.method==='PATCH'){const fId=decodeURIComponent(findingsMatch[1]);const patch=findingPatchSchema.parse(await body(req));const updated=repo.updateFinding(owner,fId,patch);return json(res,updated?200:404,updated??{error:'Finding not found'});}
 // Retest endpoint: re-crawl the finding's URL, create a new audit, auto-resolve matching findings
 const retestMatch=path.match(/^\/api\/v1\/findings\/([^/]+)\/retest$/);
 if(retestMatch&&req.method==='POST'){
   const fId=decodeURIComponent(retestMatch[1]);
   const b=await body(req);
   const cId=z.string().uuid().parse(b.clientId);
   const finding=repo.getFinding(owner,cId,fId);
   if(!finding)return json(res,404,{error:'Finding not found'});
   const client=await repo.getClient(owner,cId);
   if(!client)return json(res,404,{error:'Client not found'});
   // Crawl the URL fresh (bypass cache so we see the actual deployed state)
   const snap=await crawler.captureWithFlags(finding.url);
   const newResult=buildScanResult(snap,client);
   if(!newResult.audit)return json(res,502,{error:'Could not fetch page for retest'});
   const newAudit={...newResult.audit,id:crypto.randomUUID(),clientId:cId,created:new Date().toISOString(),source:'html-import'as const};
   await repo.saveRecords(owner,cId,'audit',[newAudit]);
   // Derive new findings from new audit, persist them
   const newFindings=deriveFindings(newAudit,cId);
   if(newFindings.length)repo.saveFindings(owner,cId,newFindings);
   // Auto-resolve: check if the retested dimension improved to 100
   const retestDim=newAudit.dimensions.find(d=>d.id===finding.dimensionId);
   const resolved=retestDim?.score===100;
   const updated=repo.updateFinding(owner,fId,{
     status:resolved?'resolved':'open',
     resolvedAuditId:resolved?newAudit.id:undefined,
     scoreAfter:retestDim?.score??undefined,
   });
   return json(res,200,{finding:updated,newAudit,resolved,scoreAfter:retestDim?.score??null,scoreBefore:finding.scoreBefore??null});
 }
 // Audit log endpoint
 if(path==='/api/v1/audit-log'&&req.method==='GET'){const limit=Math.min(200,Number(new URL('http://x'+req.url!).searchParams.get('limit')||'50')||50);return json(res,200,repo.listAuditLog(owner,limit));}
 // Page question mapping endpoint
 if(path==='/api/v1/scan/questions'&&req.method==='POST'){
   const b=await body(req);
   const url=z.string().url().parse(b.url);
   const clientId=z.string().uuid().optional().parse(b.clientId);
   const client2=clientId?(await repo.getClient(owner,clientId)||null):null;
   const dummyClient=client2||{id:'anon',name:'',brandAliases:[],domain:new URL(url).origin,industry:b.industry||'',products:b.products||[],competitors:b.competitors||[],market:b.market||'United States',created:new Date().toISOString()};
   const snap=snapCache.get(url)??await(async()=>{const s=await crawler.captureWithFlags(url);snapCache.set(url,s);return s;})();
   if(!snap.html)return json(res,422,{error:'Could not fetch page HTML'});
   const text=extractPageText(snap.html);
   const questions=queryUniverse(dummyClient);
   return json(res,200,mapQuestionsToPage(text,questions));
 }
 // CMS endpoints
 if(path==='/api/v1/cms/adapters'&&req.method==='GET')return json(res,200,CMS_ADAPTERS);
 if(path==='/api/v1/cms/change-instructions'&&req.method==='POST'){
   const b=await body(req);
   const cId=z.string().uuid().parse(b.clientId);
   const fId=z.string().uuid().parse(b.findingId);
   const adapterId=z.string().min(1).max(60).parse(b.adapterId);
   const finding=repo.getFinding(owner,cId,fId);
   if(!finding)return json(res,404,{error:'Finding not found'});
   return json(res,200,generateChangeInstructions(finding,adapterId));
 }
 // Recommendations endpoints
 const recsMatch=path.match(/^\/api\/v1\/recommendations\/([^/]+)$/);
 if(path==='/api/v1/recommendations'&&req.method==='GET'){const cId=z.string().uuid().parse(new URL('http://x'+req.url!).searchParams.get('clientId'));return json(res,200,repo.listRecommendations(owner,cId));}
 if(path==='/api/v1/recommendations'&&req.method==='POST'){
   const b=await body(req);
   const cId=z.string().uuid().parse(b.clientId);
   const fId=z.string().uuid().parse(b.findingId);
   const finding=repo.getFinding(owner,cId,fId);
   if(!finding)return json(res,404,{error:'Finding not found'});
   const now=new Date().toISOString();
   const rec={
     id:crypto.randomUUID(),clientId:cId,findingId:fId,
     title:b.title??finding.title,
     proposal:b.proposal??proposalFromFinding(finding),
     owner:b.owner??ownerFromDimension(finding.dimensionId),
     effort:(b.effort??'medium') as 'low'|'medium'|'high',
     impact:(b.impact??'medium') as 'low'|'medium'|'high',
     status:'draft' as const,
     created:now,updated:now,
   };
   repo.saveRecommendation(owner,rec);
   return json(res,200,rec);
 }
 if(recsMatch&&req.method==='PATCH'){const rId=decodeURIComponent(recsMatch[1]);const patch=recommendationPatchSchema.parse(await body(req));const updated=repo.updateRecommendation(owner,rId,patch);return json(res,updated?200:404,updated??{error:'Recommendation not found'});}
 return json(res,404,{error:'Endpoint not found'});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
 if(path==='/healthz')return json(res,200,{status:'ok'});
 const decoded=decodeURIComponent(path);let file=resolve(s.clientDir,'.'+decoded);if(!file.startsWith(s.clientDir+sep)&&file!==s.clientDir)return json(res,403,{error:'Path denied'});
 if(!existsSync(file)||statSync(file).isDirectory()){if(extname(decoded))return json(res,404,{error:'File not found'});file=resolve(s.clientDir,'index.html')}
 if(!existsSync(file))return json(res,503,{error:'Frontend is not built. Run npm run build, or use npm run dev.'});
 const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-store':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
 }catch(e){if(e instanceof CollectionError)return json(res,e.status,{error:e.message});const message=e instanceof z.ZodError?e.issues[0]?.message:e instanceof SyntaxError?'Invalid JSON':e instanceof Error?e.message:'Request failed';const status=message==='Client not found'?404:e instanceof z.ZodError||e instanceof SyntaxError||message==='Request too large'||message==='Page URL must belong to the client domain'||e instanceof URIError?400:500;if(status===500)console.error('Request failed',e);json(res,status,{error:status===500?'Request failed. Check the server log.':message})}
 });server.requestTimeout=300000;server.headersTimeout=15000;return {server,repo};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const s=settings();const {server,repo}=createWorkbenchServer(s);server.listen(s.port,s.bind,()=>console.log(`GEO Workbench API running on ${s.bind}:${s.port} (${s.mode} authentication)`));for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>{repo.close();process.exit(0)}));}
