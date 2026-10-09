import {useState} from 'react';
import {exerciseCatalog,exerciseIds,importedExerciseCount,isSupportedExerciseId,supportedExerciseIds,type ExerciseId,type SupportedExerciseId} from '../domain/exercises';
import ExerciseDetails from './ExerciseDetails.web';

const supportedAreas:Record<SupportedExerciseId,string>={
 squat:'Legs','push-up':'Chest','dumbbell-curl':'Arms','machine-shoulder-press':'Shoulders',
 'bench-press':'Chest','lat-pulldown':'Back','seated-cable-row':'Back','face-pull':'Shoulders',
 'straight-arm-pulldown':'Back',
};
const area=(id:ExerciseId)=>isSupportedExerciseId(id)?supportedAreas[id]:exerciseCatalog[id].category??'Other';
const equipmentName=(value:string)=>value==='bodyweight'?'Bodyweight':value==='machine'?'Machine / Cable':value.replace(/\b\w/g,letter=>letter.toUpperCase());
const equipmentOptions=[...new Set(exerciseIds.map(id=>exerciseCatalog[id].equipment))].sort();
const areaOptions=[...new Set(exerciseIds.map(area))].sort();

export default function ExerciseBrowser({onBack,onSelect,excluded=[]}:{onBack:()=>void;onSelect?:(id:ExerciseId)=>void;excluded?:ExerciseId[]}){
 const [query,setQuery]=useState(''),[equipment,setEquipment]=useState('all'),[muscle,setMuscle]=useState('all'),[detail,setDetail]=useState<ExerciseId|null>(null),[limit,setLimit]=useState(80);
 const excludedSet=new Set(excluded);
 const rows=exerciseIds.filter(id=>{
  const exercise=exerciseCatalog[id],term=query.trim().toLowerCase();
  return (!term||`${exercise.label} ${exercise.target??''} ${area(id)}`.toLowerCase().includes(term))&&
   (equipment==='all'||exercise.equipment===equipment)&&(muscle==='all'||area(id)===muscle);
 });
 if(detail)return <ExerciseDetails exercise={detail} onBack={()=>setDetail(null)} canAdd={!!onSelect&&!excludedSet.has(detail)} onSelect={()=>onSelect?.(detail)}/>;
 return <section className="saka-stack gymbro-page" aria-label={onSelect?'Exercise picker':'Explore exercises'}>
  <div className="saka-split"><button className="saka-btn saka-btn--sm" onClick={onBack}>Back</button><span className="saka-kicker">{importedExerciseCount.toLocaleString('en-US')} imported exercises · {supportedExerciseIds.length} with camera</span></div>
  <div><div className="saka-kicker">Gymbro library</div><h1 className="gymbro-title">{onSelect?'Add Exercise':'Explore Exercises'}</h1>
   <p className="saka-prose">Search the complete catalog. Camera detection is available for supported movements; every exercise can be logged manually.</p></div>
  <div className="gymbro-filter-grid">
   <label className="saka-field"><span className="saka-label">Search exercises</span><input className="saka-input" aria-label="Search exercises" value={query} onChange={event=>{setQuery(event.target.value);setLimit(80);}} placeholder="Search exercises"/></label>
   <label className="saka-field"><span className="saka-label">Equipment</span><select className="saka-select" aria-label="Equipment filter" value={equipment} onChange={event=>{setEquipment(event.target.value);setLimit(80);}}>
    <option value="all">All Equipment</option>{equipmentOptions.map(id=><option key={id} value={id}>{equipmentName(id)}</option>)}
   </select></label>
   <label className="saka-field"><span className="saka-label">Muscle area</span><select className="saka-select" aria-label="Muscle filter" value={muscle} onChange={event=>{setMuscle(event.target.value);setLimit(80);}}>
    <option value="all">All Muscles</option>{areaOptions.map(label=><option key={label} value={label}>{label}</option>)}
   </select></label>
  </div>
  <p className="saka-kicker">{rows.length.toLocaleString('en-US')} matching exercises</p>
  <div className="saka-list-group gymbro-exercise-list">{rows.slice(0,limit).map(id=><div className="saka-list-item gymbro-exercise-item" key={id}>
   {isSupportedExerciseId(id)?<img src={`/exercises/${id}-poses.svg`} alt="" loading="lazy"/>:<span className="gymbro-exercise-symbol" aria-hidden="true">{exerciseCatalog[id].label.slice(0,1)}</span>}
   <button className="gymbro-exercise-name" onClick={()=>onSelect?onSelect(id):setDetail(id)} disabled={excludedSet.has(id)}>{exerciseCatalog[id].label}</button>
   <span className="saka-list-item__meta">{area(id)} · {equipmentName(exerciseCatalog[id].equipment)}</span>
   <button className="saka-btn saka-btn--icon saka-btn--sm" aria-label={`Info ${exerciseCatalog[id].label}`} onClick={()=>setDetail(id)}>i</button>
  </div>)}</div>
  {rows.length>limit&&<button className="saka-btn saka-btn--block" onClick={()=>setLimit(value=>value+80)}>Load more exercises</button>}
  {!rows.length&&<p className="saka-prose">No exercises match those filters.</p>}
 </section>;
}
