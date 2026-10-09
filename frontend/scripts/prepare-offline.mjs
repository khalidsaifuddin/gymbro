import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const root=new URL('../dist/',import.meta.url);
async function files(path,prefix='') {
 const rows=[];
 for(const entry of await readdir(path,{withFileTypes:true})) {
  const relative=prefix+entry.name;
  if(relative.startsWith('exercise-media/'))continue;
  if(entry.isDirectory())rows.push(...await files(join(path,entry.name),relative+'/'));
  else if(entry.name!=='gymbro-sw.js')rows.push(relative);
 }
 return rows.sort();
}
const paths=await files(root.pathname),hash=createHash('sha256');
for(const path of paths){hash.update(path);hash.update(await readFile(new URL(path,root)));}
const cache='gymbro-assets-'+hash.digest('hex').slice(0,16);
const worker=await readFile(new URL('./offline-worker.template.js',import.meta.url),'utf8');
await writeFile(new URL('gymbro-sw.js',root),worker.replace('__CACHE__',JSON.stringify(cache)).replace('__ASSETS__',JSON.stringify(['/',...paths.map(p=>'/'+p)])));
console.log(`Prepared offline cache ${cache}: ${paths.length+1} same-origin assets`);
