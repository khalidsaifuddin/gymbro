import {it,expect} from 'vitest';
import {cableExercises,type CableExercise} from '../domain/exercises';
import {WorkoutSession} from '../domain/workout';
import {PosePhaseAdapter} from './pose-phase-adapter';
import {TemporalExerciseRecognizer} from './temporal-exercise-recognizer';
import {cablePose} from './fixtures/cable-pose';

it.each(cableExercises)('%s: stable full bilateral cycle counts one rep',exercise=>{
 let now=0;const s=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()}),a=new PosePhaseAdapter({exercise,smoothingAlpha:1});
 for(const peak of [false,true,false])for(let i=0;i<3;i++){now+=60;s.observe(a.process({timestampMs:now,landmarks:cablePose(exercise,peak)}).observation);}
 expect(s.summary().totalReps).toBe(1);expect(s.getSets()[0].exercise).toBe(exercise);
});
it.each(cableExercises)('%s: automatic recognition holds the correct candidate over two cycles',exercise=>{
 const r=new TemporalExerciseRecognizer({smoothingAlpha:1,stableFrames:1,stableMs:0});let t=0;
 for(const peak of [false,true,false,true,false]){
  const result=r.process({timestampMs:t+=60,landmarks:cablePose(exercise,peak)});
  if(t>=180)expect(result.observation.exercise).toBe(exercise);
 }
});
it.each(cableExercises)('%s: partial cycle, unilateral endpoint and interruption add no rep',exercise=>{
 let now=0;const s=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()}),a=new PosePhaseAdapter({exercise,smoothingAlpha:1,stableFrames:1,stableMs:0});
 const send=(points:ReturnType<typeof cablePose>)=>{now+=60;s.observe(a.process({timestampMs:now,landmarks:points}).observation);};
 send(cablePose(exercise));send(cablePose(exercise));expect(s.summary().totalReps).toBe(0);
 const unilateral=cablePose(exercise,true),ready=cablePose(exercise);unilateral[14]=ready[14];unilateral[16]=ready[16];send(unilateral);send(ready);expect(s.summary().totalReps).toBe(0);
 send(cablePose(exercise,true));const hidden=cablePose(exercise);hidden[15].visibility=.1;send(hidden);send(ready);expect(s.summary().totalReps).toBe(0);
 send(cablePose(exercise,true));send(ready);expect(s.summary().totalReps).toBe(1);
});
it.each(cableExercises)('%s: rejects the wrong seated/standing posture',exercise=>{
 const points=cablePose(exercise);const other=cablePose(exercise==='lat-pulldown'||exercise==='seated-cable-row'?'face-pull':'seated-cable-row');
 for(const i of [25,26,27,28])points[i]=other[i];
 expect(new PosePhaseAdapter({exercise,stableFrames:1,stableMs:0}).process({timestampMs:0,landmarks:points}).observation.visible).toBe(false);
});
it('face pull needs a visible head and straight-arm pulldown rejects bent elbows',()=>{
 const head=cablePose('face-pull',true);head[0].visibility=.1;
 expect(new PosePhaseAdapter({exercise:'face-pull'}).process({timestampMs:0,landmarks:head}).observation.visible).toBe(false);
 const bent=cablePose('straight-arm-pulldown',true);for(const side of [0,1])bent[15+side]={...bent[11+side]};
 expect(new PosePhaseAdapter({exercise:'straight-arm-pulldown'}).process({timestampMs:0,landmarks:bent}).observation.visible).toBe(false);
});
it.each(cableExercises)('%s: mirrored/scaled pose with corrected aspect ratio retains phase',exercise=>{
 const points=cablePose(exercise).map(p=>({...p,x:.1+(1-p.x)*.4,y:.1+p.y*.8}));
 expect(new PosePhaseAdapter({exercise,stableFrames:1,stableMs:0}).process({timestampMs:0,aspectRatio:2,landmarks:points}).observation.phase).toBe('ready');
});
it('seated row cannot classify face-pull endpoints, and pulldown chest cannot classify shoulder press',()=>{
 expect(new PosePhaseAdapter({exercise:'seated-cable-row'}).process({timestampMs:0,landmarks:cablePose('face-pull',true)}).observation.visible).toBe(false);
 expect(new PosePhaseAdapter({exercise:'machine-shoulder-press'}).process({timestampMs:0,landmarks:cablePose('lat-pulldown',true)}).observation.visible).toBe(false);
});

it.each(cableExercises)('%s: initial peak, jitter and body translation do not create reps; a frame gap discards a partial cycle',exercise=>{
 let now=0;const s=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()}),a=new PosePhaseAdapter({exercise,smoothingAlpha:1});
 const send=(peak:boolean,shift=0)=>{now+=60;s.observe(a.process({timestampMs:now,landmarks:cablePose(exercise,peak).map(p=>({...p,x:p.x+shift,y:p.y+shift}))}).observation);};
 for(let i=0;i<4;i++)send(true);for(let i=0;i<4;i++)send(false);expect(s.summary().totalReps).toBe(0);
 for(let i=0;i<10;i++)send(false,i%2?.015:-.015);expect(s.summary().totalReps).toBe(0);
 for(let i=0;i<8;i++)send(i%2===0);expect(s.summary().totalReps).toBe(0);
 for(let i=0;i<4;i++)send(false);for(let i=0;i<4;i++)send(true);now+=2000;send(false);for(let i=0;i<4;i++)send(false);expect(s.summary().totalReps).toBe(0);
 for(let i=0;i<4;i++)send(true);for(let i=0;i<4;i++)send(false);expect(s.summary().totalReps).toBe(1);
});
it.each(cableExercises)('%s: pause preserves verified reps and discards a partial cable cycle',exercise=>{
 let now=0;const s=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()}),a=new PosePhaseAdapter({exercise,smoothingAlpha:1,stableFrames:1,stableMs:0});
 const send=(peak:boolean)=>{now+=60;s.observe(a.process({timestampMs:now,landmarks:cablePose(exercise,peak)}).observation);};
 send(false);send(true);send(false);expect(s.summary().totalReps).toBe(1);
 send(true);s.pause();send(false);send(true);s.resume();send(false);expect(s.summary().totalReps).toBe(1);
 send(true);send(false);expect(s.summary().totalReps).toBe(2);
});
