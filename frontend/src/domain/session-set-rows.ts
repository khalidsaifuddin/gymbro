import {isExerciseId,type ExerciseId} from './exercises';
import {validateSnapshot} from './workout-snapshot';
import type {PlannedExercise,SetTarget} from './session-plan';
import type {WorkoutSet} from './workout';

export type SessionSetRow={id:string;target:SetTarget;resultSetId?:string;savedResult?:WorkoutSet};
export type SessionSetRows=Partial<Record<ExerciseId,SessionSetRow[]>>;
const validTarget=(value:unknown):value is SetTarget=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).every(key=>key==='reps'||key==='loadKg')&&Object.hasOwn(value,'reps')&&Object.hasOwn(value,'loadKg')&&
 ((value as SetTarget).reps===null||Number.isSafeInteger((value as SetTarget).reps)&&Number((value as SetTarget).reps)>=0&&Number((value as SetTarget).reps)<=2147483647)&&
 ((value as SetTarget).loadKg===null||typeof (value as SetTarget).loadKg==='number'&&Number.isFinite((value as SetTarget).loadKg)&&Number((value as SetTarget).loadKg)>=0&&Number((value as SetTarget).loadKg)<=99999.999);

export function validateSessionSetRows(value:unknown,sets:WorkoutSet[]):SessionSetRows{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!isExerciseId(key)))throw new Error('Invalid session set rows');
 const object=value as Record<string,unknown>,knownSets=new Map(sets.map(set=>[set.id,set])),rowIds=new Set<string>(),resultIds=new Set<string>();
 const result:SessionSetRows={};
 for(const [exercise,rawRows] of Object.entries(object)){
  if(!Array.isArray(rawRows)||rawRows.length>40)throw new Error('Invalid session set rows');
  const rows:SessionSetRow[]=[];
  for(const raw of rawRows){
   if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['id','target','resultSetId','savedResult'].includes(key)))throw new Error('Invalid session set row');
   const row=raw as SessionSetRow;
   if(typeof row.id!=='string'||!row.id.trim()||row.id.length>128||rowIds.has(row.id)||!validTarget(row.target))throw new Error('Invalid session set row');
   rowIds.add(row.id);
   if(row.resultSetId!==undefined){const set=knownSets.get(row.resultSetId);if(typeof row.resultSetId!=='string'||!set||set.exercise!==exercise||resultIds.has(row.resultSetId)||row.savedResult!==undefined)throw new Error('Invalid session set result reference');resultIds.add(row.resultSetId);}
   if(row.savedResult!==undefined){
    if(!row.savedResult||row.savedResult.exercise!==exercise||row.savedResult.endedAt===null)throw new Error('Invalid saved session set');
    validateSnapshot({version:1,startedAt:row.savedResult.startedAt,finishedAt:null,savedAt:Math.max(row.savedResult.endedAt,row.savedResult.lastRepAt),currentSetId:null,sets:[row.savedResult],pauses:[]});
   }
   rows.push(structuredClone(row));
  }
  result[exercise as ExerciseId]=rows;
 }
 return result;
}

export function reconcileSessionSetRows(existing:unknown,plan:PlannedExercise[],sets:WorkoutSet[],idFactory:()=>string):SessionSetRows{
 const draft=existing===undefined?{}:structuredClone(existing) as Record<string,SessionSetRow[]>;
 if(existing!==undefined&&draft&&typeof draft==='object')for(const rows of Object.values(draft))if(Array.isArray(rows))for(const row of rows)if(row?.resultSetId&&!sets.some(set=>set.id===row.resultSetId))delete row.resultSetId;
 const known:SessionSetRows=existing===undefined?{}:validateSessionSetRows(draft,sets);
 const exerciseList=[...new Set<ExerciseId>([...(Object.keys(known) as ExerciseId[]),...plan.map(row=>row.exercise),...sets.map(set=>set.exercise)])];
 const rowsByExercise:SessionSetRows={};
 for(const exercise of exerciseList){
  const rows=(known[exercise]??[]).map(row=>structuredClone(row)),targets=plan.find(row=>row.exercise===exercise)?.targets??[],actual=sets.filter(set=>set.exercise===exercise);
  for(const row of rows)if(row.resultSetId&&!actual.some(set=>set.id===row.resultSetId))delete row.resultSetId;
  for(const set of actual){
   let row=rows.find(item=>item.resultSetId===set.id);
   if(!row){row=rows.find(item=>item.resultSetId===undefined&&item.savedResult===undefined);if(!row){row={id:idFactory(),target:{reps:null,loadKg:null}};rows.push(row);}row.resultSetId=set.id;delete row.savedResult;}
   row.target={reps:set.reps,loadKg:set.loadKg};
  }
  const count=Math.max(rows.length,targets.length);
  for(let index=rows.length;index<count;index++)rows.push({id:idFactory(),target:structuredClone(targets[index]??{reps:null,loadKg:null})});
  rowsByExercise[exercise]=rows;
 }
 return rowsByExercise;
}

export function withoutSessionSetRow(rows:SessionSetRows,exercise:ExerciseId,rowId:string):SessionSetRows{
 return {...structuredClone(rows),[exercise]:(rows[exercise]??[]).filter(row=>row.id!==rowId)};
}
