import {test,expect,type Page} from '@playwright/test';
import {pose} from '../src/detection/fixtures/pose';
import type {WorkerRequest,WorkerReply} from '../src/detection/worker-protocol';
import type {Landmark} from '../src/detection/pose-phase-adapter';

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

test('izin kamera ditolak tetap memungkinkan set manual dan summary',async ({page}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia=async () => {throw new DOMException('Denied','NotAllowedError');};
  });
  await page.goto('http://127.0.0.1:8081/');
  await page.getByRole('button',{name:'Aktifkan kamera',exact:true}).click();
  await expect(page.getByText('Izin kamera ditolak. Aktifkan izin browser atau catat set manual.')).toBeVisible();
  await page.getByLabel('Latihan untuk set manual').selectOption('bench-press');
  await page.getByLabel('Reps manual').fill('12');
  await page.getByLabel('Beban kg').fill('40');
  await page.getByRole('button',{name:'Catat set manual',exact:true}).click();
  await expect(page.getByText('Total reps: 12',{exact:true})).toBeVisible();
  await expect(page.getByText('Volume diketahui: 480 kg',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
  await expect(page.getByText('Workout selesai',{exact:true})).toBeVisible();
  await expect(page.getByText('Total set: 1',{exact:true})).toBeVisible();
});
test('setiap profil memiliki panduan bagian tubuh yang harus terlihat',async ({page}) => {
  await page.goto('http://127.0.0.1:8081/');
  for (const value of ['squat','push-up','dumbbell-curl','machine-shoulder-press','bench-press']) {
    await page.getByLabel('Profil kamera').selectOption(value);
    await expect(page.getByTestId('camera-guide')).toContainText('terlihat');
  }
});
test('input manual tidak valid tidak masuk ke summary',async ({page}) => {
  await page.goto('http://127.0.0.1:8081/');
  await page.getByLabel('Reps manual').fill('1.5');
  await page.getByRole('button',{name:'Catat set manual',exact:true}).click();
  await expect(page.getByText('Masukkan reps bulat positif dan beban kg yang valid.')).toBeVisible();
  await expect(page.getByText('Total reps: 0',{exact:true})).toBeVisible();
});
test('kamera dapat dijeda, dilanjutkan, dan berhenti saat halaman background',async ({page}) => {
  const requests:{url:string;method:string}[]=[];
  page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  await page.goto('http://127.0.0.1:8081/');
  await page.getByRole('button',{name:'Aktifkan kamera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Jeda kamera',exact:true})).toBeVisible();
  expect(await page.locator('video').evaluate(element => (element as HTMLVideoElement).srcObject!==null)).toBe(true);
  await page.getByRole('button',{name:'Jeda kamera',exact:true}).click();
  await expect(page.getByText('Kamera dijeda',{exact:true})).toBeVisible();
  expect(await page.locator('video').evaluate(element => (element as HTMLVideoElement).srcObject)).toBeNull();
  await page.getByRole('button',{name:'Lanjutkan kamera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Jeda kamera',exact:true})).toBeVisible();
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByText('Kamera dijeda',{exact:true})).toBeVisible();
  expect(await page.locator('video').evaluate(element => (element as HTMLVideoElement).srcObject)).toBeNull();
  expect(requests.every(request=>new URL(request.url).origin==='http://127.0.0.1:8081'&&request.method==='GET')).toBe(true);
});
test('pergantian profil pada set aktif menunggu konfirmasi',async ({page})=>{
  await injectPoseReplay(page);await page.goto('http://127.0.0.1:8081/');
  await page.getByLabel('Profil kamera').selectOption('squat');
  await page.getByRole('button',{name:'Aktifkan kamera',exact:true}).click();
  await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
  await page.getByLabel('Profil kamera').selectOption('bench-press');
  await expect(page.getByText('Konfirmasi pergantian latihan; set aktif akan diakhiri.')).toBeVisible();
  await expect(page.getByLabel('Profil kamera')).toHaveValue('squat');
  await page.getByRole('button',{name:'Konfirmasi pergantian',exact:true}).click();
  await expect(page.getByLabel('Profil kamera')).toHaveValue('bench-press');
  await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
});
