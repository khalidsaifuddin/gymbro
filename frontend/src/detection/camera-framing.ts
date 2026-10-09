import type {SupportedExerciseId} from '../domain/exercises';
import {allowsSingleSideForExercise,type CameraView} from '../domain/camera-view';
import {isCableExercise} from '../domain/exercises';
import type {PoseFrame} from './pose-phase-adapter';
import {valid} from './pose-geometry';

export type FramingState='searching'|'adjust'|'framed';
export type FramingGuide='upper'|'full'|'horizontal';
export type FramingJoint={index:number;x:number;y:number};
export type FramingSegment=readonly [number,number];
export type FramingAssessment={
  state:FramingState;
  guide:FramingGuide;
  message:string;
  joints:FramingJoint[];
  segments:FramingSegment[];
};

const drawn=[0,11,12,13,14,15,16,23,24,25,26,27,28] as const;
const connections:FramingSegment[]=[
  [0,11],[0,12],[11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],
];
type JointGroup={base:number;single:string;both:string};
const groups={
  shoulder:{base:11,single:'bahu',both:'kedua bahu'},
  elbow:{base:13,single:'siku',both:'kedua siku'},
  wrist:{base:15,single:'pergelangan tangan',both:'kedua pergelangan tangan'},
  hip:{base:23,single:'pinggul',both:'kedua pinggul'},
  knee:{base:25,single:'lutut',both:'kedua lutut'},
  ankle:{base:27,single:'pergelangan kaki',both:'kedua pergelangan kaki'},
} as const satisfies Record<string,JointGroup>;
type GroupName=keyof typeof groups;
const upright:GroupName[]=['shoulder','hip','knee','ankle'];
const upper:GroupName[]=['shoulder','elbow','wrist','hip'];
const all:GroupName[]=['shoulder','elbow','wrist','hip','knee','ankle'];

function guideFor(exercise:SupportedExerciseId|null):FramingGuide{
  if(exercise==='dumbbell-curl')return 'upper';
  if(exercise==='push-up'||exercise==='bench-press')return 'horizontal';
  return 'full';
}
function groupsFor(exercise:SupportedExerciseId|null):GroupName[]{
  if(exercise==='squat'||exercise===null)return upright;
  if(exercise==='dumbbell-curl'||exercise==='push-up'||exercise==='bench-press')return upper;
  return all;
}
function searching(guide:FramingGuide):FramingAssessment{
  return {state:'searching',guide,message:'Masuk ke bingkai agar sendi terlihat.',joints:[],segments:[]};
}
export function poseOverlayViewBox(aspectRatio:number):{width:number;height:number}{
  const safe=Number.isFinite(aspectRatio)&&aspectRatio>0?aspectRatio:16/9;
  return {width:1000,height:1000/safe};
}

export function assessFraming(frame:PoseFrame|null,exercise:SupportedExerciseId|null,view:CameraView):FramingAssessment{
  const guide=guideFor(exercise);
  if(!frame||frame.landmarks.length!==33)return searching(guide);
  const landmarks=frame.landmarks;
  const visible=new Set<number>(drawn.filter(index=>valid(landmarks[index])));
  const joints=drawn.filter(index=>visible.has(index)).map(index=>({index,x:landmarks[index].x,y:landmarks[index].y}));
  const segments=connections.filter(([start,end])=>visible.has(start)&&visible.has(end));
  const base={guide,joints,segments};
  const needed=groupsFor(exercise);
  const single=exercise!==null&&allowsSingleSideForExercise(exercise,view);
  const score=(side:0|1)=>needed.filter(name=>valid(landmarks[groups[name].base+side])).length;
  const side:0|1=score(1)>score(0)?1:0;
  const sides:readonly (0|1)[]=single?[side]:[0,1];
  if(exercise==='face-pull'&&!valid(landmarks[0]))return {state:'adjust',message:'Pastikan wajah terlihat.',...base};
  for(const name of needed){
    const group=groups[name];
    if(sides.some(side=>!valid(landmarks[group.base+side]))){
      return {state:'adjust',message:`Pastikan ${single?group.single:group.both} terlihat.`,...base};
    }
  }
  const required=needed.flatMap(name=>sides.map(side=>landmarks[groups[name].base+side]));
  if(exercise==='face-pull')required.push(landmarks[0]);
  const xs=required.map(point=>point.x),ys=required.map(point=>point.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  if((left+right)/2<.28||(left+right)/2>.72)return {state:'adjust',message:'Geser tubuh ke tengah bingkai.',...base};
  if(left<.04||right>.96||top<.04||bottom>.96)return {state:'adjust',message:'Mundur sedikit agar semua sendi masuk bingkai.',...base};
  const span=guide==='horizontal'?right-left:bottom-top;
  const minimum=guide==='upper'?.18:guide==='horizontal'?.30:.30;
  if(span<minimum)return {state:'adjust',message:'Mendekat sedikit agar sendi lebih jelas.',...base};
  return {state:'framed',message:'Sendi terlihat. Pertahankan posisi kamera.',...base};
}
