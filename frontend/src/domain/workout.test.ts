import { describe, expect, it } from 'vitest';
import { WorkoutSession, type ExerciseId, type Phase } from './workout';

function harness() {
  let now = 0;
  let nextId = 0;
  const session = new WorkoutSession({ clock: () => now, idFactory: () => `set-${++nextId}` });
  function frame(time: number, phase: Phase, exercise: ExerciseId | null = 'squat', visible = true, bilateral = true) {
    now = time;
    session.observe({ phase, exercise, visible, bilateral });
  }
  return { session, frame, time: (time: number) => { now = time; } };
}

describe('complete repetitions', () => {
  it.each<ExerciseId>(['squat', 'push-up', 'dumbbell-curl', 'machine-shoulder-press', 'bench-press'])('counts one full %s cycle', (exercise) => {
    const { session, frame } = harness();
    frame(0, 'ready', exercise); frame(1000, 'peak', exercise); frame(2000, 'ready', exercise);
    expect(session.getSets()).toHaveLength(1);
    expect(session.getSets()[0].reps).toBe(1);
    expect(session.getSets()[0].detectedReps).toBe(1);
  });

  it('does not count a partial cycle', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'moving'); frame(2000, 'ready');
    expect(session.getSets().reduce((n, set) => n + set.reps, 0)).toBe(0);
  });

  it('requires a start anchor rather than counting an initial half-cycle', () => {
    const { session, frame } = harness();
    frame(0, 'peak'); frame(1000, 'ready');
    expect(session.getSets().reduce((n, set) => n + set.reps, 0)).toBe(0);
    frame(2000, 'peak'); frame(3000, 'ready');
    expect(session.getSets()[0].reps).toBe(1);
  });

  it('does not count held poses or repeated frames as repetitions', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(500, 'ready'); frame(1000, 'peak'); frame(1100, 'peak');
    frame(2000, 'ready'); frame(2100, 'ready');
    expect(session.getSets()[0].reps).toBe(1);
  });

  it('discards an occluded cycle and retains verified reps', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    frame(3000, 'peak'); frame(4000, 'ready', 'squat', false); frame(5000, 'ready');
    expect(session.getSets()[0].reps).toBe(1);
    frame(6000, 'peak'); frame(7000, 'ready');
    expect(session.getSets()[0].reps).toBe(2);
  });

  it('counts a bilateral curl once and ignores unsupported unilateral curl', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'dumbbell-curl'); frame(1000, 'peak', 'dumbbell-curl'); frame(2000, 'ready', 'dumbbell-curl');
    frame(3000, 'peak', 'dumbbell-curl', true, false); frame(4000, 'ready', 'dumbbell-curl', true, false);
    expect(session.getSets()[0].reps).toBe(1);
  });

  it('does not invent reps for an unknown exercise', () => {
    const { session, frame } = harness();
    frame(0, 'ready', null); frame(1000, 'peak', null); frame(2000, 'ready', null);
    expect(session.getSets()).toEqual([]);
  });

  it('discards a cycle interrupted by pause', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); time(1500); session.pause();
    frame(2000, 'ready'); time(2500); session.resume(); frame(3000, 'ready');
    expect(session.getSets().reduce((n, set) => n + set.reps, 0)).toBe(0);
    frame(4000, 'peak'); frame(5000, 'ready');
    expect(session.getSets()[0].reps).toBe(1);
  });
});

