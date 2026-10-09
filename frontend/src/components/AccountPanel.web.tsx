import {useState} from 'react';
import type {useAccount} from '../sync/use-account.web';
export default function AccountPanel({account,disabled,onReset,beforeAction}:{account:ReturnType<typeof useAccount>;disabled:boolean;onReset:()=>void;beforeAction:()=>Promise<void>}){
 const [confirmDelete,setConfirmDelete]=useState(false),[error,setError]=useState('');
 const run=async(action:()=>Promise<unknown>,reset=false)=>{setError('');try{await beforeAction();await action();if(reset)onReset();}catch(e){setError(e instanceof Error?e.message:'Operasi gagal');}};
 const busy=disabled||account.working;
 return <section aria-label="Akun dan sinkronisasi" className="saka-card is-vertical gymbro-account">
  <strong>{account.user?`Akun: ${account.user.name}`:'Workout tamu · disimpan di perangkat'}</strong>
  <span role="status" className="saka-prose">{account.status}</span>
  {!account.user&&(account.configured?<a className="saka-btn is-filled" href="/api/v1/auth/google/start" aria-disabled={busy} onClick={e=>{if(busy)e.preventDefault();}}>Masuk dengan Google</a>:<span className="saka-prose">Login Google tersedia setelah OAuth dikonfigurasi. Workout tamu tetap bisa digunakan.</span>)}
  {account.user&&<>
   {account.guests>0&&<><span className="saka-prose">{account.guests} workout tamu belum diimpor</span><button className="saka-btn" disabled={busy} onClick={()=>void run(account.importGuests)}>Impor workout tamu</button></>}
   <button className="saka-btn" disabled={busy} onClick={()=>void run(account.pull)}>Muat riwayat akun</button>
   <button className="saka-btn" disabled={account.working} onClick={()=>void run(account.flush)}>Sinkronkan sekarang</button>
   {account.conflicts.map(job=><div key={job.mutationId} className="gymbro-account-conflict"><span>Konflik workout {job.envelope.workout_id.slice(0,8)} · lokal {job.envelope.workout?.exercises.reduce((n,e)=>n+e.sets.reduce((m,s)=>m+s.reps,0),0)??'hapus'} reps · server {job.server?.exercises.reduce((n,e)=>n+e.sets.reduce((m,s)=>m+s.reps,0),0)??'dihapus'} reps</span>
    {job.server&&<button className="saka-btn" disabled={busy} onClick={()=>void run(()=>account.resolve(job,'local'),true)}>Gunakan hasil lokal</button>}
    <button className="saka-btn" disabled={busy} onClick={()=>void run(()=>account.resolve(job,'server'),true)}>{job.server?'Gunakan hasil server':'Hapus salinan lokal'}</button></div>)}
   <button className="saka-btn" disabled={busy} onClick={()=>void run(account.logout,true)}>Keluar akun</button>
   {!confirmDelete?<button className="saka-btn saka-btn--danger" disabled={busy} onClick={()=>setConfirmDelete(true)}>Hapus akun</button>:<><span className="saka-prose">Hapus akun, riwayat server, dan salinan lokal akun ini? Workout tamu tetap ada.</span><button className="saka-btn saka-btn--danger" disabled={busy} onClick={()=>void run(account.deleteAccount,true)}>Konfirmasi hapus akun</button><button className="saka-btn" onClick={()=>setConfirmDelete(false)}>Batal</button></>}
  </>}
  {error&&<span role="alert" className="saka-alert is-danger">{error}</span>}
 </section>;
}
