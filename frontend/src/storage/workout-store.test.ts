import {describe,it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {WorkoutSession} from '../domain/workout';
import {WorkoutStore,type LocalWorkout} from './workout-store';

function record(id='workout-1'):LocalWorkout {
 const session=new WorkoutSession({clock:()=>100,idFactory:()=>`${id}-set`});
 session.addManualSet('bench-press',8,40);
 return {id,revision:0,snapshot:session.exportSnapshot(),preferences:{profile:'auto',restSeconds:{},manualExercise:'squat',manualReps:'10',manualLoad:''}};
}
describe('durable guest workout storage',()=>{
 it('persists a selected camera view across reopen while accepting legacy records without it',async()=>{
  const factory=new IDBFactory(),a=new WorkoutStore(factory,'test');
  const selected=record('selected');selected.preferences.cameraView='rear-right';
  const saved=await a.save(selected,0);await a.save(record('legacy'),0);await a.close();
  const b=new WorkoutStore(factory,'test'),rows=await b.list();
  expect(rows.find(r=>r.id==='selected')).toEqual(saved);
  expect(rows.find(r=>r.id==='legacy')!.preferences.cameraView).toBeUndefined();await b.close();
 });
 it.each(['front','rear-left',undefined] as const)('rejects camera view changes within an existing session: %s',async(next)=>{
  const store=new WorkoutStore(new IDBFactory(),'test'),selected=record();selected.preferences.cameraView='side-left';
  const saved=await store.save(selected,0),changed=structuredClone(saved);changed.preferences.cameraView=next;
  await expect(store.save(changed,1)).rejects.toThrow(/camera.*fixed/i);
  expect(await store.list()).toEqual([saved]);await store.close();
 });
 it('rejects unknown camera views and prevents changing a recovered legacy session',async()=>{
  const store=new WorkoutStore(new IDBFactory(),'test'),bad:any=record();bad.preferences.cameraView='arbitrary';
  await expect(store.save(bad,0)).rejects.toThrow(/record/i);
  const saved=await store.save(record(),0);saved.preferences.cameraView='front';
  await expect(store.save(saved,1)).rejects.toThrow(/camera.*fixed/i);await store.close();
 });
 it('retains verified records after closing and reopening the database',async()=>{
  const factory=new IDBFactory(),a=new WorkoutStore(factory,'test');const saved=await a.save(record(),0);await a.close();
  const b=new WorkoutStore(factory,'test');expect(await b.list()).toEqual([saved]);
  expect(saved.revision).toBe(1);expect(saved.snapshot.sets[0]).toMatchObject({reps:8,loadKg:40});await b.close();
 });
 it('serializes two competing writers and rejects the stale revision atomically',async()=>{
  const factory=new IDBFactory(),a=new WorkoutStore(factory,'test'),b=new WorkoutStore(factory,'test');
  const first=await a.save(record(),0),newer=structuredClone(first);newer.snapshot.sets[0].reps=10;
  const outcomes=await Promise.allSettled([a.save(newer,1),b.save(first,1)]);
  expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect(outcomes.filter(x=>x.status==='rejected')).toHaveLength(1);
  expect(await b.list()).toHaveLength(1);expect((await b.list())[0].revision).toBe(2);
  await a.close();await b.close();
 });
 it('updates a finished history and deletes only the chosen workout with revision protection',async()=>{
  const store=new WorkoutStore(new IDBFactory(),'test');
  const a=record('a'),b=record('b');a.snapshot.finishedAt=100;
  await store.save(a,0);await store.save(b,0);
  await expect(store.remove('a',0)).rejects.toThrow(/conflict/i);
  await store.remove('a',1);expect((await store.list()).map(x=>x.id)).toEqual(['b']);await store.close();
 });
 it('surfaces storage unavailability and corrupt data without claiming a save',async()=>{
  await expect(new WorkoutStore(undefined).save(record(),0)).rejects.toThrow(/storage/i);
  const store=new WorkoutStore(new IDBFactory(),'test'),bad:any=record();bad.snapshot.sets[0].reps=-8;
  await expect(store.save(bad,0)).rejects.toThrow(/snapshot/i);expect(await store.list()).toEqual([]);await store.close();
 });
 it('rejects persisted media and invalid preferences rather than storing them',async()=>{
  const store=new WorkoutStore(new IDBFactory(),'test'),bad:any=record();bad.preferences.video='blob:private';
  await expect(store.save(bad,0)).rejects.toThrow(/record/i);
  delete bad.preferences.video;bad.preferences.restSeconds.squat=-1;
  await expect(store.save(bad,0)).rejects.toThrow(/record/i);await store.close();
 });
});
