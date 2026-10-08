import { expect, it } from 'vitest';
import { WorkoutSession } from './workout';

function setup() {
  let next=0;
  return new WorkoutSession({clock:()=>1000,idFactory:()=>`set-${++next}`});
}
it('set manual masuk summary dengan asal manual, bukan raw reps kamera', () => {
  const workout=setup(); const id=workout.addManualSet('dumbbell-curl',10,10);
  expect(workout.getSets()[0]).toMatchObject({id,origin:'manual',detectedReps:0,reps:10,endedAt:1000});
  expect(workout.summary()).toMatchObject({totalSets:1,totalReps:10,knownVolumeKg:200});
});
it('input manual tidak sah tidak membuat ghost set', () => {
  const workout=setup();
  expect(()=>workout.addManualSet('squat',0)).toThrow();
  expect(()=>workout.addManualSet('squat',1.5)).toThrow();
  expect(()=>workout.addManualSet('squat',10,-1)).toThrow();
  expect(()=>workout.addManualSet('squat',10,NaN)).toThrow();
  expect(workout.getSets()).toHaveLength(0);
});
it('entry manual weighted tanpa beban ditandai volume incomplete', () => {
  const workout=setup(); workout.addManualSet('bench-press',12);
  expect(workout.summary()).toMatchObject({totalReps:12,knownVolumeKg:0,volumeComplete:false});
});
it('entry manual bodyweight tidak memperkirakan berat tubuh', () => {
  const workout=setup(); workout.addManualSet('push-up',12);
  expect(workout.summary()).toMatchObject({totalReps:12,knownVolumeKg:0,volumeComplete:true});
});
it('merge manual dan kamera mempertahankan asal mixed serta raw reps', () => {
  const workout=setup();
  for (const phase of ['ready','peak','ready'] as const) workout.observe({exercise:'squat',phase,visible:true});
  workout.endSet(); const manual=workout.addManualSet('squat',10);
  workout.mergeSets([workout.getSets()[0].id,manual]);
  expect(workout.getSets()[0]).toMatchObject({origin:'mixed',detectedReps:1,reps:11});
});
it('set manual setelah finish ditolak', () => {
  const workout=setup(); workout.finish();
  expect(()=>workout.addManualSet('squat',10)).toThrow(/finished/);
});
