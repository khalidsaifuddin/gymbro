import {useState} from 'react';
import {exerciseCatalog,isSupportedExerciseId,type ExerciseId,type SupportedExerciseId} from '../domain/exercises';
import {emptyTargets,type PlannedExercise,type SetTarget} from '../domain/session-plan';
import type {WorkoutSet} from '../domain/workout';
import type {LocalWorkout} from '../storage/workout-store';
import {cameraViewLabels} from '../detection/camera-guides';
import type {CameraView} from '../domain/camera-view';
import type {SessionSetRow,SessionSetRows} from '../domain/session-set-rows';

type Props={
 plan:PlannedExercise[];mode:'routine'|'session';sets?:WorkoutSet[];history?:LocalWorkout[];sessionRows?:SessionSetRows;
 onChange:(plan:PlannedExercise[])=>void;onComplete?:(exercise:ExerciseId,row:SessionSetRow)=>void;
 onDetails?:(exercise:ExerciseId)=>void;
 onTargetChange?:(exercise:ExerciseId,row:SessionSetRow,target:SetTarget)=>void;
 onToggleSet?:(exercise:ExerciseId,row:SessionSetRow,checked:boolean)=>void;
 onEditSet?:(exercise:ExerciseId,row:SessionSetRow,reps:number,loadKg:number|null)=>void;
 onDeleteSet?:(exercise:ExerciseId,row:SessionSetRow)=>void;
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

export default function ExercisePlanCards({plan,mode,sets=[],history=[],sessionRows={},onChange,onComplete,onDetails,onTargetChange,onToggleSet,onEditSet,onDeleteSet,onCamera,onError,cameraViews,onCameraViewChange,restSeconds,onRestChange}:Props){
 const [drafts,setDrafts]=useState<Record<string,{reps:string;load:string}>>({});
 const [deleteRowId,setDeleteRowId]=useState<string|null>(null);
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
   const stableRows=sessionRows[id]??[],count=Math.max(row?.targets.length??0,actual.length,stableRows.length);
   const prior=history.find(record=>record.snapshot.finishedAt!==null&&record.snapshot.sets.some(set=>set.exercise===id))?.snapshot.sets.filter(set=>set.exercise===id)??[];
   const label=exerciseCatalog[id].label;
   return <article className="saka-card gymbro-workout-card" key={id}>
    <div className="gymbro-exercise-card-head">{isSupportedExerciseId(id)?<img src={`/exercises/${id}-poses.svg`} alt="" loading="lazy"/>:<span className="gymbro-exercise-symbol" aria-hidden="true">{label.slice(0,1)}</span>}
     <div><div className="saka-kicker">{exerciseCatalog[id].equipment}</div><h2><button className="gymbro-detail-link" onClick={()=>onDetails?.(id)}>{label}</button></h2><p className="saka-prose">{exerciseCatalog[id].loadLabel}</p></div>
     <div className="saka-cluster gymbro-card-actions">{mode==='session'&&isSupportedExerciseId(id)&&<button className="saka-btn is-filled saka-btn--sm" aria-label={`Open camera for ${label}`} onClick={()=>onCamera?.(id)}>Camera</button>}
      {row&&<button className="saka-btn saka-btn--sm" aria-label={`Remove ${label}`} onClick={()=>removeExercise(id)} disabled={actual.length>0}>Remove</button>}</div>
    </div>
    {mode==='session'&&isSupportedExerciseId(id)&&<label className="saka-field gymbro-camera-angle"><span className="saka-label">Camera angle</span><select className="saka-select" aria-label={`Camera angle ${label}`} value={cameraViews?.[id]??'auto'} disabled={actual.some(set=>set.endedAt===null)} onChange={event=>onCameraViewChange?.(id,event.target.value as CameraView)}>{Object.entries(cameraViewLabels).map(([view,name])=><option key={view} value={view}>{name}</option>)}</select></label>}
    {mode==='session'&&<div className="saka-split gymbro-rest-row"><span className="saka-kicker">Rest target</span><label><input className="saka-input" aria-label={`Target istirahat ${label}`} type="number" min="0" max="3600" value={restSeconds?.[id]??120}
      onChange={event=>{const number=Number(event.target.value);if(Number.isSafeInteger(number)&&number>=0&&number<=3600)onRestChange?.(id,number);}}/> sec</label></div>}
    <div className="gymbro-set-table" role="table" aria-label={`Planned sets ${label}`}>
     <div className="gymbro-set-grid gymbro-set-head" role="row"><span>Set</span><span>Previous</span><span>KG</span><span>Reps</span><span>Done</span><span>Actions</span></div>
     {Array.from({length:count},(_,index)=>{
      const stable=stableRows[index],complete=stable?.resultSetId?actual.find(set=>set.id===stable.resultSetId):undefined,target=stable?.target??row?.targets[index],last=prior[index];
      const edit=drafts[stable?.id??''],live=complete?.endedAt===null;
      const repsValue=edit?.reps??(complete?String(complete.reps):undefined),loadValue=edit?.load??(complete?(complete.loadKg===null?'':String(complete.loadKg)):undefined);
      return <div className={`gymbro-set-grid ${complete?'is-complete':''}`} role="row" key={stable?.id??`${id}-${index}`}>
       <span className="gymbro-set-number">{index+1}</span>
       <span className="gymbro-previous">{last?`${last.loadKg===null?'—':`${last.loadKg} kg`} × ${last.reps}`:'—'}</span>
       {complete?<><input className="saka-input" aria-label={`KG set ${index+1} ${label}`} type="number" inputMode="decimal" min="0" max="99999.999" step="0.001" placeholder="—" value={loadValue}
          disabled={live} onChange={event=>stable&&setDrafts(current=>({...current,[stable.id]:{reps:repsValue??'',load:event.target.value}}))}/>
        <input className="saka-input" aria-label={`Reps set ${index+1} ${label}`} type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={repsValue}
          disabled={live} onChange={event=>stable&&setDrafts(current=>({...current,[stable.id]:{reps:event.target.value,load:loadValue??''}}))}/>
        <input type="checkbox" aria-label={`Completed set ${index+1} ${label}`} checked disabled={live} onChange={event=>stable&&onToggleSet?.(id,stable,event.target.checked)}/>
        {stable&&<div className="saka-cluster gymbro-set-actions">{!live&&<><button className="saka-btn saka-btn--sm" aria-label={`Save set ${index+1} ${label}`} onClick={()=>{
           const reps=Number(repsValue),load=loadValue?.trim()===''?null:Number(loadValue);
           if(!Number.isSafeInteger(reps)||reps<0||reps>2147483647){onError?.('Reps must be a whole number from 0.');return;}
           if(load!==null&&(!Number.isFinite(load)||load<0||load>99999.999)){onError?.('Enter a valid nonnegative kg value.');return;}
           onEditSet?.(id,stable,reps,load);setDrafts(current=>{const next={...current};delete next[stable.id];return next;});
          }}>Save</button>{deleteRowId===stable.id?<div className="saka-alert is-danger" role="alert"><span>Delete set {index+1}?</span><button className="saka-btn saka-btn--sm" onClick={()=>{onDeleteSet?.(id,stable);setDeleteRowId(null);}}>Hapus</button><button className="saka-btn saka-btn--sm" onClick={()=>setDeleteRowId(null)}>Batal</button></div>
            :<button className="saka-btn saka-btn--sm" aria-label={`Delete set ${index+1} ${label}`} onClick={()=>setDeleteRowId(stable.id)}>Delete</button>}</>}</div>}
       </>:target?<><input className="saka-input" aria-label={`Target kg set ${index+1} ${label}`} type="number" inputMode="decimal" min="0" max="99999.999" step="0.001" placeholder="—" value={target.loadKg??''}
          onChange={event=>{const value=parsedNumber(event.target.value,'load');if(value===undefined){onError?.('Enter a valid nonnegative kg target.');return;}if(stable)onTargetChange?.(id,stable,{...target,loadKg:value});else updateTarget(id,index,'loadKg',event.target.value);}}/>
        <input className="saka-input" aria-label={`Target reps set ${index+1} ${label}`} type="number" inputMode="numeric" min="1" step="1" placeholder="—" value={target.reps??''}
          onChange={event=>{const value=parsedNumber(event.target.value,'reps');if(value===undefined){onError?.('Enter a positive whole rep target.');return;}if(stable)onTargetChange?.(id,stable,{...target,reps:value});else updateTarget(id,index,'reps',event.target.value);}}/>
        {mode==='session'?<input type="checkbox" aria-label={`Completed set ${index+1} ${label}`} checked={false} disabled={!stable} onChange={event=>stable&&onToggleSet?.(id,stable,event.target.checked)}/>
          :<span className="gymbro-pending">TARGET</span>}
        {stable&&<div className="saka-cluster gymbro-set-actions">{mode==='session'&&(deleteRowId===stable.id?<div className="saka-alert is-danger" role="alert"><span>Delete set {index+1}?</span><button className="saka-btn saka-btn--sm" onClick={()=>{onDeleteSet?.(id,stable);setDeleteRowId(null);}}>Hapus</button><button className="saka-btn saka-btn--sm" onClick={()=>setDeleteRowId(null)}>Batal</button></div>
          :<button className="saka-btn saka-btn--sm" aria-label={`Delete set ${index+1} ${label}`} onClick={()=>setDeleteRowId(stable.id)}>Delete</button>)}</div>}
        </>:<><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></>}
      </div>;
     })}
    </div>
    {row&&row.targets.length<20&&<button className="saka-btn saka-btn--block saka-btn--sm" aria-label={`Add Set ${label}`} onClick={()=>addSet(id)}>+ Add Set</button>}
   </article>;
  })}
 </div>;
}
