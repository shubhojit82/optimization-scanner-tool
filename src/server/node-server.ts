import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
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
import {NodeCrawler} from './node-crawler';
import {buildScanResult} from '../application/scanner';
import {buildXlsx} from './xlsx-export';
import {crawlSite} from './site-crawler';
import {buildSiteXlsx} from './site-xlsx-export';
import {CollectionError, type AIProvider, type ProviderInfo, type Audit, type CompetitorScanResult} from '../core/contracts';
import {clientSchema,auditSchema,observationSchema,identitySchema,scanSchema,probeSchema,competitorScanSchema,benchmarkSchema,smartPromptsSchema} from '../adapters/validation';
import {buildFullReport} from '../core/report-analysis';
import {buildHtmlReport} from './html-report';
import {buildExecSummaryReport} from './exec-summary-report';
import {analyzeHtml,aggregate,subScores} from '../core/scoring';
import {ScanCache} from './scan-cache';
import {ContentBriefService} from '../application/content-brief';
import {SmartPromptsService} from '../application/smart-prompts';
export type Settings={mode:'local'|'basic';bind:string;port:number;dataDir:string;origins:string[];username:string;password:string;clientDir:string;openaiKey?:string;openaiModel?:string;geminiKey?:string;geminiModel?:string;claudeKey?:string;claudeModel?:string};
export function settings(e:NodeJS.ProcessEnv=process.env):Settings {
 const mode=e.GEO_AUTH_MODE||'local';if(mode!=='local'&&mode!=='basic')throw new Error('GEO_AUTH_MODE must be local or basic');
 const bind=e.GEO_BIND||(mode==='local'?'127.0.0.1':'0.0.0.0');
 if(mode==='local'&&!['127.0.0.1','::1','localhost'].includes(bind))throw new Error('Local authentication may only bind to loopback');
 const port=Number(e.PORT||8080);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid PORT');
 const username=mode==='local'?(e.GEO_LOCAL_USER||'local-admin'):(e.GEO_ADMIN_USERNAME||'');const password=e.GEO_ADMIN_PASSWORD||'';
 if(mode==='basic'&&(!username||username.includes(':')||password.length<16||password.includes('REPLACE_')))throw new Error('Basic authentication requires a username and a unique password of at least 16 characters');
 const origins=(e.GEO_ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080').split(',').map(s=>s.trim()).filter(Boolean);
 for(const o of origins){const u=new URL(o);if(u.origin!==o||!['http:','https:'].includes(u.protocol))throw new Error('Allowed origins must be exact HTTP(S) origins')}
 return {mode,bind,port,dataDir:resolve(e.GEO_DATA_DIR||'data'),origins,username,password,clientDir:resolve('dist/client'),openaiKey:e.OPENAI_API_KEY?.trim()||undefined,openaiModel:e.GEO_OPENAI_MODEL?.trim()||'gpt-4o-mini',geminiKey:e.GEMINI_API_KEY?.trim()||undefined,geminiModel:e.GEO_GEMINI_MODEL?.trim()||'gemini-3.8-flash',claudeKey:e.ANTHROPIC_API_KEY?.trim()||undefined,claudeModel:e.GEO_CLAUDE_MODEL?.trim()||'claude-opus-4-5-20251101'};
}
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest())}
function authenticated(req:IncomingMessage,s:Settings){if(s.mode==='local')return true;const a=req.headers.authorization;if(!a||!a.startsWith('Basic '))return false;let decoded:string;try{decoded=Buffer.from(a.slice(6),'base64').toString('utf8')}catch{return false}return equal(decoded,s.username+':'+s.password)}
function json(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function body(req:IncomingMessage){const chunks:Buffer[]=[];let bytes=0;for await(const chunk of req){const b=Buffer.from(chunk);bytes+=b.length;if(bytes>600000)throw new Error('Request too large');chunks.push(b)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
export function createWorkbenchServer(s:Settings, supplied?:{providers:Map<string,AIProvider>;info:ProviderInfo[]}){const repo=new SqliteRepository(s.dataDir);const app=new Workbench(repo);
 const providers=supplied?.providers||new Map<string,AIProvider>();
 if(!supplied&&s.openaiKey)providers.set('openai',new OpenAIProvider(s.openaiKey,s.openaiModel));
 if(!supplied&&s.geminiKey)providers.set('gemini',new GeminiProvider(s.geminiKey,s.geminiModel));
 if(!supplied&&s.claudeKey)providers.set('claude',new ClaudeProvider(s.claudeKey,s.claudeModel));
 const info=supplied?.info||[
   {id:'openai',label:'OpenAI web search',model:s.openaiModel||'gpt-4o-mini',configured:!!s.openaiKey},
   {id:'gemini',label:'Google Gemini grounded search',model:s.geminiModel||'gemini-3.8-flash',configured:!!s.geminiKey},
   {id:'claude',label:'Anthropic Claude web search',model:s.claudeModel||'claude-opus-4-5-20251101',configured:!!s.claudeKey},
 ];
 const runner=new ObservationRunner(repo,providers);
 const probeRunner=new ProbeRunner(providers);
 const identities=new ClientIdentityService(repo);
 const crawler=new NodeCrawler(25000);
 // 5-minute TTL, 50-entry LRU caches — avoids redundant HTTP fetches
 const snapCache=new ScanCache<Awaited<ReturnType<NodeCrawler['captureWithFlags']>>>(5*60*1000,50);
 const competitorCache=new ScanCache<CompetitorScanResult>(5*60*1000,50);
 // Evict expired entries every 10 minutes
 setInterval(()=>{snapCache.evictExpired();competitorCache.evictExpired();},10*60*1000).unref();
 const briefService=new ContentBriefService({openaiKey:s.openaiKey,openaiModel:s.openaiModel,geminiKey:s.geminiKey,geminiModel:s.geminiModel,claudeKey:s.claudeKey,claudeModel:s.claudeModel});
 const smartPromptsService=new SmartPromptsService({openaiKey:s.openaiKey,openaiModel:s.openaiModel,geminiKey:s.geminiKey,geminiModel:s.geminiModel,claudeKey:s.claudeKey,claudeModel:s.claudeModel});
 const runSchema=z.object({provider:z.string().min(1).max(60),prompt:z.string().trim().min(5).max(2000),requestId:z.string().uuid()}).strict();
 const server=createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 if(s.mode==='local'){let h='';try{h=new URL('http://'+(req.headers.host||'')).hostname}catch{}if(!['127.0.0.1','localhost','[::1]'].includes(h))return json(res,403,{error:'Host denied'})}
 if(!authenticated(req,s)){res.setHeader('WWW-Authenticate','Basic realm="GEO Workbench", charset="UTF-8"');return json(res,401,{error:'Sign in required'})}
 // Identity comes only from configured authentication. Client identity headers are ignored.
 const owner=s.username;
 let path:string;try{path=new URL(req.url||'/', 'http://app.internal').pathname}catch{return json(res,400,{error:'Invalid URL'})}
 try {
 if(path.startsWith('/api/')){
 if(!['GET','POST','DELETE'].includes(req.method||''))return json(res,405,{error:'Method not allowed'});
 if(['POST','DELETE'].includes(req.method||'')&&!s.origins.includes(req.headers.origin||''))return json(res,403,{error:'Origin denied'});
 if(path==='/api/v1/providers')return req.method==='GET'?json(res,200,info):json(res,405,{error:'Method not allowed'});
 const identityMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/identity$/);
 if(identityMatch){if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});const input=identitySchema.parse(await body(req));return json(res,200,await identities.update(owner,decodeURIComponent(identityMatch[1]),input));}
 const runMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/observation-runs$/);
 if(runMatch){if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});const input=runSchema.parse(await body(req));return json(res,200,await runner.run(owner,decodeURIComponent(runMatch[1]),input.provider,input.prompt,input.requestId));}
 if(path==='/api/v1/clients'){
 if(req.method==='GET')return json(res,200,await repo.listClients(owner));
 const data=clientSchema.parse(await body(req));const c={...data,domain:new URL(data.domain).origin,id:crypto.randomUUID(),created:new Date().toISOString()};await repo.saveClient(owner,c);return json(res,200,c)}
 const recordMatch=path.match(/^\/api\/v1\/clients\/([^/]+)\/(audits|observations)\/([^/]+)$/);
 if(recordMatch){const[,cId,kind,rId]=[...recordMatch].map(decodeURIComponent);if(req.method!=='DELETE')return json(res,405,{error:'Method not allowed'});const ok=await repo.deleteRecord(owner,cId,kind as 'audit'|'observation',rId);return json(res,ok?200:404,ok?{deleted:rId}:{error:'Record not found'});}
 const m=path.match(/^\/api\/v1\/clients\/([^/]+)(?:\/(audits|observations))?$/);
 if(m){const id=decodeURIComponent(m[1]);if(req.method==='GET'&&!m[2])return json(res,200,await app.detail(owner,id));if(req.method==='DELETE'&&!m[2]){const ok=await repo.deleteClient(owner,id);return json(res,ok?200:404,ok?{deleted:id}:{error:'Client not found'})}if(req.method==='POST'&&m[2]==='audits'){const d=auditSchema.parse(await body(req));return json(res,200,await app.audit(owner,id,d.url,d.html))}if(req.method==='POST'&&m[2]==='observations')return json(res,200,await app.observations(owner,id,observationSchema.parse(await body(req))));return json(res,405,{error:'Method not allowed'})}
 if(path==='/api/v1/scan'&&req.method==='POST'){
   const {url,clientId}=scanSchema.parse(await body(req));
   const client=clientId?(await repo.getClient(owner,clientId)||null):null;
   const dummyClient=client||{id:'anon',name:'',brandAliases:[],domain:url,industry:'',products:[],competitors:[],market:'',created:new Date().toISOString()};
   const snap=snapCache.get(url)??await(async()=>{const s=await crawler.captureWithFlags(url);snapCache.set(url,s);return s;})();
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
   if(dupe)return json(res,200,dupe);
   // Assign a fresh id and stamp it to this client
   const record={...audit,id:crypto.randomUUID(),clientId:cId,created:new Date().toISOString(),source:'html-import'};
   await repo.saveRecords(owner,cId,'audit',[record]);
   return json(res,200,record);
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
   const run=await probeRunner.runProbes(client,prompts,pids);
   // Persist for history/trend tracking (best-effort — don't fail the response)
   try{await repo.saveProbeRun(owner,clientId,run)}catch(e){console.error('probe-run save failed',e)}
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
     const result:CompetitorScanResult={url,name:new URL(url).hostname,score,coverage,subScores:sub,topGaps};
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
