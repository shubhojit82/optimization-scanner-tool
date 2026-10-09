import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
run(['node_modules/typescript/bin/tsc','-p','tsconfig.server.json']);
function fix(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())fix(p);else if(p.endsWith('.js'))writeFileSync(p,readFileSync(p,'utf8').replace(/from (["'])(\.\.?\/[^"']+)\1/g,(all,q,path)=>/\.js$/.test(path)?all:`from ${q}${path}.js${q}`))}}
fix('dist/server');
if(!process.argv.includes('--server-only'))run(['node_modules/vite/bin/vite.js','build','--config','vite.portable.config.ts']);
