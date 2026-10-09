import type {Page} from '@playwright/test';
import {exerciseCatalog,type ExerciseId} from '../../src/domain/exercises';

export async function startEmptyWorkout(page:Page){
 await page.getByRole('button',{name:'Start Empty Workout'}).click();
}
export async function addExercise(page:Page,id:ExerciseId){
 await page.getByRole('button',{name:'Add Exercise'}).click();
 await page.getByRole('button',{name:exerciseCatalog[id].label,exact:true}).click();
}
export async function openCameraFor(page:Page,id:ExerciseId){
 await addExercise(page,id);
 await page.getByRole('button',{name:`Open camera for ${exerciseCatalog[id].label}`}).click();
}
export async function openAutomaticCamera(page:Page){
 if(!await page.getByRole('button',{name:'Open automatic camera'}).count())await addExercise(page,'squat');
 await page.getByRole('button',{name:'Open automatic camera'}).click();
}
export async function openCameraControls(page:Page){
 const toggle=page.getByRole('button',{name:'Open camera controls'});
 if(await toggle.count())await toggle.click();
}
export async function logPlannedSet(page:Page,id:ExerciseId,reps:string,kg=''){
 const label=exerciseCatalog[id].label;
 let card=page.locator('.gymbro-workout-card').filter({has:page.getByRole('heading',{name:label,exact:true})});
 if(!await card.count()){
  await addExercise(page,id);
  card=page.locator('.gymbro-workout-card').filter({has:page.getByRole('heading',{name:label,exact:true})});
 }
 for(let index=1;index<=20;index++){
  const completed=card.getByLabel(`Completed set ${index} ${label}`);
  if(!await completed.count()){
   await card.getByRole('button',{name:`Add Set ${label}`}).click();
  }
  const checkbox=card.getByLabel(`Completed set ${index} ${label}`);
  if(await checkbox.isChecked())continue;
  await card.getByLabel(`Target reps set ${index} ${label}`).fill(reps);
  await card.getByLabel(`Target kg set ${index} ${label}`).fill(kg);
  await checkbox.check();
  return;
 }
 throw new Error(`No planned set row is available for ${label}`);
}
