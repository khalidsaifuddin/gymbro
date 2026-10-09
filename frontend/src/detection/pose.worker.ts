import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { WorkerRequest, WorkerReply } from './worker-protocol';

const port=globalThis as unknown as {
  location: Location;
  onmessage: (event: MessageEvent<WorkerRequest>) => void;
  postMessage: (reply: WorkerReply) => void;
};
let model: Promise<PoseLandmarker> | null=null;
const load=() => model ??= (async () => {
  const files=await FilesetResolver.forVisionTasks(new URL('/vision/wasm',port.location.href).href);
  return PoseLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:new URL('/vision/pose_landmarker_full.task',port.location.href).href,delegate:'CPU'},
    runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,
    minTrackingConfidence:.6,outputSegmentationMasks:false,
  });
})();
port.onmessage=async event => {
  const request=event.data;
  try {
    const detector=await load();
    if (request.kind==='init') {
      port.postMessage({kind:'ready',requestId:request.requestId}); return;
    }
    const prediction=detector.detectForVideo(request.bitmap,request.timestampMs);
    port.postMessage({kind:'pose',requestId:request.requestId,frame:{timestampMs:request.timestampMs,
      landmarks:prediction.landmarks[0] ?? [],worldLandmarks:prediction.worldLandmarks[0] ?? [],
      aspectRatio:request.bitmap.width/request.bitmap.height}});
  } catch {
    port.postMessage({kind:'error',requestId:request.requestId,
      message:'Model/inference unavailable; check local model assets or use manual logging'});
  } finally {
    if (request.kind==='frame') request.bitmap.close();
  }
};
