// Renders the SVG sources below to retina PNGs with headless Chrome and writes src/server/email-assets.ts.
// Run: node scripts/build-email-assets.mjs   (only needed when you change the artwork; the output is committed)
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const CHROME=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BLUE='#2f6bff',NAVY='#12152b';
const stroke=(c,w=2)=>`fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

// ---- logo: concentric rings with a search handle ----
const logo=(s)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#2358f0"/></linearGradient></defs><circle cx="24" cy="24" r="21" ${stroke('url(#g)',3.2)}/><circle cx="24" cy="24" r="13.5" ${stroke('url(#g)',3.2)}/><circle cx="24" cy="24" r="6" fill="url(#g)"/><path d="M33.5 33.5 L42 42" ${stroke('url(#g)',3.6)}/></svg>`;

// ---- small icon tiles (rounded square, tinted) ----
const tile=(inner,bg,s=40)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="${bg}"/>${inner}</svg>`;
const ic={
 server:(c)=>`<g ${stroke(c,2)}><rect x="11" y="11" width="18" height="7" rx="2"/><rect x="11" y="22" width="18" height="7" rx="2"/></g><circle cx="15" cy="14.5" r="1.1" fill="${c}"/><circle cx="15" cy="25.5" r="1.1" fill="${c}"/>`,
 send:(c)=>`<path d="M28.5 11.5 L11.5 19 L18.5 21.5 L21 28.5 Z" ${stroke(c,2)}/><path d="M18.5 21.5 L28.5 11.5" ${stroke(c,2)}/>`,
 clock:(c)=>`<circle cx="20" cy="20" r="9" ${stroke(c,2)}/><path d="M20 14.5 V20 L24 22.5" ${stroke(c,2)}/>`,
 mail:(c)=>`<rect x="10.5" y="13" width="19" height="14" rx="2.5" ${stroke(c,2)}/><path d="M11.5 15 L20 21.5 L28.5 15" ${stroke(c,2)}/>`,
 user:(c)=>`<circle cx="20" cy="16" r="4.5" ${stroke(c,2)}/><path d="M11.5 29 C12.5 23.5 27.5 23.5 28.5 29" ${stroke(c,2)}/>`,
 shield:(c)=>`<path d="M20 10.5 L28.5 13.5 V20 C28.5 25 24.5 28.5 20 30 C15.5 28.5 11.5 25 11.5 20 V13.5 Z" ${stroke(c,2)}/><path d="M16 20 L19 23 L24.5 17" ${stroke(c,2)}/>`,
 building:(c)=>`<rect x="12" y="10.5" width="16" height="19" rx="2" ${stroke(c,2)}/><path d="M16.5 15.5 H18.5 M21.5 15.5 H23.5 M16.5 20 H18.5 M21.5 20 H23.5 M18 29.5 V25 H22 V29.5" ${stroke(c,2)}/>`,
 briefcase:(c)=>`<rect x="10.5" y="15" width="19" height="13" rx="2.5" ${stroke(c,2)}/><path d="M16 15 V13 C16 12 16.8 11.5 17.8 11.5 H22.2 C23.2 11.5 24 12 24 13 V15 M10.5 21 H29.5" ${stroke(c,2)}/>`,
 note:(c)=>`<path d="M13 11.5 H27 V25 L22 29.5 H13 Z" ${stroke(c,2)}/><path d="M16.5 17 H23.5 M16.5 21 H21" ${stroke(c,2)}/>`,
 globe:(c)=>`<circle cx="20" cy="20" r="9.5" ${stroke(c,2)}/><path d="M10.5 20 H29.5 M20 10.5 C16 15 16 25 20 29.5 C24 25 24 15 20 10.5" ${stroke(c,2)}/>`,
 key:(c)=>`<circle cx="15.5" cy="22.5" r="4.5" ${stroke(c,2)}/><path d="M19 19 L28 11 M24.5 14 L27.5 17 M21.8 16.6 L24 18.8" ${stroke(c,2)}/>`,
};

// ---- hero illustrations (rendered at 2x, shown at ~170px wide) ----
const W=190,H=150;
const hero=(inner)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="cardg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef3ff"/></linearGradient><filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#2f6bff" flood-opacity="0.18"/></filter></defs><circle cx="112" cy="70" r="60" fill="#eef3ff"/><circle cx="150" cy="30" r="3" fill="#bcd0ff"/><circle cx="36" cy="100" r="2.5" fill="#c9d8ff"/><circle cx="168" cy="108" r="2" fill="#bcd0ff"/>${inner}</svg>`;
const badge=(cx,cy,color,mark)=>`<circle cx="${cx}" cy="${cy}" r="19" fill="${color}" stroke="#fff" stroke-width="4"/>${mark}`;
const check=(cx,cy)=>`<path d="M${cx-8} ${cy+1} L${cx-2} ${cy+7} L${cx+9} ${cy-6}" ${stroke('#fff',4.2)}/>`;
const heroes={
 'hero-test':hero(`<g filter="url(#sh)"><path d="M40 62 L100 22 L160 62 V120 a8 8 0 0 1 -8 8 H48 a8 8 0 0 1 -8 -8 Z" fill="#dbe7ff"/><rect x="55" y="38" width="90" height="62" rx="7" fill="url(#cardg)"/><path d="M68 54 H132 M68 68 H118 M68 82 H104" ${stroke('#8fb0ff',5)}/><path d="M40 62 L100 108 L160 62 V120 a8 8 0 0 1 -8 8 H48 a8 8 0 0 1 -8 -8 Z" fill="#f4f7ff"/><path d="M40 62 L100 108 L160 62" ${stroke('#c6d7ff',2.5)}/></g>${badge(150,112,'#3f78ff',check(150,112))}`),
 'hero-invite':hero(`<g filter="url(#sh)"><path d="M40 62 L100 22 L160 62 V120 a8 8 0 0 1 -8 8 H48 a8 8 0 0 1 -8 -8 Z" fill="#dbe7ff"/><rect x="55" y="36" width="90" height="66" rx="7" fill="url(#cardg)"/><circle cx="100" cy="58" r="11" fill="#bcd0ff"/><path d="M80 90 C82 76 118 76 120 90" fill="#bcd0ff"/><path d="M40 62 L100 108 L160 62 V120 a8 8 0 0 1 -8 8 H48 a8 8 0 0 1 -8 -8 Z" fill="#f4f7ff"/><path d="M40 62 L100 108 L160 62" ${stroke('#c6d7ff',2.5)}/></g>${badge(150,112,'#3f78ff',`<path d="M150 103 V121 M141 112 H159" ${stroke('#fff',4.2)}/>`)}`),
 'hero-approved':hero(`<g filter="url(#sh)"><path d="M100 18 L142 34 V70 C142 98 124 116 100 126 C76 116 58 98 58 70 V34 Z" fill="url(#cardg)" stroke="#bfe9d0" stroke-width="3"/><path d="M100 30 L132 42 V70 C132 91 119 106 100 114 C81 106 68 91 68 70 V42 Z" fill="#e6f8ee"/></g>${badge(100,72,'#16a34a',check(100,72))}<circle cx="150" cy="40" r="3.5" fill="#86efac"/><circle cx="52" cy="48" r="3" fill="#bbf7d0"/>`),
 'hero-reset':hero(`<g filter="url(#sh)"><rect x="52" y="52" width="86" height="64" rx="10" fill="url(#cardg)"/><path d="M72 52 V42 a23 23 0 0 1 46 0 V52" ${stroke('#8fb0ff',6)}/><circle cx="95" cy="82" r="8" fill="#bcd0ff"/><path d="M95 88 V101" ${stroke('#bcd0ff',5)}/></g>${badge(146,108,'#3f78ff',`<path d="M138 108 a8 8 0 1 0 3 -6.5 M139 98 V103 H144" ${stroke('#fff',3.4)}/>`)}`),
 'hero-request':hero(`<g filter="url(#sh)"><rect x="48" y="26" width="88" height="104" rx="10" fill="url(#cardg)"/><circle cx="92" cy="54" r="12" fill="#bcd0ff"/><path d="M68 92 C70 76 114 76 116 92" fill="#bcd0ff"/><path d="M66 108 H118 M76 118 H108" ${stroke('#d4e0ff',5)}/></g>${badge(146,100,'#f59e0b',`<circle cx="146" cy="100" r="9" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M146 95 V100 L150 103" ${stroke('#fff',3.2)}/>`)}`),
 'hero-rejected':hero(`<g filter="url(#sh)"><rect x="48" y="26" width="88" height="104" rx="10" fill="url(#cardg)"/><circle cx="92" cy="54" r="12" fill="#e2e6f2"/><path d="M68 92 C70 76 114 76 116 92" fill="#e2e6f2"/><path d="M66 108 H118 M76 118 H108" ${stroke('#e4e8f3',5)}/></g>${badge(146,100,'#ef4444',`<path d="M139 93 L153 107 M153 93 L139 107" ${stroke('#fff',4)}/>`)}`),
};

// ---- callout badges (32px) ----
const dot=(bg,glyph)=>`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="${bg}"/>${glyph}</svg>`;
const callouts={
 'call-check':dot('#16a34a',`<path d="M9 16.5 L14 21.5 L23 11" ${stroke('#fff',3.2)}/>`),
 'call-x':dot('#ef4444',`<path d="M10.5 10.5 L21.5 21.5 M21.5 10.5 L10.5 21.5" ${stroke('#fff',3.2)}/>`),
 'call-clock':dot('#f59e0b',`<circle cx="16" cy="16" r="8" ${stroke('#fff',2.6)}/><path d="M16 11.5 V16 L19.5 18" ${stroke('#fff',2.6)}/>`),
 'call-info':dot('#2f6bff',`<path d="M16 15 V22" ${stroke('#fff',3.2)}/><circle cx="16" cy="10.5" r="1.9" fill="#fff"/>`),
 'call-lock':dot('#2f6bff',`<rect x="10" y="14.5" width="12" height="9" rx="2" fill="#fff"/><path d="M12.5 14.5 V12 a3.5 3.5 0 0 1 7 0 V14.5" ${stroke('#fff',2.4)}/>`),
 'call-warn':`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 5 L29 27 H3 Z" fill="#ef4444" stroke="#ef4444" stroke-width="3" stroke-linejoin="round"/><path d="M16 12.5 V19" ${stroke('#fff',2.8)}/><circle cx="16" cy="23" r="1.7" fill="#fff"/></svg>`,
};

const jobs=[];
const add=(name,svg,w,h)=>jobs.push({name,svg,w,h});
add('logo',logo(48),48,48);
for(const [k,v] of Object.entries({server:ic.server,send:ic.send,clock:ic.clock,mail:ic.mail,user:ic.user,shield:ic.shield,building:ic.building,briefcase:ic.briefcase,note:ic.note,globe:ic.globe,key:ic.key}))add('icon-'+k,tile(v(BLUE),'#eaf0ff'),40,40);
for(const [k,v] of Object.entries(heroes))add(k,v,W,H);
for(const [k,v] of Object.entries(callouts))add(k,v,32,32);

const tmp=join(tmpdir(),'geo-email-assets');rmSync(tmp,{recursive:true,force:true});mkdirSync(tmp,{recursive:true});
const out={};
for(const j of jobs){
 const html=join(tmp,j.name+'.html'),png=join(tmp,j.name+'.png');
 writeFileSync(html,`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head><body>${j.svg}</body></html>`);
 const r=spawnSync(CHROME,['--headless=new','--disable-gpu','--hide-scrollbars','--default-background-color=00000000','--force-device-scale-factor=2',`--window-size=${j.w},${j.h}`,`--screenshot=${png}`,'file://'+html],{encoding:'utf8'});
 if(r.status!==0)throw new Error('Chrome failed for '+j.name+': '+r.stderr);
 out[j.name]={w:j.w,h:j.h,b64:readFileSync(png).toString('base64')};
}
const total=Object.values(out).reduce((n,v)=>n+v.b64.length,0);
const body=Object.entries(out).map(([k,v])=>`  '${k}': {w: ${v.w}, h: ${v.h}, b64: '${v.b64}'},`).join('\n');
writeFileSync('src/server/email-assets.ts',`// GENERATED by scripts/build-email-assets.mjs. Do not edit by hand.\n// Retina PNGs (2x) shown at w x h. They are attached to messages as inline CID images.\nexport type EmailImage = {w: number; h: number; b64: string};\nexport const EMAIL_IMAGES: Record<string, EmailImage> = {\n${body}\n};\n`);
rmSync(tmp,{recursive:true,force:true});
console.log(`wrote src/server/email-assets.ts: ${jobs.length} images, ${(total/1024).toFixed(0)} KB base64`);
