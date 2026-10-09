import {WorkoutStore,type LocalWorkout} from '../storage/workout-store';
import {fromDTO,newBinding,toDTO,type Binding,type Mutation,type Outcome,type WorkoutDTO} from './mapper';
export type Job={mutationId:string;ownerId:string;localRevision:number;envelope:Mutation;status:'pending'|'sending'|'conflict';server?:WorkoutDTO|null};
type State={workouts:LocalWorkout[];bindings:Binding[];outbox:Job[]};
const notice=()=>{if(typeof document!=='undefined')document.dispatchEvent(new Event('gymbro-storage-changed'));};
function upsert(record:LocalWorkout,binding:Binding):Job{
 for(const set of record.snapshot.sets)binding.occurrences[set.exercise]??=crypto.randomUUID();
 const id=crypto.randomUUID();return {mutationId:id,ownerId:binding.ownerId,localRevision:record.revision,status:'pending',envelope:{account_id:binding.ownerId,mutation_id:id,workout_id:record.id,base_revision:binding.serverRevision,operation:'upsert',occurred_at:new Date(record.snapshot.savedAt).toISOString(),workout:toDTO(record,binding)}};
}
function deletion(record:LocalWorkout,binding:Binding):Job{const id=crypto.randomUUID();return {mutationId:id,ownerId:binding.ownerId,localRevision:record.revision,status:'pending',envelope:{account_id:binding.ownerId,mutation_id:id,workout_id:record.id,base_revision:binding.serverRevision,operation:'delete',occurred_at:new Date().toISOString()}};}
export class SyncStore extends WorkoutStore{
 private async transaction<T>(edit:(s:State)=>T,write=true):Promise<T>{
  const db=await this.open();return new Promise((resolve,reject)=>{
   const names=['workouts','bindings','outbox'] as const,tx=db.transaction([...names],write?'readwrite':'readonly');const state={} as State;let remaining=3,result:T,failure:unknown;
   for(const name of names){const req=tx.objectStore(name).getAll();req.onsuccess=()=>{(state[name] as unknown[])=req.result;if(--remaining)return;
    try{const before=structuredClone(state);result=edit(state);if(!write)return;
     for(const n of names){const key=n==='workouts'?'id':n==='bindings'?'workoutId':'mutationId';const old=new Map(before[n].map(r=>[(r as any)[key],JSON.stringify(r)]));const next=new Map(state[n].map(r=>[(r as any)[key],r]));for(const [id]of old)if(!next.has(id))tx.objectStore(n).delete(id);for(const [id,row]of next)if(old.get(id)!==JSON.stringify(row))tx.objectStore(n).put(row);}
    }catch(e){failure=e;tx.abort();}
   };}
   tx.oncomplete=()=>{if(write)notice();resolve(result!);};tx.onabort=()=>reject(failure??tx.error??new Error('Sync storage failed'));
  });
 }
 async enqueue(record:LocalWorkout,owner:string,allowImport=false):Promise<void>{await this.transaction(s=>{
  let binding=s.bindings.find(x=>x.workoutId===record.id);if(binding?.deleted||binding?.deleteRequested)throw new Error('Workout deleted');const local=s.workouts.find(x=>x.id===record.id);if(!local)throw new Error('Local workout missing');
  if(!binding){if(!allowImport)return;binding=newBinding(record.id,owner);s.bindings.push(binding);}
  if(binding.ownerId!==owner)throw new Error('Workout owner differs');if(binding.deleted||binding.deleteRequested)throw new Error('Workout deleted');
  const existing=s.outbox.find(x=>x.envelope.workout_id===record.id);
  if(existing){if(existing.status!=='pending')return;s.outbox=s.outbox.filter(x=>x!==existing);}
  s.outbox.push(upsert(local,binding));
 });}
 async jobs(owner:string):Promise<Job[]>{return this.transaction(s=>s.outbox.filter(x=>x.ownerId===owner),false);}
 async bindings():Promise<Binding[]>{return this.transaction(s=>s.bindings,false);}
 async visible(owner:string|null):Promise<LocalWorkout[]>{const [rows,bindings]=await Promise.all([this.list(),this.bindings()]);return rows.filter(r=>{const b=bindings.find(x=>x.workoutId===r.id);return !b||b.ownerId===owner&&!b.deleted&&!b.deleteRequested;});}
 async claim(owner:string):Promise<Job|null>{return this.transaction(s=>{const job=s.outbox.find(x=>x.ownerId===owner&&x.status!=='conflict');if(!job)return null;job.status='sending';return structuredClone(job);});}
 async acknowledge(job:Job,out:Outcome):Promise<void>{await this.transaction(s=>{
  const stored=s.outbox.find(x=>x.mutationId===job.mutationId&&x.ownerId===job.ownerId);if(!stored)return;
  if(out.mutation_id!==job.mutationId||out.workout_id!==job.envelope.workout_id||out.revision!==job.envelope.base_revision+1||out.deleted!==(job.envelope.operation==='delete'))throw new Error('Invalid sync acknowledgement');
  const binding=s.bindings.find(x=>x.workoutId===out.workout_id&&x.ownerId===job.ownerId);if(!binding)throw new Error('Binding missing');binding.serverRevision=out.revision;s.outbox=s.outbox.filter(x=>x!==stored);
  const local=s.workouts.find(x=>x.id===out.workout_id);
  if(out.deleted){binding.deleted=true;binding.deleteRequested=false;s.workouts=s.workouts.filter(x=>x.id!==out.workout_id);return;}
  if(local&&binding.deleteRequested){s.outbox.push(deletion(local,binding));return;}
  if(local&&local.revision>job.localRevision)s.outbox.push(upsert(local,binding));
 });}
 async markConflict(job:Job,server:WorkoutDTO|null):Promise<void>{await this.transaction(s=>{const j=s.outbox.find(x=>x.mutationId===job.mutationId&&x.ownerId===job.ownerId);if(j){j.status='conflict';j.server=server;}});}
 async resolve(owner:string,id:string,choice:'local'|'server'):Promise<void>{await this.transaction(s=>{
  const job=s.outbox.find(x=>x.ownerId===owner&&x.envelope.workout_id===id&&x.status==='conflict'),binding=s.bindings.find(x=>x.ownerId===owner&&x.workoutId===id);if(!job||!binding)throw new Error('Conflict missing');
  if(!job.server&&choice==='local')throw new Error('Server workout deleted; resurrection is blocked');
  s.outbox=s.outbox.filter(x=>x!==job);const local=s.workouts.find(x=>x.id===id);
  if(!job.server){binding.deleted=true;s.workouts=s.workouts.filter(x=>x.id!==id);return;}
  binding.serverRevision=job.server.revision;
  if(choice==='local'){if(!local)throw new Error('Local workout missing');s.outbox.push(binding.deleteRequested?deletion(local,binding):upsert(local,binding));}
  else{const remote=fromDTO(job.server,owner);if(local?.preferences.cameraView!==undefined)remote.record.preferences.cameraView=local.preferences.cameraView;remote.record.revision=(local?.revision??0)+1;s.workouts=s.workouts.filter(x=>x.id!==id);s.workouts.push(remote.record);Object.assign(binding,remote.binding,{deleteRequested:false});}
 });}
 async deleteWorkout(record:LocalWorkout,owner:string):Promise<void>{await this.transaction(s=>{
  const binding=s.bindings.find(x=>x.workoutId===record.id);if(!binding||binding.ownerId!==owner)throw new Error('Workout owner differs');if(binding.deleted)return;
  const existing=s.outbox.find(x=>x.ownerId===owner&&x.envelope.workout_id===record.id);
  binding.deleteRequested=true;if(existing?.status==='sending')return;
  s.outbox=s.outbox.filter(x=>x!==existing);
  if(existing?.server)binding.serverRevision=existing.server.revision;
  if(binding.serverRevision===0){binding.deleted=true;s.workouts=s.workouts.filter(x=>x.id!==record.id);return;}
  s.outbox.push(deletion(record,binding));
 });}
 async removeAccount(owner:string):Promise<void>{await this.transaction(s=>{const ids=new Set(s.bindings.filter(x=>x.ownerId===owner).map(x=>x.workoutId));s.workouts=s.workouts.filter(x=>!ids.has(x.id));s.bindings=s.bindings.filter(x=>x.ownerId!==owner);s.outbox=s.outbox.filter(x=>x.ownerId!==owner);});}
 async receive(owner:string,workouts:WorkoutDTO[],baseline?:Record<string,number>):Promise<void>{await this.transaction(s=>{
  const ids=new Set(workouts.map(x=>x.id));
  for(const w of workouts){const binding=s.bindings.find(x=>x.workoutId===w.id),local=s.workouts.find(x=>x.id===w.id);if(binding&&(binding.ownerId!==owner||binding.deleted||binding.deleteRequested)||s.outbox.some(j=>j.envelope.workout_id===w.id))continue;if(!binding&&local)throw new Error('Remote ID collides with guest workout');if(binding&&w.revision<=binding.serverRevision)continue;
   const remote=fromDTO(w,owner);if(local?.preferences.cameraView!==undefined)remote.record.preferences.cameraView=local.preferences.cameraView;remote.record.revision=(local?.revision??0)+1;s.workouts=s.workouts.filter(x=>x.id!==w.id);s.workouts.push(remote.record);s.bindings=s.bindings.filter(x=>x.workoutId!==w.id);s.bindings.push(remote.binding);
  }
  for(const b of s.bindings)if(b.ownerId===owner&&b.serverRevision>0&&(!baseline||baseline[b.workoutId]===b.serverRevision)&&!ids.has(b.workoutId)&&!s.outbox.some(j=>j.envelope.workout_id===b.workoutId)){b.deleted=true;s.workouts=s.workouts.filter(x=>x.id!==b.workoutId);}
 });}
}
