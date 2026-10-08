import {useEffect,useRef,useState} from 'react';
import {SyncStore,type Job} from './sync-store';
import type {Outcome,WorkoutDTO} from './mapper';
export type AccountUser={id:string;name:string};
const readCached=():AccountUser|null=>{try{const u=JSON.parse(localStorage.getItem('gymbro-current-account')??'null');return u&&typeof u.id==='string'&&typeof u.name==='string'?{id:u.id,name:u.name}:null;}catch{return null;}};
export function useAccount(){
 const store=useRef(new SyncStore(globalThis.indexedDB)),userRef=useRef<AccountUser|null>(readCached()),csrf=useRef(''),busy=useRef(false),alive=useRef(true);
 const [user,setUser]=useState(userRef.current),[ready,setReady]=useState(false),[configured,setConfigured]=useState(false),[status,setStatus]=useState('Memeriksa akun…');
 const [guests,setGuests]=useState(0),[conflicts,setConflicts]=useState<Job[]>([]),[working,setWorking]=useState(false);
 const updateUser=(next:AccountUser|null)=>{userRef.current=next;if(alive.current)setUser(next);try{if(next)localStorage.setItem('gymbro-current-account',JSON.stringify(next));else localStorage.removeItem('gymbro-current-account');}catch{}};
 const identify=async()=>{
  const response=await fetch('/api/v1/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401||response.status===404){csrf.current='';updateUser(null);return null;}
  if(!response.ok)throw new Error('Account unavailable');const data=await response.json();csrf.current=data.csrf;updateUser(data.user);return data.user as AccountUser;
 };
 const refresh=async()=>{
  try{const [records,bindings]=await Promise.all([store.current.list(),store.current.bindings()]);if(!alive.current)return;setGuests(records.filter(r=>r.snapshot.finishedAt!==null&&!bindings.some(b=>b.workoutId===r.id)).length);setConflicts(userRef.current?(await store.current.jobs(userRef.current.id)).filter(j=>j.status==='conflict'):[]);}catch{if(alive.current)setStatus('Penyimpanan sinkronisasi tidak tersedia');}
 };
 const flush=async()=>{
  if(busy.current||!userRef.current)return;
  busy.current=true;if(alive.current)setWorking(true);const expected=userRef.current.id;
  try{
   if(!navigator.onLine)throw new Error('offline');const current=await identify();if(!current||current.id!==expected){setStatus('Akun berubah; antrean akun lama tetap disimpan');return;}
   for(let n=0;n<30;n++){
    const job=await store.current.claim(expected);if(!job)break;
    setStatus('Menyinkronkan hasil…');
    const response=await fetch('/api/v1/workout-mutations',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.current},body:JSON.stringify(job.envelope)});
    if(response.status===401){await identify();throw new Error('login');}
    if(response.status===410){await store.current.markConflict(job,null);continue;}
    const data=await response.json();
    if(response.status===409&&data.error==='revision_conflict'){await store.current.markConflict(job,data.server as WorkoutDTO);continue;}
    if(!response.ok)throw new Error(data.error??'sync');
    await store.current.acknowledge(job,data as Outcome);
   }
   const remaining=await store.current.jobs(expected);setStatus(remaining.some(j=>j.status==='conflict')?'Konflik: pilih hasil lokal atau server':remaining.length?'Sinkronisasi masih tertunda':'Sinkronisasi selesai');
  }catch(error){if(alive.current)setStatus(!navigator.onLine?'Tersimpan lokal; menunggu koneksi':error instanceof Error&&error.message==='login'?'Login diperlukan; antrean tetap disimpan':'Sinkronisasi tertunda; hasil tetap tersimpan lokal');}
  finally{busy.current=false;if(alive.current)setWorking(false);await refresh();}
 };
 useEffect(()=>{
  alive.current=true;
  void (async()=>{try{const capabilities=await fetch('/api/v1/auth/capabilities',{cache:'no-store'});if(capabilities.ok)setConfigured((await capabilities.json()).google_configured);await identify();setStatus(userRef.current?'Akun tersambung':'Mode tamu');}catch{setStatus(userRef.current?'Akun tersimpan di perangkat; koneksi terputus':'Mode tamu');}finally{setReady(true);await refresh();void flush();}})();
  const changed=()=>{void refresh();void flush();},online=()=>{void flush();};document.addEventListener('gymbro-storage-changed',changed);window.addEventListener('online',online);const timer=setInterval(()=>{if(userRef.current)void flush();},10000);
  return()=>{alive.current=false;clearInterval(timer);document.removeEventListener('gymbro-storage-changed',changed);window.removeEventListener('online',online);};
 },[]);
 const importGuests=async()=>{const current=userRef.current;if(!current)return;const bindings=await store.current.bindings();for(const record of await store.current.list())if(record.snapshot.finishedAt!==null&&!bindings.some(b=>b.workoutId===record.id))await store.current.enqueue(record,current.id,true);await flush();};
 const pull=async()=>{await flush();const current=userRef.current;if(!current)return;const baseline=Object.fromEntries((await store.current.bindings()).filter(b=>b.ownerId===current.id).map(b=>[b.workoutId,b.serverRevision]));const response=await fetch('/api/v1/workouts',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Riwayat belum dapat dimuat');await store.current.receive(current.id,await response.json(),baseline);await refresh();};
 const transition=async(action:()=>Promise<void>)=>{if(busy.current)throw new Error('Tunggu sinkronisasi selesai');busy.current=true;setWorking(true);try{await action();}finally{busy.current=false;setWorking(false);}};
 const logout=async()=>transition(async()=>{const response=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf.current}});if(!response.ok)throw new Error('Logout gagal');csrf.current='';updateUser(null);setStatus('Mode tamu');await refresh();document.dispatchEvent(new Event('gymbro-storage-changed'));});
 const deleteAccount=async()=>transition(async()=>{const current=userRef.current;if(!current)return;const response=await fetch('/api/v1/account',{method:'DELETE',credentials:'same-origin',headers:{'X-CSRF-Token':csrf.current}});if(!response.ok)throw new Error('Penghapusan akun gagal');await store.current.removeAccount(current.id);csrf.current='';updateUser(null);setStatus('Akun dihapus; workout tamu tetap ada');await refresh();});
 const resolve=async(job:Job,choice:'local'|'server')=>{if(!userRef.current||busy.current)return;await store.current.resolve(userRef.current.id,job.envelope.workout_id,choice);await flush();};
 return {user,ready,configured,status,guests,conflicts,working,store:store.current,flush,importGuests,pull,logout,deleteAccount,resolve,refresh};
}
