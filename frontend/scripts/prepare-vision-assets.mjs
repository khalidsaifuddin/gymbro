import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const root=fileURLToPath(new URL('../', import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'../docs/model-manifest.json'),'utf8'));
if (!manifest.model.sha256 || manifest.model.license !== 'Apache-2.0') throw new Error('Model verification is required');
const output=join(root,'public/vision');
await mkdir(join(output,'wasm'),{recursive: true});
await copyFile(join(root,'assets/licenses/mediapipe-Apache-2.0.txt'),join(output,'LICENSE.txt'));
const wasm=join(root,'node_modules/@mediapipe/tasks-vision/wasm');
for (const filename of await readdir(wasm)) await copyFile(join(wasm,filename),join(output,'wasm',filename));
const model=join(output,'pose_landmarker_full.task');
const hash=async path => createHash('sha256').update(await readFile(path)).digest('hex');
let valid=false;
try { valid=await hash(model)===manifest.model.sha256; } catch (error) { if (error.code!=='ENOENT') throw error; }
if (!valid) {
  const temporary=model+'.download';
  const result=spawnSync('curl',['--fail','--location','--retry','2','--output',temporary,manifest.model.source],{stdio:'inherit'});
  if (result.status!==0) { await rm(temporary,{force:true}); throw new Error('Official model download failed'); }
  if (await hash(temporary)!==manifest.model.sha256) { await rm(temporary); throw new Error('Model checksum mismatch'); }
  await rename(temporary,model);
}
await build({entryPoints:[join(root,'src/detection/pose.worker.ts')],outfile:join(output,'pose.worker.js'),
  bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true});
console.log('Prepared verified local model, WASM, and classic worker:',(await stat(model)).size,'model bytes');
