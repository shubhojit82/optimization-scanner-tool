import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {mentionsBrand} from '../dist/server/core/brand-matching.js';
import {analyzeHtml,visibility,RUBRIC_VERSION} from '../dist/server/core/scoring.js';
import {ClientIdentityService} from '../dist/server/application/client-identity.js';
import {Workbench} from '../dist/server/application/workbench.js';
import {SqliteRepository} from '../dist/server/server/sqlite-repository.js';
import {settings,createWorkbenchServer} from '../dist/server/server/node-server.js';
const c={id:'identity-client',name:'WorldFinancialgroup',domain:'https://www.worldfinancialgroup.com',industry:'Insurance',market:'United States',products:['Life insurance'],competitors:['Peer'],created:'2026-10-05T12:00:00Z'};
const identity={name:'World Financial Group',brandAliases:['WFG','WorldFinancialgroup']};
const ob={id:'saved-answer',clientId:c.id,created:c.created,source:'manual-import',engine:'fixture',surface:'fixture',model:'fixture',prompt:'Which life insurance providers are available?',response:'World Financial Group (WFG) is an option.',citations:[],observedAt:c.created};
async function database(run){const dir=mkdtempSync(join(tmpdir(),'geo-identity-'));const repo=new SqliteRepository(dir);try{await repo.saveClient('alice',c);await run(repo,dir)}finally{repo.close();rmSync(dir,{recursive:true,force:true})}}

test('brand identity recognizes canonical names and explicit aliases without substring or regex false positives',()=>{
 const client={...c,...identity};
 for(const text of ['world financial group','WORLD\n FINANCIAL\tGROUP','Choose WFG.','WorldFinancialgroup is an option.'])assert.equal(mentionsBrand(client,text),true,text);
 for(const text of ['WFGrowth','XWFG','World Financial Grouper','No target brand here'])assert.equal(mentionsBrand(client,text),false,text);
 assert.equal(mentionsBrand({...c,name:'A+B',brandAliases:['X.Y']},'Choose A+B and X.Y.'),true);
 assert.equal(mentionsBrand({...c,name:'A+B',brandAliases:['X.Y']},'Choose AAAB and XZY.'),false);
 assert.equal(mentionsBrand(c,'World Financial Group'),false);
 assert.deepEqual(visibility(client,[{...ob,response:'World Financial Group, WFG, WorldFinancialgroup.'}]),{sample:1,mentionRate:100,citationRate:0});
});

test('new audit rubric uses visible brand aliases and keeps script/comment evidence excluded',()=>{
 assert.equal(RUBRIC_VERSION,'readiness-cues/1.1.0');const client={...c,...identity};
 assert.equal(analyzeHtml('<h1>WFG</h1>',client).find(d=>d.id==='entity').score,100);
 assert.equal(analyzeHtml('<!--WFG--><script>World Financial Group</script><h1>Other company</h1>',client).find(d=>d.id==='entity').score,0);
});

test('identity updates preserve client fields, observations and immutable old audits while recalculating mention rates',async()=>database(async repo=>{
 const app=new Workbench(repo);const oldAudit=await app.audit('alice',c.id,c.domain,'<h1>World Financial Group</h1>');await repo.saveRecords('alice',c.id,'observation',[ob]);
 assert.equal((await app.detail('alice',c.id)).visibility.mentionRate,0);
 const service=new ClientIdentityService(repo);const updated=await service.update('alice',c.id,{name:' World Financial Group ',brandAliases:[' WFG ','wfg','world financial group','WorldFinancialgroup']});
 assert.deepEqual(updated.brandAliases,['WFG','WorldFinancialgroup']);assert.equal(updated.id,c.id);assert.equal(updated.created,c.created);assert.equal(updated.domain,c.domain);assert.deepEqual(updated.products,c.products);assert.deepEqual(updated.competitors,c.competitors);assert.ok(updated.updated);
 const after=await app.detail('alice',c.id);assert.equal(after.visibility.mentionRate,100);assert.equal(after.visibility.citationRate,0);assert.deepEqual(after.observations,[ob]);assert.deepEqual(after.audits,[oldAudit]);assert.equal(oldAudit.dimensions.find(d=>d.id==='entity').score,0);
 const next=await app.audit('alice',c.id,c.domain,'<h1>World Financial Group</h1>');assert.equal(next.dimensions.find(d=>d.id==='entity').score,100);assert.equal(next.version,'readiness-cues/1.1.0');
}));

test('identity edit denies another owner and missing client before mutating stored data',async()=>database(async repo=>{
 const service=new ClientIdentityService(repo);await assert.rejects(service.update('bob',c.id,identity),/Client not found/);await assert.rejects(service.update('alice','missing',identity),/Client not found/);assert.deepEqual(await repo.getClient('alice',c.id),c);
 assert.equal(await repo.updateIdentity('bob',c.id,identity,new Date().toISOString()),null);assert.deepEqual(await repo.getClient('alice',c.id),c);
}));

test('identity changes persist across SQLite reopen',async()=>database(async(repo,dir)=>{
 await new ClientIdentityService(repo).update('alice',c.id,identity);const second=new SqliteRepository(dir);try{const saved=await second.getClient('alice',c.id);assert.equal(saved.name,identity.name);assert.deepEqual(saved.brandAliases,identity.brandAliases);assert.equal(await second.getClient('bob',c.id),null)}finally{second.close()}
}));

test('HTTP identity edit validates aliases, blocks other fields and origins, and preserves the existing evidence sample',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'geo-identity-http-'));const s=settings({GEO_DATA_DIR:dir});const {server,repo}=createWorkbenchServer(s);await repo.saveClient('local-admin',c);await repo.saveClient('other-owner',{...c,id:'other-client'});await repo.saveRecords('local-admin',c.id,'observation',[ob]);server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;const path='/api/v1/clients/'+c.id+'/identity';
 const post=(body,origin='http://localhost:5173')=>({method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+path,post(identity,'https://other.example'))).status,403);
  for(const bad of [{name:'x',brandAliases:[]},{...identity,brandAliases:Array(11).fill('WFG')},{...identity,domain:'https://other.example'},{...identity,brandAliases:['']}])assert.equal((await fetch(base+path,post(bad))).status,400);
  assert.equal((await fetch(base+'/api/v1/clients/other-client/identity',post(identity))).status,404);
  const result=await fetch(base+path,post(identity));assert.equal(result.status,200);assert.equal((await result.json()).id,c.id);
  const detail=await(await fetch(base+'/api/v1/clients/'+c.id)).json();assert.equal(detail.visibility.sample,1);assert.equal(detail.visibility.mentionRate,100);assert.equal(detail.visibility.citationRate,0);assert.deepEqual(detail.observations,[ob]);
 }finally{await new Promise(r=>server.close(r));repo.close();rmSync(dir,{recursive:true,force:true})}
});
