import type { SupportedExerciseId } from '../domain/exercises';
import { PosePhaseAdapter, type PoseFrame, type PoseOptions, type PoseResult } from './pose-phase-adapter';

import {supportedExerciseIds as exercises} from '../domain/exercises';
type Cycle={ready:boolean;peak:boolean};

export class TemporalExerciseRecognizer {
  private adapters=new Map<SupportedExerciseId,PosePhaseAdapter>();
  private cycles=new Map<SupportedExerciseId,Cycle>();
  private manual:SupportedExerciseId|null=null;
  private selected:SupportedExerciseId|null=null;

  constructor(private options: Omit<PoseOptions,'exercise'> = {}) { this.reset(); }

  selectManual(exercise: SupportedExerciseId | null): void {
    this.manual=exercise; this.selected=null; this.reset();
  }

  process(frame: PoseFrame): PoseResult {
    if (this.manual) return this.adapters.get(this.manual)!.process(frame);
    const results=new Map<SupportedExerciseId,PoseResult>();
    const completed:SupportedExerciseId[]=[];
    for (const exercise of exercises) {
      const result=this.adapters.get(exercise)!.process(frame);
      results.set(exercise,result);
      const cycle=this.cycles.get(exercise)!;
      const {visible,phase}=result.observation;
      if (!visible) {cycle.ready=false;cycle.peak=false;continue;}
      if (phase==='peak' && cycle.ready) cycle.peak=true;
      if (phase==='ready') {
        if (cycle.peak) completed.push(exercise);
        cycle.ready=true;cycle.peak=false;
      }
    }
    if (completed.length>1) {
      this.selected=null;
      return this.unknown('exercise-ambiguous');
    }
    if (completed.length===1) this.selected=completed[0];
    if (this.selected) return results.get(this.selected)!;
    const interruption=[...results.values()].find(result => result.reason && result.reason!=='camera-position');
    return this.unknown(interruption?.reason ?? 'exercise-unknown');
  }

  private unknown(reason:string): PoseResult {
    return {observation:{exercise:null,visible:false,phase:'moving'},reason};
  }
  private reset(): void {
    for (const exercise of exercises) {
      this.adapters.set(exercise,new PosePhaseAdapter({...this.options,exercise}));
      this.cycles.set(exercise,{ready:false,peak:false});
    }
  }
}
