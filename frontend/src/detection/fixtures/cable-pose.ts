import type {CableExercise} from '../../domain/exercises';
import type {Landmark} from '../pose-phase-adapter';
// Geometric fixtures only, not labelled real video or perspective accuracy.
export function cablePose(exercise:CableExercise,peak=false):Landmark[]{
 const points:Landmark[]=Array.from({length:33},()=>({x:.5,y:.5,visibility:1,presence:1}));
 points[0]={x:.41,y:.16,visibility:1,presence:1};
 const seated=exercise==='lat-pulldown'||exercise==='seated-cable-row';
 for(const side of [0,1]){
  const x=.36+side*.1,shift=side*.01;
  const p=(dx:number,y:number)=>({x:x+dx,y:y+shift,visibility:1,presence:1});
  points[11+side]=p(0,.32);points[23+side]=p(0,.6);
  points[25+side]=p(seated?.18:0,seated?.6:.76);points[27+side]=p(seated?.18:0,.92);
  if(exercise==='lat-pulldown'){points[13+side]=p(peak?.02:-.015,peak?.48:.21);points[15+side]=p(peak?.14:0,peak?.40:.09);}
  if(exercise==='seated-cable-row'){points[13+side]=p(peak?-.07:.16,peak?.47:.32);points[15+side]=p(peak?.08:.33,peak?.47:.32);}
  if(exercise==='face-pull'){points[13+side]=p(.16,peak?.33:.32);points[15+side]=p(peak?.03:.33,peak?.17:.32);}
  if(exercise==='straight-arm-pulldown'){points[13+side]=p(peak?.02:.12,peak?.46:.24);points[15+side]=p(peak?.04:.25,peak?.60:.16);}
 }
 return points;
}
