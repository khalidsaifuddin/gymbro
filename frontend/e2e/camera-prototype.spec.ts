import {test,expect,type Page} from '@playwright/test';
import {pose} from '../src/detection/fixtures/pose';
import type {WorkerRequest,WorkerReply} from '../src/detection/worker-protocol';
import type {Landmark} from '../src/detection/pose-phase-adapter';
import {addExercise,openAutomaticCamera,openCameraControls,openCameraFor,startEmptyWorkout} from './fixtures/workout-ui';

async function injectPoseReplay(page:Page) {
  const frames=[...Array(5).fill(170),...Array(5).fill(90),...Array(5).fill(170)].map(degrees=>pose('squat',degrees));
  await page.addInitScript((fixtures:Landmark[][])=>{
    class ReplayWorker {
      onmessage:((event:{data:WorkerReply})=>void)|null=null;
      onerror=null;
      next=0;active=true;
      terminate(){this.active=false;}
      postMessage(request:WorkerRequest){
        const reply:WorkerReply=request.kind==='init'?{kind:'ready',requestId:request.requestId}
          :{kind:'pose',requestId:request.requestId,frame:{timestampMs:request.timestampMs,aspectRatio:1,landmarks:fixtures[this.next++]??[]}};
        if(request.kind==='frame')request.bitmap.close();
        queueMicrotask(()=>{if(this.active)this.onmessage?.({data:reply});});
      }
    }
    Object.defineProperty(window,'Worker',{value:ReplayWorker});
  },frames);
}

