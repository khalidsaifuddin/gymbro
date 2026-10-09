import {test,expect} from '@playwright/test';
import {pose} from '../src/detection/fixtures/pose';
import {injectFrames} from './fixtures/pose-replay';
import {openCameraControls} from './fixtures/workout-ui';

const url='http://127.0.0.1:8081/';

test('first visit starts an empty session and adds a planned exercise without counting a set',async({page})=>{
 await page.goto(url);
 await expect(page.getByRole('button',{name:'Start Empty Workout'})).toBeVisible();
 await expect(page.getByRole('button',{name:'New Routine'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Explore'})).toBeVisible();
 await page.getByRole('button',{name:'Start Empty Workout'}).click();
 await expect(page.getByText('No exercises yet')).toBeVisible();
 await page.getByRole('button',{name:'Add Exercise'}).click();
 await page.getByRole('button',{name:'Dumbbell curl',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Dumbbell curl'})).toBeVisible();
 await expect(page.getByText('Total set: 0',{exact:true})).toBeVisible();
 await page.getByLabel('Target reps set 1 Dumbbell curl').fill('10');
 await page.getByLabel('Target kg set 1 Dumbbell curl').fill('12');
 await page.getByLabel('Target kg set 1 Dumbbell curl').press('End');
 await page.getByLabel('Target kg set 1 Dumbbell curl').press('.');
 await page.getByLabel('Target kg set 1 Dumbbell curl').press('5');
 await expect(page.getByLabel('Target kg set 1 Dumbbell curl')).toHaveValue('12.5');
 await page.getByRole('button',{name:'Complete set 1 Dumbbell curl'}).click();
 await expect(page.getByText('Total set: 1',{exact:true})).toBeVisible();
 await expect(page.getByText('Total reps: 10',{exact:true})).toBeVisible();
 await expect(page.getByText('Volume diketahui: 250 kg',{exact:true})).toBeVisible();
});

test('routine targets persist, can be edited, and start a copied workout plan',async({page})=>{
 await page.goto(url);await page.getByRole('button',{name:'New Routine'}).click();
 await page.getByLabel('Routine name').fill('Pull Day');
 await page.getByRole('button',{name:'Add Exercise'}).click();
 await page.getByLabel('Search exercises').fill('pulldown');
 await page.getByRole('button',{name:'Lat pulldown',exact:true}).click();
 await page.getByLabel('Target reps set 1 Lat pulldown').fill('12');
 await page.getByLabel('Target kg set 1 Lat pulldown').fill('40');
 await page.getByRole('button',{name:'Save Routine'}).click();
 await expect(page.getByRole('heading',{name:'Pull Day'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Pull Day'})).toBeVisible();
 await page.getByRole('button',{name:'Edit Pull Day'}).click();
 await page.getByLabel('Routine name').fill('Back Day');
 await page.getByRole('button',{name:'Save Routine'}).click();
 await page.getByRole('button',{name:'Start Back Day'}).click();
 await expect(page.getByRole('heading',{name:'Lat pulldown'})).toBeVisible();
 await expect(page.getByLabel('Target reps set 1 Lat pulldown')).toHaveValue('12');
 await expect(page.getByLabel('Target kg set 1 Lat pulldown')).toHaveValue('40');
 await page.getByLabel('Target reps set 1 Lat pulldown').fill('8');
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Pulihkan sesi'}).click();
 await expect(page.getByLabel('Target reps set 1 Lat pulldown')).toHaveValue('8');
 await page.getByRole('button',{name:'Selesaikan workout'}).click();
 await page.getByRole('button',{name:'Back to Workouts'}).click();
 await page.getByRole('button',{name:'Edit Back Day'}).click();
 await expect(page.getByLabel('Target reps set 1 Lat pulldown')).toHaveValue('12');
 await page.getByRole('button',{name:'Cancel'}).click();
 await page.getByRole('button',{name:'Delete Back Day'}).click();
 await page.getByRole('button',{name:'Confirm delete routine'}).click();
 await expect(page.getByRole('heading',{name:'Back Day'})).toHaveCount(0);
});

test('active workout does not overflow phone widths',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 await page.goto(url);await page.getByRole('button',{name:'Start Empty Workout'}).click();
 await page.getByRole('button',{name:'Add Exercise'}).click();
 await page.getByRole('button',{name:'Dumbbell curl',exact:true}).click();

 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const layout=await page.evaluate(()=>({
   viewport:window.innerWidth,
   document:document.documentElement.scrollWidth,
   bounds:['.gymbro-shell','.gymbro-stats','.gymbro-workout-card'].map(selector=>{
    const element=document.querySelector(selector);
    if(!element)return {selector,missing:true,left:-1,right:Number.POSITIVE_INFINITY};
    const rect=element.getBoundingClientRect();
    return {selector,missing:false,left:rect.left,right:rect.right};
   }),
  }));
  expect(layout.document,`document width at ${width}px: ${JSON.stringify(layout.bounds)}`).toBeLessThanOrEqual(width);
  for(const item of layout.bounds){
   expect(item.missing,`${item.selector} should exist at ${width}px`).toBe(false);
   expect(item.left,`${item.selector} left edge at ${width}px`).toBeGreaterThanOrEqual(0);
   expect(item.right,`${item.selector} right edge at ${width}px`).toBeLessThanOrEqual(width);
  }
  const table=await page.locator('.gymbro-set-table').evaluate(element=>({client:element.clientWidth,scroll:element.scrollWidth}));
  expect(table.client,`set table width at ${width}px`).toBeLessThanOrEqual(width);
  expect(table.scroll,`set rows should remain internally scrollable at ${width}px`).toBeGreaterThan(table.client);
 }
});

test('fallback entry is absent from an active workout',async({page})=>{
 await page.goto(url);
 await page.getByRole('button',{name:'Start Empty Workout'}).click();
 await expect(page.getByRole('button',{name:'Add Exercise'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Jeda workout'})).toBeVisible();
 await expect(page.getByText('Fallback entry',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Catat set manual'})).toHaveCount(0);
 await expect(page.getByLabel('Reps manual')).toHaveCount(0);
});

test('explore searches and filters the local exercise catalogue without starting a session',async({page})=>{
 await page.goto(url);await page.getByRole('button',{name:'Explore'}).click();
 await page.getByLabel('Search exercises').fill('row');
 await expect(page.getByRole('button',{name:'Seated cable row',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Squat',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Seated cable row',exact:true}).click();
 await expect(page.getByTestId('exercise-animation')).toBeVisible();
 await expect(page.getByText(/Beban kg pada mesin/)).toBeVisible();
 await page.getByRole('button',{name:'Back to Explore'}).click();
 await page.getByLabel('Search exercises').fill('');
 await page.getByLabel('Equipment filter').selectOption('bodyweight');
 await expect(page.getByRole('button',{name:'Squat',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Dumbbell curl',exact:true})).toHaveCount(0);
});

test('exercise camera fills a phone viewport and closing it clears the live feed',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await injectFrames(page,Array.from({length:100},()=>pose('dumbbell-curl',170)));
 await page.goto(url);await page.getByRole('button',{name:'Start Empty Workout'}).click();
 await page.getByRole('button',{name:'Add Exercise'}).click();
 await page.getByRole('button',{name:'Dumbbell curl',exact:true}).click();
 await page.getByRole('button',{name:'Open camera for Dumbbell curl'}).click();
 const camera=page.getByTestId('full-screen-camera');
 await expect(camera).toBeVisible();
 await openCameraControls(page);
 const bounds=await camera.boundingBox();expect(bounds).not.toBeNull();
 expect(bounds!.height).toBeGreaterThanOrEqual(840);
 expect(bounds!.width).toBeGreaterThanOrEqual(390);
 await expect(page.getByTestId('live-rep-counter')).toBeVisible();
 await expect(page.getByRole('button',{name:'Jeda kamera'})).toBeVisible();
 await expect(page.getByTestId('camera-framing-overlay').locator('[data-joint-index="15"]')).toHaveCount(1);
 await page.getByRole('button',{name:'Back to workout'}).click();
 await expect(camera).toHaveCount(0);
 await expect(page.getByText('Total reps: 0',{exact:true})).toBeVisible();
});