describe('loads and workout summary', () => {
  it('uses total barbell load including the bar', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'bench-press'); frame(1000, 'peak', 'bench-press'); frame(2000, 'ready', 'bench-press');
    session.setLoad(session.getSets()[0].id, 60);
    expect(session.summary()).toMatchObject({ knownVolumeKg: 60, volumeComplete: true });
  });

  it('calculates 200 kg for ten bilateral reps with two 10 kg dumbbells', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'dumbbell-curl');
    for (let i = 0; i < 10; i++) {
      frame(i * 2000 + 1000, 'peak', 'dumbbell-curl'); frame(i * 2000 + 2000, 'ready', 'dumbbell-curl');
    }
    session.setLoad(session.getSets()[0].id, 10);
    expect(session.summary()).toMatchObject({ totalSets: 1, totalReps: 10, knownVolumeKg: 200, volumeComplete: true });
  });

  it('uses the selected machine load', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'machine-shoulder-press'); frame(1000, 'peak', 'machine-shoulder-press'); frame(2000, 'ready', 'machine-shoulder-press');
    session.setLoad(session.getSets()[0].id, 27.5);
    expect(session.summary().knownVolumeKg).toBe(27.5);
  });

  it('excludes bodyweight from external volume without guessing body mass', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    expect(session.summary()).toMatchObject({ totalReps: 1, knownVolumeKg: 0, volumeComplete: true });
    expect(session.getSets()[0].loadKg).toBeNull();
  });

  it('marks absent weighted load as incomplete rather than a known zero', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'bench-press'); frame(1000, 'peak', 'bench-press'); frame(2000, 'ready', 'bench-press');
    expect(session.summary().volumeComplete).toBe(false);
    session.setLoad(session.getSets()[0].id, 0);
    expect(session.summary().volumeComplete).toBe(true);
    session.setLoad(session.getSets()[0].id, null);
    expect(session.summary().volumeComplete).toBe(false);
  });

  it('updates totals after correction while preserving the automatic count', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'bench-press'); frame(1000, 'peak', 'bench-press'); frame(2000, 'ready', 'bench-press'); session.endSet();
    const id = session.getSets()[0].id;
    session.setLoad(id, 40); session.correctSet(id, 5);
    expect(session.summary()).toMatchObject({ totalReps: 5, knownVolumeKg: 200 });
    expect(session.getSets()[0].detectedReps).toBe(1);
  });

  it('preserves total volume when merging sets with different loads', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'bench-press'); frame(1000, 'peak', 'bench-press'); frame(2000, 'ready', 'bench-press'); session.endSet();
    session.setLoad(session.getSets()[0].id, 40);
    frame(4000, 'ready', 'bench-press'); frame(5000, 'peak', 'bench-press'); frame(6000, 'ready', 'bench-press'); session.endSet();
    session.setLoad(session.getSets()[1].id, 50);
    session.mergeSets(session.getSets().map(set => set.id));
    expect(session.summary()).toMatchObject({ totalSets: 1, totalReps: 2, knownVolumeKg: 90, volumeComplete: true });
    session.correctSet(session.getSets()[0].id, 3);
    expect(session.summary().volumeComplete).toBe(false);
    session.setLoad(session.getSets()[0].id, 45);
    expect(session.summary()).toMatchObject({ knownVolumeKg: 135, volumeComplete: true });
  });

  it('rejects invalid weights and implement counts without mutating the set', () => {
    const { session, frame } = harness();
    frame(0, 'ready', 'dumbbell-curl'); frame(1000, 'peak', 'dumbbell-curl'); frame(2000, 'ready', 'dumbbell-curl');
    const id = session.getSets()[0].id;
    for (const value of [-1, NaN, Infinity]) expect(() => session.setLoad(id, value)).toThrow(/load/i);
    for (const value of [-1, 0, 1.5, Infinity]) expect(() => session.setLoad(id, 10, value)).toThrow(/implement/i);
    expect(session.getSets()[0]).toMatchObject({ loadKg: null, implementCount: 2 });
  });

  it('reports active duration excluding pauses and actual rest between sets', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready'); session.endSet();
    time(3000); session.pause(); time(8000); session.resume();
    frame(10000, 'ready'); frame(11000, 'peak'); frame(12000, 'ready');
    time(15000); const summary = session.finish();
    expect(summary).toMatchObject({ totalSets: 2, totalReps: 2, durationMs: 10000, pausedDurationMs: 5000, restDurationMs: 3000 });
    time(25000); expect(session.summary()).toEqual(summary);
    expect(() => frame(26000, 'ready')).toThrow(/finished/i);
  });

  it('does not invent an empty set when finishing a partial workout', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); time(1500);
    expect(session.finish()).toMatchObject({ totalSets: 0, totalReps: 0 });
  });

  it('does not let callers mutate internal sets through snapshots', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    const sets = session.getSets(); sets[0].reps = 999; sets[0].sourceIds.push('tampered');
    expect(session.getSets()[0]).toMatchObject({ reps: 1, sourceIds: ['set-1'] });
  });
});

