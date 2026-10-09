// Stable catalogue metadata shared by domain, persistence, UI and API mapping.
export const exerciseCatalog={
 'squat':{uuid:'00000000-0000-4000-8000-000000000001',label:'Squat',equipment:'bodyweight',implementCount:1,loadLabel:'Beban kg eksternal (opsional untuk bodyweight)'},
 'push-up':{uuid:'00000000-0000-4000-8000-000000000002',label:'Push-up',equipment:'bodyweight',implementCount:1,loadLabel:'Beban kg eksternal (opsional untuk bodyweight)'},
 'dumbbell-curl':{uuid:'00000000-0000-4000-8000-000000000003',label:'Dumbbell curl',equipment:'dumbbell',implementCount:2,loadLabel:'Beban kg per dumbbell (2 dumbbell)'},
 'machine-shoulder-press':{uuid:'00000000-0000-4000-8000-000000000004',label:'Seated machine shoulder press',equipment:'machine',implementCount:1,loadLabel:'Beban kg pada mesin'},
 'bench-press':{uuid:'00000000-0000-4000-8000-000000000005',label:'Flat barbell bench press',equipment:'barbell',implementCount:1,loadLabel:'Beban kg total, termasuk bar'},
 'lat-pulldown':{uuid:'00000000-0000-4000-8000-000000000006',label:'Lat pulldown',equipment:'machine',implementCount:1,loadLabel:'Beban kg pada mesin (satu weight stack)'},
 'seated-cable-row':{uuid:'00000000-0000-4000-8000-000000000007',label:'Seated cable row',equipment:'machine',implementCount:1,loadLabel:'Beban kg pada mesin (satu weight stack)'},
 'face-pull':{uuid:'00000000-0000-4000-8000-000000000008',label:'Rope face pull',equipment:'machine',implementCount:1,loadLabel:'Beban kg pada mesin (satu weight stack)'},
 'straight-arm-pulldown':{uuid:'00000000-0000-4000-8000-000000000009',label:'Straight-arm cable pulldown',equipment:'machine',implementCount:1,loadLabel:'Beban kg pada mesin (satu weight stack)'},
} as const;
export type ExerciseId=keyof typeof exerciseCatalog;
export const exerciseIds=Object.keys(exerciseCatalog) as ExerciseId[];
export const cableExercises=['lat-pulldown','seated-cable-row','face-pull','straight-arm-pulldown'] as const;
export type CableExercise=typeof cableExercises[number];
export function isExerciseId(value:unknown):value is ExerciseId{return typeof value==='string'&&Object.hasOwn(exerciseCatalog,value);}
export function isCableExercise(value:ExerciseId):value is CableExercise{return (cableExercises as readonly string[]).includes(value);}
