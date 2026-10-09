import {test,expect} from '@playwright/test';
import {pose} from '../src/detection/fixtures/pose';
import {injectFrames} from './fixtures/pose-replay';
import {addExercise,logPlannedSet,openCameraControls,startEmptyWorkout} from './fixtures/workout-ui';

const url='http://127.0.0.1:8081/';

test('camera angles belong to exercises and survive recovery',async({page})=>{
 await page.goto(url);await startEmptyWorkout(page);
 await addExercise(page,'squat');await addExercise(page,'bench-press');
 await page.getByLabel('Camera angle Squat').selectOption('side-left');
 await page.getByLabel('Camera angle Flat barbell bench press').selectOption('rear-right');
 await page.getByRole('button',{name:'Open camera for Squat'}).click();
 await openCameraControls(page);
 await expect(page.getByTestId('camera-guide')).toContainText('samping kiri');
 await page.getByRole('button',{name:'Back to workout'}).click();
 await page.getByRole('button',{name:'Open camera for Flat barbell bench press'}).click();
 await openCameraControls(page);
 await expect(page.getByTestId('camera-guide')).toContainText('kanan belakang');
 await page.getByRole('button',{name:'Back to workout'}).click();
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Pulihkan sesi'}).click();
 await expect(page.getByLabel('Camera angle Squat')).toHaveValue('side-left');
 await expect(page.getByLabel('Camera angle Flat barbell bench press')).toHaveValue('rear-right');
});

test('each angle offers exercise guidance and can change between completed sets',async({page})=>{
 await page.goto(url);await startEmptyWorkout(page);await addExercise(page,'dumbbell-curl');
 for(const view of ['front','back','front-left','front-right','rear-left','rear-right','side-left','side-right']){
  await page.getByLabel('Camera angle Dumbbell curl').selectOption(view);
  await page.getByRole('button',{name:'Open camera for Dumbbell curl'}).click();
  await openCameraControls(page);
  await expect(page.getByTestId('camera-guide')).toContainText('kedua');
  await page.getByRole('button',{name:'Back to workout'}).click();
 }
});

test('selected side angle reaches detector and counted rep survives pause',async({page})=>{
 const frames=[...Array(6).fill(170),...Array(6).fill(90),...Array(6).fill(170)].map(degrees=>{
  const points=pose('squat',degrees);for(const base of [11,13,15,23,25,27])points[base+1].visibility=.1;return points;
 });
 await injectFrames(page,frames);const requests:{url:string;method:string}[]=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.goto(url);await startEmptyWorkout(page);await addExercise(page,'squat');
 await page.getByLabel('Camera angle Squat').selectOption('side-left');
 await page.getByRole('button',{name:'Open camera for Squat'}).click();
 await openCameraControls(page);
 await expect(page.getByTestId('live-rep-counter')).toHaveText('1');
 await page.getByRole('button',{name:'Jeda kamera',exact:true}).click();
 await page.getByRole('button',{name:'Back to workout'}).click();
 await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Camera angle Squat')).toHaveValue('side-left');
 expect(requests.every(r=>new URL(r.url).origin===url.slice(0,-1)&&r.method==='GET')).toBe(true);
});

test('legacy unfinished workout without camera views recovers with default angle',async({page})=>{
 await page.goto(url);await startEmptyWorkout(page);await addExercise(page,'squat');
 await logPlannedSet(page,'squat','10','');
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const request=indexedDB.open('gymbro-local-v1',2);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('workouts','readwrite'),store=tx.objectStore('workouts'),rows=store.getAll();
   rows.onsuccess=()=>{for(const r of rows.result){delete r.preferences.cameraView;delete r.preferences.cameraViews;store.put(r);}};
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);
  });db.close();
 });
 await page.reload();await page.getByRole('button',{name:'Pulihkan sesi'}).click();
 await expect(page.getByLabel('Camera angle Squat')).toHaveValue('auto');
 await expect(page.getByText('Total reps: 10',{exact:true})).toBeVisible();
});
