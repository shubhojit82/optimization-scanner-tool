import {spawn,spawnSync} from 'node:child_process';
if(process.env.GEO_AUTH_MODE&&!['local','users'].includes(process.env.GEO_AUTH_MODE))throw new Error('npm run dev supports GEO_AUTH_MODE=local or users. Use build/start for basic mode.');
// users mode binds 0.0.0.0 by default; keep the dev API on loopback.
process.env.GEO_BIND??='127.0.0.1';
if(process.env.PORT&&process.env.PORT!=='8080')throw new Error('Development API uses PORT=8080.');
const build=spawnSync(process.execPath,['scripts/build-portable.mjs','--server-only'],{stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
const api=spawn(process.execPath,['--env-file-if-exists=.env','dist/server/server/node-server.js'],{stdio:'inherit'});
const ui=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','vite.portable.config.ts'],{stdio:'inherit'});
let closing=false;function stop(code=0){if(closing)return;closing=true;api.kill('SIGTERM');ui.kill('SIGTERM');setTimeout(()=>process.exit(code),200).unref()}
api.on('exit',c=>stop(c||0));ui.on('exit',c=>stop(c||0));process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
