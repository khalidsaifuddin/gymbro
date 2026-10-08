import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserPoseDetector, type PoseWorkerPort } from './browser-pose-detector';
import type { WorkerReply, WorkerRequest } from './worker-protocol';

class FakeWorker implements PoseWorkerPort {
  onmessage: PoseWorkerPort['onmessage']=null;
  onerror: PoseWorkerPort['onerror']=null;
  messages: {message: WorkerRequest; transfer: Transferable[]}[]=[];
  terminate=vi.fn();
  postMessage(message: WorkerRequest, transfer: Transferable[]) { this.messages.push({message,transfer}); }
  reply(message: WorkerReply) { this.onmessage?.({data:message} as MessageEvent<WorkerReply>); }
}
function bitmap() { return {width:640,height:480,close:vi.fn()} as unknown as ImageBitmap; }
function setup() { const worker=new FakeWorker(); return {worker,detector:new BrowserPoseDetector(() => worker)}; }
async function ready(worker: FakeWorker, detector: BrowserPoseDetector) {
  const promise=detector.initialize();
  promise.catch(() => {}); // Attach a handler before inspecting stub messages during RED.
  const request=worker.messages.at(-1)!.message;
  worker.reply({kind:'ready',requestId:request.requestId});
  await promise;
}
afterEach(() => vi.useRealTimers());
describe('browser worker boundary', () => {
  it('init menunggu ready, bukan hanya worker tercipta', async () => {
    const {worker,detector}=setup(); const done=vi.fn();
    const initialization=detector.initialize().then(done);
    initialization.catch(() => {});
    expect(worker.messages[0].message.kind).toBe('init');
    await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    worker.reply({kind:'ready',requestId:worker.messages[0].message.requestId});
    await initialization; expect(done).toHaveBeenCalledOnce(); detector.stop();
  });
  it('frame ditransfer ke worker, pose dikembalikan tanpa bitmap', async () => {
    const {worker,detector}=setup(); await ready(worker,detector);
    const image=bitmap(), pending=detector.detect(image,100);
    pending.catch(() => {});
    const message=worker.messages.at(-1)!;
    expect(message.transfer).toEqual([image]);
    worker.reply({kind:'pose',requestId:message.message.requestId,frame:{timestampMs:100,landmarks:[],aspectRatio:4/3}});
    expect(await pending).toEqual({timestampMs:100,landmarks:[],aspectRatio:4/3}); detector.stop();
  });
  it('frame sebelum model siap ditutup dan ditolak', async () => {
    const {detector}=setup(), image=bitmap();
    await expect(detector.detect(image,100)).rejects.toThrow(/ready/);
    expect(image.close).toHaveBeenCalledOnce(); detector.stop();
  });
  it('frame kedua saat inference sibuk dibuang agar antrean tidak tumbuh', async () => {
    const {worker,detector}=setup(); await ready(worker,detector);
    const first=detector.detect(bitmap(),100), second=bitmap();
    expect(await detector.detect(second,120)).toBeNull(); expect(second.close).toHaveBeenCalledOnce();
    worker.reply({kind:'pose',requestId:worker.messages.at(-1)!.message.requestId,frame:{timestampMs:100,landmarks:[]}});
    await first; detector.stop();
  });
  it('error model menjelaskan failure dan tidak mengaku ready', async () => {
    const {worker,detector}=setup(); const promise=detector.initialize();
    promise.catch(() => {});
    worker.reply({kind:'error',requestId:worker.messages[0].message.requestId,message:'Model unavailable'});
    await expect(promise).rejects.toThrow('Model unavailable'); detector.stop();
  });
  it('stop menolak frame tertunda dan menghentikan worker', async () => {
    const {worker,detector}=setup(); await ready(worker,detector);
    const pending=detector.detect(bitmap(),100); detector.stop();
    await expect(pending).rejects.toThrow(/stopped/); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('requestId salah tidak menyelesaikan inference lain', async () => {
    const {worker,detector}=setup(); await ready(worker,detector);
    const done=vi.fn(), pending=detector.detect(bitmap(),100).then(done);
    pending.catch(() => {});
    worker.reply({kind:'pose',requestId:999,frame:{timestampMs:100,landmarks:[]}});
    await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    worker.reply({kind:'pose',requestId:worker.messages.at(-1)!.message.requestId,frame:{timestampMs:100,landmarks:[]}});
    await pending; detector.stop();
  });
  it('init yang tidak menjawab mengalami timeout', async () => {
    vi.useFakeTimers(); const {worker,detector}=setup();
    const assertion=expect(detector.initialize()).rejects.toThrow(/timeout/);
    assertion.catch(() => {});
    await vi.advanceTimersByTimeAsync(30001); await assertion;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('timestamp nonfinite ditolak dan bitmap ditutup', async () => {
    const {worker,detector}=setup(); await ready(worker,detector); const image=bitmap();
    await expect(detector.detect(image,NaN)).rejects.toThrow(/timestamp/);
    expect(image.close).toHaveBeenCalledOnce(); detector.stop();
  });
});
