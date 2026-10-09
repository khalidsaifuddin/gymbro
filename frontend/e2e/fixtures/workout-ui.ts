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
