import type {IncomingMessage,ServerResponse} from 'node:http';
import type {AuthService,Principal} from './auth-service';
import {testEmail} from './email-templates';
import {SESSION_COOKIE} from './auth-service';
import type {SqliteRepository} from './sqlite-repository';
import {loginSchema,accessRequestSchema,acceptInviteSchema,createUserSchema,userPatchSchema,decisionSchema,mailTestSchema} from '../adapters/validation';

export type RouteCtx={
 req:IncomingMessage;res:ServerResponse;path:string;method:string;
 principal:Principal|null;auth:AuthService;repo:SqliteRepository;owner:string;secure:boolean;
 json:(res:ServerResponse,status:number,data:unknown)=>void;
 body:(req:IncomingMessage)=>Promise<any>;
};

export function readCookie(req:IncomingMessage,name:string):string|undefined{
 for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim())}
 return undefined;
}
function setCookie(c:RouteCtx,token:string,maxAge?:number){c.res.setHeader('Set-Cookie',`${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/${c.secure?'; Secure':''}${maxAge?`; Max-Age=${maxAge}`:''}`)}
function clearCookie(c:RouteCtx){c.res.setHeader('Set-Cookie',`${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/${c.secure?'; Secure':''}; Max-Age=0`)}
const ip=(c:RouteCtx)=>c.auth.clientIp(c.req.socket.remoteAddress,c.req.headers['x-forwarded-for']);
const notAllowed=(c:RouteCtx)=>{c.json(c.res,405,{error:'Method not allowed'});return true};

/** Routes reachable without a session: session probe, sign-in, sign-out, access request, invitation. Returns true when handled. */
export async function handlePublicRoutes(c:RouteCtx):Promise<boolean>{
 const{path,method,res,auth}=c;
 if(path==='/api/v1/session'){if(method!=='GET')return notAllowed(c);c.json(res,200,auth.sessionInfo(c.principal,c.owner));return true}
 if(path==='/api/v1/auth/login'){
  if(method!=='POST')return notAllowed(c);
  const input=loginSchema.parse(await c.body(c.req));
  const r=await auth.login(input.email,input.password,ip(c),!!input.remember);
  setCookie(c,r.token,r.maxAgeSeconds);c.json(res,200,auth.sessionInfo(r.principal,c.owner));return true;
 }
 if(path==='/api/v1/auth/logout'){if(method!=='POST')return notAllowed(c);auth.logout(readCookie(c.req,SESSION_COOKIE));clearCookie(c);c.json(res,200,{ok:true});return true}
 if(path==='/api/v1/auth/request-access'){
  if(method!=='POST')return notAllowed(c);
  await auth.requestAccess(accessRequestSchema.parse(await c.body(c.req)),ip(c));
  c.json(res,200,{received:true,emailNotifications:auth.mailMode==='smtp'});return true;
 }
 if(path==='/api/v1/auth/invite'){
  if(method!=='GET')return notAllowed(c);
  const token=new URL(c.req.url||'/','http://x').searchParams.get('token')||'';
  c.json(res,200,token.length>=20?auth.inviteStatus(token):{valid:false});return true;
 }
 if(path==='/api/v1/auth/accept-invite'){
  if(method!=='POST')return notAllowed(c);
  const input=acceptInviteSchema.parse(await c.body(c.req));
  const r=await auth.acceptInvite(input.token,input.password);
  setCookie(c,r.token,r.maxAgeSeconds);c.json(res,200,auth.sessionInfo(r.principal,c.owner));return true;
 }
 return false;
}

function audit(c:RouteCtx,action:'user.create'|'user.update'|'access.approve'|'access.reject',entityId:string,detail:Record<string,unknown>){
 c.repo.logEvent({id:crypto.randomUUID(),owner:c.owner,action,entityType:'user',entityId,detail:{...detail,by:c.principal?.email},created:new Date().toISOString()});
}

