import {useEffect,useState} from 'react';
import type {ExerciseAnimation} from '../domain/exercise-media';

function useReducedMotion(){
 const [reduced,setReduced]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(query.matches);query.addEventListener?.('change',change);return()=>query.removeEventListener?.('change',change);},[]);
 return reduced;
}

export default function ExerciseMedia({animation,label}:{animation:ExerciseAnimation|null;label:string}){
 const reduced=useReducedMotion(),[playing,setPlaying]=useState(true),[position,setPosition]=useState(0),[failed,setFailed]=useState(false);
 useEffect(()=>{const hide=()=>{if(document.hidden){setPlaying(false);setPosition(0);}};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 useEffect(()=>{
  if(!animation||!playing||reduced)return;
  const timer=window.setInterval(()=>setPosition(index=>(index+1)%animation.sequence.length),animation.frameDurationMs);
  return()=>window.clearInterval(timer);
 },[animation,playing,reduced]);
 useEffect(()=>{
  if(!animation||!playing)return;
  const preload=animation.frames.map(frame=>{const image=new Image();image.src=frame.path;return image;});
  return()=>{for(const image of preload)image.src='';};
 },[animation,playing]);
 if(!animation)return <section className="gymbro-exercise-media" aria-label={`${label} illustration`}>
  <p className="saka-prose">No movement illustration is available for this exercise.</p>
 </section>;
 const frameIndex=reduced?0:animation.sequence[position]??0;
 const frame=animation.frames[frameIndex];
 return <section className="gymbro-exercise-media" aria-label={`${label} movement illustration`}>
  <div className="gymbro-exercise-media-stage" data-testid="exercise-media-stage">
   {playing&&!failed&&<img src={frame.path} alt={`${label} movement illustration`} onError={()=>{setFailed(true);setPlaying(false);}}/>}
   {failed&&<p role="status">Illustration unavailable. The exercise details are still available.</p>}
   {!playing&&<p className="saka-prose">Start the illustration when you are ready.</p>}
  </div>
  <div className="saka-cluster">{!playing?<button className="saka-btn saka-btn--sm" onClick={()=>{setFailed(false);setPlaying(true);}}>Play animation</button>:<button className="saka-btn saka-btn--sm" onClick={()=>{setPlaying(false);setPosition(0);}}>Stop animation</button>}
   <span className="saka-kicker">Illustrative movement · CC0-1.0 artwork, rights to the extent held</span></div>
  <small>Source: Flow Exercise Dataset. Provenance is incomplete; illustrations are not professionally verified coaching and may not show precise form.</small>
  {reduced&&playing&&<small>Reduced motion is enabled; showing the first frame only.</small>}
 </section>;
}
