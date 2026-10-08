import type { PoseFrame } from './pose-phase-adapter';
import type { WorkerReply, WorkerRequest } from './worker-protocol';

export interface PoseWorkerPort {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: WorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
}
export class BrowserPoseDetector {
  private worker: PoseWorkerPort | null=null;
  private ready=false;
  private stopped=false;
  private busy=false;
  private nextId=0;
  private lastTimestamp=-1;
  private initialization: Promise<void> | null=null;
  private pending=new Map<number, {
    expected: 'ready' | 'pose'; resolve: (reply: WorkerReply) => void;
    reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>;
  }>();

  constructor(private factory: () => PoseWorkerPort = () => new Worker('/vision/pose.worker.js')) {}

  initialize(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('Pose detector stopped'));
    if (this.initialization) return this.initialization;
    try { this.worker=this.factory(); }
    catch { return Promise.reject(new Error('Pose worker unsupported; use manual logging')); }
    this.worker.onmessage=event => {
      const reply=event.data, entry=this.pending.get(reply.requestId);
      if (!entry) return;
      if (reply.kind==='error') { this.halt(new Error(reply.message)); return; }
      if (reply.kind!==entry.expected) { this.halt(new Error('Invalid pose worker response')); return; }
      clearTimeout(entry.timer); this.pending.delete(reply.requestId); entry.resolve(reply);
    };
    this.worker.onerror=() => this.halt(new Error('Pose worker failed; use manual logging'));
    this.initialization=this.send({kind:'init'},'ready',[],30000).then(() => { this.ready=true; });
    return this.initialization;
  }

  async detect(bitmap: ImageBitmap, timestampMs: number): Promise<PoseFrame | null> {
    if (!this.ready || this.stopped) { bitmap.close(); throw new Error('Pose detector not ready or stopped'); }
    if (!Number.isFinite(timestampMs) || timestampMs<0 || timestampMs<=this.lastTimestamp) {
      bitmap.close(); throw new Error('Invalid frame timestamp');
    }
    if (this.busy) { bitmap.close(); return null; }
    this.busy=true; this.lastTimestamp=timestampMs;
    try {
      const reply=await this.send({kind:'frame',bitmap,timestampMs},'pose',[bitmap],5000);
      if (reply.kind!=='pose') throw new Error('Invalid pose reply');
      return reply.frame;
    } finally { this.busy=false; }
  }

  stop(): void { this.halt(new Error('Pose detector stopped')); }

  private send(message: {kind:'init'} | {kind:'frame'; bitmap:ImageBitmap; timestampMs:number},
      expected:'ready'|'pose', transfer:Transferable[], timeoutMs:number): Promise<WorkerReply> {
    const requestId=++this.nextId;
    return new Promise((resolve,reject) => {
      const timer=setTimeout(() => this.halt(new Error('Pose worker timeout; use manual logging')),timeoutMs);
      this.pending.set(requestId,{expected,resolve,reject,timer});
      try { this.worker!.postMessage({...message,requestId},transfer); }
      catch {
        if (message.kind==='frame') message.bitmap.close();
        this.halt(new Error('Pose frame transfer failed; use manual logging'));
      }
    });
  }

  private halt(error: Error): void {
    if (this.stopped) return;
    this.stopped=true; this.ready=false;
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    this.pending.clear(); this.worker?.terminate();
  }
}
