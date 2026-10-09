import {validateSnapshot} from './workout-snapshot';
export type {ExerciseId} from './exercises';
import {exerciseCatalog,type ExerciseId} from './exercises';
export type Phase = 'ready' | 'peak' | 'moving';
export type Observation = {
  exercise: ExerciseId | null;
  phase: Phase;
  visible: boolean;
  bilateral?: boolean;
  labelSource?:'automatic'|'profile';
};
export type WorkoutSet = {
  id: string;
  exercise: ExerciseId;
  detectedReps: number;
  origin: 'automatic' | 'manual' | 'mixed';
  reps: number;
  startedAt: number;
  endedAt: number | null;
  lastRepAt: number;
  loadKg: number | null;
  implementCount: number;
  sourceIds: string[];
  mergedFrom?: WorkoutSet[];
  loadEdited?: boolean;
  labelSource?:'automatic'|'profile'|'manual'|'mixed';
  rawExercise?:ExerciseId|null;
};
export type SessionOptions = { clock: () => number; idFactory: () => string };
export type SessionSnapshot = {
  version:1; startedAt:number; finishedAt:number|null; savedAt:number;
  currentSetId:string|null; sets:WorkoutSet[]; pauses:{start:number;end:number|null}[];
};
export type WorkoutSummary = {
  totalSets: number; totalReps: number; knownVolumeKg: number; volumeComplete: boolean;
  durationMs: number; pausedDurationMs: number; restDurationMs: number;
};

export class WorkoutSession {
  private options: SessionOptions;
  private sets: WorkoutSet[] = [];
  private current: WorkoutSet | null = null;
  private anchor: { exercise: ExerciseId; at: number } | null = null;
  private reachedPeak = false;
  private paused = false;
  private tracking = false;
  private quietSince: number | null = null;
  private pendingExercise: ExerciseId | null = null;
  private startedAt: number;
  private finishedAt: number | null = null;
  private pauses: { start: number; end: number | null }[] = [];

  constructor(options: SessionOptions) { this.options = options; this.startedAt = options.clock(); }

  exportSnapshot(): SessionSnapshot {
    return structuredClone({version:1,startedAt:this.startedAt,finishedAt:this.finishedAt,
      savedAt:this.options.clock(),currentSetId:this.current?.id??null,sets:this.sets,pauses:this.pauses});
  }
  static restore(value:unknown,options:SessionOptions): WorkoutSession {
    const snapshot=validateSnapshot(value),session=new WorkoutSession(options);
    session.startedAt=snapshot.startedAt;session.finishedAt=snapshot.finishedAt;
    session.sets=snapshot.sets;session.pauses=snapshot.pauses;
    session.current=session.sets.find(set=>set.id===snapshot.currentSetId)??null;
    if(session.finishedAt===null) {
      if(session.pauses.at(-1)?.end!==null) session.pauses.push({start:snapshot.savedAt,end:null});
      session.paused=true;
    }
    return session;
  }
  isPaused():boolean {return this.paused;}
  isFinished():boolean {return this.finishedAt!==null;}

  addManualSet(exercise: ExerciseId, reps: number, loadKg: number | null = null): string {
    if (this.finishedAt !== null) throw new Error('Workout is finished');
    if (!Number.isSafeInteger(reps) || reps < 1 || reps > 2147483647) throw new Error('Manual reps must be a positive integer');
    this.validateLoad(loadKg);
    const id=this.options.idFactory(), now=this.options.clock();
    this.endSet();
    this.sets.push({id,exercise,reps,detectedReps:0,origin:'manual',startedAt:now,endedAt:now,lastRepAt:now,
      loadKg:loadKg===null?null:Math.round(loadKg*1000)/1000,implementCount:exerciseCatalog[exercise].implementCount,
      sourceIds:[id],loadEdited:true,labelSource:'manual',rawExercise:null});
    return id;
  }

