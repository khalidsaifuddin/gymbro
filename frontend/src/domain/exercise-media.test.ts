import {describe,expect,it} from 'vitest';
import {exerciseMedia,resolveExerciseAnimation} from './exercise-media';

describe('Flow exercise media inventory',()=>{
 it('contains exact records for every imported exercise and skips the 67 without artwork',()=>{
  expect(Object.keys(exerciseMedia)).toHaveLength(1324);
  expect(Object.values(exerciseMedia).filter(item=>item.animation!==null)).toHaveLength(1257);
  expect(Object.values(exerciseMedia).filter(item=>item.animation===null)).toHaveLength(67);
 });
 it('resolves frames only by exact Gymbro dataset ID',()=>{
  const pushUp=resolveExerciseAnimation('dataset:0662');
  expect(pushUp?.sequence).toEqual([0,1,2,1]);
  expect(pushUp?.frames).toHaveLength(3);
  expect(resolveExerciseAnimation('dataset:missing')).toBeNull();
 });
 it('uses verified exact variants for supported IDs and does not substitute an approximate squat',()=>{
  expect(resolveExerciseAnimation('push-up')).toBe(resolveExerciseAnimation('dataset:0662'));
  expect(resolveExerciseAnimation('dumbbell-curl')).toBe(resolveExerciseAnimation('dataset:0294'));
  expect(resolveExerciseAnimation('squat')).toBeNull();
 });
});
