import {describe,it,expect} from 'vitest';
import {WorkoutSession,type ExerciseId} from '../domain/workout';
import {PosePhaseAdapter} from './pose-phase-adapter';
import {TemporalExerciseRecognizer} from './temporal-exercise-recognizer';
import {pose,readyAngle,peakAngle} from './fixtures/pose';

const views=['front-left','front-right','rear-left','rear-right','side-left','side-right'] as const;
const unilateral:ExerciseId[]=['squat','push-up','machine-shoulder-press','bench-press'];
function halfPose(exercise:ExerciseId,degrees:number,side:0|1){
 const points=pose(exercise,degrees);
 for(const base of [11,13,15,23,25,27])points[base+1-side].visibility=.1;
 return points;
}
describe('synthetic side-view replay, not real-camera accuracy',()=>{
 for(const view of views)for(const side of [0,1] as const)it.each(unilateral)(`${view}, visible side ${side}: %s completes a cycle`,exercise=>{
  let now=0;const s=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()});
  const a=new PosePhaseAdapter({exercise,cameraView:view,smoothingAlpha:1,stableFrames:1,stableMs:0});
  for(const degrees of [readyAngle(exercise),peakAngle(exercise),readyAngle(exercise)]){
   now+=60;s.observe(a.process({timestampMs:now,landmarks:halfPose(exercise,degrees,side)}).observation);
  }
  expect(s.summary().totalReps).toBe(1);
 });
 it.each(['auto','front','back'] as const)('%s keeps both-side visibility requirements',cameraView=>{
  const a=new PosePhaseAdapter({exercise:'squat',cameraView,stableFrames:1,stableMs:0});
  expect(a.process({timestampMs:0,landmarks:halfPose('squat',170,0)}).observation.visible).toBe(false);
 });
 it.each(views)('%s never turns a one-arm curl into a bilateral rep',cameraView=>{
  const a=new PosePhaseAdapter({exercise:'dumbbell-curl',cameraView,stableFrames:1,stableMs:0});
  expect(a.process({timestampMs:0,landmarks:halfPose('dumbbell-curl',170,0)}).observation.visible).toBe(false);
 });
 it('does not splice a partial cycle across visible-side changes or close the set on interruption',()=>{
  let now=0;const s=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()});
  const a=new PosePhaseAdapter({exercise:'squat',cameraView:'side-left',smoothingAlpha:1,stableFrames:1,stableMs:0});
  const send=(degrees:number,side:0|1)=>{now+=60;const r=a.process({timestampMs:now,landmarks:halfPose('squat',degrees,side)});s.observe(r.observation);return r;};
  send(170,0);send(90,0);send(170,0);expect(s.summary().totalReps).toBe(1);
  send(90,0);expect(send(170,1).observation.visible).toBe(false);expect(s.summary().totalReps).toBe(1);
  for(let i=0;i<18;i++){now+=1000;s.observe(a.process({timestampMs:now,landmarks:[]}).observation);s.tick();}
  expect(s.getSets()[0].endedAt).toBeNull();
  send(170,1);send(90,1);send(170,1);expect(s.summary().totalReps).toBe(2);
 });
 it('keeps the selected side when the other side reappears with a conflicting phase',()=>{
  const a=new PosePhaseAdapter({exercise:'squat',cameraView:'rear-left',smoothingAlpha:1,stableFrames:1,stableMs:0});
  expect(a.process({timestampMs:0,landmarks:halfPose('squat',170,1)}).observation.phase).toBe('ready');
  expect(a.process({timestampMs:60,landmarks:pose('squat',170,90)}).observation.phase).toBe('peak');
 });
 it('handles mirrored/translated/scaled coordinates with aspect-ratio correction',()=>{
  const a=new PosePhaseAdapter({exercise:'bench-press',cameraView:'side-right',smoothingAlpha:1,stableFrames:1,stableMs:0});
  const points=halfPose('bench-press',90,1).map(p=>({...p,x:(1-p.x)*.4+.2,y:p.y*.8+.1}));
  expect(a.process({timestampMs:0,aspectRatio:2,landmarks:points}).observation.phase).toBe('ready');
 });
 it('passes camera view to automatic recognizer while static poses remain unknown',()=>{
  const r=new TemporalExerciseRecognizer({cameraView:'front-left',smoothingAlpha:1,stableFrames:1,stableMs:0});
  for(const timestampMs of [0,60,120])expect(r.process({timestampMs,landmarks:halfPose('squat',170,0)}).observation.exercise).toBeNull();
  r.process({timestampMs:180,landmarks:halfPose('squat',90,0)});
  expect(r.process({timestampMs:240,landmarks:halfPose('squat',170,0)}).observation.exercise).toBe('squat');
 });
 it('rejects collapsed joint geometry even in a selected side view',()=>{
  const a=new PosePhaseAdapter({exercise:'bench-press',cameraView:'front-right',stableFrames:1,stableMs:0});
  const points=halfPose('bench-press',90,0);points[15]={...points[13]};
  expect(a.process({timestampMs:0,landmarks:points}).observation.visible).toBe(false);
 });
});
