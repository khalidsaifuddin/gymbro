import {useEffect,useRef,useState} from 'react';
import {RoutineStore,type Routine} from './routine-store';

export function useRoutines(){
 const store=useRef<RoutineStore|null>(null);
 const [routines,setRoutines]=useState<Routine[]>([]),[ready,setReady]=useState(false),[error,setError]=useState('');
 const reload=async()=>{const rows=await store.current!.list();setRoutines(rows);return rows;};
 useEffect(()=>{
  let active=true;store.current=new RoutineStore(globalThis.indexedDB);
  void store.current.list().then(rows=>{if(active)setRoutines(rows);}).catch(()=>{if(active)setError('Routine storage is unavailable in this browser.');})
   .finally(()=>{if(active)setReady(true);});
  return ()=>{active=false;void store.current?.close();};
 },[]);
 const save=async(routine:Routine)=>{const saved=await store.current!.save(routine,routine.revision);await reload();setError('');return saved;};
 const remove=async(routine:Routine)=>{await store.current!.remove(routine.id,routine.revision);await reload();setError('');};
 return {routines,ready,error,save,remove,reload};
}
