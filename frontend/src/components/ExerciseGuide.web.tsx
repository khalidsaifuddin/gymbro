import {useState} from 'react';
import type {ExerciseId} from '../domain/workout';
import {exerciseLabels} from '../detection/camera-guides';
export default function ExerciseGuide({exercise}:{exercise:ExerciseId}) {
 const [animated,setAnimated]=useState(()=>!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 return <div style={{background:'#edf5ff',borderRadius:12,padding:12}}>
  <object data-testid="exercise-animation" aria-label={`Panduan ${exerciseLabels[exercise]}`} type="image/svg+xml" data={`/exercises/${exercise}${animated?'':'-poses'}.svg`} style={{width:'100%',height:animated?240:200}}/>
  <button onClick={()=>setAnimated(!animated)}>{animated?'Lihat pose awal dan akhir':'Lihat animasi gerakan'}</button>
  <p style={{fontSize:12}}>Ilustrasi: Gymbro contributors · <a href="/exercises/LICENSE.txt">Lisensi aset CC-BY-4.0</a>. Panduan ini membantu penempatan kamera.</p>
 </div>;
}
