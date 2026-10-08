import {describe,it,expect} from 'vitest';
import {WorkoutSession,type SessionOptions} from './workout';

function fixture() {
  let now=0,next=0;
  const options:SessionOptions={clock:()=>now,idFactory:()=>`set-${++next}`};
  const session=new WorkoutSession(options);
  const frame=(phase:'ready'|'peak')=>{now+=1000;session.observe({exercise:'squat',phase,visible:true});};
  frame('ready');for(let i=0;i<8;i++){frame('peak');frame('ready');}
  return {session,options,frame,time:(value:number)=>{now=value;}};
}
describe('verified session recovery',()=>{
  it('recovers eight reps paused, drops partial cycles and excludes reload downtime',()=>{
    const f=fixture();f.frame('peak');
    const snapshot=JSON.parse(JSON.stringify(f.session.exportSnapshot()));
    f.time(100000);const recovered=WorkoutSession.restore(snapshot,f.options);
    expect(recovered.isPaused()).toBe(true);
    expect(recovered.summary()).toMatchObject({totalReps:8,durationMs:18000,pausedDurationMs:82000});
    recovered.observe({exercise:'squat',phase:'ready',visible:true});recovered.tick();
    expect(recovered.getSets()[0]).toMatchObject({reps:8,endedAt:null});
    recovered.resume();recovered.observe({exercise:'squat',phase:'ready',visible:true});
    expect(recovered.summary().totalReps).toBe(8);
    recovered.observe({exercise:'squat',phase:'peak',visible:true});
    recovered.observe({exercise:'squat',phase:'ready',visible:true});
    expect(recovered.summary().totalReps).toBe(9);
  });
  it('retains an existing open pause without double counting',()=>{
    const f=fixture();f.time(20000);f.session.pause();f.time(25000);
    const snapshot=f.session.exportSnapshot();f.time(50000);
    const recovered=WorkoutSession.restore(snapshot,f.options);
    expect(recovered.summary()).toMatchObject({durationMs:20000,pausedDurationMs:30000});
    recovered.resume();expect(recovered.summary().durationMs).toBe(20000);
  });
  it('restores finished summaries unchanged and preserves merged provenance',()=>{
    const f=fixture();f.session.endSet();f.time(21000);
    const a=f.session.addManualSet('bench-press',10,40);f.time(23000);
    const b=f.session.addManualSet('bench-press',8,50);f.session.mergeSets([a,b]);
    f.time(25000);const expected=f.session.finish(),snapshot=f.session.exportSnapshot();
    f.time(999000);const recovered=WorkoutSession.restore(snapshot,f.options);
    expect(recovered.isFinished()).toBe(true);expect(recovered.summary()).toEqual(expected);
    expect(recovered.getSets()[1].mergedFrom).toHaveLength(2);
    recovered.correctSet(a,20);expect(recovered.summary().volumeComplete).toBe(false);
  });
  it('clones both export and restored data',()=>{
    const f=fixture(),snapshot=f.session.exportSnapshot();
    const recovered=WorkoutSession.restore(snapshot,f.options);
    snapshot.sets[0].reps=999;expect(recovered.summary().totalReps).toBe(8);
    expect(f.session.summary().totalReps).toBe(8);
  });
  it.each(['version','negative-reps','unknown-exercise','missing-current','overlapping-pause','future-time','media'])('rejects corrupt snapshot: %s',kind=>{
    const f=fixture();const snapshot:any=f.session.exportSnapshot();
    if(kind==='version')snapshot.version=99;
    if(kind==='negative-reps')snapshot.sets[0].reps=-1;
    if(kind==='unknown-exercise')snapshot.sets[0].exercise='deadlift';
    if(kind==='missing-current')snapshot.currentSetId='missing';
    if(kind==='overlapping-pause')snapshot.pauses=[{start:1,end:10},{start:5,end:12}];
    if(kind==='future-time')snapshot.sets[0].lastRepAt=999999;
    if(kind==='media')snapshot.video='blob:secret';
    expect(()=>WorkoutSession.restore(snapshot,f.options)).toThrow(/snapshot/i);
    expect(f.session.summary().totalReps).toBe(8);
  });
});
