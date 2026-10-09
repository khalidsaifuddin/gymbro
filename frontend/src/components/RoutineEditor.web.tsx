import type {ExerciseId} from '../domain/exercises';
import type {Routine} from '../storage/routine-store';
import ExercisePlanCards from './ExercisePlanCards.web';

export default function RoutineEditor({draft,onChange,onAdd,onSave,onCancel,onError,onDetails,error,busy}:{
 draft:Routine;onChange:(routine:Routine)=>void;onAdd:()=>void;onSave:()=>void;onCancel:()=>void;onError:(message:string)=>void;onDetails:(exercise:ExerciseId)=>void;error:string;busy:boolean;
}){
 return <section className="saka-stack gymbro-page" aria-label="Routine editor">
  <div className="saka-split"><button className="saka-btn saka-btn--sm" onClick={onCancel}>Cancel</button><span className="saka-kicker">Routine builder</span></div>
  <div><div className="saka-kicker">Your training plan</div><h1 className="gymbro-title">{draft.revision?'Edit Routine':'New Routine'}</h1>
   <p className="saka-prose">Set your exercise order and targets. Starting the routine creates a separate workout session.</p></div>
  <label className="saka-field"><span className="saka-label">Routine name</span><input className="saka-input" aria-label="Routine name" maxLength={80} value={draft.name} onChange={event=>onChange({...draft,name:event.target.value})} placeholder="For example, Pull Day"/></label>
  {draft.exercises.length?<ExercisePlanCards plan={draft.exercises} mode="routine" onChange={exercises=>onChange({...draft,exercises})} onError={onError} onDetails={onDetails}/>
   :<div className="saka-card gymbro-empty"><strong>No exercises yet</strong><p className="saka-prose">Add the first exercise to build this routine.</p></div>}
  <div className="saka-cluster"><button className="saka-btn" onClick={onAdd}>+ Add Exercise</button><button className="saka-btn is-filled" onClick={onSave} disabled={busy}>Save Routine</button></div>
  {error&&<div className="saka-alert is-danger" role="alert">{error}</div>}
 </section>;
}
