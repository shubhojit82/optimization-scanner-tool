import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
 root:resolve(process.cwd(),'frontend'), publicDir:resolve(process.cwd(),'public'),
 plugins:[react()], build:{outDir:resolve(process.cwd(),'dist/client'),emptyOutDir:true},
 server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8080',changeOrigin:false}}},
});
