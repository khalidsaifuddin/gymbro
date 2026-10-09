import {it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {WorkoutSession} from '../domain/workout';
import {SyncStore} from './sync-store';
import {fromDTO} from './mapper';
import type {LocalWorkout} from '../storage/workout-store';
const owner='00000000-0000-4000-8000-000000000011';
function record():LocalWorkout{const s=new WorkoutSession({clock:()=>10000,idFactory:()=>crypto.randomUUID()});s.addManualSet('bench-press',10,40);s.finish();return {id:crypto.randomUUID(),revision:0,snapshot:s.exportSnapshot(),preferences:{profile:'auto',restSeconds:{},manualExercise:'squat',manualReps:'10',manualLoad:''}};}
it('requires opt-in for guest import and keeps account caches isolated',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),local=await store.save(record(),0);
 await store.enqueue(local,owner);expect(await store.jobs(owner)).toEqual([]);
 await store.enqueue(local,owner,true);expect(await store.jobs(owner)).toHaveLength(1);
 expect(await store.visible(null)).toEqual([]);expect(await store.visible(owner)).toHaveLength(1);
 await expect(store.enqueue(local,'00000000-0000-4000-8000-000000000012',true)).rejects.toThrow(/owner/i);
 await store.close();
});
it('adds stable cable occurrence IDs to old bindings without changing an in-flight envelope',async()=>{
 class LegacyStore extends SyncStore{
  async stripNewOccurrences(){const db=await this.open();await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('bindings','readwrite'),store=tx.objectStore('bindings'),all=store.getAll();
   all.onsuccess=()=>{for(const b of all.result){for(const slug of ['lat-pulldown','seated-cable-row','face-pull','straight-arm-pulldown'])delete b.occurrences[slug];store.put(b);}};
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);
  });}
 }
 const store=new LegacyStore(new IDBFactory(),'test');let now=10000;
 const session=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()});session.addManualSet('bench-press',8,40);
 let local=await store.save({...record(),snapshot:session.exportSnapshot()},0);await store.enqueue(local,owner,true);await store.stripNewOccurrences();
 const sent=(await store.claim(owner))!;now+=1000;session.addManualSet('lat-pulldown',10,40);session.finish();
 local=await store.save({...local,snapshot:session.exportSnapshot()},local.revision);await store.enqueue(local,owner);
 expect(await store.claim(owner)).toEqual(sent);
 await store.acknowledge(sent,{mutation_id:sent.mutationId,workout_id:local.id,revision:1,deleted:false});
 const next=(await store.claim(owner))!,occurrence=next.envelope.workout!.exercises.find(e=>e.exercise_id.endsWith('000006'))!.id;
 expect(occurrence).toMatch(/^[0-9a-f-]{36}$/);expect((await store.bindings())[0].occurrences['lat-pulldown']).toBe(occurrence);
 expect(await store.claim(owner)).toEqual(next);await store.close();
});
it('rejects unknown server exercises atomically instead of overwriting local history',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),local=await store.save(record(),0);await store.enqueue(local,owner,true);const job=(await store.claim(owner))!;
 await store.acknowledge(job,{mutation_id:job.mutationId,workout_id:local.id,revision:1,deleted:false});
 const remote=structuredClone(job.envelope.workout!);remote.revision=2;remote.exercises[0].exercise_id='00000000-0000-4000-8000-999999999999';
 await expect(store.receive(owner,[remote])).rejects.toThrow(/unsupported/i);expect(await store.list()).toEqual([local]);expect((await store.bindings())[0].serverRevision).toBe(1);await store.close();
});
it('keeps local camera configuration out of API payloads and preserves it across history and conflict replacement',async()=>{
 const store=new SyncStore(new IDBFactory(),'test');const value={...record(),preferences:{...record().preferences,cameraView:'rear-left' as const,cameraViews:{squat:'side-left' as const,'dumbbell-curl':'front-right' as const}}};
 const local=await store.save(value,0);await store.enqueue(local,owner,true);const job=(await store.claim(owner))!;
 expect(JSON.stringify(job.envelope)).not.toContain('cameraView');
 const remote={...job.envelope.workout!,revision:1};await store.acknowledge(job,{mutation_id:job.mutationId,workout_id:local.id,revision:1,deleted:false});
 await store.receive(owner,[{...remote,revision:2}]);let latest=(await store.list())[0];expect(latest.preferences.cameraView).toBe('rear-left');expect(latest.preferences.cameraViews).toEqual(value.preferences.cameraViews);
 await store.enqueue(latest,owner);const next=(await store.claim(owner))!;await store.markConflict(next,{...remote,revision:3});
 await store.resolve(owner,local.id,'server');latest=(await store.list())[0];expect(latest.preferences.cameraView).toBe('rear-left');expect(latest.preferences.cameraViews).toEqual(value.preferences.cameraViews);await store.close();
});
it('keeps session row IDs browser-local, reconciles server edits, and drops unchecked sources on server conflict',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),base=record(),set=base.snapshot.sets[0];
 base.preferences.exercisePlan=[{exercise:'bench-press',targets:[{reps:10,loadKg:40}]}];
 base.preferences.sessionRows={'bench-press':[{id:'stable-row',target:{reps:10,loadKg:40},resultSetId:set.id}]};
 const local=await store.save(base,0);await store.enqueue(local,owner,true);const job=(await store.claim(owner))!;
 expect(JSON.stringify(job.envelope)).not.toContain('stable-row');
 const first={...job.envelope.workout!,revision:1};await store.acknowledge(job,{mutation_id:job.mutationId,workout_id:local.id,revision:1,deleted:false});
 const edited=structuredClone(first);edited.exercises[0].sets[0].reps=12;edited.revision=2;await store.receive(owner,[edited]);
 let latest=(await store.list())[0];expect(latest.preferences.sessionRows?.['bench-press']?.[0]).toMatchObject({id:'stable-row',resultSetId:set.id,target:{reps:12,loadKg:40}});
 const saved=latest.preferences.sessionRows!['bench-press']![0].savedResult={...set,reps:12};delete latest.preferences.sessionRows!['bench-press']![0].resultSetId;
 latest.snapshot.sets=[];latest.revision=(await store.save(latest,latest.revision)).revision;await store.enqueue(latest,owner);
 const pending=(await store.claim(owner))!,server={...first,revision:3,exercises:[]};await store.markConflict(pending,server);await store.resolve(owner,local.id,'server');
 latest=(await store.list())[0];expect(latest.preferences.sessionRows?.['bench-press']?.[0].id).toBe('stable-row');expect(latest.preferences.sessionRows?.['bench-press']?.[0].savedResult).toBeUndefined();
 expect(latest.preferences.sessionRows?.['bench-press']?.[0].target.reps).toBe(12);expect(saved.reps).toBe(12);await store.close();
});
it('retains the exact in-flight envelope after reload and queues newer local edits only after acknowledgement',async()=>{
 const factory=new IDBFactory();let store=new SyncStore(factory,'test');let local=await store.save(record(),0);await store.enqueue(local,owner,true);
 const sent=(await store.claim(owner))!;expect(sent.status).toBe('sending');await store.close();store=new SyncStore(factory,'test');
 expect(await store.claim(owner)).toEqual(sent);
 local.snapshot.sets[0].reps=12;local=await store.save(local,local.revision);await store.enqueue(local,owner);
 expect(await store.jobs(owner)).toEqual([sent]);await store.acknowledge(sent,{mutation_id:sent.mutationId,workout_id:local.id,revision:1,deleted:false,workout:{...sent.envelope.workout!,revision:1}});
 const next=(await store.jobs(owner))[0];expect(next.mutationId).not.toBe(sent.mutationId);expect(next.envelope.base_revision).toBe(1);expect(next.envelope.workout!.exercises[0].sets[0].reps).toBe(12);await store.close();
});
it('requires an explicit conflict choice and uses a new mutation ID with the server revision',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),local=await store.save(record(),0);await store.enqueue(local,owner,true);const sent=(await store.claim(owner))!;
 const remote={...sent.envelope.workout!,revision:4};remote.exercises=structuredClone(remote.exercises);remote.exercises[0].sets[0].reps=20;
 await store.markConflict(sent,remote);expect(await store.claim(owner)).toBeNull();expect((await store.list())[0].snapshot.sets[0].reps).toBe(10);
 await store.resolve(owner,local.id,'local');const resolved=(await store.claim(owner))!;expect(resolved.envelope.base_revision).toBe(4);expect(resolved.mutationId).not.toBe(sent.mutationId);expect(resolved.envelope.workout!.exercises[0].sets[0].reps).toBe(10);
 await store.markConflict(resolved,remote);await store.resolve(owner,local.id,'server');expect((await store.list())[0].snapshot).toEqual(fromDTO(remote,owner).record.snapshot);expect(await store.jobs(owner)).toEqual([]);await store.close();
});
it('keeps delete durable and tombstones stale records; account cleanup preserves guest workouts',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),local=await store.save(record(),0),guest=await store.save(record(),0);await store.enqueue(local,owner,true);let job=(await store.claim(owner))!;await store.acknowledge(job,{mutation_id:job.mutationId,workout_id:local.id,revision:1,deleted:false});
 await store.deleteWorkout(local,owner);job=(await store.claim(owner))!;expect(job.envelope.operation).toBe('delete');await store.acknowledge(job,{mutation_id:job.mutationId,workout_id:local.id,revision:2,deleted:true});
 await expect(store.enqueue(local,owner,true)).rejects.toThrow(/deleted/i);await store.removeAccount(owner);expect((await store.list()).map(x=>x.id)).toEqual([guest.id]);await store.close();
});
it('pulls remote history without overwriting pending edits and reconciles server deletions',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),local=await store.save(record(),0);await store.enqueue(local,owner,true);const job=(await store.claim(owner))!;const remote={...job.envelope.workout!,revision:1};await store.acknowledge(job,{mutation_id:job.mutationId,workout_id:local.id,revision:1,deleted:false});
 await store.receive(owner,[remote]);expect(await store.visible(owner)).toHaveLength(1);await store.receive(owner,[]);expect(await store.visible(owner)).toEqual([]);await store.close();
});
it('does not mistake a stale history response for deletion of a mutation acknowledged after the history request began',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),local=await store.save(record(),0);await store.enqueue(local,owner,true);const job=(await store.claim(owner))!;
 const baseline=Object.fromEntries((await store.bindings()).map(b=>[b.workoutId,b.serverRevision]));
 await store.acknowledge(job,{mutation_id:job.mutationId,workout_id:local.id,revision:1,deleted:false});await store.receive(owner,[],baseline);
 expect(await store.visible(owner)).toHaveLength(1);await store.close();
});
