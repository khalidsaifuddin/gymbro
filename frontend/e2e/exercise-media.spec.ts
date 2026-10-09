import {test,expect} from '@playwright/test';
import {exerciseCatalog,type ExerciseId} from '../src/domain/exercises';
import {exerciseMedia} from '../src/domain/exercise-media';

test('Explore auto-plays the Flow animation above instructions and preserves entry context',async({page})=>{
 await page.goto('http://127.0.0.1:8081/');await page.getByRole('button',{name:'Explore'}).click();
 const search=page.getByRole('textbox',{name:'Search exercises'});await search.fill('push-up');
 const frame=page.waitForResponse(response=>response.url().includes('/exercise-media/')&&response.url().endsWith('/0662/frame-00.svg'));
 await page.getByRole('button',{name:'Info Push-up',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Push-up',level:1})).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop animation'})).toBeVisible();
 await expect(page.locator('.gymbro-exercise-media-stage img')).toHaveAttribute('src',/0662\/frame-00\.svg$/);
 expect((await frame).status()).toBe(200);
 const playerTop=await page.locator('.gymbro-exercise-media').evaluate(element=>element.getBoundingClientRect().top);
 const detailsTop=await page.locator('[aria-label="Exercise details"]>.saka-card').evaluate(element=>element.getBoundingClientRect().top);
 expect(playerTop).toBeLessThan(detailsTop);
 await page.getByRole('button',{name:'Stop animation'}).click();await expect(page.locator('.gymbro-exercise-media-stage img')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Play animation'})).toBeVisible();
 await expect(page.getByText(/provenance is incomplete/i)).toBeVisible();
 await page.getByRole('button',{name:'Back to exercises'}).click();

 const noArtId=Object.entries(exerciseMedia).find(([,record])=>record.animation===null)?.[0];expect(noArtId).toBeTruthy();
 const noArtLabel=exerciseCatalog[`dataset:${noArtId}` as ExerciseId].label;
 await search.fill(noArtLabel);await page.getByRole('button',{name:`Info ${noArtLabel}`,exact:true}).click();
 await expect(page.getByText('No movement illustration is available for this exercise.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Play animation'})).toHaveCount(0);
 await page.getByRole('button',{name:'Back to exercises'}).click();

 await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'+ Start Empty Workout'}).click();
 await page.getByRole('button',{name:'+ Add Exercise'}).click();await page.getByRole('textbox',{name:'Search exercises'}).fill('push-up');
 await page.getByRole('button',{name:'Info Push-up',exact:true}).click();await page.getByRole('button',{name:'Add Push-up'}).click();
 await expect(page.getByRole('heading',{name:'Push-up',level:2})).toBeVisible();
 await page.getByRole('button',{name:'Push-up',exact:true}).click();await expect(page.getByRole('heading',{name:'Push-up',level:1})).toBeVisible();
 await page.getByRole('button',{name:'Back to exercises'}).click();await expect(page.getByRole('heading',{name:'Log Workout'})).toBeVisible();
});

test('completed sets can be edited, unchecked across reload, restored, and deleted without shifting neighbors',async({page})=>{
 await page.goto('http://127.0.0.1:8081/');await page.getByRole('button',{name:'+ Start Empty Workout'}).click();
 await page.getByRole('button',{name:'+ Add Exercise'}).click();await page.getByRole('button',{name:'Push-up',exact:true}).click();
 for(const [index,reps] of [[1,'8'],[2,'9'],[3,'10']] as const){
  await page.getByLabel(`Target reps set ${index} Push-up`).fill(reps);
  await page.getByLabel(`Target kg set ${index} Push-up`).fill('5');
  await page.getByLabel(`Completed set ${index} Push-up`).check();
 }
 await expect(page.getByText('Total reps: 27',{exact:true})).toBeVisible();
 await page.getByLabel('Reps set 2 Push-up').fill('7');await page.getByLabel('Save set 2 Push-up').click();
 await expect(page.getByText('Total reps: 25',{exact:true})).toBeVisible();
 await page.getByLabel('Completed set 2 Push-up').uncheck();await expect(page.getByText('Total reps: 18',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Target reps set 2 Push-up')).toHaveValue('7');
 await expect(page.getByText('Tersimpan di perangkat',{exact:true})).toBeVisible();await page.reload();
 await page.getByRole('button',{name:'Pulihkan sesi',exact:true}).click();
 await expect(page.getByText('Total reps: 18',{exact:true})).toBeVisible();await expect(page.getByLabel('Completed set 2 Push-up')).not.toBeChecked();
 await page.getByLabel('Completed set 2 Push-up').check();await expect(page.getByText('Total reps: 25',{exact:true})).toBeVisible();
 await page.getByLabel('Delete set 2 Push-up').click();await page.getByRole('button',{name:'Hapus',exact:true}).click();
 await expect(page.getByText('Total reps: 18',{exact:true})).toBeVisible();await expect(page.getByLabel('Completed set 1 Push-up')).toBeChecked();await expect(page.getByLabel('Completed set 2 Push-up')).toBeChecked();
});
