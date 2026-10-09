import type {Page} from '@playwright/test';
import type {Landmark} from '../../src/detection/pose-phase-adapter';
import type {WorkerRequest,WorkerReply} from '../../src/detection/worker-protocol';

// Replaces only model output; browser camera, detector bridge and UI remain real.
export async function injectFrames(page:Page,frames:Landmark[][]):Promise<void>{
 await page.addInitScript((fixtures:Landmark[][])=>{
  class ReplayWorker{
   onmessage:((event:{data:WorkerReply})=>void)|null=null;onerror=null;
   next=0;active=true;terminate(){this.active=false;}
   postMessage(request:WorkerRequest){
    const reply:WorkerReply=request.kind==='init'?{kind:'ready',requestId:request.requestId}
     :{kind:'pose',requestId:request.requestId,frame:{timestampMs:request.timestampMs,aspectRatio:1,landmarks:fixtures[this.next++]??[]}};
    if(request.kind==='frame')request.bitmap.close();
    queueMicrotask(()=>{if(this.active)this.onmessage?.({data:reply});});
   }
  }
  Object.defineProperty(window,'Worker',{value:ReplayWorker});
 },frames);
}