describe('set boundaries and corrections', () => {
  it('closes at 15 valid seconds and keeps the last repetition end time', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    time(16999); session.tick(); expect(session.getSets()[0].endedAt).toBeNull();
    time(17000); session.tick(); expect(session.getSets()[0].endedAt).toBe(2000);
  });

  it('does not end a set because tracking is lost, and starts a fresh valid window on return', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    frame(3000, 'ready', 'squat', false); time(100000); session.tick();
    expect(session.getSets()[0].endedAt).toBeNull();
    frame(101000, 'ready'); time(115999); session.tick();
    expect(session.getSets()[0].endedAt).toBeNull();
    time(116000); session.tick(); expect(session.getSets()[0].endedAt).toBe(2000);
  });

  it('allows manual ending and a new set before the rest target expires', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    time(3000); session.endSet();
    frame(5000, 'ready'); frame(6000, 'peak'); frame(7000, 'ready');
    expect(session.getSets()).toHaveLength(2);
    expect(session.getSets()[0].endedAt).toBe(2000);
    expect(session.getSets()[1].startedAt).toBe(5000);
  });

  it('asks for confirmation before changing exercise during an active set', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    frame(3000, 'ready', 'push-up'); frame(4000, 'peak', 'push-up'); frame(5000, 'ready', 'push-up');
    expect(session.getPendingExercise()).toBe('push-up');
    expect(session.getSets()[0].reps).toBe(1);
    session.confirmExerciseChange();
    frame(6000, 'ready', 'push-up'); frame(7000, 'peak', 'push-up'); frame(8000, 'ready', 'push-up');
    expect(session.getSets().map(set => set.exercise)).toEqual(['squat', 'push-up']);
    expect(session.getSets().map(set => set.reps)).toEqual([1, 1]);
  });

  it('switches exercises automatically between sets', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready'); session.endSet();
    frame(4000, 'ready', 'bench-press'); frame(5000, 'peak', 'bench-press'); frame(6000, 'ready', 'bench-press');
    expect(session.getPendingExercise()).toBeNull();
    expect(session.getSets().map(set => set.exercise)).toEqual(['squat', 'bench-press']);
  });

  it('preserves automatic reps when correcting a completed set', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready'); session.endSet();
    session.correctSet(session.getSets()[0].id, 3);
    expect(session.getSets()[0]).toMatchObject({ reps: 3, detectedReps: 1 });
  });

  it('removes and restores a completed edited set without changing its ID or detection provenance',()=>{
    const {session,frame}=harness();
    frame(100,'ready','push-up');frame(200,'peak','push-up');frame(300,'ready','push-up');session.endSet();
    const original=session.getSets()[0];session.correctSet(original.id,2);session.setLoad(original.id,5);
    const removed=session.removeCompletedSet(original.id);
    expect(session.summary()).toMatchObject({totalSets:0,totalReps:0,knownVolumeKg:0});
    session.restoreCompletedSet(removed);
    expect(session.getSets()[0]).toMatchObject({id:original.id,exercise:'push-up',reps:2,detectedReps:1,loadKg:5,sourceIds:original.sourceIds,startedAt:100,endedAt:300});
    expect(session.summary()).toMatchObject({totalSets:1,totalReps:2,knownVolumeKg:10});
    expect(()=>session.restoreCompletedSet(removed)).toThrow(/already exists/i);
  });

  it('rejects removing a live set and restoring invalid or incomplete source data without mutation',()=>{
    const {session,frame}=harness();
    frame(0,'ready');frame(1000,'peak');frame(2000,'ready');
    const live=session.getSets()[0];expect(()=>session.removeCompletedSet(live.id)).toThrow(/completed/i);
    session.endSet();const saved=session.removeCompletedSet(live.id);
    for(const reps of [-1,1.5,Infinity])expect(()=>session.restoreCompletedSet(saved,{reps})).toThrow(/reps/i);
    for(const loadKg of [-1,Infinity])expect(()=>session.restoreCompletedSet(saved,{loadKg})).toThrow(/load/i);
    expect(session.getSets()).toHaveLength(0);session.restoreCompletedSet(saved);expect(session.getSets()).toHaveLength(1);
  });

  it('preserves load provenance when restoring a set with the same load',()=>{
    const {session,frame}=harness();frame(0,'ready');frame(1000,'peak');frame(2000,'ready');session.endSet();
    const saved=session.removeCompletedSet(session.getSets()[0].id);
    session.restoreCompletedSet(saved,{loadKg:saved.loadKg});
    expect(session.getSets()[0].loadEdited).toBe(saved.loadEdited);
  });

  it('merges completed sets without doubling corrected or raw counts', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready'); session.endSet();
    frame(4000, 'ready'); frame(5000, 'peak'); frame(6000, 'ready'); session.endSet();
    const ids = session.getSets().map(set => set.id);
    session.correctSet(ids[0], 3); session.correctSet(ids[1], 2); session.mergeSets(ids);
    expect(session.getSets()).toHaveLength(1);
    expect(session.getSets()[0]).toMatchObject({ reps: 5, detectedReps: 2, startedAt: 0, endedAt: 6000, sourceIds: ids });
  });

  it('rejects merging different exercise types', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready'); session.endSet();
    frame(4000, 'ready', 'push-up'); frame(5000, 'peak', 'push-up'); frame(6000, 'ready', 'push-up'); session.endSet();
    expect(() => session.mergeSets(session.getSets().map(set => set.id))).toThrow(/same exercise/i);
    expect(session.getSets()).toHaveLength(2);
  });

  it('rejects invalid corrections and changes to unfinished sets', () => {
    const { session, frame } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready');
    expect(() => session.correctSet(session.getSets()[0].id, 2)).toThrow(/completed/i);
    session.endSet();
    for (const value of [-1, 1.5, NaN, Infinity]) {
      expect(() => session.correctSet(session.getSets()[0].id, value)).toThrow(/reps/i);
    }
    expect(session.getSets()[0].reps).toBe(1);
  });

  it('measures rest from the last repetition rather than the later set boundary', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready'); time(17000); session.tick();
    time(52000); expect(session.restElapsedMs()).toBe(50000);
  });

  it('suspends automatic set closure while paused and resets the valid timer on resume', () => {
    const { session, frame, time } = harness();
    frame(0, 'ready'); frame(1000, 'peak'); frame(2000, 'ready'); time(5000); session.pause();
    time(50000); session.tick(); expect(session.getSets()[0].endedAt).toBeNull();
    session.resume(); frame(50000, 'ready'); time(64999); session.tick();
    expect(session.getSets()[0].endedAt).toBeNull();
    time(65000); session.tick(); expect(session.getSets()[0].endedAt).toBe(2000);
  });
});
