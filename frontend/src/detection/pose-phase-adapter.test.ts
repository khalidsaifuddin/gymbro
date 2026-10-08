import { describe, expect, it } from 'vitest';
import { WorkoutSession, type ExerciseId } from '../domain/workout';
import { PosePhaseAdapter, type PoseOptions } from './pose-phase-adapter';

import { exercises, readyAngle, peakAngle, pose } from './fixtures/pose';

function create(exercise: ExerciseId, extra: Partial<PoseOptions> = {}) {
  return new PosePhaseAdapter({exercise, smoothingAlpha: 1, ...extra});
}
function hold(adapter: PosePhaseAdapter, exercise: ExerciseId, angle: number, start = 0, rightAngle = angle) {
  const results = [0, 60, 120].map(offset => adapter.process({timestampMs: start+offset, landmarks: pose(exercise, angle, rightAngle)}));
  return results.at(-1)!;
}

describe('profil pose lima gerakan', () => {
  it.each(exercises)('%s: fase awal harus stabil sebelum ready', exercise => {
    const adapter = create(exercise);
    const first = adapter.process({timestampMs: 0, landmarks: pose(exercise, readyAngle(exercise))});
    expect(first.observation.phase).toBe('moving');
    const ready = hold(adapter, exercise, readyAngle(exercise), 60);
    expect(ready.observation).toMatchObject({exercise, phase: 'ready', visible: true});
  });
  it.each(exercises)('%s: replay siklus penuh menghasilkan satu rep', exercise => {
    let now = 0;
    const workout = new WorkoutSession({clock: () => now, idFactory: () => 'set-1'});
    const adapter = create(exercise);
    for (const [start, angle] of [[0,readyAngle(exercise)],[180,peakAngle(exercise)],[360,readyAngle(exercise)]]) {
      for (const offset of [0, 60, 120]) {
        now = start+offset;
        workout.observe(adapter.process({timestampMs: now, landmarks: pose(exercise, angle)}).observation);
      }
    }
    expect(workout.summary().totalReps).toBe(1);
    expect(workout.getSets()[0].exercise).toBe(exercise);
  });
});

