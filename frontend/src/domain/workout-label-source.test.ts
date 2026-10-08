import {it,expect,describe} from 'vitest';
import {WorkoutSession,type Observation} from './workout';
function setup(){let time=0,id=0;const w=new WorkoutSession({clock:()=>time,idFactory:()=>`set-${++id}`});const cycle=(labelSource:'automatic'|'profile'='automatic')=>{for(const phase of ['ready','peak','ready'] as const){time+=1000;w.observe({exercise:'squat',phase,visible:true,labelSource} as Observation);}};return {w,cycle};}
describe('raw exercise labels separate from user-selected profiles',()=>{
 it('preserves the classifier label independently from corrected final reps',()=>{const {w,cycle}=setup();cycle();w.endSet();w.correctSet(w.getSets()[0].id,3);expect(w.getSets()[0]).toMatchObject({detectedReps:1,reps:3,labelSource:'automatic',rawExercise:'squat'});});
 it('counts a profile-based cycle without calling its selected exercise an automatic label',()=>{const {w,cycle}=setup();cycle('profile');expect(w.getSets()[0]).toMatchObject({reps:1,labelSource:'profile',rawExercise:null});});
 it('marks mixed classification inputs unknown without discarding verified reps',()=>{const {w,cycle}=setup();cycle();cycle('profile');expect(w.getSets()[0]).toMatchObject({reps:2,detectedReps:2,labelSource:'mixed',rawExercise:null});});
 it('retains original label evidence on merged source sets',()=>{const {w,cycle}=setup();cycle();w.endSet();cycle('profile');w.endSet();w.mergeSets(w.getSets().map(s=>s.id));expect(w.getSets()[0]).toMatchObject({labelSource:'mixed',rawExercise:null});expect(w.getSets()[0].mergedFrom?.map(s=>s.rawExercise)).toEqual(['squat',null]);});
 it('marks manual input separately',()=>{const {w}=setup();w.addManualSet('bench-press',8,40);expect(w.getSets()[0]).toMatchObject({labelSource:'manual',rawExercise:null,detectedReps:0});});
});
