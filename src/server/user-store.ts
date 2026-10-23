import type {DatabaseSync} from 'node:sqlite';
import type {AppUser,AccessRequest,AccessRequestStatus,UserRole} from '../core/contracts';

type UserRow={id:string;email:string;name:string;role:string;status:string;pass_hash:string|null;created:string;last_login:string|null};
type RequestRow={id:string;name:string;email:string;company:string;role:string;reason:string;status:string;created:string;decided_at:string|null;decided_by:string|null;note:string|null};

/** SQL for users, access requests, invites, sessions and per-client grants. Tables are created by migration 6 in SqliteRepository. */
export class UserStore{
 constructor(private readonly db:DatabaseSync){}
 clientIds(userId:string){return (this.db.prepare('SELECT client_id FROM client_access WHERE user_id=?').all(userId) as {client_id:string}[]).map(r=>r.client_id)}
 private map(r:UserRow):AppUser{return{id:r.id,email:r.email,name:r.name,role:r.role as UserRole,status:r.status as AppUser['status'],created:r.created,lastLogin:r.last_login??undefined,passwordSet:!!r.pass_hash,clientIds:this.clientIds(r.id)}}
 private mapRequest(r:RequestRow):AccessRequest{return{id:r.id,name:r.name,email:r.email,company:r.company,role:r.role,reason:r.reason,status:r.status as AccessRequestStatus,created:r.created,decidedAt:r.decided_at??undefined,decidedBy:r.decided_by??undefined,note:r.note??undefined}}

 getById(id:string):AppUser|null{const r=this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow|undefined;return r?this.map(r):null}
 getByEmail(email:string):AppUser|null{const r=this.db.prepare('SELECT * FROM users WHERE email=?').get(email) as UserRow|undefined;return r?this.map(r):null}
 withHash(email:string):{user:AppUser;hash:string|null}|null{const r=this.db.prepare('SELECT * FROM users WHERE email=?').get(email) as UserRow|undefined;return r?{user:this.map(r),hash:r.pass_hash}:null}
 list():AppUser[]{return (this.db.prepare('SELECT * FROM users ORDER BY created DESC LIMIT 500').all() as UserRow[]).map(r=>this.map(r))}
 create(u:{id:string;email:string;name:string;role:UserRole;created:string}){this.db.prepare('INSERT INTO users(id,email,name,role,status,pass_hash,created) VALUES(?,?,?,?,?,NULL,?)').run(u.id,u.email,u.name,u.role,'active',u.created)}
 update(id:string,patch:{role?:UserRole;status?:'active'|'disabled'}){
  if(patch.role)this.db.prepare('UPDATE users SET role=? WHERE id=?').run(patch.role,id);
  if(patch.status){this.db.prepare('UPDATE users SET status=? WHERE id=?').run(patch.status,id);if(patch.status==='disabled')this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id)}
 }
 setPassword(id:string,hash:string){this.db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hash,id);this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id)}
 touchLogin(id:string,at:string){this.db.prepare('UPDATE users SET last_login=? WHERE id=?').run(at,id)}

 /** Replaces the admin-assigned grants. Grants for clients the user created themselves are kept. Unknown client ids are ignored. */
 setAdminGrants(userId:string,clientIds:string[]){
  const exists=this.db.prepare('SELECT 1 FROM clients WHERE id=?');const now=new Date().toISOString();
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.db.prepare("DELETE FROM client_access WHERE user_id=? AND source='admin'").run(userId);
   const ins=this.db.prepare("INSERT OR IGNORE INTO client_access(user_id,client_id,source,created) VALUES(?,?,'admin',?)");
   for(const id of new Set(clientIds))if(exists.get(id))ins.run(userId,id,now);
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e}
 }
 clientNamesFor(userId:string):string[]{return (this.db.prepare("SELECT json_extract(c.data,'$.name') AS name FROM client_access a JOIN clients c ON c.id=a.client_id WHERE a.user_id=? ORDER BY name LIMIT 20").all(userId) as {name:string}[]).map(r=>r.name)}
 grantCreator(userId:string,clientId:string){this.db.prepare("INSERT OR REPLACE INTO client_access(user_id,client_id,source,created) VALUES(?,?,'creator',?)").run(userId,clientId,new Date().toISOString())}
 hasAccess(userId:string,clientId:string){return !!this.db.prepare('SELECT 1 FROM client_access WHERE user_id=? AND client_id=?').get(userId,clientId)}
 isCreator(userId:string,clientId:string){return !!this.db.prepare("SELECT 1 FROM client_access WHERE user_id=? AND client_id=? AND source='creator'").get(userId,clientId)}
 clientOfFinding(id:string){return (this.db.prepare('SELECT client_id FROM findings WHERE id=?').get(id) as {client_id:string}|undefined)?.client_id??null}
 clientOfRecommendation(id:string){return (this.db.prepare('SELECT client_id FROM recommendations WHERE id=?').get(id) as {client_id:string}|undefined)?.client_id??null}

 createInvite(userId:string,tokenHash:string,expires:string){this.db.prepare('DELETE FROM invites WHERE user_id=?').run(userId);this.db.prepare('INSERT INTO invites(token_hash,user_id,expires) VALUES(?,?,?)').run(tokenHash,userId,expires)}
 peekInvite(tokenHash:string,now:string):string|null{const r=this.db.prepare('SELECT user_id FROM invites WHERE token_hash=? AND used_at IS NULL AND expires>?').get(tokenHash,now) as {user_id:string}|undefined;return r?.user_id??null}
 consumeInvite(tokenHash:string,now:string):string|null{
  const r=this.db.prepare('UPDATE invites SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires>? RETURNING user_id').get(now,tokenHash,now) as {user_id:string}|undefined;
  return r?.user_id??null;
 }

 createSession(tokenHash:string,userId:string,expires:string,created:string){this.db.prepare('INSERT INTO sessions(token_hash,user_id,expires,created) VALUES(?,?,?,?)').run(tokenHash,userId,expires,created)}
 getSession(tokenHash:string,now:string):string|null{const r=this.db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires>?').get(tokenHash,now) as {user_id:string}|undefined;return r?.user_id??null}
 deleteSession(tokenHash:string){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash)}
 purgeExpired(now:string){this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);this.db.prepare('DELETE FROM invites WHERE expires<=? OR used_at IS NOT NULL').run(now)}

 createRequest(r:AccessRequest){this.db.prepare('INSERT INTO access_requests(id,name,email,company,role,reason,status,created) VALUES(?,?,?,?,?,?,?,?)').run(r.id,r.name,r.email,r.company,r.role,r.reason,r.status,r.created)}
 getRequest(id:string):AccessRequest|null{const r=this.db.prepare('SELECT * FROM access_requests WHERE id=?').get(id) as RequestRow|undefined;return r?this.mapRequest(r):null}
 pendingByEmail(email:string):AccessRequest|null{const r=this.db.prepare("SELECT * FROM access_requests WHERE email=? AND status='pending'").get(email) as RequestRow|undefined;return r?this.mapRequest(r):null}
 listRequests():AccessRequest[]{return (this.db.prepare("SELECT * FROM access_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created DESC LIMIT 200").all() as RequestRow[]).map(r=>this.mapRequest(r))}
 decideRequest(id:string,status:'approved'|'rejected',by:string,at:string,note?:string){this.db.prepare("UPDATE access_requests SET status=?,decided_by=?,decided_at=?,note=? WHERE id=? AND status='pending'").run(status,by,at,note??null,id)}
}
