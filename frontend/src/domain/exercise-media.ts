import inventory from '../data/exercise-media.json';
import type {ExerciseId} from './exercises';

export type ExerciseAnimation={frames:{path:string;sha256:string;sourceSha256:string;viewBox:string}[];sequence:number[];frameDurationMs:number;license:string;provenance:string};
export type ExerciseMediaRecord={animation:ExerciseAnimation|null};
export const exerciseMedia=inventory.exercises as Record<string,ExerciseMediaRecord>;
const supportedExerciseMediaIds:Partial<Record<ExerciseId,string>>={'push-up':'0662','dumbbell-curl':'0294','bench-press':'0025','seated-cable-row':'0861','straight-arm-pulldown':'0238'};
export function resolveExerciseAnimation(id:ExerciseId|string):ExerciseAnimation|null{
 const datasetId=id.startsWith('dataset:')?id.slice('dataset:'.length):supportedExerciseMediaIds[id as ExerciseId]??null;
 return datasetId?exerciseMedia[datasetId]?.animation??null:null;
}
