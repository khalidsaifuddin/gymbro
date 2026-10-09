import {afterEach,expect,it,vi} from 'vitest';
import type {WorkerRequest} from './worker-protocol';

const model=vi.hoisted(()=>({detectForVideo:vi.fn()}));
vi.mock('@mediapipe/tasks-vision',()=>({
  FilesetResolver:{forVisionTasks:vi.fn(async()=>({}))},
  PoseLandmarker:{createFromOptions:vi.fn(async()=>model)},
}));
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});

it('transports image and world joints from the same prediction without retaining the frame',async()=>{
  const landmarks=[{x:.5,y:.2,z:-.1,visibility:.9,presence:.9}];
  const worldLandmarks=[{x:-.2,y:-.4,z:.1,visibility:.9,presence:.9}];
  model.detectForVideo.mockReturnValue({landmarks:[landmarks],worldLandmarks:[worldLandmarks]});
  const postMessage=vi.fn(),close=vi.fn();
  vi.stubGlobal('location',new URL('http://localhost:8080/vision/pose.worker.js'));
  vi.stubGlobal('postMessage',postMessage);vi.stubGlobal('onmessage',null);
  await import('./pose.worker');
  const request:WorkerRequest={kind:'frame',requestId:2,timestampMs:100,bitmap:{width:640,height:480,close} as unknown as ImageBitmap};
  await (globalThis as unknown as {onmessage:(event:{data:WorkerRequest})=>Promise<void>}).onmessage({data:request});
  expect(postMessage).toHaveBeenCalledWith({kind:'pose',requestId:2,frame:{timestampMs:100,
    landmarks,worldLandmarks,aspectRatio:4/3}});
  expect(close).toHaveBeenCalledOnce();
});
