import type {CableExercise} from '../domain/exercises';
import type {Phase} from '../domain/workout';
import type {PoseFrame,PoseOptions,PoseResult,Landmark} from './pose-phase-adapter';
import {valid,angle} from './pose-geometry';

// Prototype thresholds on normalized 2D body geometry, not form scoring.
export class CablePoseAdapter{
 private timestamp:number|null=null;private smoothed:number[]|null=null;
 private candidate:Phase='moving';private since=0;private frames=0;
 constructor(private options:Required<Omit<PoseOptions,'exercise'>>&{exercise:CableExercise}){}
 process(frame:PoseFrame):PoseResult{
  const now=frame.timestampMs;
  if(!Number.isFinite(now)||now<0||this.timestamp!==null&&now<=this.timestamp)return this.invalid('invalid-timestamp');
  const gap=this.timestamp!==null&&now-this.timestamp>1000;this.timestamp=now;if(gap)return this.invalid('frame-gap');
  const ratio=frame.aspectRatio??1;if(!Number.isFinite(ratio)||ratio<=0)return this.invalid('invalid-aspect-ratio');
  const raw=frame.landmarks,{exercise}=this.options;
  if(raw.length!==33||[11,12,13,14,15,16,23,24,25,26,27,28].some(i=>!valid(raw[i]))||exercise==='face-pull'&&!valid(raw[0]))return this.invalid('landmarks-unavailable');
  const p=raw.map(v=>({...v,x:v.x*ratio}));
  const metrics:number[]=[],phases:Phase[]=[];
  for(const side of [0,1]){
   const s=p[11+side],e=p[13+side],w=p[15+side],h=p[23+side],k=p[25+side],a=p[27+side];
   const length=Math.hypot(s.x-h.x,s.y-h.y);
   if(length<.04||h.y<=s.y||Math.abs(h.x-s.x)>(h.y-s.y)*.65)return this.invalid('camera-position');
   const seated=exercise==='lat-pulldown'||exercise==='seated-cable-row';
   if(seated?Math.abs(k.y-h.y)>Math.abs(k.x-h.x)*.6||Math.abs(k.x-h.x)<length*.3
     :k.y-h.y<length*.35||a.y-k.y<length*.2)return this.invalid('camera-position');
   const elbow=angle(s,e,w),shoulder=angle(e,s,h);
   if(elbow===null||shoulder===null)return this.invalid('landmarks-unavailable');
   if(exercise==='straight-arm-pulldown'&&elbow<145)return this.invalid('cable-elbows-bent');
   const metric=exercise==='straight-arm-pulldown'?shoulder:elbow;metrics.push(metric);
   phases.push(this.endpoint(p,side,metric,length));
  }
  if(phases[0]!==phases[1]||Math.abs(metrics[0]-metrics[1])>35)return this.invalid('cable-not-bilateral');
  const alpha=this.options.smoothingAlpha;this.smoothed=this.smoothed?metrics.map((n,i)=>alpha*n+(1-alpha)*this.smoothed![i]):metrics;
  const smooth=(this.smoothed[0]+this.smoothed[1])/2;
  const geometric=this.metricPhase(smooth),phase=geometric===phases[0]?geometric:'moving';
  if(this.frames===0||phase!==this.candidate){this.candidate=phase;this.since=now;this.frames=1;}else this.frames++;
  const stable=this.frames>=this.options.stableFrames&&now-this.since>=this.options.stableMs;
  return {observation:{exercise,visible:true,phase:stable?phase:'moving',bilateral:true},reason:null};
 }
 private metricPhase(value:number):Phase{
  return this.options.exercise==='straight-arm-pulldown'?value>=70?'ready':value<=30?'peak':'moving'
   :value>=150?'ready':value<=110?'peak':'moving';
 }
 private endpoint(p:Landmark[],side:number,metric:number,length:number):Phase{
  const s=p[11+side],w=p[15+side],h=p[23+side],phase=this.metricPhase(metric),{exercise}=this.options;
  if(exercise==='lat-pulldown')return phase==='ready'&&w.y<s.y-.35*length?'ready'
   :phase==='peak'&&w.y>=s.y+.12*length&&w.y<=s.y+.6*length?'peak':'moving';
  if(exercise==='seated-cable-row')return phase==='ready'&&Math.abs(w.y-s.y)<=.35*length&&Math.abs(w.x-s.x)>=.65*length?'ready'
   :phase==='peak'&&w.y>=s.y+.2*length&&w.y<=h.y+.2*length&&Math.abs(w.x-s.x)<.65*length?'peak':'moving';
  if(exercise==='face-pull')return phase==='ready'&&Math.abs(w.y-s.y)<=.35*length&&Math.abs(w.x-s.x)>=.75*length?'ready'
   :phase==='peak'&&w.y<s.y-.2*length&&Math.hypot(w.x-p[0].x,w.y-p[0].y)<=.6*length?'peak':'moving';
  return phase==='ready'&&w.y<=s.y+.2*length?'ready'
   :phase==='peak'&&Math.hypot(w.x-h.x,w.y-h.y)<=.5*length?'peak':'moving';
 }
 private invalid(reason:string):PoseResult{
  this.smoothed=null;this.candidate='moving';this.frames=0;
  return {observation:{exercise:null,phase:'moving',visible:false,bilateral:false},reason};
 }
}
