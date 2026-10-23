import nodemailer from 'nodemailer';
import {EMAIL_IMAGES} from './email-assets';
import {mkdirSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

/** off: nothing is sent, the admin gets the link. local: messages are saved to an outbox you can read in the app. smtp: sent through a real SMTP server. */
export type MailMode='off'|'local'|'smtp';
export type MailOutcome='sent'|'captured'|'off'|'failed';
export type SmtpSettings={host:string;port:number;secure:boolean;user?:string;pass?:string;from:string};
export type MailConfig={mode:MailMode;smtp?:SmtpSettings};
export type CapturedMail={id:string;to:string;subject:string;text:string;html?:string;created:string};
const OUTBOX_KEEP=200;
const CID_RE=/cid:([a-z0-9-]+)@geo/gi;

/** Names of the bundled images an HTML body references as cid:<name>@geo. Unknown names are ignored. */
export function cidImages(html:string|undefined):string[]{
 if(!html)return [];
 const out=new Set<string>();
 for(const m of html.matchAll(CID_RE))if(EMAIL_IMAGES[m[1]])out.add(m[1]);
 return [...out];
}
/** Swaps cid: references for data: URIs so a browser (the Email tab preview) can show the same images. */
export function inlineCidImages(html:string):string{
 return html.replace(CID_RE,(whole,name:string)=>EMAIL_IMAGES[name]?`data:image/png;base64,${EMAIL_IMAGES[name].b64}`:whole);
}

export class Mailer{
 private readonly tx;
 constructor(private readonly cfg:MailConfig,private readonly outboxDir:string){
  this.tx=cfg.mode==='smtp'&&cfg.smtp?nodemailer.createTransport({host:cfg.smtp.host,port:cfg.smtp.port,secure:cfg.smtp.secure,auth:cfg.smtp.user?{user:cfg.smtp.user,pass:cfg.smtp.pass||''}:undefined}):null;
 }
 get mode(){return this.cfg.mode}
 get fromAddress(){return this.cfg.smtp?.from}
 async send(to:string,msg:{subject:string;text:string;html?:string}):Promise<MailOutcome>{
  if(this.cfg.mode==='off')return 'off';
  if(this.cfg.mode==='local'){this.capture({id:randomUUID(),to,subject:msg.subject,text:msg.text,html:msg.html,created:new Date().toISOString()});return 'captured'}
  try{
   const attachments=cidImages(msg.html).map(name=>({filename:`${name}.png`,content:Buffer.from(EMAIL_IMAGES[name].b64,'base64'),cid:`${name}@geo`,contentType:'image/png',contentDisposition:'inline' as const}));
   await this.tx!.sendMail({from:this.cfg.smtp!.from,to,subject:msg.subject,text:msg.text,html:msg.html,attachments});return 'sent'
  }
  catch(e){console.error('SMTP send failed:',e instanceof Error?e.message:e);return 'failed'}
 }
 /** Checks the SMTP host, port and credentials without sending anything. */
 async verify():Promise<{ok:boolean;error?:string}>{
  if(!this.tx)return{ok:false,error:'SMTP is not the active mail mode'};
  try{await this.tx.verify();return{ok:true}}catch(e){return{ok:false,error:e instanceof Error?e.message:'SMTP verification failed'}}
 }
 private capture(m:CapturedMail){
  mkdirSync(this.outboxDir,{recursive:true});
  writeFileSync(join(this.outboxDir,`${m.created.replace(/[:.]/g,'-')}_${m.id}.json`),JSON.stringify(m,null,2));
  const files=readdirSync(this.outboxDir).filter(f=>f.endsWith('.json')).sort();
  for(const f of files.slice(0,Math.max(0,files.length-OUTBOX_KEEP)))rmSync(join(this.outboxDir,f),{force:true});
 }
 outbox(limit=50):CapturedMail[]{
  if(this.cfg.mode!=='local')return [];
  try{return readdirSync(this.outboxDir).filter(f=>f.endsWith('.json')).sort().reverse().slice(0,limit).map(f=>{const m=JSON.parse(readFileSync(join(this.outboxDir,f),'utf8')) as CapturedMail;return m.html?{...m,html:inlineCidImages(m.html)}:m})}
  catch{return []}
 }
}

/**
 * GEO_MAIL_MODE=off|local|smtp. When unset it is smtp if SMTP_HOST is set, otherwise off, so existing setups keep their behaviour.
 * local is for development only and is refused when NODE_ENV=production, so a server cannot silently drop real mail.
 */
export function mailConfig(e:NodeJS.ProcessEnv):MailConfig{
 const host=e.SMTP_HOST?.trim();
 const raw=(e.GEO_MAIL_MODE||'').trim().toLowerCase();
 const mode:MailMode=raw===''?(host?'smtp':'off'):(raw as MailMode);
 if(!['off','local','smtp'].includes(mode))throw new Error('GEO_MAIL_MODE must be off, local or smtp');
 if(mode==='local'&&e.NODE_ENV==='production')throw new Error('GEO_MAIL_MODE=local saves emails instead of sending them. Use smtp (or off) in production.');
 if(mode!=='smtp')return{mode};
 if(!host)throw new Error('GEO_MAIL_MODE=smtp requires SMTP_HOST');
 const port=Number(e.SMTP_PORT||587);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('SMTP_PORT must be a valid port number');
 const user=e.SMTP_USER?.trim()||undefined;
 return{mode,smtp:{host,port,secure:e.SMTP_SECURE?e.SMTP_SECURE==='true':port===465,user,pass:e.SMTP_PASS||undefined,from:e.SMTP_FROM?.trim()||user||'no-reply@localhost'}};
}
