import {describe,expect,it} from 'vitest';
import {pose} from './fixtures/pose';
import {cablePose} from './fixtures/cable-pose';
import {assessFraming,poseOverlayViewBox} from './camera-framing';

const frame=(exercise:'dumbbell-curl'|'squat'|'push-up',degrees=170)=>({timestampMs:0,aspectRatio:16/9,landmarks:pose(exercise,degrees)});

describe('camera framing feedback',()=>{
  it('starts with a placement guide but no invented joints',()=>{
    const result=assessFraming(null,'dumbbell-curl','front');
    expect(result.state).toBe('searching');
    expect(result.message).toContain('Masuk ke bingkai');
    expect(result.joints).toEqual([]);
    expect(result.segments).toEqual([]);
    expect(result.guide).toBe('upper');
  });

  it('shows both arms for a framed curl without calling it a recognized rep',()=>{
    const result=assessFraming(frame('dumbbell-curl'),'dumbbell-curl','front');
    expect(result.state).toBe('framed');
    expect(result.message).toContain('Sendi terlihat');
    expect(result.message).not.toMatch(/rep|dikenali/i);
    expect(result.joints.map(joint=>joint.index)).toEqual(expect.arrayContaining([11,12,13,14,15,16,23,24]));
    expect(result.segments).toContainEqual([13,15]);
    expect(result.segments).toContainEqual([14,16]);
  });

  it('does not draw a connection through a missing wrist and asks for both wrists during curl',()=>{
    const curl=frame('dumbbell-curl');curl.landmarks[15].visibility=.1;
    const result=assessFraming(curl,'dumbbell-curl','side-left');
    expect(result.state).toBe('adjust');
    expect(result.message).toContain('kedua pergelangan tangan');
    expect(result.joints.some(joint=>joint.index===15)).toBe(false);
    expect(result.segments).not.toContainEqual([13,15]);
  });

  it('accepts one visible side for a side-view squat but requires both from the front',()=>{
    const squat=frame('squat');
    for(const base of [11,23,25,27])squat.landmarks[base+1].visibility=.1;
    expect(assessFraming(squat,'squat','side-left').state).toBe('framed');
    expect(assessFraming(squat,'squat','front').state).toBe('adjust');
  });

  it('keeps cable guidance bilateral and requires the face for face pull',()=>{
    const cable={timestampMs:0,landmarks:cablePose('lat-pulldown')};
    expect(assessFraming(cable,'lat-pulldown','side-left').state).toBe('framed');
    cable.landmarks[16].visibility=.1;
    expect(assessFraming(cable,'lat-pulldown','side-left').message).toContain('kedua pergelangan tangan');
    const face={timestampMs:0,landmarks:cablePose('face-pull')};
    face.landmarks[0].visibility=.1;
    expect(assessFraming(face,'face-pull','front').message).toContain('wajah');
  });

  it('asks a person at the edge to center and a distant person to come closer',()=>{
    const edge=frame('dumbbell-curl');
    edge.landmarks.forEach(point=>{point.x-=.29;});
    expect(assessFraming(edge,'dumbbell-curl','front').message).toContain('tengah');
    const small=frame('dumbbell-curl');
    small.landmarks.forEach(point=>{point.x=.5+(point.x-.5)*.25;point.y=.5+(point.y-.5)*.25;});
    expect(assessFraming(small,'dumbbell-curl','front').message).toContain('Mendekat');
  });

  it('keeps portrait and landscape landmark coordinates in the video coordinate space',()=>{
    expect(poseOverlayViewBox(16/9)).toEqual({width:1000,height:562.5});
    expect(poseOverlayViewBox(9/16)).toEqual({width:1000,height:1000/(9/16)});
  });
});
