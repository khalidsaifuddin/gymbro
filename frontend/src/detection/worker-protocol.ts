import type { PoseFrame } from './pose-phase-adapter';

export type WorkerRequest =
  | { kind: 'init'; requestId: number }
  | { kind: 'frame'; requestId: number; bitmap: ImageBitmap; timestampMs: number };
export type WorkerReply =
  | { kind: 'ready'; requestId: number }
  | { kind: 'pose'; requestId: number; frame: PoseFrame }
  | { kind: 'error'; requestId: number; message: string };