test('izin kamera ditolak tetap memungkinkan set target dan summary',async ({page}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia=async () => {throw new DOMException('Denied','NotAllowedError');};
  });
  await page.goto('http://127.0.0.1:8081/');
  await startEmptyWorkout(page);await openCameraFor(page,'bench-press');
  await expect(page.getByTestId('camera-framing-status')).toContainText('Izin kamera ditolak. Aktifkan izin browser untuk menggunakan deteksi.');
  await openCameraControls(page);
  await page.getByRole('button',{name:'Back to workout'}).click();
  await page.getByLabel('Target reps set 1 Bench press').fill('12');
  await page.getByLabel('Target kg set 1 Bench press').fill('40');
  await page.getByLabel('Completed set 1 Bench press').check();
  await expect(page.getByText('Total reps: 12',{exact:true})).toBeVisible();
  await expect(page.getByText('Volume diketahui: 480 kg',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
  await expect(page.getByText('Workout selesai',{exact:true})).toBeVisible();
  await expect(page.getByText('Total set: 1',{exact:true})).toBeVisible();
});
test('setiap profil memiliki panduan bagian tubuh yang harus terlihat',async ({page}) => {
  await page.goto('http://127.0.0.1:8081/');
  await startEmptyWorkout(page);await openAutomaticCamera(page);
  await openCameraControls(page);
  for (const value of ['squat','push-up','dumbbell-curl','machine-shoulder-press','bench-press']) {
    await page.getByLabel('Profil kamera').selectOption(value);
    await expect(page.getByTestId('camera-guide')).toContainText('terlihat');
  }
});
test('kamera otomatis memenuhi viewport dengan status gabungan dan kontrol ikon lipat',async({page,context})=>{
 await context.grantPermissions(['camera']);
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:8081/');await startEmptyWorkout(page);await openCameraFor(page,'squat');
 const camera=page.getByTestId('full-screen-camera'),stage=page.locator('.gymbro-camera-stage');
 await expect(camera).toBeVisible();await expect(page.getByRole('button',{name:'Open camera controls'})).toBeVisible();
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
 const cameraBox=await camera.boundingBox(),stageBox=await stage.boundingBox();expect(cameraBox).not.toBeNull();expect(stageBox).not.toBeNull();
 expect(cameraBox!.width).toBeGreaterThanOrEqual(viewport.width);expect(cameraBox!.height).toBeGreaterThanOrEqual(viewport.height);
 expect(stageBox!.width).toBeGreaterThanOrEqual(viewport.width);expect(stageBox!.height).toBeGreaterThanOrEqual(viewport.height);
 await expect(page.getByTestId('camera-framing-status')).toContainText(/Pastikan/);
 await expect(page.getByRole('button',{name:'Aktifkan kamera'})).toHaveCount(0);
 await page.getByRole('button',{name:'Open camera controls'}).click();
 await expect(page.getByLabel('Profil kamera')).toHaveValue('squat');
 const iconText=await page.locator('.gymbro-camera-panel .gymbro-camera-icon-button').allTextContents();
 expect(iconText.length).toBeGreaterThan(3);expect(iconText.every(icon=>/^[←▶Ⅱ■↩✓×]+$/.test(icon.trim()))).toBe(true);
 await expect(page.getByRole('button',{name:'Jeda kamera'})).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'Close camera controls'}).click();
 await expect(page.locator('#gymbro-camera-controls-panel')).toHaveCount(0);
});
test('input manual tidak valid tidak masuk ke summary',async ({page}) => {
  await page.goto('http://127.0.0.1:8081/');
  await startEmptyWorkout(page);await addExercise(page,'squat');
  await page.getByLabel('Target reps set 1 Squat').fill('1.5');
  await expect(page.getByText('Enter a positive whole rep target.')).toBeVisible();
  await expect(page.getByText('Total reps: 0',{exact:true})).toBeVisible();
});
test('kamera dapat dijeda, dilanjutkan, dan berhenti saat halaman background',async ({page}) => {
  const requests:{url:string;method:string}[]=[];
  page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  await page.goto('http://127.0.0.1:8081/');
  await startEmptyWorkout(page);await openAutomaticCamera(page);
  await openCameraControls(page);
  await expect(page.getByRole('button',{name:'Jeda kamera',exact:true})).toBeVisible({timeout:20000});
  expect(await page.locator('video').evaluate(element => (element as HTMLVideoElement).srcObject!==null)).toBe(true);
  await page.getByRole('button',{name:'Jeda kamera',exact:true}).click();
  await expect(page.getByTestId('camera-framing-status')).toContainText('Kamera dijeda');
  expect(await page.locator('video').evaluate(element => (element as HTMLVideoElement).srcObject)).toBeNull();
  await page.getByRole('button',{name:'Lanjutkan kamera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Jeda kamera',exact:true})).toBeVisible({timeout:20000});
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByTestId('camera-framing-status')).toContainText('Kamera dijeda');
  expect(await page.locator('video').evaluate(element => (element as HTMLVideoElement).srcObject)).toBeNull();
  expect(requests.every(request=>new URL(request.url).origin==='http://127.0.0.1:8081'&&request.method==='GET')).toBe(true);
});
test('pergantian profil pada set aktif menunggu konfirmasi',async ({page})=>{
 await injectPoseReplay(page);await page.goto('http://127.0.0.1:8081/');
 await startEmptyWorkout(page);await openCameraFor(page,'squat');await openCameraControls(page);
  await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
  await expect(page.getByTestId('live-rep-counter')).toHaveText('1');
  await page.getByLabel('Profil kamera').selectOption('bench-press');
  await expect(page.getByText('Konfirmasi pergantian latihan; set aktif akan diakhiri.')).toBeVisible();
  await expect(page.getByLabel('Profil kamera')).toHaveValue('squat');
  await page.getByRole('button',{name:'Konfirmasi pergantian',exact:true}).click();
  await expect(page.getByLabel('Profil kamera')).toHaveValue('bench-press');
  await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
});
test('akhiri set dan kembali membersihkan kamera sambil mempertahankan sesi',async({page})=>{
 await injectPoseReplay(page);await page.goto('http://127.0.0.1:8081/');await startEmptyWorkout(page);await openCameraFor(page,'squat');await openCameraControls(page);
 await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Akhiri set & kembali ke workout session',exact:true}).click();
 await expect(page.getByTestId('full-screen-camera')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Log Workout'})).toBeVisible();
 await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
 expect(await page.locator('video').count()).toBe(0);
 await expect(page.getByRole('button',{name:'Selesaikan workout',exact:true})).toBeEnabled();
});