  observe(observation: Observation): void {
    if (this.finishedAt !== null) throw new Error('Workout is finished');
    if (this.paused) return;
    const { exercise, phase, visible } = observation;
    if (!visible || !exercise || (exercise === 'dumbbell-curl' && observation.bilateral === false)) {
      this.tracking = false;
      this.quietSince = null;
      this.resetCycle();
      return;
    }
    const now = this.options.clock();
    if (!this.tracking) this.quietSince = now;
    this.tracking = true;
    if (this.pendingExercise) return;
    if (this.current && this.current.exercise !== exercise) {
      this.pendingExercise = exercise;
      this.quietSince = null;
      this.resetCycle();
      return;
    }
    this.tick();
    if (this.anchor && this.anchor.exercise !== exercise) this.resetCycle();
    if (phase === 'ready') {
      if (this.anchor && this.reachedPeak) {
        if (!this.current) {
          const id = this.options.idFactory();
          this.current = { id, exercise, detectedReps: 0, origin: 'automatic', reps: 0, startedAt: this.anchor.at,
            endedAt: null, lastRepAt: now, loadKg: null, implementCount: exerciseCatalog[exercise].implementCount, sourceIds: [id],labelSource:observation.labelSource??'automatic',rawExercise:observation.labelSource==='profile'?null:exercise };
          this.sets.push(this.current);
        }
        if(this.current.labelSource!==(observation.labelSource??'automatic')){this.current.labelSource='mixed';this.current.rawExercise=null;}
        this.current.detectedReps++;
        this.current.reps++;
        this.current.lastRepAt = now;
        this.quietSince = now;
      }
      this.anchor = { exercise, at: now };
      this.reachedPeak = false;
    } else if (phase === 'peak' && this.anchor) {
      this.reachedPeak = true;
    }
  }

  getSets(): WorkoutSet[] { return structuredClone(this.sets); }
  setLoad(id: string, loadKg: number | null, implementCount?: number): void {
    this.validateLoad(loadKg, implementCount);
    const set = this.requireSet(id);
    set.loadKg = loadKg === null ? null : Math.round(loadKg * 1000) / 1000;
    set.implementCount = implementCount ?? set.implementCount;
    set.loadEdited = true;
  }

  private validateLoad(loadKg: number | null, implementCount?: number): void {
    if (loadKg !== null && (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > 99999.999)) {
      throw new Error('Load must be a nonnegative finite kg value within the storage range');
    }
    if (implementCount !== undefined && (!Number.isSafeInteger(implementCount) || implementCount < 1 || implementCount > 32767)) {
      throw new Error('Implement count must be a positive integer within the storage range');
    }
  }

  summary(): WorkoutSummary {
    const end = this.finishedAt ?? this.options.clock();
    const pausedDurationMs = this.pausedBetween(this.startedAt, end);
    const volumes = this.sets.map(set => this.volume(set));
    const restDurationMs = this.sets.reduce((total, set, index) => {
      const previous = this.sets[index - 1];
      return previous?.endedAt !== undefined && previous.endedAt !== null
        ? total + Math.max(0, set.startedAt - previous.endedAt - this.pausedBetween(previous.endedAt, set.startedAt))
        : total;
    }, 0);
    return {
      totalSets: this.sets.filter(set => set.reps > 0).length,
      totalReps: this.sets.reduce((n, set) => n + set.reps, 0),
      knownVolumeKg: Math.round(volumes.reduce((n, volume) => n + volume.knownKg, 0) * 1000) / 1000,
      volumeComplete: volumes.every(volume => volume.complete),
      durationMs: Math.max(0, end - this.startedAt - pausedDurationMs), pausedDurationMs, restDurationMs,
    };
  }

  finish(): WorkoutSummary {
    if (this.finishedAt === null) {
      this.endSet();
      this.finishedAt = this.options.clock();
      const pause = this.pauses.at(-1);
      if (pause && pause.end === null) pause.end = this.finishedAt;
    }
    return this.summary();
  }
  tick(): void {
    if (!this.paused && this.tracking && !this.pendingExercise && this.current && this.quietSince !== null &&
        this.options.clock() - this.quietSince >= 15000) this.endSet();
  }

  endSet(): void {
    if (this.current) this.current.endedAt = this.current.lastRepAt;
    this.current = null;
    this.quietSince = null;
    this.pendingExercise = null;
    this.resetCycle();
  }

