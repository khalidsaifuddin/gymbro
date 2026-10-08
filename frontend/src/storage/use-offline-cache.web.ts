import {useEffect,useState} from 'react';
export function useOfflineCache():string {
 const [status,setStatus]=useState('Menyiapkan cache offline…');
 useEffect(()=>{
  let active=true;
  const set=(s:string)=>{if(active)setStatus(s);};
  if(!('serviceWorker' in navigator)){set('Cache offline tidak tersedia di browser ini');return;}
  const timer=setTimeout(()=>set('Cache offline belum siap. Perlu koneksi untuk membuka ulang aplikasi.'),25000);
  void (async()=>{
   try {
    await navigator.serviceWorker.register('/gymbro-sw.js');
    const registration=await navigator.serviceWorker.ready;
    const ready=await new Promise<boolean>((resolve,reject)=>{
     const channel=new MessageChannel(),timeout=setTimeout(()=>{channel.port1.close();reject(new Error('cache-timeout'));},10000);
     channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();resolve(e.data?.ready===true);};
     registration.active!.postMessage({kind:'offline-status'},[channel.port2]);
    });
    clearTimeout(timer);set(ready?'Aplikasi dan model siap offline':'Cache offline belum siap. Perlu koneksi untuk membuka ulang aplikasi.');
   }catch{clearTimeout(timer);set('Cache offline belum siap. Jalankan web build dan periksa ruang penyimpanan.');}
  })();
  return ()=>{active=false;clearTimeout(timer);};
 },[]);
 return status;
}
