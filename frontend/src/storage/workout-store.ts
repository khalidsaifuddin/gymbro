import type {ExerciseId,SessionSnapshot} from '../domain/workout';
import {validateSnapshot} from '../domain/workout-snapshot';

export type WorkoutPreferences={
 profile:'auto'|ExerciseId;restSeconds:Partial<Record<ExerciseId,number>>;
 manualExercise:ExerciseId;manualReps:string;manualLoad:string;
};
export type LocalWorkout={id:string;revision:number;snapshot:SessionSnapshot;preferences:WorkoutPreferences};
const exercises=['squat','push-up','dumbbell-curl','machine-shoulder-press','bench-press'];
function validateRecord(value:LocalWorkout):LocalWorkout {
 const fail=():never=>{throw new Error('Invalid local workout record');};
 if(!value||typeof value.id!=='string'||!value.id||!Number.isSafeInteger(value.revision)||value.revision<0||
   Object.keys(value).some(k=>!['id','revision','snapshot','preferences'].includes(k)))return fail();
 const p=value.preferences;
 if(!p||Object.keys(p).some(k=>!['profile','restSeconds','manualExercise','manualReps','manualLoad'].includes(k))||
   !['auto',...exercises].includes(p.profile)||!exercises.includes(p.manualExercise)||
   typeof p.manualReps!=='string'||typeof p.manualLoad!=='string'||!p.restSeconds||
   Object.entries(p.restSeconds).some(([k,v])=>!exercises.includes(k)||!Number.isSafeInteger(v)||v!<0||v!>3600))return fail();
 return {...structuredClone(value),snapshot:validateSnapshot(value.snapshot)};
}
export class WorkoutStore {
 private database:Promise<IDBDatabase>|null=null;
 constructor(private factory:IDBFactory|undefined,private name='gymbro-local-v1'){}
 private open():Promise<IDBDatabase> {
  if(!this.factory)return Promise.reject(new Error('Browser storage unavailable'));
  return this.database??=new Promise((resolve,reject)=>{
   const request=this.factory!.open(this.name,1);
   request.onupgradeneeded=()=>{
    request.result.createObjectStore('workouts',{keyPath:'id'});
    // Account mutations are added by the authenticated sync adapter in stage 5.
    request.result.createObjectStore('outbox',{keyPath:'mutationId'});
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
  return this.mutate(db,record.id,expectedRevision,store=>store.put({...record,revision:expectedRevision+1}))
   .then(()=>({...record,revision:expectedRevision+1}));
 }
 async remove(id:string,expectedRevision:number):Promise<void> {
  const db=await this.open();await this.mutate(db,id,expectedRevision,store=>store.delete(id));
 }
 private mutate(db:IDBDatabase,id:string,revision:number,write:(store:IDBObjectStore)=>void):Promise<void> {
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('workouts','readwrite'),store=tx.objectStore('workouts'),request=store.get(id);
   let failure:Error|null=null;
   request.onsuccess=()=>{
    if((request.result?.revision??0)!==revision){failure=new Error('Local revision conflict; reload the stored version before editing');tx.abort();return;}
    write(store);
   };
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??new Error('Browser storage write failed'));
  });
 }
 async close():Promise<void>{if(this.database)(await this.database).close();this.database=null;}
}
