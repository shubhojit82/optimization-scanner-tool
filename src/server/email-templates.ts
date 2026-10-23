import type {UserRole} from '../core/contracts';
import {EMAIL_IMAGES} from './email-assets';

export type EmailMessage={subject:string;text:string;html?:string};
/** Inline images are referenced as cid:<name>@geo and attached by the mailer. */
export const cidOf=(name:string)=>`${name}@geo`;

const INK='#12152b',BODY='#3a3f5c',MUTED='#6b7194',LINE='#e8ecf6',PAGE='#eef2fb';
const FONT="'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";
type Theme={accent:string;accent2:string;btn:string;soft:string;line:string};
const THEMES={
 blue:{accent:'#2f6bff',accent2:'#7c5cff',btn:'#2f6bff',soft:'#eef3ff',line:'#d6e2ff'},
 green:{accent:'#16a34a',accent2:'#14b8a6',btn:'#16a34a',soft:'#e9f8ef',line:'#bfe9d0'},
 red:{accent:'#ef4444',accent2:'#f97316',btn:'#dc2626',soft:'#fdecec',line:'#f7c9c9'},
 amber:{accent:'#f59e0b',accent2:'#f97316',btn:'#d97706',soft:'#fff6e0',line:'#fde4a8'},
} satisfies Record<string,Theme>;
export type ThemeName=keyof typeof THEMES;
const ROLE_TEXT:Record<UserRole,string>={admin:'Administrator',member:'Member',viewer:'Viewer (read-only)'};

export function esc(v:string){return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
const multiline=(v:string)=>esc(v).replace(/\r?\n/g,'<br>');

function img(name:string,alt:string,w?:number,h?:number,extra=''){
 const a=EMAIL_IMAGES[name];
 if(!a)throw new Error('Unknown email image '+name);
 return `<img src="cid:${cidOf(name)}" width="${w??a.w}" height="${h??a.h}" alt="${esc(alt)}" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;${extra}">`;
}

type Btn={label:string;url:string};
/** Bulletproof button: VML rounded rectangle for Outlook desktop (Word engine), a styled link everywhere else. */
function button(b:Btn,t:Theme):string{
 const w=Math.max(210,b.label.length*9+76),label=esc(b.label)+' &rarr;',url=esc(b.url);
 return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr><td align="center">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:50px;v-text-anchor:middle;width:${w}px" arcsize="16%" stroke="f" fillcolor="${t.btn}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${url}" target="_blank" style="display:inline-block;background:${t.btn};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:700;line-height:50px;height:50px;text-align:center;text-decoration:none;padding:0 34px;border-radius:9px;-webkit-text-size-adjust:none">${label}</a><!--<![endif]-->
</td></tr></table>
<p style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};text-align:center">Button not working? Paste this link into your browser:<br><a href="${url}" target="_blank" style="color:${t.btn};word-break:break-all">${url}</a></p>`;
}

/** Icon + small-caps label + value rows inside one rounded card, like the reference design. */
function details(rows:{icon:string;label:string;value:string}[]):string{
 const tr=rows.map((r,i)=>`<tr><td width="56" valign="middle" style="padding:13px 0 13px 16px;${i?`border-top:1px solid ${LINE};`:''}">${img('icon-'+r.icon,r.label,36,36)}</td><td width="104" valign="middle" style="padding:13px 8px 13px 8px;${i?`border-top:1px solid ${LINE};`:''}font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${MUTED}">${esc(r.label)}</td><td valign="middle" style="padding:13px 16px 13px 0;${i?`border-top:1px solid ${LINE};`:''}font-family:${FONT};font-size:15px;line-height:1.45;color:${INK}">${r.value}</td></tr>`).join('');
 return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;background:#f7f9ff;border:1px solid ${LINE};border-radius:12px">${tr}</table>`;
}

/** Coloured message box with a status icon (success, warning, info, ...). */
function callout(t:Theme,icon:string,title:string,text:string):string{
 return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;background:${t.soft};border:1px solid ${t.line};border-radius:12px"><tr><td width="58" valign="top" style="padding:16px 0 16px 18px">${img('call-'+icon,'',32,32)}</td><td valign="top" style="padding:15px 18px 15px 12px;font-family:${FONT};font-size:14px;line-height:1.55;color:${BODY}"><div style="font-size:15px;font-weight:700;color:${t.btn};padding-bottom:2px">${esc(title)}</div>${text}</td></tr></table>`;
}

function quote(t:Theme,label:string,text:string):string{
 return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0"><tr><td width="4" bgcolor="${t.accent}" style="font-size:0;line-height:0">&nbsp;</td><td style="padding:12px 18px;background:#f7f9ff;font-family:${FONT};font-size:14px;line-height:1.6;color:${INK}"><div style="font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};padding-bottom:4px">${esc(label)}</div>${multiline(text)}</td></tr></table>`;
}

const fine=(text:string)=>`<p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED}">${text}</p>`;

