import {test,expect} from '@playwright/test';
import {exerciseIds} from '../src/domain/exercises';
test('nine original SVG guides render, animate continuously and provide start/end pose diagrams',async({page})=>{
 await page.goto('http://127.0.0.1:8081/');
 for(const id of exerciseIds){
  await page.getByLabel('Profil kamera').selectOption(id);
  const guide=page.locator('object[data-testid="exercise-animation"]');
  await expect(guide).toHaveAttribute('data',`/exercises/${id}.svg`);
  await expect.poll(()=>guide.evaluate((el)=>!!(el as HTMLObjectElement).contentDocument?.querySelector('animate'))).toBe(true);
  const moves=await guide.evaluate(el=>{
   const svg=(el as HTMLObjectElement).contentDocument!.querySelector('svg')!;
   const capture=()=>Array.from(svg.querySelectorAll<SVGCircleElement>('[data-joint]')).map(c=>[c.cx.animVal.value,c.cy.animVal.value]);
   svg.pauseAnimations();svg.setCurrentTime(0);const before=capture();
   svg.setCurrentTime(1.5);const after=capture();svg.setCurrentTime(.975);const between=capture();
   return {before,after,between};
  });expect(moves.before).not.toEqual(moves.after);expect(moves.between).not.toEqual(moves.before);expect(moves.between).not.toEqual(moves.after);
  await page.getByRole('button',{name:'Lihat pose awal dan akhir',exact:true}).click();
  await expect(guide).toHaveAttribute('data',`/exercises/${id}-poses.svg`);
  await expect.poll(()=>guide.evaluate(el=>(el as HTMLObjectElement).contentDocument?.documentElement.textContent)).toContain('Pose awal');
  await page.getByRole('button',{name:'Lihat animasi gerakan',exact:true}).click();
 }
 await expect(page.getByRole('link',{name:'Lisensi aset CC-BY-4.0',exact:true})).toBeVisible();
});
test('reduced motion displays static positioning diagrams first',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:8081/');
 await expect(page.locator('object[data-testid="exercise-animation"]')).toHaveAttribute('data','/exercises/squat-poses.svg');
});
