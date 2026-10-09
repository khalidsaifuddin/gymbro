import {describe,expect,it} from 'vitest';
import {WorkoutSession} from '../domain/workout';
import {PosePhaseAdapter,type Landmark,type PoseFrame} from './pose-phase-adapter';
import {pose} from './fixtures/pose';

type DepthFrame = Omit<PoseFrame,'landmarks'> & {landmarks:Landmark[];worldLandmarks:(Landmark & {z:number})[]};

// Synthetic arm geometry rotated toward the camera. Its image projection
// remains nearly straight while the actual elbow angle changes in depth.
function depthCurl(timestampMs:number,left:number,right=left):DepthFrame {
  const landmarks=pose('dumbbell-curl',170);
  const worldLandmarks=landmarks.map(point=>({...point,z:0}));
  for(const side of [0,1]){
    const x=.32+side*.2;
    const elbowY=.2+.15*Math.cos(70*Math.PI/180),elbowZ=.15*Math.sin(70*Math.PI/180);
    const direction=((side?right:left)-110)*Math.PI/180;
    worldLandmarks[11+side]={x,y:.2,z:0,visibility:1,presence:1};
    worldLandmarks[13+side]={x,y:elbowY,z:elbowZ,visibility:1,presence:1};
    worldLandmarks[15+side]={x,y:elbowY+.14*Math.cos(direction),z:elbowZ+.14*Math.sin(direction),visibility:1,presence:1};
    for(const index of [11,13,15])landmarks[index+side]={...worldLandmarks[index+side]};
  }
  return {timestampMs,landmarks,worldLandmarks};
}

function replay(make:(now:number,degrees:number)=>PoseFrame,angles=[170,80,170],reps=1){
  let now=0;const workout=new WorkoutSession({clock:()=>now,idFactory:()=>`set-${now}`});
  const adapter=new PosePhaseAdapter({exercise:'dumbbell-curl'});
  for(let rep=0;rep<reps;rep++)for(const degrees of angles)for(let i=0;i<5;i++){
    workout.observe(adapter.process(make(now,degrees)).observation);now+=60;
  }
  return workout.summary().totalReps;
}

describe('curl toward the chest',()=>{
  it('counts three full depth curls whose image projection never reaches peak',()=>{
    expect(replay(depthCurl,[170,80,170],3)).toBe(3);
  });
  it.each([.56,1.78])('keeps world angles independent of image aspect %s and negative world coordinates',aspectRatio=>{
    expect(replay((now,degrees)=>{
      const frame=depthCurl(now,degrees);
      frame.worldLandmarks=frame.worldLandmarks.map(point=>({...point,x:point.x-.8,y:point.y-.5}));
      frame.landmarks=frame.landmarks.map(point=>({...point,x:point.x/aspectRatio}));
      return {...frame,aspectRatio};
    })).toBe(1);
  });
  it('uses valid depth geometry even when the image forearm collapses onto the elbow',()=>{
    expect(replay((now,degrees)=>{
      const frame=depthCurl(now,degrees);
      if(degrees===80)for(const side of [0,1])frame.landmarks[15+side]={...frame.landmarks[13+side]};
      return frame;
    })).toBe(1);
  });
  it('accepts measured wrists with lower visibility only inside the chest area',()=>{
    expect(replay((timestampMs,degrees)=>{
      const landmarks=pose('dumbbell-curl',degrees);
      if(degrees===80)for(const side of [0,1])landmarks[15+side]={x:.37+side*.1,y:.25,visibility:.4,presence:.8};
      return {timestampMs,landmarks};
    })).toBe(1);
  });
  it('does not trust low visibility wrists away from the chest',()=>{
    const landmarks=pose('dumbbell-curl',170);
    for(const side of [0,1])landmarks[15+side].visibility=.4;
    expect(new PosePhaseAdapter({exercise:'dumbbell-curl'}).process({timestampMs:0,landmarks}).observation.visible).toBe(false);
  });
  it.each(['presence','visibility'] as const)('very weak wrist %s still interrupts the cycle at the chest',field=>{
    expect(replay((now,degrees)=>{
      const frame=depthCurl(now,degrees);
      if(degrees===80)frame.landmarks[15][field]=.3;
      return frame;
    })).toBe(0);
  });
  it('does not count one arm remaining extended in depth',()=>{
    expect(replay((now,degrees)=>depthCurl(now,degrees,170))).toBe(0);
  });
  it.each(['nan','missing','zero-length'] as const)('invalid %s world geometry cannot complete a cycle',problem=>{
    expect(replay((now,degrees)=>{
      const frame=depthCurl(now,degrees);
      if(degrees===80){
        if(problem==='nan')frame.worldLandmarks[15].z=NaN;
        if(problem==='missing')frame.worldLandmarks=[];
        if(problem==='zero-length')frame.worldLandmarks[15]={...frame.worldLandmarks[13]};
      }
      // Image pose alone could otherwise manufacture the missing peak.
      frame.landmarks=pose('dumbbell-curl',degrees);
      return frame;
    })).toBe(0);
  });
  it('does not join an image ready phase to a depth peak phase',()=>{
    expect(replay((now,degrees)=>degrees===170
      ? {timestampMs:now,landmarks:pose('dumbbell-curl',degrees)} : depthCurl(now,degrees))).toBe(0);
  });
  it('keeps supporting complete image-only curls',()=>{
    expect(replay((timestampMs,degrees)=>({timestampMs,landmarks:pose('dumbbell-curl',degrees)}))).toBe(1);
  });
});
