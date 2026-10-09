import {test,expect,type Page} from '@playwright/test';
async function manual(page:Page,reps='10',kg='40'){
 await page.getByLabel('Latihan untuk set manual').selectOption('bench-press');await page.getByLabel('Reps manual',{exact:true}).fill(reps);await page.getByLabel('Beban kg',{exact:true}).fill(kg);await page.getByRole('button',{name:'Catat set manual',exact:true}).click();await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
}
async function login(page:Page){await page.getByRole('link',{name:'Masuk dengan Google',exact:true}).click();await expect(page.getByText('Akun: Fixture athlete',{exact:true})).toBeVisible();}
test('signed fixture login, opt-in guest import and cross-device corrected history',async({page,browser})=>{
 await page.goto('/');await manual(page);await login(page);
 await expect(page.getByText('1 workout tamu belum diimpor',{exact:true})).toBeVisible();
 const before=await page.request.get('/api/v1/workouts');expect(await before.json()).toEqual([]);
 await page.getByRole('button',{name:'Impor workout tamu',exact:true}).click();await expect(page.getByText('Sinkronisasi selesai',{exact:true})).toBeVisible();
 const second=await browser.newContext();const p2=await second.newPage();await p2.goto('http://127.0.0.1:8093');await login(p2);await p2.getByRole('button',{name:'Muat riwayat akun',exact:true}).click();
 await expect(p2.getByText('10 reps',{exact:false}).first()).toBeVisible();await p2.getByRole('button',{name:'Lihat workout',exact:true}).first().click();await expect(p2.getByText('Volume diketahui: 400 kg',{exact:true})).toBeVisible();await second.close();
});
test('offline account workout stays durable and uploads after reconnect without media',async({page,context})=>{
 await context.addCookies([{name:'fixture_subject',value:'fixture-offline',url:'http://127.0.0.1:8094'}]);await page.goto('/');await login(page);
 const bodies:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('workout-mutations'))bodies.push(r.postData()??'');});
 await context.setOffline(true);await manual(page,'8','50');await expect(page.getByText(/Tersimpan lokal; menunggu koneksi/)).toBeVisible();await context.setOffline(false);
 await expect(page.getByText('Sinkronisasi selesai',{exact:true})).toBeVisible();const history=await page.request.get('/api/v1/workouts');const rows=await history.json();expect(rows).toHaveLength(1);expect(rows[0].exercises[0].sets[0].reps).toBe(8);expect(rows[0].revision).toBeGreaterThanOrEqual(1);
 expect(bodies.length).toBeGreaterThan(0);for(const body of bodies){const parsed=JSON.parse(body);expect(Object.keys(parsed).sort()).toEqual(['account_id','base_revision','mutation_id','occurred_at','operation','workout','workout_id']);expect(body).not.toMatch(/landmarks|data:video|blob:|video_data|frames/);}
});
async function history(page:Page){const response=await page.request.get('/api/v1/workouts');expect(response.status()).toBe(200);return response.json();}
async function correct(page:Page,reps:string){await page.getByRole('button',{name:'Mode log',exact:true}).click();await page.getByLabel('Reps set 1 Flat barbell bench press',{exact:true}).fill(reps);await page.getByRole('button',{name:'Simpan set 1 Flat barbell bench press',exact:true}).click();await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();}
test('finishing during an in-flight active mutation uploads the completed result without camera configuration',async({page,context})=>{
 await context.addCookies([{name:'fixture_subject',value:'fixture-final-save',url:'http://127.0.0.1:8094'}]);
 await page.goto('/');await login(page);await page.getByLabel('Sudut kamera',{exact:true}).selectOption('front-right');
 let signalStarted!:()=>void,release!:()=>void,first=true;
 const started=new Promise<void>(resolve=>{signalStarted=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/v1/workout-mutations',async route=>{
  const body=route.request().postDataJSON();expect(JSON.stringify(body)).not.toContain('cameraView');
  if(first&&body.workout?.status==='active'){first=false;const response=await route.fetch();signalStarted();await gate;await route.fulfill({response});}
  else await route.continue();
 });
 await page.getByLabel('Latihan untuk set manual').selectOption('bench-press');await page.getByLabel('Beban kg',{exact:true}).fill('40');
 await page.getByRole('button',{name:'Catat set manual',exact:true}).click();await started;
 await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();release();
 await expect.poll(async()=>(await history(page))[0]?.status).toBe('completed');
 await expect(page.getByText('Sinkronisasi selesai',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Sudut kamera',{exact:true})).toHaveValue('front-right');
});
test('two devices preserve divergent edits and require explicit conflict resolution',async({page,context,browser})=>{
 await context.addCookies([{name:'fixture_subject',value:'fixture-conflict',url:'http://127.0.0.1:8094'}]);await page.goto('/');await login(page);await manual(page);await expect.poll(async()=>(await history(page))[0]?.status).toBe('completed');
 const other=await browser.newContext();await other.addCookies([{name:'fixture_subject',value:'fixture-conflict',url:'http://127.0.0.1:8094'}]);const second=await other.newPage();await second.goto('http://127.0.0.1:8093');await login(second);await second.getByRole('button',{name:'Muat riwayat akun',exact:true}).click();await second.getByRole('button',{name:'Lihat workout',exact:true}).first().click();
 await context.setOffline(true);await other.setOffline(true);await correct(page,'12');await correct(second,'15');await context.setOffline(false);await expect.poll(async()=>(await history(page))[0]?.exercises[0].sets[0].reps).toBe(12);
 await other.setOffline(false);await expect(second.getByRole('button',{name:'Gunakan hasil lokal',exact:true})).toBeVisible();expect((await history(second))[0].exercises[0].sets[0].reps).toBe(12);await expect(second.getByText('Total reps: 15',{exact:true})).toBeVisible();
 await second.getByRole('button',{name:'Gunakan hasil lokal',exact:true}).click();await expect.poll(async()=>(await history(second))[0]?.exercises[0].sets[0].reps).toBe(15);await other.close();
});
test('workout deletion blocks stale sync, and account deletion invalidates cookies and clears only account data',async({page,context,browser})=>{
 await context.addCookies([{name:'fixture_subject',value:'fixture-delete',url:'http://127.0.0.1:8094'}]);await page.goto('/');await manual(page,'6','30');await login(page);await manual(page);await expect.poll(async()=>(await history(page))[0]?.status).toBe('completed');
 const other=await browser.newContext();await other.addCookies([{name:'fixture_subject',value:'fixture-delete',url:'http://127.0.0.1:8094'}]);const stale=await other.newPage();await stale.goto('http://127.0.0.1:8093');await login(stale);await stale.getByRole('button',{name:'Muat riwayat akun',exact:true}).click();await stale.getByRole('button',{name:'Lihat workout',exact:true}).first().click();await other.setOffline(true);await correct(stale,'20');
 await page.getByRole('button',{name:'Hapus workout',exact:true}).first().click();await page.getByRole('button',{name:'Konfirmasi hapus workout',exact:true}).click();await expect.poll(async()=>(await history(page)).length).toBe(0);
 await other.setOffline(false);await expect(stale.getByRole('button',{name:'Hapus salinan lokal',exact:true})).toBeVisible();await expect(stale.getByRole('button',{name:'Gunakan hasil lokal',exact:true})).toHaveCount(0);await stale.getByRole('button',{name:'Hapus salinan lokal',exact:true}).click();expect(await history(stale)).toEqual([]);
 const oldUser=(await (await page.request.get('/api/v1/auth/me')).json()).user.id;
 await page.getByRole('button',{name:'Hapus akun',exact:true}).click();await page.getByRole('button',{name:'Konfirmasi hapus akun',exact:true}).click();await expect(page.getByText('Akun dihapus; workout tamu tetap ada',{exact:true})).toBeVisible();expect((await stale.request.get('/api/v1/workouts')).status()).toBe(401);
 await expect(page.getByText(/6 reps/).first()).toBeVisible();await login(page);const recreated=(await (await page.request.get('/api/v1/auth/me')).json()).user.id;expect(recreated).not.toBe(oldUser);expect(await history(page)).toEqual([]);await other.close();
});
test('merged unequal loads and original source timestamps survive PostgreSQL and another browser',async({page,context,browser})=>{
 await context.addCookies([{name:'fixture_subject',value:'fixture-merge',url:'http://127.0.0.1:8094'}]);await page.goto('/');await login(page);await page.getByLabel('Latihan untuk set manual').selectOption('bench-press');
 for(const [reps,kg]of [['10','40'],['8','50']]){await page.getByLabel('Reps manual',{exact:true}).fill(reps);await page.getByLabel('Beban kg',{exact:true}).fill(kg);await page.getByRole('button',{name:'Catat set manual',exact:true}).click();}
 await page.getByRole('button',{name:'Mode log',exact:true}).click();await page.getByLabel('Gabung set 1 Flat barbell bench press').check();await page.getByLabel('Gabung set 2 Flat barbell bench press').check();await page.getByRole('button',{name:'Gabungkan set terpilih',exact:true}).click();await page.getByRole('button',{name:'Selesaikan workout',exact:true}).click();await expect.poll(async()=>(await history(page))[0]?.status).toBe('completed');
 const rows=await history(page);expect(rows[0].exercises[0].sets).toHaveLength(1);const sources=rows[0].exercises[0].sets[0].merged_from;expect(sources).toHaveLength(2);expect(sources.map((s:any)=>Number(s.load_kg))).toEqual([40,50]);expect(sources.every((s:any)=>s.source_started_at&&s.source_last_rep_at)).toBe(true);
 const other=await browser.newContext();await other.addCookies([{name:'fixture_subject',value:'fixture-merge',url:'http://127.0.0.1:8094'}]);const p=await other.newPage();await p.goto('http://127.0.0.1:8093');await login(p);await p.getByRole('button',{name:'Muat riwayat akun',exact:true}).click();await p.getByRole('button',{name:'Lihat workout',exact:true}).first().click();await expect(p.getByText('Volume diketahui: 800 kg',{exact:true})).toBeVisible();await expect(p.getByText('Total reps: 18',{exact:true})).toBeVisible();await other.close();
});
