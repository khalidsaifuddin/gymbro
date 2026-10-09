import type { ExerciseId, Observation, Phase } from '../domain/workout';
import {allowsSingleSide,isCameraView,type CameraView} from '../domain/camera-view';
import {isCableExercise} from '../domain/exercises';
import {CablePoseAdapter} from './cable-pose-adapter';
import {valid,angle} from './pose-geometry';

export type Landmark = { x: number; y: number; visibility?: number; presence?: number };
export type PoseFrame = {
  timestampMs: number;
  landmarks: readonly Landmark[];
  // videoWidth / videoHeight; default 1 hanya untuk fixture/perangkat persegi.
  aspectRatio?: number;
};
export type PoseResult = { observation: Observation; reason: string | null };
export type PoseOptions = {
  exercise: ExerciseId;
  cameraView?: CameraView;
  smoothingAlpha?: number;
  stableFrames?: number;
  stableMs?: number;
};

// Profil dipilih pengguna; ini belum classifier jenis latihan otomatis.
export class PosePhaseAdapter {
  private readonly options: Required<PoseOptions>;
  private timestamp: number | null = null;
  private smoothed: [number, number] | null = null;
  private candidate: Phase = 'moving';
  private candidateAt = 0;
  private frames = 0;
  private selectedSide: 0|1|null = null;
  private cable: CablePoseAdapter|null=null;

  constructor(options: PoseOptions) {
    this.options = {smoothingAlpha: .5, stableFrames: 3, stableMs: 120, cameraView:'auto', ...options};
    const {smoothingAlpha, stableFrames, stableMs} = this.options;
    if (!isCameraView(this.options.cameraView) || !Number.isFinite(smoothingAlpha) || smoothingAlpha <= 0 || smoothingAlpha > 1 ||
        !Number.isSafeInteger(stableFrames) || stableFrames < 1 || !Number.isFinite(stableMs) || stableMs < 0) {
      throw new Error('Invalid pose smoothing/debounce configuration');
    }
    if(isCableExercise(options.exercise))this.cable=new CablePoseAdapter({...this.options,exercise:options.exercise});
  }

  process(frame: PoseFrame): PoseResult {
    if(this.cable)return this.cable.process(frame);
    const now = frame.timestampMs;
    if (!Number.isFinite(now) || now < 0 || (this.timestamp !== null && now <= this.timestamp)) {
      return this.invalid('invalid-timestamp');
    }
    const gap = this.timestamp !== null && now - this.timestamp > 1000;
    this.timestamp = now;
    if (gap) return this.invalid('frame-gap');
    const aspectRatio = frame.aspectRatio ?? 1;
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return this.invalid('invalid-aspect-ratio');
    const {exercise} = this.options;
    const isSquat = exercise === 'squat';
    const required = isSquat ? [11,23,25,27]
      : exercise === 'machine-shoulder-press' ? [11,13,15,23,25,27]
      : [11,13,15,23];
    const raw = frame.landmarks;
    const eligible=([0,1] as const).filter(side=>required.every(index=>valid(raw[index+side])));
    const single=allowsSingleSide(this.options.cameraView)&&exercise!=='dumbbell-curl';
    if (raw.length !== 33 || (single ? eligible.length===0 : eligible.length!==2)) {
      return this.invalid('landmarks-unavailable');
    }
    let sides:readonly (0|1)[]=[0,1];
    if(single){
      if(this.selectedSide!==null&&!eligible.includes(this.selectedSide)){
        this.selectedSide=eligible[0];
        // Do not combine the previous limb's partial cycle with another limb.
        return this.invalid('visible-side-changed');
      }
      if(this.selectedSide===null){
        const confidence=(side:0|1)=>Math.min(...required.map(index=>Math.min(raw[index+side].visibility!,raw[index+side].presence??1)));
        this.selectedSide=eligible.reduce((best,side)=>confidence(side)>confidence(best)?side:best);
      }
      sides=[this.selectedSide];
    }
    const points = raw.map(point => ({...point, x: point.x*aspectRatio}));
    const horizontal = exercise === 'push-up' || exercise === 'bench-press';
    if (sides.some(side => {
      const shoulder = points[11+side], hip = points[23+side];
      const dx = Math.abs(hip.x-shoulder.x), dy = Math.abs(hip.y-shoulder.y);
      return Math.hypot(dx,dy) < .04 || (horizontal ? dy > dx*.6 : dx > dy*.6);
    })) return this.invalid('camera-position');
    if (horizontal && sides.some(side => {
      const torsoY=(points[11+side].y+points[23+side].y)/2;
      return exercise === 'bench-press' ? points[15+side].y >= torsoY-.01 : points[15+side].y <= torsoY+.01;
    })) return this.invalid('camera-position');
    if (exercise === 'machine-shoulder-press' && sides.some(side => points[15+side].y>points[11+side].y+.1*Math.hypot(points[23+side].x-points[11+side].x,points[23+side].y-points[11+side].y))) return this.invalid('camera-position');
    if (exercise === 'machine-shoulder-press' && sides.some(side => {
      const hip = points[23+side], knee = points[25+side];
      return Math.abs(knee.y-hip.y) > Math.abs(knee.x-hip.x)*.6;
    })) return this.invalid('camera-position');
    if (exercise === 'dumbbell-curl' && sides.some(side => points[13+side].y <= points[11+side].y)) {
      return this.invalid('camera-position');
    }
    const angles = sides.map(side => isSquat
      ? angle(points[23+side],points[25+side],points[27+side])
      : angle(points[11+side],points[13+side],points[15+side]));
    if (angles.some(value => value === null)) return this.invalid('landmarks-unavailable');
    const values: [number,number] = [angles[0]!,angles[1]??angles[0]!];
    if (exercise === 'dumbbell-curl' && (Math.abs(values[0]-values[1]) > 30 ||
        this.phase(values[0]) !== this.phase(values[1]))) {
      return this.invalid('curl-not-bilateral', false);
    }
    const alpha = this.options.smoothingAlpha;
    this.smoothed = this.smoothed
      ? [alpha*values[0]+(1-alpha)*this.smoothed[0], alpha*values[1]+(1-alpha)*this.smoothed[1]]
      : values;
    const phase = this.phase((this.smoothed[0]+this.smoothed[1])/2);
    if (phase !== this.candidate || this.frames === 0) {
      this.candidate = phase; this.candidateAt = now; this.frames = 1;
    } else this.frames++;
    const stable = this.frames >= this.options.stableFrames && now-this.candidateAt >= this.options.stableMs;
    return {observation: {exercise, phase: stable ? phase : 'moving', visible: true,
      ...(exercise === 'dumbbell-curl' ? {bilateral: true} : {})}, reason: null};
  }

  private phase(degrees: number): Phase {
    const {exercise} = this.options;
    if (exercise === 'machine-shoulder-press' || exercise === 'bench-press') {
      return degrees <= 105 ? 'ready' : degrees >= 155 ? 'peak' : 'moving';
    }
    const ready = exercise === 'dumbbell-curl' ? 150 : 155;
    const peak = exercise === 'dumbbell-curl' ? 65 : exercise === 'push-up' ? 100 : 105;
    return degrees >= ready ? 'ready' : degrees <= peak ? 'peak' : 'moving';
  }

  private invalid(reason: string, bilateral?: boolean): PoseResult {
    this.smoothed = null; this.candidate = 'moving'; this.frames = 0;
    return {observation: {exercise: null, phase: 'moving', visible: false,
      ...(bilateral === undefined ? {} : {bilateral})}, reason};
  }
}
