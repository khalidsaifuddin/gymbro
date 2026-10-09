import type {Landmark} from './pose-phase-adapter';

export function valid(point: Landmark | undefined): point is Landmark {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 &&
    Number.isFinite(point.visibility) && point.visibility! >= .55 &&
    (point.presence === undefined || (Number.isFinite(point.presence) && point.presence >= .55));
}

export function angle(a: Landmark, b: Landmark, c: Landmark): number | null {
  const ux=a.x-b.x, uy=a.y-b.y, vx=c.x-b.x, vy=c.y-b.y;
  const length=Math.hypot(ux,uy)*Math.hypot(vx,vy);
  if (length < 1e-8) return null;
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/length)))*180/Math.PI;
}
