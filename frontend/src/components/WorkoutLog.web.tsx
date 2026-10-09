import {useEffect,useState} from 'react';
import type {ExerciseId,WorkoutSession,WorkoutSet} from '../domain/workout';
import type {LocalWorkout,WorkoutPreferences} from '../storage/workout-store';
import {exerciseCatalog} from '../domain/exercises';

export function loadLabel(id:ExerciseId):string {
 return exerciseCatalog[id].loadLabel;
}
function SetRow({set,index,session,refresh,onError,selected,toggle,previous}:{set:WorkoutSet;index:number;session:WorkoutSession;refresh:()=>void;onError:(s:string)=>void;selected:boolean;toggle:()=>void;previous?:WorkoutSet}) {
 const [reps,setReps]=useState(String(set.reps)),[load,setLoad]=useState(set.loadKg===null?'':String(set.loadKg));
 useEffect(()=>setReps(String(set.reps)),[set.reps]);
 useEffect(()=>setLoad(set.loadKg===null?'':String(set.loadKg)),[set.loadKg]);
 const label=`set ${index+1} ${exerciseCatalog[set.exercise].label}`;
 const save=()=>{
  const r=Number(reps),kg=load.trim()===''?null:Number(load);
  if(!Number.isSafeInteger(r)||r<0||r>2147483647||(kg!==null&&(!Number.isFinite(kg)||kg<0||kg>99999.999))){onError('Masukkan reps bulat dan beban kg yang valid.');return;}
  try{if(set.endedAt!==null)session.correctSet(set.id,r);session.setLoad(set.id,kg);refresh();onError('Set diperbarui');}catch{onError('Set belum dapat diperbarui. Akhiri set sebelum mengoreksi reps.');}
 };
 return <tr>
  <td>{index+1}</td><td>{previous?`${previous.loadKg===null?'—':`${previous.loadKg} kg`} × ${previous.reps}`:'—'}</td>
  <td><input aria-label={`Beban ${label}`} type="number" min="0" max="99999.999" step="0.001" placeholder="—" value={load} onChange={e=>setLoad(e.target.value)}/></td>
  <td>{set.endedAt===null?<strong>{set.reps}</strong>:<input aria-label={`Reps ${label}`} type="number" min="0" step="1" value={reps} onChange={e=>setReps(e.target.value)}/>}</td>
  <td><button onClick={save} aria-label={`Simpan ${label}`}>Simpan</button><small>{set.endedAt===null?'Aktif':'Selesai'} · {set.origin==='automatic'?'kamera':set.origin==='mixed'?'campuran':'manual'}<br/><span>Raw kamera: {set.detectedReps}</span></small></td>
  <td><input type="checkbox" aria-label={`Gabung ${label}`} disabled={set.endedAt===null} checked={selected} onChange={toggle}/></td>
 </tr>;
}
export default function WorkoutLog({session,sets,history,preferences,refresh,onError}:{session:WorkoutSession|null;sets:WorkoutSet[];history:LocalWorkout[];preferences:WorkoutPreferences;refresh:()=>void;onError:(s:string)=>void}) {
 const [selected,setSelected]=useState<string[]>([]);
 const exercises=[...new Set(sets.map(s=>s.exercise))];
 const merge=()=>{try{session!.mergeSets(selected);setSelected([]);refresh();onError('Set digabungkan');}catch{onError('Pilih minimal dua set selesai dari latihan yang sama.');}};
 return <div className="workout-log">
  {exercises.map(id=>{
   const rows=sets.filter(s=>s.exercise===id),previous=history.find(h=>h.id&&h.snapshot.sets.some(s=>s.exercise===id)&&h.snapshot.startedAt!==(session?.exportSnapshot().startedAt));
   const prior=previous?.snapshot.sets.filter(s=>s.exercise===id)??[];
   return <section key={id} className="exercise-card">
    <h2>{exerciseCatalog[id].label}</h2><p>{loadLabel(id)}</p>
    <label>Istirahat <input aria-label={`Target istirahat ${exerciseCatalog[id].label}`} type="number" min="0" max="3600" step="1" value={preferences.restSeconds[id]??120}
     onChange={e=>{const n=Number(e.target.value);if(Number.isSafeInteger(n)&&n>=0&&n<=3600){preferences.restSeconds[id]=n;refresh();}}}/> detik</label>
    <p>Target: {preferences.restSeconds[id]??120} detik</p>
    <div style={{overflowX:'auto'}}><table aria-label={`Set ${exerciseCatalog[id].label}`}><thead><tr><th>Set</th><th>Sebelumnya</th><th>kg</th><th>Reps</th><th>Status</th><th>Gabung</th></tr></thead>
     <tbody>{rows.map((set,i)=><SetRow key={set.id} set={set} index={i} session={session!} refresh={refresh} onError={onError} previous={prior[i]} selected={selected.includes(set.id)}
      toggle={()=>setSelected(ids=>ids.includes(set.id)?ids.filter(x=>x!==set.id):[...ids,set.id])}/>)}</tbody></table></div>
   </section>;
  })}
  {!sets.length&&<p>Belum ada set. Tandai target set pada latihan atau gunakan kamera.</p>}
  {sets.length>1&&<button onClick={merge}>Gabungkan set terpilih</button>}
 </div>;
}
