import {describe,expect,it} from 'vitest';
import {WorkoutSession} from '../domain/workout';
import {PosePhaseAdapter} from './pose-phase-adapter';
import {assessFraming} from './camera-framing';
import {pose} from './fixtures/pose';

function pushUpPose(degrees:number,hiddenSide:0|1|null=null){
  const points=pose('push-up',degrees);
  for(const side of [0,1])points[23+side].x+=.12;
  if(hiddenSide!==null)for(const base of [11,13,15,23])points[base+hiddenSide].visibility=.1;
  return points;
}

describe('default side-view push-up detection',()=>{
  it('tracks the visible complete side when the far side is occluded',()=>{
    const adapter=new PosePhaseAdapter({exercise:'push-up',cameraView:'auto'});
    expect(adapter.process({timestampMs:0,landmarks:pushUpPose(160,0)}).observation.visible).toBe(true);
  });
  it('camera framing guide accepts that same default side view',()=>{
    expect(assessFraming({timestampMs:0,landmarks:pushUpPose(160,0)},'push-up','auto').state).toBe('framed');
  });
  it('counts three complete modest cycles at the default production cadence',()=>{
    let now=0;const workout=new WorkoutSession({clock:()=>now,idFactory:()=>`set-${now}`});
    const adapter=new PosePhaseAdapter({exercise:'push-up',cameraView:'auto'});
    for(let rep=0;rep<3;rep++)for(const degrees of [148,148,142,136,128,118,108,108,118,128,136,142,148,148]){
      workout.observe(adapter.process({timestampMs:now,landmarks:pushUpPose(degrees,0)}).observation);
      now+=34;
    }
    expect(workout.summary().totalReps).toBe(3);
  });
  it('does not count a plank, a one-frame peak or a partial down movement',()=>{
    let now=0;const workout=new WorkoutSession({clock:()=>now,idFactory:()=>`set-${now}`});
    const adapter=new PosePhaseAdapter({exercise:'push-up'});
    for(let i=0;i<18;i++){workout.observe(adapter.process({timestampMs:now,landmarks:pushUpPose(170,0)}).observation);now+=34;}
    workout.observe(adapter.process({timestampMs:now,landmarks:pushUpPose(170,0)}).observation);now+=34;
    workout.observe(adapter.process({timestampMs:now,landmarks:pushUpPose(108,0)}).observation);now+=34;
    workout.observe(adapter.process({timestampMs:now,landmarks:pushUpPose(170,0)}).observation);now+=34;
    for(const degrees of [148,138,128,118,108])for(let i=0;i<3;i++){
      workout.observe(adapter.process({timestampMs:now,landmarks:pushUpPose(degrees,0)}).observation);now+=34;
    }
    expect(workout.summary().totalReps).toBe(0);
  });
  it('still requires both arms when the user explicitly selects front view',()=>{
    const result=new PosePhaseAdapter({exercise:'push-up',cameraView:'front'})
      .process({timestampMs:0,landmarks:pushUpPose(160,0)});
    expect(result.observation.visible).toBe(false);
  });
  it('changing visible sides interrupts a partial repetition',()=>{
    let now=0;const workout=new WorkoutSession({clock:()=>now,idFactory:()=>`set-${now}`});
    const adapter=new PosePhaseAdapter({exercise:'push-up',cameraView:'auto'});
    for(const [angle,hidden] of [[148,0],[148,0],[108,0],[108,0],[148,1],[148,1],[148,1]] as const){
      workout.observe(adapter.process({timestampMs:now,landmarks:pushUpPose(angle,hidden)}).observation);now+=40;
    }
    expect(workout.summary().totalReps).toBe(0);
  });
});
