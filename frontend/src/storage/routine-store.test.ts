import {describe,expect,it} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {RoutineStore,type Routine} from './routine-store';

const routine=(id='routine-1'):Routine=>({id,revision:0,name:'Pull Day',createdAt:100,updatedAt:100,exercises:[
 {exercise:'lat-pulldown',targets:[{reps:12,loadKg:40},{reps:10,loadKg:45}]},
 {exercise:'seated-cable-row',targets:[{reps:10,loadKg:35}]},
]});

describe('browser-local routines',()=>{
 it('persists a routine and its targets after reopening, then edits and deletes it',async()=>{
  const factory=new IDBFactory(),first=new RoutineStore(factory,'test-routines');
  const saved=await first.save(routine(),0);expect(saved.revision).toBe(1);await first.close();
  const second=new RoutineStore(factory,'test-routines');expect(await second.list()).toEqual([saved]);
  const edited={...saved,name:'Back Day',updatedAt:200,exercises:[...saved.exercises,{exercise:'face-pull' as const,targets:[{reps:15,loadKg:15}]}]};
  const updated=await second.save(edited,1);expect(updated.revision).toBe(2);
  await second.remove(updated.id,2);expect(await second.list()).toEqual([]);await second.close();
 });
 it('rejects stale edits and deletes while keeping the last committed routine',async()=>{
  const factory=new IDBFactory(),a=new RoutineStore(factory,'test-routines'),b=new RoutineStore(factory,'test-routines');
  const saved=await a.save(routine(),0),next=await a.save({...saved,name:'New name',updatedAt:200},1);
  await expect(b.save({...saved,name:'Stale'},1)).rejects.toThrow(/conflict/i);
  await expect(b.remove(saved.id,1)).rejects.toThrow(/conflict/i);
  expect(await b.list()).toEqual([next]);await a.close();await b.close();
 });
 it('rejects empty names, empty exercise lists, duplicate exercises, and invalid targets',async()=>{
  const store=new RoutineStore(new IDBFactory(),'test-routines');
  await expect(store.save({...routine(),name:'  '},0)).rejects.toThrow(/name/i);
  await expect(store.save({...routine(),exercises:[]},0)).rejects.toThrow(/exercise/i);
  await expect(store.save({...routine(),exercises:[routine().exercises[0],routine().exercises[0]]},0)).rejects.toThrow(/duplicate/i);
  await expect(store.save({...routine(),exercises:[{exercise:'bench-press',targets:[{reps:0,loadKg:40}]}]},0)).rejects.toThrow(/reps/i);
  expect(await store.list()).toEqual([]);await store.close();
 });
 it('reports unavailable storage rather than claiming the routine was saved',async()=>{
  await expect(new RoutineStore(undefined).save(routine(),0)).rejects.toThrow(/storage/i);
 });
});
