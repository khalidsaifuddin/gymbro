import {test,expect,type Page} from '@playwright/test';
import {startEmptyWorkout} from './fixtures/workout-ui';

const url='http://127.0.0.1:8081/';
async function manual(page:Page,exercise='bench-press',reps='10',load='40') {
 await page.getByLabel('Latihan untuk set manual').selectOption(exercise);
 await page.getByLabel('Reps manual').fill(reps);await page.getByLabel('Beban kg',{exact:true}).fill(load);
 await page.getByRole('button',{name:'Catat set manual',exact:true}).click();
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
}
test('log table, weight edits, correction, merge and summary share the same session',async({page})=>{
 await page.goto(url);await startEmptyWorkout(page);await manual(page);
 await page.getByRole('button',{name:'Mode log',exact:true}).click();
 const table=page.getByRole('table',{name:'Set Flat barbell bench press'});
 await expect(table).toBeVisible();await expect(page.getByLabel('Reps set 1 Flat barbell bench press')).toHaveValue('10');
 await page.getByLabel('Reps set 1 Flat barbell bench press').fill('12');
 await page.getByRole('button',{name:'Simpan set 1 Flat barbell bench press',exact:true}).click();
 await expect(page.getByText('Total reps: 12',{exact:true})).toBeVisible();
 await page.getByLabel('Beban set 1 Flat barbell bench press').fill('50');
 await page.getByRole('button',{name:'Simpan set 1 Flat barbell bench press',exact:true}).click();
 await expect(page.getByText('Volume diketahui: 600 kg',{exact:true})).toBeVisible();
 await page.getByLabel('Reps set 1 Flat barbell bench press').fill('1.5');
 await page.getByRole('button',{name:'Simpan set 1 Flat barbell bench press',exact:true}).click();
 await expect(page.getByText('Total reps: 12',{exact:true})).toBeVisible();
 await manual(page,'bench-press','8','50');
 await page.getByLabel('Gabung set 1 Flat barbell bench press').check();
 await page.getByLabel('Gabung set 2 Flat barbell bench press').check();
 await page.getByRole('button',{name:'Gabungkan set terpilih',exact:true}).click();
 await expect(page.getByText('Total set: 1',{exact:true})).toBeVisible();
 await expect(page.getByText('Total reps: 20',{exact:true})).toBeVisible();
 await expect(page.getByText('Volume diketahui: 1000 kg',{exact:true})).toBeVisible();
 await expect(page.getByText('Raw kamera: 0',{exact:true})).toBeVisible();
});
test('finished local history provides previous results and independent rest targets',async({page})=>{
 await page.goto(url);await startEmptyWorkout(page);await manual(page,'dumbbell-curl','10','10');
 await expect(page.getByText('Volume diketahui: 200 kg',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Workout baru',exact:true}).click();
 await startEmptyWorkout(page);
 await manual(page,'dumbbell-curl','8','12');
 await page.getByRole('button',{name:'Mode log',exact:true}).click();
  await expect(page.getByRole('table',{name:'Set Dumbbell curl'}).getByText('10 kg × 10',{exact:true})).toBeVisible();
  await page.locator('.workout-log').getByLabel('Target istirahat Dumbbell curl').fill('90');
  await page.locator('.workout-log').getByLabel('Target istirahat Dumbbell curl').blur();
 await expect(page.getByText('Target: 90 detik',{exact:true})).toBeVisible();
 await manual(page,'bench-press','6','40');
 await expect(page.getByText('Target: 120 detik',{exact:true})).toBeVisible();
 await expect(page.getByText('Total set: 2',{exact:true})).toBeVisible();
});
test('incrementally saved unfinished workout offers recovery without reactivating the camera',async({page})=>{
 await page.goto(url);await startEmptyWorkout(page);await manual(page,'bench-press','8','40');await page.reload();
 await expect(page.getByText('Sesi belum selesai ditemukan',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pulihkan sesi',exact:true}).click();
 await expect(page.getByText('Total reps: 8',{exact:true})).toBeVisible();
 await expect(page.getByText('Sesi dipulihkan dalam keadaan jeda. Aktifkan kamera kembali atau lanjutkan manual.',{exact:true})).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
 await page.getByRole('button',{name:'Lanjutkan workout manual',exact:true}).click();
 await manual(page,'bench-press','5','40');
 await expect(page.getByText('Total reps: 13',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();await page.reload();
 await expect(page.getByRole('button',{name:'Lihat workout',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Lihat workout',exact:true}).click();
 await expect(page.getByText('Total reps: 13',{exact:true})).toBeVisible();
});
test('two tabs cannot silently overwrite the same stored workout',async({page,context})=>{
 await page.goto(url);await startEmptyWorkout(page);await manual(page);const other=await context.newPage();await other.goto(url);
 await other.getByRole('button',{name:'Pulihkan sesi',exact:true}).click();
 await other.getByRole('button',{name:'Lanjutkan workout manual',exact:true}).click();await manual(other,'bench-press','5','40');
 await page.getByLabel('Reps manual').fill('7');await page.getByRole('button',{name:'Catat set manual',exact:true}).click();
 await expect(page.getByText('Konflik lokal: sesi telah diubah di tab lain. Hasil tab ini belum tersimpan.',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Pulihkan sesi',exact:true}).click();
 await expect(page.getByText('Total reps: 15',{exact:true})).toBeVisible();
});
test('storage unavailable is explicit, manual results remain exportable',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{value:undefined});});await page.goto(url);
 await startEmptyWorkout(page);
 await expect(page.getByText('Penyimpanan lokal tidak tersedia. Hasil hanya ada di memori; ekspor sebelum menutup halaman.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Catat set manual',exact:true}).click();
 await expect(page.getByText('Total reps: 10',{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Ekspor hasil JSON',exact:true}).click();
 expect((await download).suggestedFilename()).toBe('gymbro-workout.json');
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toHaveCount(0);
});
test('idle active duration gets a durable checkpoint while paused duration stops advancing',async({page})=>{
 await page.clock.install();await page.goto(url);await startEmptyWorkout(page);await manual(page);
 const savedAt=()=>page.evaluate(async()=>{
  const request=indexedDB.open('gymbro-local-v1');const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const read=db.transaction('workouts').objectStore('workouts').getAll();const rows=await new Promise<any[]>((resolve,reject)=>{read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);});db.close();return rows[0].snapshot.savedAt as number;
 });
 const first=await savedAt();await page.clock.fastForward(6000);
 await expect.poll(savedAt).toBeGreaterThan(first+4000);
 await page.getByRole('button',{name:'Jeda workout',exact:true}).click();await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 const paused=await savedAt();await page.clock.fastForward(10000);expect(await savedAt()).toBe(paused);
});