describe('stabilitas dan tracking', () => {
  it('satu frame fleksi tidak mencapai peak', () => {
    const adapter = create('dumbbell-curl');
    hold(adapter, 'dumbbell-curl', 170);
    expect(adapter.process({timestampMs: 180, landmarks: pose('dumbbell-curl', 55)}).observation.phase).toBe('moving');
    expect(hold(adapter, 'dumbbell-curl', 170, 240).observation.phase).toBe('ready');
  });
  it('tiga frame tanpa 120 ms tetap belum stabil', () => {
    const adapter = create('squat');
    for (const timestampMs of [0, 10, 20]) {
      expect(adapter.process({timestampMs, landmarks: pose('squat', 170)}).observation.phase).toBe('moving');
    }
    expect(adapter.process({timestampMs: 120, landmarks: pose('squat', 170)}).observation.phase).toBe('ready');
  });
  it('EMA mengurangi perubahan sudut mendadak', () => {
    const adapter = create('dumbbell-curl', {smoothingAlpha: .25, stableFrames: 1, stableMs: 0});
    expect(adapter.process({timestampMs: 0, landmarks: pose('dumbbell-curl', 170)}).observation.phase).toBe('ready');
    expect(adapter.process({timestampMs: 60, landmarks: pose('dumbbell-curl', 55)}).observation.phase).toBe('moving');
  });
  it('sudut memakai rasio aspek gambar agar video lebar tidak mengubah fase', () => {
    const adapter=create('dumbbell-curl', {stableFrames: 1, stableMs: 0});
    const points=pose('dumbbell-curl', 70).map(point => ({...point, x: point.x/2}));
    const result=adapter.process({timestampMs: 0, landmarks: points, aspectRatio: 2});
    expect(result.observation).toMatchObject({visible: true, phase: 'moving'});
  });
  it('rasio aspek tidak sah ditolak tanpa counting', () => {
    for (const aspectRatio of [0, -1, NaN, Infinity]) {
      const result=create('squat').process({timestampMs: 0, landmarks: pose('squat', 170), aspectRatio});
      expect(result.observation.visible).toBe(false);
      expect(result.reason).toBe('invalid-aspect-ratio');
    }
  });
  it.each(['visibility', 'presence'] as const)('confidence %s rendah langsung memutus tracking', field => {
    const adapter = create('dumbbell-curl');
    hold(adapter, 'dumbbell-curl', 170);
    const points = pose('dumbbell-curl', 55); points[15][field] = .3;
    const result = adapter.process({timestampMs: 180, landmarks: points});
    expect(result.observation).toMatchObject({exercise: null, visible: false});
    expect(result.reason).toBe('landmarks-unavailable');
  });
  it('landmarks kurang dari 33 tidak menghasilkan pose', () => {
    const result = create('squat').process({timestampMs: 0, landmarks: []});
    expect(result.observation.visible).toBe(false);
  });
  it('koordinat NaN/keluar frame tidak dihitung', () => {
    for (const x of [NaN, Infinity, -1, 2]) {
      const points = pose('squat', 170); points[25].x = x;
      expect(create('squat').process({timestampMs: 0, landmarks: points}).observation.visible).toBe(false);
    }
  });
  it('sendi berimpit tidak memberi sudut palsu', () => {
    const points = pose('squat', 170); points[25] = {...points[23]};
    expect(create('squat').process({timestampMs: 0, landmarks: points}).observation.visible).toBe(false);
  });
  it('gap kamera lebih dari 1000 ms membuang siklus aktif', () => {
    const adapter = create('squat'); hold(adapter, 'squat', 170);
    expect(adapter.process({timestampMs: 1200, landmarks: pose('squat', 90)})).toMatchObject({
      observation: {exercise: null, visible: false}, reason: 'frame-gap',
    });
  });
  it('timestamp mundur ditolak', () => {
    const adapter = create('squat'); hold(adapter, 'squat', 170);
    expect(adapter.process({timestampMs: 100, landmarks: pose('squat', 90)}).reason).toBe('invalid-timestamp');
  });
  it('curl alternating/asimetris bukan bilateral', () => {
    const result = hold(create('dumbbell-curl'), 'dumbbell-curl', 55, 0, 170);
    expect(result.observation).toMatchObject({visible: false, bilateral: false});
    expect(result.reason).toBe('curl-not-bilateral');
  });
  it('badan tegak bukan profil push-up atau bench press', () => {
    for (const exercise of ['push-up', 'bench-press'] as const) {
      const result = create(exercise).process({timestampMs: 0, landmarks: pose('dumbbell-curl', 170)});
      expect(result.observation.visible).toBe(false);
      expect(result.reason).toBe('camera-position');
    }
  });
  it('arah tangan memisahkan profil push-up dan bench press', () => {
    expect(create('bench-press').process({timestampMs:0,landmarks:pose('push-up',170)}).observation.visible).toBe(false);
    expect(create('push-up').process({timestampMs:0,landmarks:pose('bench-press',90)}).observation.visible).toBe(false);
  });
  it('seated press menolak profil berdiri', () => {
    const result = create('machine-shoulder-press').process({timestampMs: 0, landmarks: pose('dumbbell-curl', 90)});
    expect(result.observation.visible).toBe(false);
  });
  it('siklus terputus tidak menambah rep saat pose pulih', () => {
    let now = 0;
    const workout = new WorkoutSession({clock: () => now, idFactory: () => 'set-1'});
    const adapter = create('squat');
    for (const [start, angle] of [[0,170],[180,90]]) {
      for (const offset of [0,60,120]) {
        now = start+offset;
        workout.observe(adapter.process({timestampMs: now, landmarks: pose('squat', angle)}).observation);
      }
    }
    now = 360; workout.observe(adapter.process({timestampMs: now, landmarks: []}).observation);
    for (const offset of [0,60,120]) {
      now = 420+offset;
      workout.observe(adapter.process({timestampMs: now, landmarks: pose('squat', 170)}).observation);
    }
    expect(workout.summary().totalReps).toBe(0);
  });
  it('siklus yang belum kembali ke pose awal tidak dihitung', () => {
    let now=0;
    const workout=new WorkoutSession({clock: () => now, idFactory: () => 'set-1'});
    const adapter=create('dumbbell-curl');
    for (const [start, degrees] of [[0,170],[180,55]]) {
      for (const offset of [0,60,120]) {
        now=start+offset;
        workout.observe(adapter.process({timestampMs: now, landmarks: pose('dumbbell-curl',degrees)}).observation);
      }
    }
    expect(workout.finish().totalReps).toBe(0);
  });
  it('pose diam tidak dihitung sebagai rep', () => {
    let now=0;
    const workout = new WorkoutSession({clock: () => now, idFactory: () => 'set-1'});
    const adapter=create('squat');
    for (let i=0; i<40; i++) {
      now=i*60;
      workout.observe(adapter.process({timestampMs: now, landmarks: pose('squat', 170)}).observation);
    }
    expect(workout.summary().totalReps).toBe(0);
  });
  it('konfigurasi smoothing/debounce tidak valid ditolak', () => {
    expect(() => create('squat', {smoothingAlpha: 0})).toThrow();
    expect(() => create('squat', {smoothingAlpha: 2})).toThrow();
    expect(() => create('squat', {stableFrames: 0})).toThrow();
    expect(() => create('squat', {stableMs: -1})).toThrow();
  });
});