type Shell={theme:ThemeName;preheader:string;title:string;intro:string;hero?:string;body?:string;cta?:Btn;footer:string};
/** 600px table layout with inline styles. Only the mobile media query lives in <style>; clients that drop it still show a correct desktop layout. */
function shell(s:Shell):string{
 const t:Theme=THEMES[s.theme];
 const text=`<h1 class="h1" style="margin:0 0 14px;font-family:${FONT};font-size:34px;line-height:1.15;font-weight:800;letter-spacing:-.025em;color:${INK}">${esc(s.title)}</h1><p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.6;color:${BODY}">${s.intro}</p>`;
 const top=s.hero
  ?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="col" valign="middle" style="padding:0 18px 0 0">${text}</td><td class="hero" width="190" valign="middle" align="right">${s.hero}</td></tr></table>`
  :text;
 return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${esc(s.title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}img{-ms-interpolation-mode:bicubic}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media only screen and (max-width:620px){.wrap{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.col{display:block!important;width:100%!important;padding:0!important}.hero{display:block!important;width:100%!important;text-align:center!important;padding:18px 0 0!important}.hero img{margin:0 auto!important}.h1{font-size:28px!important}}</style></head>
<body style="margin:0;padding:0;background:${PAGE};word-spacing:normal">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(s.preheader)}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background:${PAGE}"><tr><td align="center" style="padding:30px 12px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #dde4f5;border-radius:16px">
<tr><td height="6" bgcolor="${t.accent}" style="height:6px;font-size:0;line-height:0;background:linear-gradient(90deg,${t.accent},${t.accent2});border-radius:16px 16px 0 0">&nbsp;</td></tr>
<tr><td class="pad" style="padding:30px 40px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:12px">${img('logo','AI Search Intelligence',44,44)}</td><td valign="middle"><div style="font-family:${FONT};font-size:21px;font-weight:700;color:${INK};letter-spacing:-.01em;line-height:1.1">AI Search Intelligence</div><div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:.2em;color:${MUTED};padding-top:4px">SEO &middot; AEO &middot; GEO READINESS</div></td></tr></table></td></tr>
<tr><td class="pad" style="padding:30px 40px 8px">${top}${s.body||''}${s.cta?`<div style="height:28px;line-height:28px;font-size:0">&nbsp;</div>${button(s.cta,t)}`:''}</td></tr>
<tr><td class="pad" style="padding:26px 40px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${LINE};padding-top:18px;font-family:${FONT};font-size:12px;line-height:1.7;color:${MUTED};text-align:center">${s.footer}<br>AI Search Intelligence &middot; Generative search intelligence for your clients</td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
}

const first=(name:string)=>name.trim().split(/\s+/)[0]||name;
const strong=(v:string)=>`<strong style="color:${INK}">${esc(v)}</strong>`;

/** Scenario 1: outgoing mail check (blue). */
export function testEmail(o:{mode:string;from?:string;dashboardUrl?:string}):EmailMessage{
 const at=new Date().toUTCString();
 return{
  subject:'AI Search Intelligence test email',
  text:`Email is working.\n\nThis is a test message from AI Search Intelligence. If you can read it, invitations and access decisions will reach your users.\n\nMail mode: ${o.mode}${o.from?`\nSent from: ${o.from}`:''}\nSent at: ${at}${o.dashboardUrl?`\n\nOpen the dashboard: ${o.dashboardUrl}`:''}`,
  html:shell({theme:'blue',preheader:'Outgoing email is working.',title:'Email is working',
   intro:`This is a test message from ${strong('AI Search Intelligence')}. If you can read it, invitations and access decisions will reach your users.`,
   hero:img('hero-test','',170,134),
   body:details([{icon:'server',label:'Mail mode',value:esc(o.mode)},...(o.from?[{icon:'send',label:'Sent from',value:esc(o.from)}]:[]),{icon:'clock',label:'Sent at',value:esc(at)}]),
   cta:o.dashboardUrl?{label:'Open Dashboard',url:o.dashboardUrl}:undefined,
   footer:'You received this because an administrator clicked &ldquo;send test email&rdquo;.'}),
 };
}

export type InviteKind='invited'|'approved'|'reset';
/** Scenarios 2-4: set-password links. invited (blue), approved (green), reset (blue with a security note). */
export function inviteEmail(o:{name:string;email:string;url:string;days:number;kind:InviteKind;role:UserRole;clientNames?:string[]}):EmailMessage{
 const f=first(o.name);
 const rows=[{icon:'mail',label:'Sign-in email',value:esc(o.email)},{icon:'shield',label:'Your role',value:esc(ROLE_TEXT[o.role])},{icon:'briefcase',label:'Client access',value:o.clientNames?.length?esc(o.clientNames.join(', ')):'Assigned by your administrator'}];
 const expiry=`This link works once and expires in ${o.days} days. If you were not expecting this email, you can safely ignore it. Nothing happens until you set a password.`;
 if(o.kind==='approved')return{
  subject:'Your access to AI Search Intelligence was approved',
  text:`Hello ${o.name},\n\nYou're approved. Your access request was approved. Set a password to sign in for the first time:\n\n${o.url}\n\nSign-in email: ${o.email}\nRole: ${ROLE_TEXT[o.role]}\n\n${expiry}`,
  html:shell({theme:'green',preheader:'Your access request was approved. Set a password to get started.',title:`You're approved, ${f}`,
   intro:'Good news: your access request was reviewed and approved. Set a password to sign in for the first time.',hero:img('hero-approved','',170,134),
   body:callout(THEMES.green,'check',"You're invited!",'Your account is ready. You now have access to AI Search Intelligence.')+details(rows)+fine(expiry),
   cta:{label:'Get Started',url:o.url},footer:'You received this because an administrator approved your access request.'}),
 };
 if(o.kind==='reset')return{
  subject:'Reset your AI Search Intelligence password',
  text:`Hello ${o.name},\n\nAn administrator sent you a link to choose a new password for ${o.email}:\n\n${o.url}\n\n${expiry} Your current password keeps working until you use the link.`,
  html:shell({theme:'blue',preheader:'Choose a new password for your account.',title:'Reset your password',
   intro:`An administrator sent you a link to choose a new password for ${strong(o.email)}.`,hero:img('hero-reset','',170,134),
   body:callout(THEMES.blue,'lock','Keep your account secure','Your current password keeps working until you use this link. After you choose a new one, you will be signed out of other devices.')+fine(expiry),
   cta:{label:'Choose a New Password',url:o.url},footer:'You received this because an administrator requested a password reset for your account.'}),
 };
 return{
  subject:'You are invited to AI Search Intelligence',
  text:`Hello ${o.name},\n\nAn administrator added you to AI Search Intelligence. Set your password to sign in:\n\n${o.url}\n\nSign-in email: ${o.email}\nRole: ${ROLE_TEXT[o.role]}\n\n${expiry}`,
  html:shell({theme:'blue',preheader:`${f}, set a password to join AI Search Intelligence.`,title:`Welcome, ${f}`,
   intro:`An administrator added you to ${strong('AI Search Intelligence')}. Set a password to activate your account.`,hero:img('hero-invite','',170,134),
   body:details(rows)+fine(expiry),cta:{label:'Set Your Password',url:o.url},footer:'You received this because an administrator entered your email address.'}),
 };
}

