import {isExerciseId,type ExerciseId} from './exercises';

export type SetTarget={reps:number|null;loadKg:number|null};
export type PlannedExercise={exercise:ExerciseId;targets:SetTarget[]};

export function emptyTargets():SetTarget[]{return Array.from({length:3},()=>({reps:null,loadKg:null}));}

export function validatePlan(value:unknown):PlannedExercise[]{
 if(!Array.isArray(value)||value.length>30)throw new Error('Invalid exercise plan');
 const seen=new Set<ExerciseId>();
 return value.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||
   Object.keys(item).some(key=>!['exercise','targets'].includes(key))||!isExerciseId(item.exercise))throw new Error('Invalid exercise in plan');
  const exercise=item.exercise as ExerciseId;
  if(seen.has(exercise))throw new Error('Duplicate exercise in plan');
  seen.add(exercise);
  if(!Array.isArray(item.targets)||item.targets.length>20)throw new Error('Invalid targets in plan');
  const targets=item.targets.map((target:unknown)=>{
   if(!target||typeof target!=='object'||Array.isArray(target)||
    Object.keys(target).some(key=>!['reps','loadKg'].includes(key)))throw new Error('Invalid target in plan');
   const {reps,loadKg}=target as Record<string,unknown>;
   if(reps!==null&&(!Number.isSafeInteger(reps)||Number(reps)<1||Number(reps)>2147483647))throw new Error('Invalid target reps');
   if(loadKg!==null&&(typeof loadKg!=='number'||!Number.isFinite(loadKg)||loadKg<0||loadKg>99999.999))throw new Error('Invalid target load');
   return {reps:reps as number|null,loadKg:loadKg as number|null};
  });
  return {exercise,targets};
 });
}
export function copyPlan(value:unknown):PlannedExercise[]{return structuredClone(validatePlan(value));}
