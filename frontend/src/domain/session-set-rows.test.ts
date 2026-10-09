import {describe,expect,it} from 'vitest';
import {WorkoutSession} from './workout';
import {emptyTargets} from './session-plan';
import {reconcileSessionSetRows,validateSessionSetRows,withoutSessionSetRow} from './session-set-rows';

describe('stable planned set rows',()=>{
 it('keeps A/B/C identities stable across edit, uncheck, restore and deleting the middle row',()=>{
  let id=0;const makeId=()=>`row-${++id}`,session=new WorkoutSession({clock:()=>100,idFactory:()=>`set-${++id}`});
  const plan=[{exercise:'push-up' as const,targets:[{reps:8,loadKg:null},{reps:8,loadKg:null},{reps:8,loadKg:null}]}];
  const a=session.addManualSet('push-up',8),b=session.addManualSet('push-up',8),c=session.addManualSet('push-up',8);
  let rows=reconcileSessionSetRows(undefined,plan,session.getSets(),makeId),exerciseRows=rows['push-up']!;
  expect(exerciseRows.map(row=>row.resultSetId)).toEqual([a,b,c]);
  const identity=[...exerciseRows.map(row=>row.id)];session.correctSet(b,6);
  const removed=session.removeCompletedSet(b);exerciseRows[1].savedResult=removed;delete exerciseRows[1].resultSetId;
  rows=reconcileSessionSetRows(rows,plan,session.getSets(),makeId);exerciseRows=rows['push-up']!;
  expect(exerciseRows.map(row=>row.id)).toEqual(identity);expect(exerciseRows[1].savedResult?.reps).toBe(6);
  session.restoreCompletedSet(exerciseRows[1].savedResult!,{reps:7});exerciseRows[1].resultSetId=b;delete exerciseRows[1].savedResult;
  rows=reconcileSessionSetRows(rows,plan,session.getSets(),makeId);exerciseRows=rows['push-up']!;
  expect(exerciseRows.map(row=>row.id)).toEqual(identity);expect(exerciseRows.map(row=>row.resultSetId)).toEqual([a,b,c]);
  session.removeCompletedSet(b);rows=withoutSessionSetRow(rows,'push-up',identity[1]);
  expect(rows['push-up']?.map(row=>row.id)).toEqual([identity[0],identity[2]]);
 });

 it('migrates legacy plan/results once and fills new targets without shifting existing identities',()=>{
  let id=0;const session=new WorkoutSession({clock:()=>100,idFactory:()=>`set-${++id}`});session.addManualSet('bench-press',5,40);
  const plan=[{exercise:'bench-press' as const,targets:[{reps:5,loadKg:40},{reps:6,loadKg:42}]}];
  const first=reconcileSessionSetRows(undefined,plan,session.getSets(),()=>`row-${++id}`);
  expect(first['bench-press']).toHaveLength(2);expect(first['bench-press']![0].target).toEqual({reps:5,loadKg:40});
  const second=reconcileSessionSetRows(first,[{...plan[0],targets:[...plan[0].targets,emptyTargets()[0]]}],session.getSets(),()=>`row-${++id}`);
  expect(second['bench-press']).toHaveLength(3);expect(second['bench-press']!.slice(0,2).map(row=>row.id)).toEqual(first['bench-press']!.map(row=>row.id));
 });

 it('rejects duplicate row/result IDs, cross-exercise references, and invalid targets',()=>{
  const session=new WorkoutSession({clock:()=>100,idFactory:()=>`set`});session.addManualSet('push-up',8);
  const set=session.getSets()[0],valid={ 'push-up':[{id:'row',target:{reps:8,loadKg:null},resultSetId:set.id}] };
  expect(()=>validateSessionSetRows({'push-up':[...valid['push-up']!,{...valid['push-up']![0]}]},[set])).toThrow(/row/i);
  expect(()=>validateSessionSetRows({'squat':[{...valid['push-up']![0]}]},[set])).toThrow(/result/i);
  expect(()=>validateSessionSetRows({'push-up':[{id:'row',target:{reps:-1,loadKg:null}}]},[set])).toThrow(/row/i);
 });
});
