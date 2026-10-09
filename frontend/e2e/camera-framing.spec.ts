import {test,expect} from '@playwright/test';
import {pose} from '../src/detection/fixtures/pose';
import {injectFrames} from './fixtures/pose-replay';
import {openCameraControls,openCameraFor,startEmptyWorkout} from './fixtures/workout-ui';

test('preview shows live curl joints, missing-wrist guidance, and clears on pause',async({page})=>{
  const hidden=pose('dumbbell-curl',170);hidden[15].visibility=.1;
  await injectFrames(page,Array.from({length:100},()=>hidden));
  await page.goto('http://127.0.0.1:8081/');
  await startEmptyWorkout(page);await openCameraFor(page,'dumbbell-curl');
  const overlay=page.getByTestId('camera-framing-overlay');
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId('camera-framing-status')).toContainText('Masuk ke bingkai');
  await expect(overlay.locator('[data-joint-index]')).toHaveCount(0);
  await openCameraControls(page);
  await expect(page.getByTestId('camera-framing-status')).toContainText('kedua pergelangan tangan');
  await expect(overlay.locator('[data-joint-index="14"]')).toHaveCount(1);
  await expect(overlay.locator('[data-joint-index="15"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Jeda kamera',exact:true}).click();
  await expect(overlay.locator('[data-joint-index]')).toHaveCount(0);
});

test('framed curl shows bilateral skeleton without changing the rep count',async({page})=>{
  const valid=pose('dumbbell-curl',170);
  await injectFrames(page,Array.from({length:100},()=>valid));
  await page.goto('http://127.0.0.1:8081/');
  await startEmptyWorkout(page);await openCameraFor(page,'dumbbell-curl');
  await openCameraControls(page);
  await expect(page.getByTestId('camera-framing-status')).toContainText('Sendi terlihat');
  const overlay=page.getByTestId('camera-framing-overlay');
  await expect(overlay.locator('[data-joint-index="15"]')).toHaveCount(1);
  await expect(overlay.locator('[data-joint-index="16"]')).toHaveCount(1);
  const alignmentError=()=>page.evaluate(({x,y})=>{
    const video=document.querySelector('video')!;
    const joint=document.querySelector('[data-joint-index="15"]')!;
    const box=video.getBoundingClientRect(),dot=joint.getBoundingClientRect();
    const scale=Math.min(box.width/video.videoWidth,box.height/video.videoHeight);
    const imageWidth=video.videoWidth*scale,imageHeight=video.videoHeight*scale;
    return {x:Math.abs(dot.left+dot.width/2-(box.left+(box.width-imageWidth)/2+x*imageWidth)),
      y:Math.abs(dot.top+dot.height/2-(box.top+(box.height-imageHeight)/2+y*imageHeight))};
  },{x:valid[15].x,y:valid[15].y});
  for(const error of Object.values(await alignmentError()))expect(error).toBeLessThan(3);
  await page.setViewportSize({width:390,height:844});
  for(const error of Object.values(await alignmentError()))expect(error).toBeLessThan(3);
  await expect(page.getByTestId('live-rep-counter')).toHaveText('0');
});