/** User administration. The caller has already verified an administrator session. */
export async function handleAdminRoutes(c:RouteCtx):Promise<boolean>{
 const{path,method,res,auth}=c,actor=c.principal!;
 if(!path.startsWith('/api/v1/admin/'))return false;
 if(path==='/api/v1/admin/overview'){
  if(method!=='GET')return notAllowed(c);
  c.json(res,200,{users:auth.store.list(),requests:auth.store.listRequests(),emailEnabled:auth.emailEnabled,mailMode:auth.mailMode,superAdmin:actor.superAdmin});return true;
 }
 if(path==='/api/v1/admin/outbox'){if(method!=='GET')return notAllowed(c);c.json(res,200,{mode:auth.mailMode,messages:auth.mailer.outbox()});return true}
 if(path==='/api/v1/admin/mail/test'){
  if(method!=='POST')return notAllowed(c);
  const to=mailTestSchema.parse(await c.body(c.req)).to||actor.email;
  if(auth.mailMode==='off'){c.json(res,200,{mode:'off',ok:false,message:'Mail is off. Set GEO_MAIL_MODE=local or smtp.'});return true}
  if(auth.mailMode==='smtp'){const v=await auth.mailer.verify();if(!v.ok){c.json(res,200,{mode:'smtp',ok:false,message:'Could not connect to the SMTP server: '+v.error});return true}}
  const out=await auth.mailer.send(to,testEmail({mode:auth.mailMode,from:auth.mailer.fromAddress,dashboardUrl:auth.publicUrl}));
  c.json(res,200,{mode:auth.mailMode,ok:out==='sent'||out==='captured',message:out==='sent'?`Test email sent to ${to}. Check the inbox.`:out==='captured'?`Saved to the local outbox for ${to}.`:'The SMTP server accepted the connection but rejected the message. Check the server log.'});return true;
 }
 if(path==='/api/v1/admin/users'){
  if(method!=='POST')return notAllowed(c);
  const input=createUserSchema.parse(await c.body(c.req));
  const r=await auth.createUser(input,actor);audit(c,'user.create',r.user.id,{email:r.user.email,role:r.user.role});c.json(res,200,r);return true;
 }
 const userMatch=path.match(/^\/api\/v1\/admin\/users\/([^/]+)(\/invite)?$/);
 if(userMatch){
  const id=decodeURIComponent(userMatch[1]);
  if(userMatch[2]){if(method!=='POST')return notAllowed(c);c.json(res,200,await auth.resendInvite(id));return true}
  if(method!=='PATCH')return notAllowed(c);
  const patch=userPatchSchema.parse(await c.body(c.req));
  const u=await auth.updateUser(id,patch,actor);audit(c,'user.update',id,{...patch});c.json(res,200,u);return true;
 }
 const decisionMatch=path.match(/^\/api\/v1\/admin\/access-requests\/([^/]+)\/decision$/);
 if(decisionMatch){
  if(method!=='POST')return notAllowed(c);
  const d=decisionSchema.parse(await c.body(c.req));
  const id=decodeURIComponent(decisionMatch[1]);
  const r=await auth.decide(id,d.decision,actor,{role:d.role,clientIds:d.clientIds,note:d.note});
  audit(c,d.decision==='approve'?'access.approve':'access.reject',id,{email:r.request.email});c.json(res,200,r);return true;
 }
 c.json(res,404,{error:'Endpoint not found'});return true;
}

const PATH_CLIENT=[/^\/api\/v1\/clients\/([^/]+)/,/^\/api\/v1\/exec-summary\/([^/]+)$/,/^\/api\/v1\/probe-history\/([^/]+)$/,/^\/api\/v1\/schedules\/([^/]+)$/,/^\/api\/v1\/alerts\/([^/]+)/];

/**
 * Single place that decides whether a non-admin may touch a client. Looks for the client id in the path, the query string,
 * the JSON body, or (for findings and recommendations) the stored record. Returns an error to send, or null to continue.
 */
export async function clientGuard(c:RouteCtx):Promise<{status:number;error:string}|null>{
 const p=c.principal!,{auth,path,method}=c;
 if(auth.isAdmin(p))return null;
 const denied={status:404,error:'Client not found'};
 let clientId:string|null=null;
 for(const re of PATH_CLIENT){const m=path.match(re);if(m){clientId=decodeURIComponent(m[1]);break}}
 if(!clientId){
  const fm=path.match(/^\/api\/v1\/findings\/([^/]+)$/);
  const rm=path.match(/^\/api\/v1\/recommendations\/([^/]+)$/);
  if(fm&&method==='PATCH'){clientId=auth.store.clientOfFinding(decodeURIComponent(fm[1]));if(!clientId)return denied}
  else if(rm&&method==='PATCH'){clientId=auth.store.clientOfRecommendation(decodeURIComponent(rm[1]));if(!clientId)return denied}
 }
 if(!clientId){const q=new URL(c.req.url||'/','http://x').searchParams.get('clientId');if(q)clientId=q}
 if(!clientId&&(method==='POST'||method==='PATCH')){
  try{const b=await c.body(c.req);if(b&&typeof b==='object'&&!Array.isArray(b)&&typeof b.clientId==='string')clientId=b.clientId}catch{/* the route handler reports malformed JSON */}
 }
 if(!clientId)return null;
 if(!auth.canAccess(p,clientId))return denied;
 if(method==='DELETE'&&/^\/api\/v1\/clients\/[^/]+$/.test(path)&&!auth.canDelete(p,clientId))return{status:403,error:'Only the client creator or an administrator can delete this client'};
 return null;
}
