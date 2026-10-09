import {test,expect} from '@playwright/test';
import {openCameraControls} from './fixtures/workout-ui';

const url='http://127.0.0.1:8081/';

test('phone pages scroll to content below the fold and recover after closing camera',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(url);
 await expect(page.getByRole('button',{name:'Start Empty Workout'})).toBeVisible();
 await page.mouse.move(200,400);await page.mouse.wheel(0,650);
 await expect.poll(()=>page.evaluate(()=>scrollY),{timeout:2500}).toBeGreaterThan(100);
 await page.getByRole('button',{name:'Start Empty Workout'}).click();
 await page.getByRole('button',{name:'Add Exercise'}).click();await page.getByRole('button',{name:'Squat',exact:true}).click();
 await page.mouse.move(200,400);await page.mouse.wheel(0,700);
 await expect.poll(()=>page.evaluate(()=>scrollY),{timeout:2500}).toBeGreaterThan(100);
 await page.getByRole('button',{name:'Open automatic camera'}).click();
 await expect(page.getByTestId('full-screen-camera')).toBeVisible();
 await openCameraControls(page);
 await page.getByRole('button',{name:'Back to workout'}).click();
 await page.mouse.move(200,400);await page.mouse.wheel(0,700);
 await expect.poll(()=>page.evaluate(()=>scrollY),{timeout:2500}).toBeGreaterThan(100);
});

test('web theme uses the supplied SAKA cyan preset',async({page})=>{
 await page.goto(url);await expect(page.locator('.gymbro-root')).toHaveAttribute('data-theme','cyan');
 expect(await page.locator('.gymbro-root').evaluate(element=>getComputedStyle(element).getPropertyValue('--saka-accent').trim())).toBe('#22E0E0');
});

test('distinct camera angles survive switching exercise and workout recovery',async({page})=>{
 await page.goto(url);await page.getByRole('button',{name:'Start Empty Workout'}).click();
 for(const label of ['Squat','Dumbbell curl']){
  await page.getByRole('button',{name:'Add Exercise'}).click();await page.getByRole('button',{name:label,exact:true}).click();
 }
 await page.getByLabel('Camera angle Squat').selectOption('side-left');
 await page.getByLabel('Camera angle Dumbbell curl').selectOption('front-right');
 await expect(page.getByLabel('Camera angle Squat')).toHaveValue('side-left');
 await expect(page.getByLabel('Camera angle Dumbbell curl')).toHaveValue('front-right');
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Pulihkan sesi'}).click();
 await expect(page.getByLabel('Camera angle Squat')).toHaveValue('side-left');
 await expect(page.getByLabel('Camera angle Dumbbell curl')).toHaveValue('front-right');
});

test('all imported exercises can be explored and selected without camera controls',async({page})=>{
 await page.goto(url);await page.getByRole('button',{name:'Explore'}).click();
 await expect(page.getByText(/1,324 imported exercises/)).toBeVisible();
 await page.getByLabel('Search exercises').fill('3/4 sit-up');
 await expect(page.getByRole('button',{name:'3/4 sit-up',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back'}).click();
 await page.getByRole('button',{name:'Start Empty Workout'}).click();
 await page.getByRole('button',{name:'Add Exercise'}).click();
 await page.getByLabel('Search exercises').fill('3/4 sit-up');
 await page.getByRole('button',{name:'3/4 sit-up',exact:true}).click();
 await expect(page.getByRole('heading',{name:'3/4 sit-up'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open camera for 3/4 sit-up'})).toHaveCount(0);
});
