import {exerciseCatalog,isSupportedExerciseId,type ExerciseId} from '../domain/exercises';
import {resolveExerciseAnimation} from '../domain/exercise-media';
import ExerciseGuide from './ExerciseGuide.web';
import ExerciseMedia from './ExerciseMedia.web';

const supportedAreas:Partial<Record<ExerciseId,string>>={squat:'Legs','push-up':'Chest','dumbbell-curl':'Arms','machine-shoulder-press':'Shoulders','bench-press':'Chest','lat-pulldown':'Back','seated-cable-row':'Back','face-pull':'Shoulders','straight-arm-pulldown':'Back'};
const area=(id:ExerciseId)=>supportedAreas[id]??exerciseCatalog[id].category??'Other';
const equipmentName=(value:string)=>value==='bodyweight'?'Bodyweight':value==='machine'?'Machine / Cable':value.replace(/\b\w/g,letter=>letter.toUpperCase());

export default function ExerciseDetails({exercise,onBack,onSelect,canAdd=false}:{exercise:ExerciseId;onBack:()=>void;onSelect?:()=>void;canAdd?:boolean}){
 const item=exerciseCatalog[exercise],animation=resolveExerciseAnimation(exercise);
 return <section className="saka-stack gymbro-page" aria-label="Exercise details">
  <div className="saka-split"><button className="saka-btn saka-btn--sm" onClick={onBack}>Back to exercises</button><span className="saka-kicker">Exercise guide</span></div>
  <h1 className="gymbro-title">{item.label}</h1>
  <ExerciseMedia key={exercise} animation={animation} label={item.label}/>
  <div className="saka-card"><div className="saka-cluster"><span className="gymbro-chip">{equipmentName(item.equipment)}</span><span className="gymbro-chip">{area(exercise)}</span>
   {item.target&&<span className="gymbro-chip">{item.target}</span>}</div>
   <p className="saka-prose">{item.loadLabel}</p>
   {isSupportedExerciseId(exercise)?<ExerciseGuide exercise={exercise}/>:<><ol className="saka-prose gymbro-dataset-instructions">{(item.instructions??'').split(/\n|(?<=\.)\s+(?=[A-Z0-9])/).filter(Boolean).map((instruction,index)=><li key={index}>{instruction}</li>)}</ol>
    <small>Exercise names, equipment, and instructions: hasaneyldrm/exercises-dataset (MIT).</small></>}
  </div>
  {isSupportedExerciseId(exercise)&&<p className="saka-prose">Camera detection is supported for this exercise. Movement illustrations are visual examples, not verified coaching.</p>}
  {canAdd&&onSelect&&<button className="saka-btn is-filled" onClick={onSelect}>Add {item.label}</button>}
 </section>;
}
