import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// Upstream metadata only. Gym visual images and GIFs have separate license terms.
const revision='7455efae41b330c265e7cd4b78dfa848e7ce5ebd';
const inputHash='656634224b8977b99a6d765470ee123260d4979715eaa4e7c0b7c8bb0d79f93d';
const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/import-exercise-dataset.mjs /path/to/exercises.json');
const body=readFileSync(input),hash=createHash('sha256').update(body).digest('hex');
if(hash!==inputHash)throw new Error(`Dataset hash mismatch: ${hash}`);
const upstream=JSON.parse(body.toString('utf8'));
if(!Array.isArray(upstream)||upstream.length!==1324)throw new Error('Expected 1,324 upstream exercises');
const ids=new Set();
const rows=upstream.map(entry=>{
 if(!/^\d{4}$/.test(entry.id)||ids.has(entry.id)||!entry.name||!entry.instructions?.en||!entry.category||!entry.equipment){
  throw new Error(`Invalid upstream exercise ${entry.id}`);
 }
 ids.add(entry.id);
 return {id:entry.id,name:entry.name,category:entry.category,equipment:entry.equipment,target:entry.target,
  instructions:entry.instructions.en};
}).sort((a,b)=>a.id.localeCompare(b.id));
const here=dirname(fileURLToPath(import.meta.url));
const frontend=resolve(here,'..'),root=resolve(frontend,'..');
const output=resolve(frontend,'src/data/exercises-dataset.json');mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify({source:`https://github.com/hasaneyldrm/exercises-dataset/commit/${revision}`,exercises:rows})+'\n');
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const uuid=id=>`00000000-0000-4000-8001-${String(Number(id)).padStart(12,'0')}`;
const values=rows.map(row=>`(${[uuid(row.id),`dataset-${row.id}`,row.name,
 row.equipment==='body weight'?'bodyweight':row.equipment,
 row.equipment==='body weight'?'optional-external-kg':'entered-total-external-kg','manual-only'].map(quote).join(',')},false)`);
const up=`-- Metadata from hasaneyldrm/exercises-dataset ${revision}; MIT text/data only, no Gym visual media.\n`+
 `INSERT INTO ref.exercises(id,slug,name,equipment,load_convention,recognition_version,automatic_candidate) VALUES\n${values.join(',\n')};\n`;
writeFileSync(resolve(root,'backend/pkg/migration/sql/005_exercise_dataset.up.sql'),up);
writeFileSync(resolve(root,'backend/pkg/migration/sql/005_exercise_dataset.down.sql'),
 `DELETE FROM ref.exercises WHERE id IN (\n${rows.map(row=>quote(uuid(row.id))).join(',\n')}\n);\n`);
console.log(`Imported ${rows.length} metadata records from ${revision}`);
