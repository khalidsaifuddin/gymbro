import {it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {WorkoutSession,type ExerciseId} from './workout';
import {WorkoutStore,type LocalWorkout} from '../storage/workout-store';
import {catalogIds,newBinding,toDTO,fromDTO} from '../sync/mapper';
import {loadLabel} from '../components/WorkoutLog.web';
import {exerciseCatalog,importedExerciseCount,isSupportedExerciseId} from './exercises';

const ids=['lat-pulldown','seated-cable-row','face-pull','straight-arm-pulldown'] as const;
it.each(ids)('%s: one stack, snapshot, local preferences and API history roundtrip',async slug=>{
 const exercise=slug as ExerciseId,s=new WorkoutSession({clock:()=>1000,idFactory:()=>crypto.randomUUID()});
 s.addManualSet(exercise,10,40);s.finish();expect(s.summary().knownVolumeKg).toBe(400);
 expect(s.getSets()[0].implementCount).toBe(1);expect(loadLabel(exercise)).toContain('mesin');
 const store=new WorkoutStore(new IDBFactory(),'test');
 const local=await store.save({id:crypto.randomUUID(),revision:0,snapshot:s.exportSnapshot(),preferences:{profile:exercise,manualExercise:exercise,manualReps:'10',manualLoad:'40',restSeconds:{[exercise]:90}}},0);
 const dto=toDTO(local,newBinding(local.id,crypto.randomUUID()));
 expect(dto.exercises[0].exercise_id).toBe(`00000000-0000-4000-8000-00000000000${ids.indexOf(slug)+6}`);
 expect(fromDTO(dto,crypto.randomUUID()).record.snapshot).toEqual(local.snapshot);await store.close();
});
it('keeps original exercise IDs while importing the full manual catalog',()=>{
 expect(catalogIds['bench-press']).toBe('00000000-0000-4000-8000-000000000005');expect(Object.keys(catalogIds)).toHaveLength(1333);
});
it('logs an imported exercise manually and roundtrips its stable ID through sync',()=>{
 const id='dataset:0001';expect(importedExerciseCount).toBe(1324);
 expect(isSupportedExerciseId(id)).toBe(false);
 const session=new WorkoutSession({clock:()=>1000,idFactory:()=>crypto.randomUUID()});
 session.addManualSet(id,12,15);session.finish();
 const local:LocalWorkout={id:crypto.randomUUID(),revision:0,snapshot:session.exportSnapshot(),preferences:{profile:'auto',manualExercise:id,manualReps:'12',manualLoad:'15',restSeconds:{}}};
 const dto=toDTO(local,newBinding(local.id,crypto.randomUUID()));
 expect(dto.exercises[0].exercise_id).toBe(exerciseCatalog[id].uuid);
 expect(dto.exercises[0].sets[0].recognition_status).toBe('manual');
 expect(fromDTO(dto,crypto.randomUUID()).record.snapshot.sets[0].exercise).toBe(id);
});
