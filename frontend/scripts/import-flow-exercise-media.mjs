import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const frontend=resolve(fileURLToPath(new URL('..',import.meta.url)));
const pin=JSON.parse(await readFile(join(frontend,'src/data/exercise-media-source.json'),'utf8'));
const source=resolve(process.argv[2]??process.env.FLOW_EXERCISE_DATASET_DIR??'');
if(!process.argv[2]&&!process.env.FLOW_EXERCISE_DATASET_DIR)throw new Error('Pass the pinned Flow dataset checkout path as an argument or set FLOW_EXERCISE_DATASET_DIR.');
const commit=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(commit!==pin.commit)throw new Error(`Flow commit mismatch: expected ${pin.commit}, found ${commit}.`);
const exerciseFile=join(source,'data/exercises.json');
const sourceBytes=await readFile(exerciseFile);
const sourceHash=createHash('sha256').update(sourceBytes).digest('hex');
if(sourceHash!==pin.exercisesSha256)throw new Error(`Flow dataset checksum mismatch: ${sourceHash}.`);
const sourceRows=JSON.parse(sourceBytes);
const sourceChecksums=JSON.parse(await readFile(join(source,'data/checksums.json'),'utf8'));
const existing=JSON.parse(await readFile(join(frontend,'src/data/exercises-dataset.json'),'utf8')).exercises;
if(sourceRows.length!==1324||new Set(sourceRows.map(row=>row.id)).size!==sourceRows.length)throw new Error('Expected exactly 1,324 unique Flow exercise IDs.');
if(existing.length!==1324||existing.some(row=>{const flow=sourceRows.find(item=>item.id===row.id);return !flow||flow.name!==row.name;}))throw new Error('Flow IDs/names do not exactly match Gymbro catalog; refusing fuzzy mapping.');

const output=join(frontend,'public/exercise-media',pin.commit);
const staging=`${output}.staging`;
await rm(staging,{recursive:true,force:true});
await mkdir(staging,{recursive:true});
const seenPaths=new Set();
const manifest={source:{...pin,records:sourceRows.length,animations:0,instructionOnly:0,frames:0},exercises:{}};
for(const row of sourceRows){
 const animation=row.animation;
 if(!animation){manifest.source.instructionOnly++;manifest.exercises[row.id]={animation:null};continue;}
 if(animation.license!=='CC0-1.0'||animation.frames?.length!==3||animation.sequence?.some(index=>!Number.isInteger(index)||index<0||index>=animation.frames.length)||!Number.isInteger(animation.frameDurationMs)||animation.frameDurationMs<1)throw new Error(`Malformed Flow animation metadata: ${row.id}.`);
 const frames=[];
 for(let index=0;index<animation.frames.length;index++){
  const relative=animation.frames[index];
  if(typeof relative!=='string'||!/^assets\/[0-9]{4}\/frame-0[0-2]\.svg$/.test(relative)||seenPaths.has(relative))throw new Error(`Invalid/duplicate Flow frame path: ${relative}.`);
  seenPaths.add(relative);
  const sourceBytes=await readFile(join(source,relative));
  const sourceChecksum=createHash('sha256').update(sourceBytes).digest('hex');
  if(sourceChecksums[relative]!==sourceChecksum)throw new Error(`Flow frame checksum mismatch: ${relative}.`);
  let svg=sourceBytes.toString('utf8');
  if(!/^\s*<\?xml[\s\S]*?<svg\b|^\s*<svg\b/i.test(svg)||/<\s*(script|foreignObject|image|use|style)\b/i.test(svg)||/\son[a-z]+\s*=/i.test(svg)||/(?:href|src)\s*=\s*['"](?:https?:|\/\/|javascript:|data:)/i.test(svg)||/<!ENTITY/i.test(svg))throw new Error(`Unsafe or invalid SVG frame: ${relative}.`);
  const sourceViewBox=svg.match(/\bviewBox\s*=\s*['"]([^'"]+)['"]/i)?.[1];
  const width=Number(svg.match(/\bwidth\s*=\s*['"]([0-9.]+)(?:pt|px)?['"]/i)?.[1]);
  const height=Number(svg.match(/\bheight\s*=\s*['"]([0-9.]+)(?:pt|px)?['"]/i)?.[1]);
  const viewBox=sourceViewBox??(Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0?`0 0 ${width} ${height}`:null);
  if(!viewBox||viewBox.trim().split(/[\s,]+/).length!==4)throw new Error(`Missing SVG viewBox or intrinsic dimensions: ${relative}.`);
  svg=svg.replace(/<!DOCTYPE[\s\S]*?>\s*/i,'').replace(/^\s*<\?xml[^?]*\?>\s*/i,'');
  if(!sourceViewBox)svg=svg.replace(/<svg\b/i,match=>`${match} viewBox="${viewBox}"`);
  const bytes=Buffer.from(svg);
  const checksum=createHash('sha256').update(bytes).digest('hex');
  const path=`${row.id}/${relative.split('/').at(-1)}`;
  await mkdir(join(staging,row.id),{recursive:true});
  await writeFile(join(staging,path),bytes);
  frames.push({path:`/exercise-media/${pin.commit}/${path}`,sha256:checksum,sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),viewBox});
  manifest.source.frames++;
 }
 manifest.source.animations++;
 manifest.exercises[row.id]={animation:{frames,sequence:animation.sequence,frameDurationMs:animation.frameDurationMs,license:pin.artworkLicense,provenance:animation.provenance}};
}
if(manifest.source.animations!==1257||manifest.source.instructionOnly!==67||manifest.source.frames!==3771)throw new Error(`Unexpected Flow inventory counts: ${JSON.stringify(manifest.source)}.`);
await rm(output,{recursive:true,force:true});
await mkdir(join(frontend,'public/exercise-media'),{recursive:true});
await cp(staging,output,{recursive:true});
await rm(staging,{recursive:true,force:true});
await writeFile(join(frontend,'src/data/exercise-media.json'),`${JSON.stringify(manifest,null,2)}\n`);
await Promise.all(['LICENSE','ARTWORK-LICENSE','NOTICE.md'].map(async name=>writeFile(join(output,name==='NOTICE.md'?'FLOW-NOTICE.md':name),await readFile(join(source,name)))));
await writeFile(join(output,'NOTICE.md'),`# Imported Flow exercise media\n\nSource: [${pin.repository}](https://github.com/ozansozuozgit/flow-exercise-dataset)\n\nPinned commit: ${pin.commit}\n\nCustom SVG artwork: CC0-1.0, to the extent rights are held by Flow. The source project documents incomplete provenance (13 original prompts retained for 1,257 animations), no blanket third-party rights clearance, and no professional form review. These illustrations are illustrative, not verified coaching. See FLOW-NOTICE.md and ARTWORK-LICENSE. The upstream exercise data and its MIT notice are also preserved here.\n`);
console.log(`Imported ${manifest.source.animations} animations / ${manifest.source.frames} SVG frames; ${manifest.source.instructionOnly} exercises have no artwork.`);
