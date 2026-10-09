import {describe,expect,it} from 'vitest';
import {copyPlan,emptyTargets,validatePlan} from './session-plan';

describe('planned exercises',()=>{
 it('starts with three empty targets that do not create completed sets',()=>{
  expect(emptyTargets()).toEqual([{reps:null,loadKg:null},{reps:null,loadKg:null},{reps:null,loadKg:null}]);
 });
 it('copies routine targets so session edits cannot mutate the source',()=>{
  const source=[{exercise:'dumbbell-curl',targets:[{reps:10,loadKg:12}]}];
  const session=copyPlan(source);
  session[0].targets[0].reps=8;
  expect(source[0].targets[0].reps).toBe(10);
  expect(copyPlan(session)).toEqual([{exercise:'dumbbell-curl',targets:[{reps:8,loadKg:12}]}]);
 });
 it('keeps an exercise card with zero targets after deleting its final set',()=>{
  expect(validatePlan([{exercise:'push-up',targets:[]}])).toEqual([{exercise:'push-up',targets:[]}]);
 });
 it('rejects duplicate exercises and malformed kg/reps without accepting an arbitrary id',()=>{
  expect(()=>validatePlan([{exercise:'squat',targets:[{reps:null,loadKg:null}]},{exercise:'squat',targets:[{reps:10,loadKg:null}]}])).toThrow(/duplicate/i);
  expect(()=>validatePlan([{exercise:'unknown',targets:[{reps:10,loadKg:null}]}])).toThrow(/exercise/i);
  expect(()=>validatePlan([{exercise:'bench-press',targets:[{reps:1.5,loadKg:40}]}])).toThrow(/reps/i);
  expect(()=>validatePlan([{exercise:'bench-press',targets:[{reps:10,loadKg:-2}]}])).toThrow(/load/i);
 });
});
