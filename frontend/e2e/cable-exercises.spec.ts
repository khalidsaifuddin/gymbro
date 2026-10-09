import {test,expect} from '@playwright/test';
import {cableExercises,exerciseCatalog} from '../src/domain/exercises';
import {cablePose} from '../src/detection/fixtures/cable-pose';
import {injectFrames} from './fixtures/pose-replay';
import {addExercise,openAutomaticCamera,startEmptyWorkout} from './fixtures/workout-ui';
for(const exercise of cableExercises){
 test(`${exercise}: profile replay counts a cycle and recovers local results`,async({page})=>{
  await injectFrames(page,[false,true,false].flatMap(peak=>Array.from({length:6},()=>cablePose(exercise,peak))));
  await page.goto('http://127.0.0.1:8081/');await startEmptyWorkout(page);await addExercise(page,exercise);await page.getByLabel(`Camera angle ${exerciseCatalog[exercise].label}`).selectOption('front-left');await openAutomaticCamera(page);
  await page.getByLabel('Profil kamera',{exact:true}).selectOption(exercise);await expect(page.getByTestId('camera-guide')).toContainText('terlihat');
  await page.getByRole('button',{name:'Aktifkan kamera',exact:true}).click();await expect(page.getByTestId('live-rep-counter')).toHaveText('1');
  await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Lihat workout',exact:true}).first().click();
  await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
 });
 test(`${exercise}: automatic classifier counts a following full cycle without uploading poses`,async({page})=>{
  await injectFrames(page,[false,true,false,true,false].flatMap(peak=>Array.from({length:6},()=>cablePose(exercise,peak))));
  const requests:{url:string;method:string}[]=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.goto('http://127.0.0.1:8081/');await startEmptyWorkout(page);await openAutomaticCamera(page);await page.getByRole('button',{name:'Aktifkan kamera',exact:true}).click();
  await expect(page.getByTestId('live-rep-counter')).toHaveText('1');await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
  await expect(page.getByText('Total reps: 1',{exact:true})).toBeVisible();
  expect(requests.every(r=>new URL(r.url).origin==='http://127.0.0.1:8081'&&r.method==='GET')).toBe(true);
 });
}
test('all four cable exercises share one stack load, local history and log correction',async({page})=>{
 await page.goto('http://127.0.0.1:8081/');await startEmptyWorkout(page);
 for(const id of cableExercises){await page.getByLabel('Latihan untuk set manual').selectOption(id);await page.getByLabel('Beban kg',{exact:true}).fill('40');await page.getByRole('button',{name:'Catat set manual',exact:true}).click();}
 await expect(page.getByText('Volume diketahui: 1600 kg',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Lihat workout',exact:true}).first().click();
 await expect(page.getByText('Total set: 4',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Mode log',exact:true}).click();
 await page.getByLabel('Reps set 1 Lat pulldown',{exact:true}).fill('12');await page.getByRole('button',{name:'Simpan set 1 Lat pulldown',exact:true}).click();
 await expect(page.getByText('Volume diketahui: 1680 kg',{exact:true})).toBeVisible();
});

test('face occlusion counts no rep; manual cable sets recover with their camera view',async({page})=>{
 const hidden=[false,true,false].flatMap(peak=>Array.from({length:6},()=>{const p=cablePose('face-pull',peak);p[0].visibility=.1;return p;}));
 await injectFrames(page,hidden);await page.goto('http://127.0.0.1:8081/');await startEmptyWorkout(page);await addExercise(page,'face-pull');const view=page.getByLabel('Camera angle Rope face pull');await view.selectOption('rear-right');await openAutomaticCamera(page);await page.getByLabel('Profil kamera',{exact:true}).selectOption('face-pull');
 await page.getByRole('button',{name:'Aktifkan kamera',exact:true}).click();await expect(page.getByText('Tracking terputus. Pastikan tubuh dan sendi terlihat.',{exact:true})).toBeVisible();await expect(page.getByText('Total reps: 0',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to workout'}).click();await expect(view).toBeEnabled();
 await page.getByLabel('Latihan untuk set manual').selectOption('face-pull');await page.getByLabel('Beban kg',{exact:true}).fill('40');await page.getByRole('button',{name:'Catat set manual',exact:true}).click();await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Pulihkan sesi',exact:true}).click();await expect(view).toHaveValue('rear-right');await expect(view).toBeEnabled();await expect(page.getByText('Total reps: 10',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Lanjutkan workout manual',exact:true}).click();await page.getByLabel('Latihan untuk set manual').selectOption('seated-cable-row');await page.getByRole('button',{name:'Catat set manual',exact:true}).click();await expect(view).toBeEnabled();await expect(page.getByText('Volume diketahui: 800 kg',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();await expect(page.getByText('Total set: 2',{exact:true})).toBeVisible();
});
