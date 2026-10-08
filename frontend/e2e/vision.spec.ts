import { test, expect } from '@playwright/test';

test('MediaPipe worker memakai model/WASM lokal dan tidak mengunggah frame', async ({page}) => {
  const requests: {url:string; method:string}[]=[];
  const errors:string[]=[];
  page.on('request',request => requests.push({url:request.url(),method:request.method()}));
  page.on('pageerror',error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8091/');
  const result=await page.evaluate(async () => {
    return window.runPoseSmoke();
  });
  expect(result).toMatchObject({timestampMs:100,landmarks:[],aspectRatio:4/3});
  expect(errors).toEqual([]);
  expect(requests.some(request => request.url.endsWith('pose_landmarker_full.task'))).toBe(true);
  expect(requests.some(request => request.url.endsWith('.wasm'))).toBe(true);
  expect(requests.every(request => new URL(request.url).origin==='http://127.0.0.1:8091' && request.method==='GET')).toBe(true);
});
