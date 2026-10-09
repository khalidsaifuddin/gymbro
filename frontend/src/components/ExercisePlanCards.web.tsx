import {exerciseCatalog,isSupportedExerciseId,type ExerciseId,type SupportedExerciseId} from '../domain/exercises';
import {emptyTargets,type PlannedExercise,type SetTarget} from '../domain/session-plan';
import type {WorkoutSet} from '../domain/workout';
import type {LocalWorkout} from '../storage/workout-store';
import {cameraViewLabels} from '../detection/camera-guides';
import type {CameraView} from '../domain/camera-view';

type Props={
 plan:PlannedExercise[];mode:'routine'|'session';sets?:WorkoutSet[];history?:LocalWorkout[];
 onChange:(plan:PlannedExercise[])=>void;onComplete?:(exercise:ExerciseId,index:number)=>void;
 onCamera?:(exercise:SupportedExerciseId)=>void;onError?:(message:string)=>void;
 cameraViews?:Partial<Record<SupportedExerciseId,CameraView>>;onCameraViewChange?:(exercise:SupportedExerciseId,view:CameraView)=>void;
 restSeconds?:Partial<Record<ExerciseId,number>>;onRestChange?:(exercise:ExerciseId,seconds:number)=>void;
};

function parsedNumber(value:string,kind:'reps'|'load'):number|null|undefined{
 if(value.trim()==='')return null;
 const number=Number(value);
 if(kind==='reps')return Number.isSafeInteger(number)&&number>=1&&number<=2147483647?number:undefined;
 return Number.isFinite(number)&&number>=0&&number<=99999.999?number:undefined;
}

export default function ExercisePlanCards({plan,mode,sets=[],history=[],onChange,onComplete,onCamera,onError,cameraViews,onCameraViewChange,restSeconds,onRestChange}:Props){
 const exercises=[...plan.map(row=>row.exercise),...sets.map(set=>set.exercise).filter(id=>!plan.some(row=>row.exercise===id))];
 const updateTarget=(exercise:ExerciseId,index:number,field:keyof SetTarget,value:string)=>{
  const number=parsedNumber(value,field==='reps'?'reps':'load');
  if(number===undefined){onError?.(field==='reps'?'Enter a positive whole rep target.':'Enter a valid nonnegative kg target.');return;}
  onChange(plan.map(row=>row.exercise===exercise?{
   ...row,targets:row.targets.map((target,i)=>i===index?{...target,[field]:number}:target),
  }:row));
 };
 const addSet=(exercise:ExerciseId)=>onChange(plan.map(row=>row.exercise===exercise?{...row,targets:[...row.targets,emptyTargets()[0]]}:row));
 const removeExercise=(exercise:ExerciseId)=>onChange(plan.filter(row=>row.exercise!==exercise));
 return <div className="saka-stack gymbro-plan-list">
  {exercises.map(id=>{
   const row=plan.find(item=>item.exercise===id),actual=sets.filter(set=>set.exercise===id);
   const count=Math.max(row?.targets.length??0,actual.length);
   const prior=history.find(record=>record.snapshot.finishedAt!==null&&record.snapshot.sets.some(set=>set.exercise===id))?.snapshot.sets.filter(set=>set.exercise===id)??[];
   const label=exerciseCatalog[id].label;
   return <article className="saka-card gymbro-workout-card" key={id}>
    <div className="gymbro-exercise-card-head">{isSupportedExerciseId(id)?<img src={`/exercises/${id}-poses.svg`} alt="" loading="lazy"/>:<span className="gymbro-exercise-symbol" aria-hidden="true">{label.slice(0,1)}</span>}
     <div><div className="saka-kicker">{exerciseCatalog[id].equipment}</div><h2>{label}</h2><p className="saka-prose">{exerciseCatalog[id].loadLabel}</p></div>
     <div className="saka-cluster gymbro-card-actions">{mode==='session'&&isSupportedExerciseId(id)&&<button className="saka-btn is-filled saka-btn--sm" aria-label={`Open camera for ${label}`} onClick={()=>onCamera?.(id)}>Camera</button>}
      {row&&<button className="saka-btn saka-btn--sm" aria-label={`Remove ${label}`} onClick={()=>removeExercise(id)} disabled={actual.length>0}>Remove</button>}</div>
    </div>
    {mode==='session'&&isSupportedExerciseId(id)&&<label className="saka-field gymbro-camera-angle"><span className="saka-label">Camera angle</span><select className="saka-select" aria-label={`Camera angle ${label}`} value={cameraViews?.[id]??'auto'} disabled={actual.some(set=>set.endedAt===null)} onChange={event=>onCameraViewChange?.(id,event.target.value as CameraView)}>{Object.entries(cameraViewLabels).map(([view,name])=><option key={view} value={view}>{name}</option>)}</select></label>}
    {mode==='session'&&<div className="saka-split gymbro-rest-row"><span className="saka-kicker">Rest target</span><label><input className="saka-input" aria-label={`Target istirahat ${label}`} type="number" min="0" max="3600" value={restSeconds?.[id]??120}
      onChange={event=>{const number=Number(event.target.value);if(Number.isSafeInteger(number)&&number>=0&&number<=3600)onRestChange?.(id,number);}}/> sec</label></div>}
    <div className="gymbro-set-table" role="table" aria-label={`Planned sets ${label}`}>
     <div className="gymbro-set-grid gymbro-set-head" role="row"><span>Set</span><span>Previous</span><span>KG</span><span>Reps</span><span>Done</span></div>
     {Array.from({length:count},(_,index)=>{
      const complete=actual[index],target=row?.targets[index],last=prior[index];
      return <div className={`gymbro-set-grid ${complete?'is-complete':''}`} role="row" key={`${id}-${index}`}>
       <span className="gymbro-set-number">{index+1}</span>
       <span className="gymbro-previous">{last?`${last.loadKg===null?'—':`${last.loadKg} kg`} × ${last.reps}`:'—'}</span>
       {complete?<><span>{complete.loadKg===null?'—':complete.loadKg}</span><span>{complete.reps}{complete.endedAt===null&&<small> LIVE</small>}</span>
        <span className="gymbro-done" aria-label={`Completed set ${index+1} ${label}`}>✓</span></>
       :target?<><input className="saka-input" aria-label={`Target kg set ${index+1} ${label}`} type="number" inputMode="decimal" min="0" max="99999.999" step="0.001" placeholder="—" value={target.loadKg??''}
          onChange={event=>updateTarget(id,index,'loadKg',event.target.value)}/>
        <input className="saka-input" aria-label={`Target reps set ${index+1} ${label}`} type="number" inputMode="numeric" min="1" step="1" placeholder="—" value={target.reps??''}
          onChange={event=>updateTarget(id,index,'reps',event.target.value)}/>
        {mode==='session'?<button className="saka-btn saka-btn--icon saka-btn--sm" aria-label={`Complete set ${index+1} ${label}`} onClick={()=>onComplete?.(id,index)} disabled={actual.length!==index}>✓</button>
          :<span className="gymbro-pending">TARGET</span>}</>:<><span>—</span><span>—</span><span>—</span></>}
      </div>;
     })}
    </div>
    {row&&row.targets.length<20&&<button className="saka-btn saka-btn--block saka-btn--sm" aria-label={`Add Set ${label}`} onClick={()=>addSet(id)}>+ Add Set</button>}
   </article>;
  })}
 </div>;
}
