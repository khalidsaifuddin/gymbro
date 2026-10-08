import { BrowserPoseDetector } from '../../src/detection/browser-pose-detector';
import type { PoseFrame } from '../../src/detection/pose-phase-adapter';

declare global { interface Window { runPoseSmoke: () => Promise<PoseFrame | null> } }
window.runPoseSmoke=async () => {
  const detector=new BrowserPoseDetector();
  try {
    await detector.initialize();
    const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=480;
    const context=canvas.getContext('2d')!;
    context.fillStyle='#000'; context.fillRect(0,0,640,480);
    return await detector.detect(await createImageBitmap(canvas),100);
  } finally { detector.stop(); }
};
