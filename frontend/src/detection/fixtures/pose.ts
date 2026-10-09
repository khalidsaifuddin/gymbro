import type { ExerciseId } from '../../domain/workout';
import type {SupportedExerciseId} from '../../domain/exercises';
import type { Landmark } from '../pose-phase-adapter';

export const exercises: SupportedExerciseId[] = ['squat', 'push-up', 'dumbbell-curl', 'machine-shoulder-press', 'bench-press'];
export const readyAngle = (exercise: ExerciseId) => exercise.includes('press') ? 90 : 170;
export const peakAngle = (exercise: ExerciseId) => exercise.includes('press') ? 170 : exercise === 'dumbbell-curl' ? 55 : 90;

// Fixture geometris sintetis. Tidak merepresentasikan video/orang/model nyata.
export function pose(exercise: ExerciseId, angle: number, rightAngle = angle): Landmark[] {
  const points: Landmark[] = Array.from({length: 33}, () => ({x: .5, y: .5, visibility: 1, presence: 1}));
  const horizontal = exercise === 'push-up' || exercise === 'bench-press';
  for (let side = 0; side < 2; side++) {
    const x = .32 + side * .2, shift = side * .02;
    points[11+side] = {x, y: .2+shift, visibility: 1, presence: 1};
    points[23+side] = {x: horizontal ? x+.22 : x, y: horizontal ? .2+shift : .5+shift, visibility: 1, presence: 1};
    points[13+side] = {x, y: .35+shift, visibility: 1, presence: 1};
    const armAngle=exercise === 'squat' ? 170 : (side ? rightAngle : angle);
    const radians=armAngle*Math.PI/180;
    points[15+side] = {x: x+.14*Math.sin(radians), y: .35+shift-.14*Math.cos(radians), visibility: 1, presence: 1};
    if(exercise==='machine-shoulder-press'){
      // Press endpoints: hands near/above shoulders, then overhead. The old
      // generic curl arm placed hands at chest level and resembled pulldown.
      const progress=Math.max(0,Math.min(1,(armAngle-90)/80));
      const elbowX=x-.12+.11*progress,elbowY=.27-.15*progress+shift;
      const upperDirection=Math.atan2(points[11+side].y-elbowY,x-elbowX);
      const forearm=upperDirection-radians;
      points[13+side]={x:elbowX,y:elbowY,visibility:1,presence:1};
      points[15+side]={x:elbowX+.1*Math.cos(forearm),y:elbowY+.1*Math.sin(forearm),visibility:1,presence:1};
    }
    if (exercise === 'bench-press') {
      points[13+side]={x:x+.14,y:.2+shift,visibility:1,presence:1};
      points[15+side]={x:x+.14-.14*Math.cos(radians),y:.2+shift-.14*Math.sin(radians),visibility:1,presence:1};
    }
    const kneeRadians=(exercise === 'squat' ? (side ? rightAngle : angle) : 170)*Math.PI/180;
    const seated = exercise === 'machine-shoulder-press';
    const kneeX = seated ? x+.16 : x;
    const kneeY = seated ? .5+shift : .7+shift;
    points[25+side] = {x: kneeX, y: kneeY, visibility: 1, presence: 1};
    points[27+side] = seated
      ? {x: kneeX, y: kneeY+.16, visibility: 1, presence: 1}
      : {x: kneeX+.14*Math.sin(kneeRadians), y: kneeY-.14*Math.cos(kneeRadians), visibility: 1, presence: 1};
  }
  return points;
}
