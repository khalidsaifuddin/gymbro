import {test,expect} from '@playwright/test';
import {pose} from '../src/detection/fixtures/pose';
import {injectFrames} from './fixtures/pose-replay';

test('camera view locks through exercise changes, pause and recovery, then unlocks for a new workout',async({page})=>{
 await page.goto('http://127.0.0.1:8081/');
 const view=page.getByLabel('Sudut kamera', {exact:true});await expect(view).toBeEnabled();
 await view.selectOption('rear-right');await page.getByLabel('Profil kamera',{exact:true}).selectOption('squat');
 await expect(page.getByTestId('camera-guide')).toContainText('kanan belakang');
 await page.getByRole('button',{name:'Catat set manual',exact:true}).click();
 await expect(view).toBeDisabled();await expect(view).toHaveValue('rear-right');
 await page.getByLabel('Profil kamera',{exact:true}).selectOption('bench-press');await expect(view).toBeDisabled();
 await page.getByRole('button',{name:'Jeda workout',exact:true}).click();await expect(view).toBeDisabled();
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Pulihkan sesi',exact:true})).toBeVisible();await expect(view).toBeDisabled();
 await page.getByRole('button',{name:'Pulihkan sesi',exact:true}).click();await expect(view).toHaveValue('rear-right');await expect(view).toBeDisabled();
 await page.getByRole('button',{name:'Lanjutkan workout manual',exact:true}).click();await expect(view).toBeDisabled();
 await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();await expect(view).toBeDisabled();
 await page.getByRole('button',{name:'Workout baru',exact:true}).click();await expect(view).toBeEnabled();await view.selectOption('front-left');
});
test('each camera direction has guidance without promising validated automatic accuracy',async({page})=>{
 await page.goto('http://127.0.0.1:8081/');
 await page.getByLabel('Profil kamera',{exact:true}).selectOption('dumbbell-curl');
 for(const view of ['front','back','front-left','front-right','rear-left','rear-right','side-left','side-right']){
  await page.getByLabel('Sudut kamera',{exact:true}).selectOption(view);
  await expect(page.getByTestId('camera-guide')).toContainText('kedua');
 }
 await expect(page.getByText('Pilihan sudut belum membuktikan akurasi otomatis. Jika sendi terhalang, catat set manual.',{exact:true})).toBeVisible();
});
test('selected side view reaches detector and verified rep survives camera pause and tracking loss',async({page})=>{
 const frames=[...Array(6).fill(170),...Array(6).fill(90),...Array(6).fill(170)].map(degrees=>{
  const points=pose('squat',degrees);for(const base of [11,13,15,23,25,27])points[base+1].visibility=.1;return points;
 });
 await injectFrames(page,frames);const requests:{url:string;method:string}[]=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.goto('http://127.0.0.1:8081/');await page.getByLabel('Sudut kamera',{exact:true}).selectOption('side-left');
 await page.getByLabel('Profil kamera',{exact:true}).selectOption('squat');await page.getByRole('button',{name:'Aktifkan kamera',exact:true}).click();
 await expect(page.getByLabel('Sudut kamera',{exact:true})).toBeDisabled();
 await expect(page.getByTestId('live-rep-counter')).toHaveText('1');
 await expect(page.getByText('Tracking terputus. Pastikan tubuh dan sendi terlihat.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Jeda kamera',exact:true}).click();
 await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();await expect(page.getByLabel('Sudut kamera',{exact:true})).toHaveValue('side-left');
 expect(requests.every(r=>new URL(r.url).origin==='http://127.0.0.1:8081'&&r.method==='GET')).toBe(true);
});
test('legacy unfinished workout without camera view recovers in locked default mode',async({page})=>{
 await page.goto('http://127.0.0.1:8081/');await page.getByRole('button',{name:'Catat set manual',exact:true}).click();
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const request=indexedDB.open('gymbro-local-v1',2);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('workouts','readwrite'),store=tx.objectStore('workouts'),rows=store.getAll();
   rows.onsuccess=()=>{for(const r of rows.result){delete r.preferences.cameraView;store.put(r);}};
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);
  });db.close();
 });
 await page.reload();await page.getByRole('button',{name:'Pulihkan sesi',exact:true}).click();
 await expect(page.getByLabel('Sudut kamera',{exact:true})).toHaveValue('auto');await expect(page.getByLabel('Sudut kamera',{exact:true})).toBeDisabled();
 await expect(page.getByText('Total reps: 10',{exact:true})).toBeVisible();
});
