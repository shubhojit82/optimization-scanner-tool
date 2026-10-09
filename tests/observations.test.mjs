import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {OpenAIProvider} from '../dist/server/server/providers/openai-provider.js';
import {ObservationRunner} from '../dist/server/application/observation-runner.js';
import {SqliteRepository} from '../dist/server/server/sqlite-repository.js';
import {settings,createWorkbenchServer} from '../dist/server/server/node-server.js';

const fixture={id:'resp_fixture',model:'fixture-model',status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Acme offers a CMS. [1]',annotations:[{type:'url_citation',url:'https://acme.example/cms',start_index:18,end_index:21},{type:'url_citation',url:'javascript:alert(1)',start_index:0,end_index:4}]}]}]};
const c={id:'client-fixture',name:'Acme',domain:'https://acme.example',industry:'Software',market:'United States',products:['CMS'],competitors:[],created:new Date().toISOString()};
const evidence={engine:'openai',surface:'Fixture API',model:'fixture',prompt:'Which CMS should we use?',response:'Acme offers a CMS.',citations:['https://acme.example'],observedAt:new Date().toISOString()};
async function database(run){const dir=mkdtempSync(join(tmpdir(),'geo-observation-'));const repo=new SqliteRepository(dir);try{await repo.saveClient('alice',c);await run(repo)}finally{repo.close();rmSync(dir,{recursive:true,force:true})}}

test('OpenAI adapter sends an unbranded query, requires search, and extracts evidence with safe citations',async()=>{
 let call;
 const p=new OpenAIProvider('fixture-secret','gpt-4.1',async(url,init)=>{call={url,init};return Response.json(fixture)});
 const row=await p.observe(evidence.prompt,c.market);
 assert.equal(call.url,'https://api.openai.com/v1/responses');assert.equal(call.init.headers.Authorization,'Bearer fixture-secret');
 const payload=JSON.parse(call.init.body);assert.equal(payload.input,evidence.prompt);assert.equal(payload.store,false);assert.equal(payload.tool_choice,'required');assert.equal(payload.max_output_tokens,2048);assert.match(payload.instructions,/United States/);assert.doesNotMatch(payload.instructions,/Acme/);
 assert.equal(row.providerResponseId,'resp_fixture');assert.equal(row.model,'fixture-model');assert.equal(row.prompt,evidence.prompt);assert.deepEqual(row.citations,['https://acme.example/cms']);assert.deepEqual(row.annotations,[{url:'https://acme.example/cms',startIndex:18,endIndex:21}]);assert.ok(!JSON.stringify(row).includes('fixture-secret'));
});

test('provider failures never become a blank or fabricated observation and do not expose upstream payloads',async()=>{
 const cases=[
  [async()=>new Response('fixture-secret', {status:401}),/API key/],
  [async()=>new Response('private upstream details', {status:429}),/quota/],
  [async()=>new Response('private upstream details', {status:400}),/model|MODEL/],
  [async()=>{throw new Error('fixture-secret')},/connection/],
  [async()=>new Response('invalid JSON'),/invalid JSON/],
  [async()=>Response.json({...fixture,status:'incomplete'}),/incomplete/],
  [async()=>Response.json({...fixture,output:fixture.output.slice(1)}),/web search/],
  [async()=>Response.json({...fixture,output:[fixture.output[0]]}),/empty/]
 ];
 for(const [request,match] of cases){const p=new OpenAIProvider('fixture-secret','fixture-model',request);await assert.rejects(p.observe(evidence.prompt,c.market),e=>{assert.match(e.message,match);assert.doesNotMatch(e.message,/fixture-secret|private upstream/);return true})}
});

test('collection is owner-scoped, persists API evidence, and replays completed requests without paying again',async()=>database(async repo=>{
 let calls=0;const p={id:'openai',observe:async(prompt)=>{calls++;return {...evidence,prompt}}};const runner=new ObservationRunner(repo,new Map([['openai',p]]));const requestId=randomUUID();
 await assert.rejects(runner.run('bob',c.id,'openai',evidence.prompt,requestId),/Client not found/);assert.equal(calls,0);
 const first=await runner.run('alice',c.id,'openai',evidence.prompt,requestId);assert.equal(first.source,'ai-provider');assert.equal((await repo.listRecords('alice',c.id,'observation')).length,1);
 const replay=await runner.run('alice',c.id,'openai',evidence.prompt,requestId);assert.equal(replay.id,first.id);assert.equal(calls,1);
 await assert.rejects(runner.run('alice',c.id,'openai','A different question?',requestId),/already used/);assert.equal(calls,1);
 assert.equal(await repo.findObservation('bob',c.id,first.id),null);
}));

test('missing provider and failed collection leave the evidence and visibility sample empty',async()=>database(async repo=>{
 const missing=new ObservationRunner(repo,new Map());await assert.rejects(missing.run('alice',c.id,'openai',evidence.prompt,randomUUID()),/not configured/);
 const failure=new ObservationRunner(repo,new Map([['openai',{id:'openai',observe:async()=>{throw new Error('provider failed')}}]]));await assert.rejects(failure.run('alice',c.id,'openai',evidence.prompt,randomUUID()),/provider failed/);assert.equal((await repo.listRecords('alice',c.id,'observation')).length,0);
}));

test('simultaneous duplicate and capacity requests cannot trigger extra provider calls',async()=>database(async repo=>{
 const release=[];let calls=0;const runner=new ObservationRunner(repo,new Map([['openai',{id:'openai',observe:()=>{calls++;return new Promise(resolve=>release.push(()=>resolve(evidence)))}}]]));const firstId=randomUUID();
 const first=runner.run('alice',c.id,'openai',evidence.prompt,firstId);await new Promise(r=>setImmediate(r));
 await assert.rejects(runner.run('alice',c.id,'openai',evidence.prompt,firstId),/already running/);
 const second=runner.run('alice',c.id,'openai',evidence.prompt,randomUUID());await new Promise(r=>setImmediate(r));
 await assert.rejects(runner.run('alice',c.id,'openai',evidence.prompt,randomUUID()),/Two queries/);assert.equal(calls,2);
 release.forEach(r=>r());await Promise.all([first,second]);
 assert.equal((await repo.listRecords('alice',c.id,'observation')).length,2);
}));

test('HTTP provider discovery excludes secrets; run route enforces origin, input and client ownership',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'geo-run-http-'));
 const s=settings({GEO_DATA_DIR:dir,OPENAI_API_KEY:'fixture-secret'});
 let calls=0;const p={id:'openai',observe:async(prompt)=>{calls++;return {...evidence,prompt}}};
 const {server,repo}=createWorkbenchServer(s,{providers:new Map([['openai',p]]),info:[{id:'openai',label:'Fixture provider',model:'fixture',configured:true}]});
 await repo.saveClient('local-admin',c);server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const data={provider:'openai',prompt:evidence.prompt,requestId:randomUUID()};const options=(input,origin='http://localhost:5173')=>({method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
 try {
  const info=await (await fetch(base+'/api/v1/providers')).text();assert.doesNotMatch(info,/fixture-secret/);assert.match(info,/configured/);
  const path='/api/v1/clients/'+c.id+'/observation-runs';
  assert.equal((await fetch(base+path,options(data,'https://attacker.example'))).status,403);
  assert.equal((await fetch(base+path,options({...data,requestId:'bad'}))).status,400);
  assert.equal((await fetch(base+'/api/v1/clients/missing/observation-runs',options(data))).status,404);assert.equal(calls,0);
  const run=await fetch(base+path,options(data));assert.equal(run.status,200);assert.equal((await run.json()).source,'ai-provider');
  assert.equal((await fetch(base+path,options(data))).status,200);assert.equal(calls,1);
  const detail=await (await fetch(base+'/api/v1/clients/'+c.id)).json();assert.deepEqual(detail.visibility,{sample:1,mentionRate:100,citationRate:100});
  assert.equal((await fetch(base+path,options({...data,requestId:randomUUID(),provider:'missing'}))).status,503);
 }finally{await new Promise(r=>server.close(r));repo.close();rmSync(dir,{recursive:true,force:true})}
});
