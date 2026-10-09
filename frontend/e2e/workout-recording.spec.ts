import {test,expect} from '@playwright/test';
import {logPlannedSet,openAutomaticCamera,openCameraControls,startEmptyWorkout} from './fixtures/workout-ui';
test('default camera session never constructs a MediaRecorder',async({page})=>{
 await page.addInitScript(()=>{
  const original=MediaRecorder;(window as any).recorderCreations=0;
  Object.defineProperty(window,'MediaRecorder',{value:new Proxy(original,{construct(target,args){(window as any).recorderCreations++;return Reflect.construct(target,args);}})});
 });
 await page.goto('http://127.0.0.1:8081/');await startEmptyWorkout(page);await openAutomaticCamera(page);await openCameraControls(page);
 await expect(page.getByRole('button',{name:'Jeda kamera',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).recorderCreations)).toBe(0);
 await expect(page.getByRole('link',{name:'Simpan segmen 1',exact:true})).toHaveCount(0);
});
test('recording is off by default and unavailable MIME preserves manual workouts',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(MediaRecorder,'isTypeSupported',{value:()=>false});});
 await page.goto('http://127.0.0.1:8081/');
 await expect(page.getByLabel('Rekam video di perangkat')).not.toBeChecked();
 await page.getByLabel('Rekam video di perangkat').check();
 await startEmptyWorkout(page);await openAutomaticCamera(page);await openCameraControls(page);
 await expect(page.getByText('Perekaman tidak tersedia. Workout tetap dapat dilanjutkan.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to workout'}).click();
 await logPlannedSet(page,'squat','8');
 await expect(page.getByText('Total reps: 8',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Rekam video di perangkat')).toBeDisabled();
});
test('real browser recorder produces playable local files and discard retains the workout',async({page})=>{
 const requests:{url:string;method:string}[]=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.goto('http://127.0.0.1:8081/');await page.getByLabel('Rekam video di perangkat').check();
 await startEmptyWorkout(page);await openAutomaticCamera(page);await openCameraControls(page);
 await expect(page.getByText('Rekaman aktif di perangkat',{exact:true})).toBeVisible({timeout:15000});
 await expect.poll(()=>page.locator('video').evaluate(e=>(e as HTMLVideoElement).currentTime)).toBeGreaterThan(.5);
 await page.getByRole('button',{name:'Jeda kamera',exact:true}).click();
 await page.getByRole('button',{name:'Lanjutkan kamera',exact:true}).click();
 await expect(page.getByText('Rekaman aktif di perangkat',{exact:true})).toBeVisible({timeout:15000});
 await expect.poll(()=>page.locator('video').evaluate(e=>(e as HTMLVideoElement).currentTime)).toBeGreaterThan(.5);
 await page.getByRole('button',{name:'Back to workout'}).click();
 await logPlannedSet(page,'squat','8');
 await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
 await expect(page.getByRole('link',{name:'Simpan segmen 1',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Simpan segmen 2',exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Simpan segmen 1',exact:true}).click();
 expect((await download).suggestedFilename()).toMatch(/\.webm$/);
 const urls=await page.locator('a[download]').evaluateAll(links=>links.map(a=>(a as HTMLAnchorElement).href));
 for(const url of urls) {
  const dimensions=await page.evaluate(async u=>{
   const video=document.createElement('video');video.src=u;video.muted=true;
   await new Promise<void>((resolve,reject)=>{video.onloadeddata=()=>resolve();video.onerror=()=>reject(new Error('invalid-video'));});
   return {width:video.videoWidth,height:video.videoHeight};
  },url);expect(dimensions.width).toBeGreaterThan(0);expect(dimensions.height).toBeGreaterThan(0);
 }
 await page.getByRole('button',{name:'Buang rekaman',exact:true}).click();
 await expect(page.getByRole('link',{name:'Simpan segmen 1',exact:true})).toHaveCount(0);
 await expect(page.getByText('Total reps: 8',{exact:true})).toBeVisible();
 expect(requests.every(r=>new URL(r.url).origin==='http://127.0.0.1:8081'&&r.method==='GET')).toBe(true);
});
