import {useEffect,useRef,useState} from 'react';
import {WorkoutSession} from '../domain/workout';
import {WorkoutStore,type LocalWorkout,type WorkoutPreferences} from './workout-store';

export const defaultPreferences=():WorkoutPreferences=>({profile:'auto',restSeconds:{},manualExercise:'squat',manualReps:'10',manualLoad:''});
export function useLocalWorkout() {
 const workout=useRef<WorkoutSession|null>(null),preferences=useRef(defaultPreferences());
 const store=useRef<WorkoutStore|null>(null),record=useRef<{id:string;revision:number}|null>(null);
 const queue=useRef(Promise.resolve()),fingerprint=useRef(''),blocked=useRef(false),generation=useRef(0),checkpointAt=useRef(0);
 const [ready,setReady]=useState(false),[saveStatus,setSaveStatus]=useState('Membuka penyimpanan lokal…');
 const [history,setHistory]=useState<LocalWorkout[]>([]),[recovery,setRecovery]=useState<LocalWorkout|null>(null);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let mounted=true;store.current=new WorkoutStore(globalThis.indexedDB);
  void store.current.list().then(rows=>{if(mounted){setHistory(rows.filter(r=>r.snapshot.finishedAt!==null));setRecovery(rows.find(r=>r.snapshot.finishedAt===null)??null);setSaveStatus('Belum ada perubahan');}})
   .catch(()=>{if(mounted){blocked.current=true;setSaveStatus('Penyimpanan lokal tidak tersedia. Hasil hanya ada di memori; ekspor sebelum menutup halaman.');}})
   .finally(()=>{if(mounted)setReady(true);});
  return ()=>{mounted=false;};
 },[]);
 const getWorkout=()=>{
  if(!workout.current){workout.current=new WorkoutSession({clock:Date.now,idFactory:()=>crypto.randomUUID()});record.current={id:crypto.randomUUID(),revision:0};}
  return workout.current;
 };
 const refresh=(checkpoint=false)=>{
  setVersion(v=>v+1);
  if(!workout.current||!record.current||blocked.current)return;
  const snapshot=workout.current.exportSnapshot(),prefs=structuredClone(preferences.current),target=record.current;
  const next=JSON.stringify({snapshot:{...snapshot,savedAt:0},preferences:prefs});
  if(next===fingerprint.current&&(!checkpoint||workout.current.isPaused()||workout.current.isFinished()||snapshot.savedAt-checkpointAt.current<5000))return;
  checkpointAt.current=snapshot.savedAt;
  fingerprint.current=next;setSaveStatus('Menyimpan…');const sequence=++generation.current;
  queue.current=queue.current.then(async()=>{
   if(blocked.current)return;
   try {
    const saved=await store.current!.save({id:target.id,revision:target.revision,snapshot,preferences:prefs},target.revision);
    target.revision=saved.revision;if(sequence===generation.current)setSaveStatus('Tersimpan di perangkat');
    if(snapshot.finishedAt!==null){const rows=await store.current!.list();setHistory(rows.filter(r=>r.snapshot.finishedAt!==null));}
   }catch(error){
    blocked.current=true;
    setSaveStatus(error instanceof Error&&/conflict/i.test(error.message)
     ?'Konflik lokal: sesi telah diubah di tab lain. Hasil tab ini belum tersimpan.'
     :'Penyimpanan gagal. Hasil hanya ada di memori; ekspor sebelum menutup halaman.');
   }
  });
 };
 const open=(value:LocalWorkout)=>{
  workout.current=WorkoutSession.restore(value.snapshot,{clock:Date.now,idFactory:()=>crypto.randomUUID()});
  preferences.current=structuredClone(value.preferences);record.current={id:value.id,revision:value.revision};
  setRecovery(null);fingerprint.current='';blocked.current=false;refresh();
 };
 const newWorkout=()=>{workout.current=null;record.current=null;preferences.current=defaultPreferences();fingerprint.current='';setVersion(v=>v+1);setSaveStatus('Belum ada perubahan');};
 const exportResults=()=>{
  if(!workout.current)return;
  const blob=new Blob([JSON.stringify({snapshot:workout.current.exportSnapshot(),preferences:preferences.current},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gymbro-workout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return {workout,preferences,getWorkout,refresh,ready,saveStatus,history,recovery,open,newWorkout,exportResults,version};
}
