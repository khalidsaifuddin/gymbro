import {WorkoutSession,type ExerciseId,type WorkoutSet} from '../domain/workout';
import {validateSnapshot} from '../domain/workout-snapshot';
import type {LocalWorkout} from '../storage/workout-store';
export const catalogIds:Record<ExerciseId,string>={'squat':'00000000-0000-4000-8000-000000000001','push-up':'00000000-0000-4000-8000-000000000002','dumbbell-curl':'00000000-0000-4000-8000-000000000003','machine-shoulder-press':'00000000-0000-4000-8000-000000000004','bench-press':'00000000-0000-4000-8000-000000000005'};
export type Binding={workoutId:string;ownerId:string;serverRevision:number;occurrences:Record<ExerciseId,string>;deleted?:boolean;deleteRequested?:boolean};
export type SourceDTO={id:string;reps:number;detected_reps:number;load_kg:string|null;implement_count:number;source_ids:string[];merged_from:SourceDTO[];load_edited:boolean;label_source:string;raw_exercise_id?:string|null;source_exercise_id?:string;source_origin?:WorkoutSet['origin'];source_started_at?:string;source_ended_at?:string|null;source_last_rep_at?:string};
export type SetDTO=SourceDTO&{position:number;rep_source:WorkoutSet['origin'];detected_exercise_id:string|null;recognition_status:string;started_at:string;ended_at:string|null;last_rep_at:string;rest_duration_ms:number};
export type WorkoutDTO={id:string;revision:number;started_at:string;captured_at:string;finished_at:string|null;pause_intervals:{start:string;end:string|null}[];duration_ms:number;paused_duration_ms:number;rest_duration_ms:number;status:'active'|'paused'|'completed';exercises:{id:string;exercise_id:string;position:number;notes:string;rest_target_seconds:number;sets:SetDTO[]}[]};
export type Mutation={account_id:string;mutation_id:string;workout_id:string;base_revision:number;operation:'upsert'|'delete';occurred_at:string;workout?:WorkoutDTO};
export type Outcome={mutation_id:string;workout_id:string;revision:number;deleted:boolean;workout?:WorkoutDTO};
export function newBinding(workoutId:string,ownerId:string):Binding{return {workoutId,ownerId,serverRevision:0,occurrences:Object.fromEntries(Object.keys(catalogIds).map(x=>[x,crypto.randomUUID()])) as Record<ExerciseId,string>};}
const iso=(t:number)=>new Date(t).toISOString();
const millis=(t:string)=>{const n=Date.parse(t);if(!Number.isFinite(n))throw new Error('Invalid server timestamp');return n;};
function slug(id:string):ExerciseId{const found=Object.entries(catalogIds).find(x=>x[1]===id)?.[0];if(!found)throw new Error('Unsupported server exercise');return found as ExerciseId;}
function source(s:WorkoutSet):SourceDTO{return {id:s.id,reps:s.reps,detected_reps:s.detectedReps,load_kg:s.loadKg===null?null:s.loadKg.toFixed(3),implement_count:s.implementCount,source_ids:s.sourceIds,merged_from:s.mergedFrom?.map(source)??[],load_edited:s.loadEdited??false,label_source:s.labelSource??'unknown',raw_exercise_id:s.rawExercise?catalogIds[s.rawExercise]:null,source_exercise_id:catalogIds[s.exercise],source_origin:s.origin,source_started_at:iso(s.startedAt),source_ended_at:s.endedAt===null?null:iso(s.endedAt),source_last_rep_at:iso(s.lastRepAt)};}
export function toDTO(local:LocalWorkout,binding:Binding):WorkoutDTO{
 const snapshot=validateSnapshot(local.snapshot),summary=WorkoutSession.restore(snapshot,{clock:()=>snapshot.savedAt,idFactory:()=>{throw new Error('Unexpected ID');}}).summary();
 const exercises:WorkoutDTO['exercises']=[];
 snapshot.sets.forEach((s,position)=>{let e=exercises.find(x=>x.exercise_id===catalogIds[s.exercise]);if(!e){e={id:binding.occurrences[s.exercise],exercise_id:catalogIds[s.exercise],position:exercises.length,notes:'',rest_target_seconds:local.preferences.restSeconds[s.exercise]??120,sets:[]};exercises.push(e);}
 const raw=s.labelSource==='automatic'&&s.rawExercise?catalogIds[s.rawExercise]:null;
 e.sets.push({...source(s),position,rep_source:s.origin,detected_exercise_id:raw,recognition_status:raw?'known':s.labelSource==='manual'?'manual':'unknown',started_at:iso(s.startedAt),ended_at:s.endedAt===null?null:iso(s.endedAt),last_rep_at:iso(s.lastRepAt),rest_duration_ms:0});});
 return {id:local.id,revision:binding.serverRevision,started_at:iso(snapshot.startedAt),captured_at:iso(snapshot.savedAt),finished_at:snapshot.finishedAt===null?null:iso(snapshot.finishedAt),pause_intervals:snapshot.pauses.map(p=>({start:iso(p.start),end:p.end===null?null:iso(p.end)})),duration_ms:summary.durationMs,paused_duration_ms:summary.pausedDurationMs,rest_duration_ms:summary.restDurationMs,status:snapshot.finishedAt!==null?'completed':snapshot.pauses.at(-1)?.end===null?'paused':'active',exercises};
}
function fromSource(s:SourceDTO,exercise:ExerciseId,origin:WorkoutSet['origin'],start:string,end:string|null,last:string):WorkoutSet{
 const label=s.label_source;return {id:s.id,exercise,reps:s.reps,detectedReps:s.detected_reps,loadKg:s.load_kg===null?null:Number(s.load_kg),implementCount:s.implement_count,sourceIds:s.source_ids,loadEdited:s.load_edited,origin,startedAt:millis(start),endedAt:end===null?null:millis(end),lastRepAt:millis(last),...(label==='unknown'?{}:{labelSource:label as WorkoutSet['labelSource']}),rawExercise:s.raw_exercise_id?slug(s.raw_exercise_id):null,...(s.merged_from.length?{mergedFrom:s.merged_from.map(x=>{if(!x.source_exercise_id||!x.source_origin||!x.source_started_at||x.source_ended_at===undefined||!x.source_last_rep_at)throw new Error('Incomplete server merge provenance');return fromSource(x,slug(x.source_exercise_id),x.source_origin,x.source_started_at,x.source_ended_at,x.source_last_rep_at);})}:{})};
}
export function fromDTO(w:WorkoutDTO,ownerId:string):{record:LocalWorkout;binding:Binding}{
 const ordered=w.exercises.flatMap(e=>e.sets.map(s=>({e,s}))).sort((a,b)=>a.s.position-b.s.position);
 const sets=ordered.map(({e,s})=>fromSource({...s,raw_exercise_id:s.detected_exercise_id},slug(e.exercise_id),s.rep_source,s.started_at,s.ended_at,s.last_rep_at));
 const snapshot=validateSnapshot({version:1,startedAt:millis(w.started_at),savedAt:millis(w.captured_at),finishedAt:w.finished_at===null?null:millis(w.finished_at),pauses:w.pause_intervals.map(p=>({start:millis(p.start),end:p.end===null?null:millis(p.end)})),sets,currentSetId:sets.find(s=>s.endedAt===null)?.id??null});
 const binding=newBinding(w.id,ownerId);binding.serverRevision=w.revision;w.exercises.forEach(e=>binding.occurrences[slug(e.exercise_id)]=e.id);
 return {record:{id:w.id,revision:0,snapshot,preferences:{profile:'auto',restSeconds:Object.fromEntries(w.exercises.map(e=>[slug(e.exercise_id),e.rest_target_seconds])),manualExercise:'squat',manualReps:'10',manualLoad:''}},binding};
}
