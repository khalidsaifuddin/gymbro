import {it,expect} from 'vitest';
import {WorkoutSession} from '../domain/workout';
import {newBinding,toDTO,fromDTO} from './mapper';
it('retains global set order, pauses, corrections and complete merged provenance through API JSON',()=>{
 let now=10000;const session=new WorkoutSession({clock:()=>now,idFactory:()=>crypto.randomUUID()});
 session.addManualSet('bench-press',10,40);now+=1000;session.addManualSet('squat',8);now+=1000;session.addManualSet('bench-press',8,50);session.mergeSets(session.getSets().filter(s=>s.exercise==='bench-press').map(s=>s.id));session.pause();now+=3000;session.resume();session.finish();
 const local={id:crypto.randomUUID(),revision:1,snapshot:session.exportSnapshot(),preferences:{profile:'auto' as const,restSeconds:{},manualExercise:'squat' as const,manualReps:'10',manualLoad:''}};
 const dto=toDTO(local,newBinding(local.id,crypto.randomUUID()));const read=fromDTO(JSON.parse(JSON.stringify(dto)),crypto.randomUUID()).record;
 expect(read.snapshot).toEqual(local.snapshot);expect(dto.paused_duration_ms).toBe(3000);expect(session.summary().knownVolumeKg).toBe(800);
});
