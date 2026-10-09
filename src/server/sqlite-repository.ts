import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {Client,Repository,Observation,ObservationLookup,ClientIdentity,ClientIdentityStore,ProbeRun} from '../core/contracts';
export class SqliteRepository implements Repository,ObservationLookup,ClientIdentityStore {
 readonly db:DatabaseSync;
 constructor(dir:string){mkdirSync(dir,{recursive:true});this.db=new DatabaseSync(join(dir,'geo.sqlite'));this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY NOT NULL)');
 if(!this.db.prepare('SELECT version FROM schema_migrations WHERE version=1').get()){this.db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE clients(id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
 CREATE INDEX idx_clients_owner_created ON clients(owner,created);
 CREATE TABLE records(id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,client_id TEXT NOT NULL REFERENCES clients(id),kind TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
 CREATE INDEX idx_records_owner_client_kind_created ON records(owner,client_id,kind,created);
 INSERT INTO schema_migrations(version) VALUES(1); COMMIT;`);}}
 async listClients(owner:string){return (this.db.prepare('SELECT data FROM clients WHERE owner=? ORDER BY created DESC LIMIT 100').all(owner) as {data:string}[]).map(r=>JSON.parse(r.data) as Client)}
 async getClient(owner:string,id:string){const r=this.db.prepare('SELECT data FROM clients WHERE owner=? AND id=?').get(owner,id) as {data:string}|undefined;return r?JSON.parse(r.data) as Client:null}
 async saveClient(owner:string,c:Client){this.db.prepare('INSERT INTO clients(id,owner,data,created) VALUES(?,?,?,?)').run(c.id,owner,JSON.stringify(c),c.created)}
 async deleteClient(owner:string,id:string){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('DELETE FROM records WHERE owner=? AND client_id=?').run(owner,id);const r=this.db.prepare('DELETE FROM clients WHERE owner=? AND id=?').run(owner,id);this.db.exec('COMMIT');return (r as {changes:number}).changes>0}catch(e){this.db.exec('ROLLBACK');throw e}}
 async listRecords<T>(owner:string,id:string,kind:'audit'|'observation'){return (this.db.prepare('SELECT data FROM records WHERE owner=? AND client_id=? AND kind=? ORDER BY created DESC LIMIT 200').all(owner,id,kind) as {data:string}[]).map(r=>JSON.parse(r.data) as T)}
 async saveRecords(owner:string,id:string,kind:'audit'|'observation',rows:{id:string;created:string}[]){this.db.exec('BEGIN IMMEDIATE');try{const q=this.db.prepare('INSERT INTO records(id,owner,client_id,kind,data,created) VALUES(?,?,?,?,?,?)');for(const r of rows)q.run(r.id,owner,id,kind,JSON.stringify(r),r.created);this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}}
 async deleteRecord(owner:string,clientId:string,kind:'audit'|'observation',recordId:string){const r=this.db.prepare('DELETE FROM records WHERE owner=? AND client_id=? AND kind=? AND id=?').run(owner,clientId,kind,recordId);return (r as {changes:number}).changes>0}
 async saveProbeRun(owner:string,clientId:string,run:ProbeRun){this.db.prepare('INSERT INTO records(id,owner,client_id,kind,data,created) VALUES(?,?,?,?,?,?)').run(run.id,owner,clientId,'probe-run',JSON.stringify(run),run.created)}
 async listProbeRuns(owner:string,clientId:string,limit=20){return (this.db.prepare('SELECT data FROM records WHERE owner=? AND client_id=? AND kind=? ORDER BY created DESC LIMIT ?').all(owner,clientId,'probe-run',limit) as {data:string}[]).map(r=>JSON.parse(r.data) as ProbeRun)}
 async findObservation(owner:string,clientId:string,id:string){const r=this.db.prepare("SELECT data FROM records WHERE owner=? AND client_id=? AND id=? AND kind='observation'").get(owner,clientId,id) as {data:string}|undefined;return r?JSON.parse(r.data) as Observation:null}
 async updateIdentity(owner:string,clientId:string,identity:ClientIdentity,updatedAt:string){
 const row=this.db.prepare("UPDATE clients SET data=json_set(data,'$.name',?,'$.brandAliases',json(?),'$.updated',?) WHERE owner=? AND id=? RETURNING data").get(identity.name,JSON.stringify(identity.brandAliases),updatedAt,owner,clientId) as {data:string}|undefined;
 return row?JSON.parse(row.data) as Client:null;
 }
 close(){this.db.close()}
}
