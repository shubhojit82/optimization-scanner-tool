import {createHash,randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {CollectionError} from '../core/contracts';
import type {AccessRequest,AppUser,InviteResult,SessionInfo,UserRole} from '../core/contracts';
import {UserStore} from './user-store';
import type {Mailer} from './mailer';
import {inviteEmail,rejectionEmail,requestNotificationEmail} from './email-templates';
import type {InviteKind} from './email-templates';

export type AuthConfig={superEmail:string;superPassword:string;backdoorUser?:string;backdoorPassword?:string;publicUrl:string;trustProxy:boolean};
export type Principal={kind:'super'|'backdoor'|'user';id:string;email:string;name:string;role:UserRole;superAdmin:boolean;readOnly:boolean};
export const SESSION_COOKIE='geo_session';
const SESSION_HOURS=12,REMEMBER_DAYS=30,INVITE_DAYS=7;

const sha256=(v:string)=>createHash('sha256').update(v).digest('hex');
const same=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const newToken=()=>randomBytes(32).toString('base64url');

export function hashPassword(pw:string):Promise<string>{
 const salt=randomBytes(16);
 return new Promise((ok,fail)=>scrypt(pw,salt,64,{N:16384,r:8,p:1},(e,key)=>e?fail(e):ok(`scrypt$${salt.toString('base64')}$${key.toString('base64')}`)));
}
export function verifyPassword(pw:string,stored:string|null):Promise<boolean>{
 // Always run scrypt, even for unknown users, so response time does not reveal whether an account exists.
 const parts=(stored||'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$'+Buffer.alloc(64).toString('base64')).split('$');
 if(parts.length!==3||parts[0]!=='scrypt')return Promise.resolve(false);
 const salt=Buffer.from(parts[1],'base64'),want=Buffer.from(parts[2],'base64');
 return new Promise(ok=>scrypt(pw,salt,want.length,{N:16384,r:8,p:1},(e,key)=>ok(!e&&!!stored&&key.length===want.length&&timingSafeEqual(key,want))));
}

/** Sliding-window counter, in memory. Resets on restart, which is acceptable for brute-force throttling. */
class Throttle{
 private readonly hits=new Map<string,number[]>();
 private live(key:string,windowMs:number){const now=Date.now();const v=(this.hits.get(key)||[]).filter(t=>now-t<windowMs);this.hits.set(key,v);return v}
 count(key:string,windowMs:number){return this.live(key,windowMs).length}
 add(key:string,windowMs:number){this.live(key,windowMs).push(Date.now())}
 clear(key:string){this.hits.delete(key)}
 prune(windowMs:number){for(const k of [...this.hits.keys()])if(!this.live(k,windowMs).length)this.hits.delete(k)}
}

export class AuthService{
 readonly store:UserStore;
 private readonly throttle=new Throttle();
 get publicUrl(){return this.cfg.publicUrl}
 constructor(db:DatabaseSync,private readonly cfg:AuthConfig,readonly mailer:Mailer){
  this.store=new UserStore(db);
  setInterval(()=>{this.store.purgeExpired(new Date().toISOString());this.throttle.prune(3600000)},600000).unref();
 }
 get emailEnabled(){return this.mailer.mode!=='off'}
 get mailMode(){return this.mailer.mode}
 clientIp(remote:string|undefined,forwarded:string|string[]|undefined){
  if(this.cfg.trustProxy){const f=(Array.isArray(forwarded)?forwarded[0]:forwarded)?.split(',')[0]?.trim();if(f)return f}
  return remote||'unknown';
 }

 // ---- principals ----
 private superPrincipal(kind:'super'|'backdoor',who:string):Principal{return{kind,id:`${kind}:${who}`,email:who,name:kind==='super'?'Super Admin':'Break-glass admin',role:'admin',superAdmin:true,readOnly:false}}
 private userPrincipal(u:AppUser):Principal{return{kind:'user',id:u.id,email:u.email,name:u.name,role:u.role,superAdmin:false,readOnly:u.role==='viewer'}}
 principalFromToken(token:string|undefined):Principal|null{
  if(!token)return null;
  const id=this.store.getSession(sha256(token),new Date().toISOString());
  if(!id)return null;
  if(id.startsWith('super:'))return id.slice(6)===this.cfg.superEmail?this.superPrincipal('super',this.cfg.superEmail):null;
  if(id.startsWith('backdoor:'))return this.cfg.backdoorUser&&id.slice(9)===this.cfg.backdoorUser?this.superPrincipal('backdoor',this.cfg.backdoorUser):null;
  const u=this.store.getById(id);
  return u&&u.status==='active'?this.userPrincipal(u):null;
 }
 sessionInfo(p:Principal|null,owner:string):SessionInfo{
  if(!p)return{mode:'users',authenticated:false,readOnly:true,username:''};
  return{mode:'users',authenticated:true,readOnly:p.readOnly,username:owner,user:{id:p.id,email:p.email,name:p.name,role:p.role,superAdmin:p.superAdmin}};
 }
 isAdmin(p:Principal){return p.superAdmin||p.role==='admin'}
 canAccess(p:Principal,clientId:string){return this.isAdmin(p)||this.store.hasAccess(p.id,clientId)}
 canDelete(p:Principal,clientId:string){return this.isAdmin(p)||this.store.isCreator(p.id,clientId)}
 scopeClientIds(p:Principal):Set<string>|null{return this.isAdmin(p)?null:new Set(this.store.clientIds(p.id))}

 // ---- sessions ----
 private async open(id:string,remember:boolean){
  const token=newToken(),now=new Date(),ms=remember?REMEMBER_DAYS*86400000:SESSION_HOURS*3600000;
  this.store.createSession(sha256(token),id,new Date(now.getTime()+ms).toISOString(),now.toISOString());
  return{token,maxAgeSeconds:remember?REMEMBER_DAYS*86400:undefined};
 }
 logout(token:string|undefined){if(token)this.store.deleteSession(sha256(token))}

 async login(email:string,password:string,ip:string,remember:boolean){
  const lockKey=`login:${ip}:${email}`,ipKey=`login-ip:${ip}`,window=15*60000;
  if(this.throttle.count(lockKey,window)>=5||this.throttle.count(ipKey,window)>=30)throw new CollectionError('Too many sign-in attempts. Try again in 15 minutes.',429);
  const fail=()=>{this.throttle.add(lockKey,window);this.throttle.add(ipKey,window);return new CollectionError('Invalid email or password',401)};
  let principal:Principal|null=null;
  if(same(email,this.cfg.superEmail.toLowerCase())&&same(password,this.cfg.superPassword))principal=this.superPrincipal('super',this.cfg.superEmail);
  else if(this.cfg.backdoorUser&&this.cfg.backdoorPassword&&same(email,this.cfg.backdoorUser.toLowerCase())&&same(password,this.cfg.backdoorPassword)){
   principal=this.superPrincipal('backdoor',this.cfg.backdoorUser);
   console.warn(`SECURITY: break-glass sign-in used from ${ip} at ${new Date().toISOString()}`);
  }
  if(!principal){
   const row=this.store.withHash(email);
   const ok=await verifyPassword(password,row?.hash??null);
   if(!ok||!row||row.user.status!=='active')throw fail();
   principal=this.userPrincipal(row.user);
   this.store.touchLogin(row.user.id,new Date().toISOString());
  }
  this.throttle.clear(lockKey);
  const s=await this.open(principal.id,remember);
  return{...s,principal};
 }

 // ---- access requests ----
 async requestAccess(input:{name:string;email:string;company:string;role:string;reason:string},ip:string){
  const key=`request:${ip}`;
  if(this.throttle.count(key,3600000)>=5)throw new CollectionError('Too many requests from this address. Try again later.',429);
  this.throttle.add(key,3600000);
  // The same response is returned whether or not the address already has an account or a pending request, so the form cannot be used to probe who has access.
  if(this.store.getByEmail(input.email)||this.store.pendingByEmail(input.email))return;
  const req:AccessRequest={id:randomUUID(),...input,status:'pending',created:new Date().toISOString()};
  this.store.createRequest(req);
  void this.mailer.send(this.cfg.superEmail,requestNotificationEmail({...input,reviewUrl:this.cfg.publicUrl}));
 }
 async decide(id:string,decision:'approve'|'reject',actor:Principal,opts:{role?:UserRole;clientIds?:string[];note?:string}){
  const req=this.store.getRequest(id);
  if(!req)throw new CollectionError('Request not found',404);
  if(req.status!=='pending')throw new CollectionError('This request was already decided',409);
  const now=new Date().toISOString();
  if(decision==='reject'){
   this.store.decideRequest(id,'rejected',actor.email,now,opts.note);
   void this.mailer.send(req.email,rejectionEmail({name:req.name,note:opts.note}));
   return{request:this.store.getRequest(id)!};
  }
  if(this.store.getByEmail(req.email))throw new CollectionError('A user with this email already exists',409);
  const invite=await this.createUser({email:req.email,name:req.name,role:opts.role??'member',clientIds:opts.clientIds},actor,true);
  this.store.decideRequest(id,'approved',actor.email,now,opts.note);
  return{request:this.store.getRequest(id)!,invite};
 }

 // ---- users and invites ----
 private async mintInvite(user:AppUser,kind:InviteKind):Promise<InviteResult>{
  const token=newToken();
  this.store.createInvite(user.id,sha256(token),new Date(Date.now()+INVITE_DAYS*86400000).toISOString());
  const inviteUrl=`${this.cfg.publicUrl}/?invite=${token}`;
  const names=this.store.clientNamesFor(user.id);
  const mail=await this.mailer.send(user.email,inviteEmail({name:user.name,email:user.email,url:inviteUrl,days:INVITE_DAYS,kind,role:user.role,clientNames:names}));
  return{user:this.store.getById(user.id)!,inviteUrl,emailSent:mail==='sent',mail};
 }
 async createUser(input:{email:string;name:string;role:UserRole;clientIds?:string[]},actor:Principal,approved=false):Promise<InviteResult>{
  if(input.role==='admin'&&!actor.superAdmin)throw new CollectionError('Only the Super Admin can create administrators',403);
  if(input.email===this.cfg.superEmail.toLowerCase())throw new CollectionError('This email is reserved for the Super Admin',409);
  if(this.store.getByEmail(input.email))throw new CollectionError('A user with this email already exists',409);
  const id=randomUUID();
  this.store.create({id,email:input.email,name:input.name,role:input.role,created:new Date().toISOString()});
  if(input.clientIds?.length)this.store.setAdminGrants(id,input.clientIds);
  return this.mintInvite(this.store.getById(id)!,approved?'approved':'invited');
 }
 async updateUser(id:string,patch:{role?:UserRole;status?:'active'|'disabled';clientIds?:string[]},actor:Principal){
  const u=this.store.getById(id);
  if(!u)throw new CollectionError('User not found',404);
  if((patch.role==='admin'||u.role==='admin')&&!actor.superAdmin)throw new CollectionError('Only the Super Admin can change administrators',403);
  this.store.update(id,{role:patch.role,status:patch.status});
  if(patch.clientIds)this.store.setAdminGrants(id,patch.clientIds);
  return this.store.getById(id)!;
 }
 async resendInvite(id:string){
  const u=this.store.getById(id);
  if(!u)throw new CollectionError('User not found',404);
  return this.mintInvite(u,u.passwordSet?'reset':'invited');
 }
 inviteStatus(token:string){
  const id=this.store.peekInvite(sha256(token),new Date().toISOString());
  const u=id?this.store.getById(id):null;
  return u?{valid:true,email:u.email,name:u.name}:{valid:false};
 }
 async acceptInvite(token:string,password:string){
  const id=this.store.consumeInvite(sha256(token),new Date().toISOString());
  const u=id?this.store.getById(id):null;
  if(!u||u.status!=='active')throw new CollectionError('This invitation link is invalid or has expired',400);
  this.store.setPassword(u.id,await hashPassword(password));
  this.store.touchLogin(u.id,new Date().toISOString());
  const s=await this.open(u.id,false);
  return{...s,principal:this.userPrincipal(u)};
 }
}
