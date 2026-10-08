import {it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {WorkoutSession} from '../domain/workout';
import {SyncStore} from './sync-store';
import {fromDTO} from './mapper';
const owner='00000000-0000-4000-8000-000000000011';
function record(){const s=new WorkoutSession({clock:()=>10000,idFactory:()=>crypto.randomUUID()});s.addManualSet('bench-press',10,40);s.finish();return {id:crypto.randomUUID(),revision:0,snapshot:s.exportSnapshot(),preferences:{profile:'auto' as const,restSeconds:{},manualExercise:'squat' as const,manualReps:'10',manualLoad:''}};}
it('requires opt-in for guest import and keeps account caches isolated',async()=>{
 const store=new SyncStore(new IDBFactory(),'test'),local=await store.save(record(),0);
 await store.enqueue(local,owner);expect(await store.jobs(owner)).toEqual([]);
 await store.enqueue(local,owner,true);expect(await store.jobs(owner)).toHaveLength(1);
 expect(await store.visible(null)).toEqual([]);expect(await store.visible(owner)).toHaveLength(1);
 await expect(store.enqueue(local,'00000000-0000-4000-8000-000000000012',true)).rejects.toThrow(/owner/i);
 await store.close();
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
