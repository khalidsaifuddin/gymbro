import { describe, expect, it } from 'vitest';
import { TemporalExerciseRecognizer } from './temporal-exercise-recognizer';
import { exercises, peakAngle, pose, readyAngle } from './fixtures/pose';

describe('pengenalan kandidat dari urutan gerakan', () => {
  it.each(exercises)('%s: satu siklus stabil memilih pola kandidat', exercise => {
    const recognizer=new TemporalExerciseRecognizer({smoothingAlpha:1});
    let result;
    for (const [start,degrees] of [[0,readyAngle(exercise)],[180,peakAngle(exercise)],[360,readyAngle(exercise)]]) {
      for (const offset of [0,60,120]) result=recognizer.process({timestampMs:start+offset,landmarks:pose(exercise,degrees)});
    }
    expect(result!.observation).toMatchObject({exercise,phase:'ready',visible:true});
  });
  it('pose berdiri diam tidak dipaksa diberi label squat/curl', () => {
    const recognizer=new TemporalExerciseRecognizer({smoothingAlpha:1});
    for (let i=0;i<20;i++) {
      const result=recognizer.process({timestampMs:i*60,landmarks:pose('squat',170)});
      expect(result.observation.exercise).toBeNull();
      expect(result.reason).toBe('exercise-unknown');
    }
  });
  it('gerakan tanpa titik tubuh tetap unknown', () => {
    const result=new TemporalExerciseRecognizer().process({timestampMs:0,landmarks:[]});
    expect(result.observation.visible).toBe(false);
    expect(result.reason).toBe('landmarks-unavailable');
  });
  it('mode manual dapat dipilih sebelum siklus otomatis terbukti', () => {
    const recognizer=new TemporalExerciseRecognizer({smoothingAlpha:1,stableFrames:1,stableMs:0});
    recognizer.selectManual('dumbbell-curl');
    expect(recognizer.process({timestampMs:0,landmarks:pose('dumbbell-curl',170)}).observation)
      .toMatchObject({exercise:'dumbbell-curl',phase:'ready',visible:true});
  });
  it('pemilihan manual tetap menghentikan tracking saat sendi hilang', () => {
    const recognizer=new TemporalExerciseRecognizer(); recognizer.selectManual('squat');
    expect(recognizer.process({timestampMs:0,landmarks:[]}).observation.visible).toBe(false);
  });
  it('kembali ke otomatis membuang siklus parsial dari profil manual', () => {
    const recognizer=new TemporalExerciseRecognizer({smoothingAlpha:1,stableFrames:1,stableMs:0});
    recognizer.selectManual('dumbbell-curl');
    recognizer.process({timestampMs:0,landmarks:pose('dumbbell-curl',170)});
    recognizer.process({timestampMs:60,landmarks:pose('dumbbell-curl',55)});
    recognizer.selectManual(null);
    expect(recognizer.process({timestampMs:120,landmarks:pose('dumbbell-curl',170)}).observation.exercise).toBeNull();
  });
});
