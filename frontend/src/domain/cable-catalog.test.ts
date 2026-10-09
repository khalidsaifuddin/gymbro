import {it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {WorkoutSession,type ExerciseId} from './workout';
import {WorkoutStore} from '../storage/workout-store';
import {catalogIds,newBinding,toDTO,fromDTO} from '../sync/mapper';
import {loadLabel} from '../components/WorkoutLog.web';

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
it('keeps the original exercise IDs and expands the catalogue to nine',()=>{
 expect(catalogIds['bench-press']).toBe('00000000-0000-4000-8000-000000000005');expect(Object.keys(catalogIds)).toHaveLength(9);
});
