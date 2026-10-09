import type {ExerciseId,SessionSnapshot} from '../domain/workout';
import {validateSnapshot} from '../domain/workout-snapshot';
import {exerciseIds,isSupportedExerciseId,type SupportedExerciseId} from '../domain/exercises';
import {isCameraView,type CameraView} from '../domain/camera-view';
import {validatePlan,type PlannedExercise} from '../domain/session-plan';

export type WorkoutPreferences={
 profile:'auto'|ExerciseId;restSeconds:Partial<Record<ExerciseId,number>>;
 manualExercise:ExerciseId;manualReps:string;manualLoad:string;
 cameraView?:CameraView;
 cameraViews?:Partial<Record<SupportedExerciseId,CameraView>>;
 exercisePlan?:PlannedExercise[];
};
export type LocalWorkout={id:string;revision:number;snapshot:SessionSnapshot;preferences:WorkoutPreferences};
const exercises:readonly string[]=exerciseIds;
function validateRecord(value:LocalWorkout):LocalWorkout {
 const fail=():never=>{throw new Error('Invalid local workout record');};
 if(!value||typeof value.id!=='string'||!value.id||!Number.isSafeInteger(value.revision)||value.revision<0||
   Object.keys(value).some(k=>!['id','revision','snapshot','preferences'].includes(k)))return fail();
 const p=value.preferences;
 if(!p||Object.keys(p).some(k=>!['profile','restSeconds','manualExercise','manualReps','manualLoad','cameraView','cameraViews','exercisePlan'].includes(k))||
   (p.cameraView!==undefined&&!isCameraView(p.cameraView))||
   (p.cameraViews!==undefined&&(typeof p.cameraViews!=='object'||p.cameraViews===null||Array.isArray(p.cameraViews)||Object.entries(p.cameraViews).some(([id,view])=>!isSupportedExerciseId(id)||!isCameraView(view))))||
   !['auto',...exercises].includes(p.profile)||!exercises.includes(p.manualExercise)||
   typeof p.manualReps!=='string'||typeof p.manualLoad!=='string'||!p.restSeconds||
   Object.entries(p.restSeconds).some(([k,v])=>!exercises.includes(k)||!Number.isSafeInteger(v)||v!<0||v!>3600))return fail();
 if(p.exercisePlan!==undefined)validatePlan(p.exercisePlan);
 return {...structuredClone(value),snapshot:validateSnapshot(value.snapshot)};
}
export class WorkoutStore {
 private database:Promise<IDBDatabase>|null=null;
 constructor(private factory:IDBFactory|undefined,private name='gymbro-local-v1'){}
 protected open():Promise<IDBDatabase> {
  if(!this.factory)return Promise.reject(new Error('Browser storage unavailable'));
  return this.database??=new Promise((resolve,reject)=>{
   const request=this.factory!.open(this.name,2);
   request.onupgradeneeded=()=>{
    if(!request.result.objectStoreNames.contains('workouts'))request.result.createObjectStore('workouts',{keyPath:'id'});
    // Account mutations are added by the authenticated sync adapter in stage 5.
    if(!request.result.objectStoreNames.contains('outbox'))request.result.createObjectStore('outbox',{keyPath:'mutationId'});
    if(!request.result.objectStoreNames.contains('bindings'))request.result.createObjectStore('bindings',{keyPath:'workoutId'});
   };
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.database=null;};resolve(db);};
   request.onerror=()=>{this.database=null;reject(request.error??new Error('Browser storage failed'));};
   request.onblocked=()=>{this.database=null;reject(new Error('Browser storage upgrade blocked; close other tabs'));};
  });
 }
 async list():Promise<LocalWorkout[]> {
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('workouts','readonly'),request=tx.objectStore('workouts').getAll();
   tx.oncomplete=()=>{try{resolve(request.result.map(validateRecord).sort((a,b)=>b.snapshot.startedAt-a.snapshot.startedAt));}catch(e){reject(e);}};
   tx.onabort=()=>reject(tx.error??new Error('Browser storage read failed'));
  });
 }
 async save(value:LocalWorkout,expectedRevision:number):Promise<LocalWorkout> {
  const record=validateRecord(value),db=await this.open();
  return this.mutate(db,record.id,expectedRevision,(store,previous)=>{
   if(previous&&(previous.preferences.cameraView??'auto')!==(record.preferences.cameraView??'auto'))throw new Error('Camera view is fixed for this workout session');
   const active=previous?.snapshot.sets.find(set=>set.endedAt===null);
   if(active&&isSupportedExerciseId(active.exercise)&&
      (previous?.preferences.cameraViews?.[active.exercise]??previous?.preferences.cameraView??'auto')!==
      (record.preferences.cameraViews?.[active.exercise]??record.preferences.cameraView??'auto'))
    throw new Error('Camera view is fixed during an active set');
   store.put({...record,revision:expectedRevision+1});
  })
   .then(()=>({...record,revision:expectedRevision+1}));
 }
 async remove(id:string,expectedRevision:number):Promise<void> {
  const db=await this.open();await this.mutate(db,id,expectedRevision,store=>store.delete(id));
 }
 private mutate(db:IDBDatabase,id:string,revision:number,write:(store:IDBObjectStore,previous:LocalWorkout|undefined)=>void):Promise<void> {
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('workouts','readwrite'),store=tx.objectStore('workouts'),request=store.get(id);
   let failure:Error|null=null;
   request.onsuccess=()=>{
    if((request.result?.revision??0)!==revision){failure=new Error('Local revision conflict; reload the stored version before editing');tx.abort();return;}
    try{write(store,request.result);}catch(error){failure=error instanceof Error?error:new Error('Browser storage write failed');tx.abort();}
   };
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??new Error('Browser storage write failed'));
  });
 }
 async close():Promise<void>{if(this.database)(await this.database).close();this.database=null;}
}
