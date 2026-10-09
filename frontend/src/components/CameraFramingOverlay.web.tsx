import type {SupportedExerciseId} from '../domain/exercises';
import type {CameraView} from '../domain/camera-view';
import type {PoseFrame} from '../detection/pose-phase-adapter';
import {assessFraming,poseOverlayViewBox} from '../detection/camera-framing';

type Props={frame:PoseFrame|null;exercise:SupportedExerciseId|null;cameraView:CameraView;videoAspectRatio:number};

export default function CameraFramingOverlay({frame,exercise,cameraView,videoAspectRatio}:Props){
  const framing=assessFraming(frame,exercise,cameraView);
  const {width,height}=poseOverlayViewBox(videoAspectRatio);
  const guide=framing.guide==='upper'?{x:.17,y:.08,w:.66,h:.76}
    :framing.guide==='horizontal'?{x:.06,y:.24,w:.88,h:.64}
    :{x:.11,y:.05,w:.78,h:.90};
  const color=framing.state==='framed'?'var(--saka-success, #5cf2a9)':'var(--saka-accent-bright, #ff5a1f)';
  const joints=new Map(framing.joints.map(joint=>[joint.index,joint]));
  return <>
    <svg data-testid="camera-framing-overlay" aria-hidden="true" viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
      <rect x={guide.x*width} y={guide.y*height} width={guide.w*width} height={guide.h*height}
        rx="18" fill="rgba(5,5,5,0.04)" stroke={color} strokeWidth="2.5" strokeDasharray="10 8"
        vectorEffect="non-scaling-stroke"/>
      {framing.segments.map(([from,to])=>{
        const a=joints.get(from)!,b=joints.get(to)!;
        return <line key={`${from}-${to}`} x1={a.x*width} y1={a.y*height} x2={b.x*width} y2={b.y*height}
          stroke="var(--saka-accent-bright, #ff5a1f)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>;
      })}
      {framing.joints.map(joint=><circle key={joint.index} data-joint-index={joint.index}
        cx={joint.x*width} cy={joint.y*height} r="9" fill="var(--saka-accent-bright, #ff5a1f)" stroke="#050505" strokeWidth="2"/>)}
    </svg>
    <div data-testid="camera-framing-status" role="status" aria-live="polite"
      style={{position:'absolute',left:10,right:10,bottom:10,padding:'8px 12px',borderRadius:9,
        background:'rgba(5,5,5,.88)',color:'var(--saka-accent-bright, #ff5a1f)',
        border:'1px solid var(--saka-accent-dim, #7a2c12)',font:'700 12px/1.35 ui-monospace,monospace',
        textAlign:'center',pointerEvents:'none'}}>{framing.message}</div>
  </>;
}
