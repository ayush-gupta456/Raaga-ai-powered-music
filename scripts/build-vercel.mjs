import { cp, mkdir } from 'node:fs/promises';
// Vercel serves public files through its CDN; express.static is ignored there.
await mkdir('public/assets',{recursive:true});
await cp('dist-node/assets','public/assets',{recursive:true});
