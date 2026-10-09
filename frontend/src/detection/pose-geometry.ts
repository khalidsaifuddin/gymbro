import type {Landmark,WorldLandmark} from './pose-phase-adapter';

export function valid(point: Landmark | undefined, minConfidence = .55): point is Landmark {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 &&
    Number.isFinite(point.visibility) && point.visibility! >= minConfidence &&
    (point.presence === undefined || (Number.isFinite(point.presence) && point.presence >= minConfidence));
}

export function angle(a: Landmark, b: Landmark, c: Landmark): number | null {
  const ux=a.x-b.x, uy=a.y-b.y, vx=c.x-b.x, vy=c.y-b.y;
  const length=Math.hypot(ux,uy)*Math.hypot(vx,vy);
  if (length < 1e-8) return null;
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/length)))*180/Math.PI;
}

export function validWorld(point:WorldLandmark|undefined):point is WorldLandmark {
  // World points may be negative or outside [0,1]; image bounds do not apply.
  return !!point && [point.x,point.y,point.z].every(Number.isFinite) &&
    (point.visibility === undefined || (Number.isFinite(point.visibility) && point.visibility >= .35)) &&
    (point.presence === undefined || (Number.isFinite(point.presence) && point.presence >= .45));
}

export function angle3d(a:WorldLandmark,b:WorldLandmark,c:WorldLandmark):number|null {
  const ux=a.x-b.x,uy=a.y-b.y,uz=a.z-b.z;
  const vx=c.x-b.x,vy=c.y-b.y,vz=c.z-b.z;
  const length=Math.hypot(ux,uy,uz)*Math.hypot(vx,vy,vz);
  if(length < 1e-8)return null;
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy+uz*vz)/length)))*180/Math.PI;
}
