// Session configuration only; this is not an inferred pose label or accuracy claim.
export const cameraViews=['auto','front','back','front-left','front-right','rear-left','rear-right','side-left','side-right'] as const;
export type CameraView=typeof cameraViews[number];
export function isCameraView(value:unknown):value is CameraView {
 return typeof value==='string'&&(cameraViews as readonly string[]).includes(value);
}
export function allowsSingleSide(view:CameraView):boolean {
 return view!=='auto'&&view!=='front'&&view!=='back';
}