/** Scenario 5: request not approved (red accent, no button because there is nothing to click). */
export function rejectionEmail(o:{name:string;note?:string}):EmailMessage{
 const f=first(o.name);
 return{
  subject:'Your AI Search Intelligence access request',
  text:`Hello ${o.name},\n\nThank you for your interest in AI Search Intelligence. After review, your access request was not approved this time.${o.note?`\n\nNote from the administrator: ${o.note}`:''}\n\nIf you think this is a mistake, contact the administrator who manages your workspace.`,
  html:shell({theme:'red',preheader:'An update on your access request.',title:`Hello, ${f}`,
   intro:`Thank you for your interest in ${strong('AI Search Intelligence')}. After review, your access request was ${strong('not approved')} this time.`,hero:img('hero-rejected','',170,134),
   body:callout(THEMES.red,'x','Request not approved','No account was created for this email address.')+(o.note?quote(THEMES.red,'Note from the administrator',o.note):'')+fine('If you think this is a mistake, contact the administrator who manages your workspace. You are welcome to submit a new request later.'),
   footer:'You received this because you submitted an access request.'}),
 };
}

/** Scenario 6: sent to the Super Admin when someone requests access (amber, pending). */
export function requestNotificationEmail(o:{name:string;email:string;company:string;role:string;reason:string;reviewUrl:string}):EmailMessage{
 return{
  subject:`Access request from ${o.name}`,
  text:`${o.name} (${o.email}) at ${o.company} requested access as ${o.role}.\n\nReason: ${o.reason}\n\nReview it under Users: ${o.reviewUrl}`,
  html:shell({theme:'amber',preheader:`${o.name} from ${o.company} is waiting for your decision.`,title:'New access request',
   intro:`${strong(o.name)} from ${esc(o.company)} asked for access. Approve or reject the request in the Users screen.`,hero:img('hero-request','',170,134),
   body:callout(THEMES.amber,'clock','Waiting for review','Nothing happens until you decide. The requester has not been told anything yet.')+details([{icon:'user',label:'Name',value:esc(o.name)},{icon:'mail',label:'Email',value:esc(o.email)},{icon:'building',label:'Company',value:esc(o.company)},{icon:'briefcase',label:'Role',value:esc(o.role)}])+quote(THEMES.amber,'Reason for access',o.reason),
   cta:{label:'Review Request',url:o.reviewUrl},footer:'You received this because you are the Super Admin of this workspace.'}),
 };
}