  getPendingExercise(): ExerciseId | null { return this.pendingExercise; }
  confirmExerciseChange(): void { if (this.pendingExercise) this.endSet(); }

  correctSet(id: string, reps: number): void {
    if (!Number.isSafeInteger(reps) || reps < 0 || reps > 2147483647) throw new Error('Reps must be a nonnegative integer within the storage range');
    const set = this.requireSet(id);
    if (set.endedAt === null) throw new Error('Corrections require a completed set');
    set.reps = reps;
  }

  mergeSets(ids: string[]): void {
    if (ids.length < 2 || new Set(ids).size !== ids.length) throw new Error('Choose at least two distinct sets');
    const selected = ids.map(id => this.requireSet(id)).sort((a, b) => a.startedAt - b.startedAt);
    if (selected.some(set => set.endedAt === null)) throw new Error('Merge requires completed sets');
    if (selected.some(set => set.exercise !== selected[0].exercise)) throw new Error('Merge requires the same exercise');
    const sameLoad = selected.every(set => set.loadKg === selected[0].loadKg && set.implementCount === selected[0].implementCount);
    const labelSource=selected.every(set=>set.labelSource===selected[0].labelSource)?selected[0].labelSource??'mixed':'mixed';
    const merged: WorkoutSet = { ...selected[0],
      origin: selected.every(set => set.origin === selected[0].origin) ? selected[0].origin : 'mixed',
      reps: selected.reduce((n, set) => n + set.reps, 0),
      detectedReps: selected.reduce((n, set) => n + set.detectedReps, 0),
      endedAt: Math.max(...selected.map(set => set.endedAt!)),
      lastRepAt: Math.max(...selected.map(set => set.lastRepAt)),
      loadKg: sameLoad ? selected[0].loadKg : null,
      sourceIds: selected.flatMap(set => set.sourceIds),
      mergedFrom: structuredClone(selected),
      loadEdited: false,
      labelSource,rawExercise:labelSource==='automatic'?selected[0].rawExercise??null:null,
    };
    const position = this.sets.indexOf(selected[0]);
    this.sets = this.sets.filter(set => !ids.includes(set.id));
    this.sets.splice(position, 0, merged);
  }

  restElapsedMs(): number {
    if (this.current) return 0;
    const last = this.sets.filter(set => set.endedAt !== null).at(-1);
    const end = this.finishedAt ?? this.options.clock();
    return last ? Math.max(0, end - last.endedAt! - this.pausedBetween(last.endedAt!, end)) : 0;
  }

  pause(): void {
    if (this.finishedAt !== null) throw new Error('Workout is finished');
    if (!this.paused) this.pauses.push({ start: this.options.clock(), end: null });
    this.paused = true; this.tracking = false; this.quietSince = null; this.resetCycle();
  }
  resume(): void {
    if (this.finishedAt !== null) throw new Error('Workout is finished');
    const pause = this.pauses.at(-1);
    if (this.paused && pause && pause.end === null) pause.end = this.options.clock();
    this.paused = false; this.tracking = false; this.quietSince = null; this.resetCycle();
  }

  private volume(set: WorkoutSet): { knownKg: number; complete: boolean } {
    if (set.loadKg !== null) return { knownKg: set.loadKg * set.implementCount * set.reps, complete: true };
    if (!set.loadEdited && set.mergedFrom && set.reps === set.mergedFrom.reduce((n, source) => n + source.reps, 0)) {
      const sources = set.mergedFrom.map(source => this.volume(source));
      return { knownKg: sources.reduce((n, source) => n + source.knownKg, 0), complete: sources.every(source => source.complete) };
    }
    return { knownKg: 0, complete: set.reps === 0 || exerciseCatalog[set.exercise].equipment === 'bodyweight' };
  }

  private pausedBetween(start: number, end: number): number {
    return this.pauses.reduce((total, pause) => total + Math.max(0,
      Math.min(end, pause.end ?? end) - Math.max(start, pause.start)), 0);
  }
  private requireSet(id: string): WorkoutSet {
    const set = this.sets.find(set => set.id === id);
    if (!set) throw new Error('Set not found');
    return set;
  }
  private resetCycle(): void { this.anchor = null; this.reachedPeak = false; }
}
