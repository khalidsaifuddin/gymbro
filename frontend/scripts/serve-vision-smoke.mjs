import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const temporary=resolve('node_modules/.cache/vision-smoke');
await mkdir(temporary,{recursive:true});
await build({entryPoints:['e2e/fixtures/vision-smoke.ts'],outfile:temporary+'/smoke.js',bundle:true,format:'iife',platform:'browser'});
const assets=resolve('public/vision');
createServer(async (request,response) => {
  if (request.method!=='GET') { response.writeHead(405); response.end(); return; }
  const path=new URL(request.url,'http://127.0.0.1').pathname;
  if (path==='/') { response.setHeader('Content-Type','text/html'); response.end('<!doctype html><title>Vision smoke</title><script src="/smoke.js"></script>'); return; }
  let file;
  if (path==='/smoke.js') file=temporary+'/smoke.js';
  else if (path.startsWith('/vision/')) {
    file=resolve(assets,decodeURIComponent(path.slice('/vision/'.length)));
    if (!file.startsWith(assets+sep)) {response.writeHead(403);response.end();return;}
  } else {response.writeHead(404);response.end();return;}
  try {
    const bytes=await readFile(file);
    response.setHeader('Content-Type',extname(file)==='.js'?'application/javascript':extname(file)==='.wasm'?'application/wasm':'application/octet-stream');
    response.end(bytes);
  } catch {response.writeHead(404);response.end();}
}).listen(8091,'127.0.0.1');
