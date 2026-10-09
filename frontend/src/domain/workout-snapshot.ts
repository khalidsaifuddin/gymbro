import type {SessionSnapshot,WorkoutSet} from './workout';
import {isExerciseId} from './exercises';

// Strict versioned boundary: persisted records may be corrupt or edited outside the app.
export function validateSnapshot(value:unknown):SessionSnapshot {
  const fail=():never=>{throw new Error('Invalid workout snapshot');};
  const object=(v:unknown,keys:string[]):Record<string,unknown>=>{
    if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))return fail();
    return v as Record<string,unknown>;
  };
  const time=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=2147483647;
  const s=object(value,['version','startedAt','finishedAt','savedAt','currentSetId','sets','pauses']);
  if(s.version!==1||!time(s.startedAt)||!time(s.savedAt)||s.savedAt<s.startedAt||
    !(s.finishedAt===null||(time(s.finishedAt)&&s.finishedAt>=s.startedAt&&s.finishedAt<=s.savedAt))||
    !(s.currentSetId===null||typeof s.currentSetId==='string')||!Array.isArray(s.sets)||!Array.isArray(s.pauses))return fail();
  const start=s.startedAt,end=s.finishedAt??s.savedAt;
  const set=(v:unknown,depth=0):void=>{
    if(depth>20)return fail();
    const r=object(v,['id','exercise','detectedReps','origin','reps','startedAt','endedAt','lastRepAt','loadKg','implementCount','sourceIds','mergedFrom','loadEdited','labelSource','rawExercise']);
    if(typeof r.id!=='string'||!r.id||!isExerciseId(r.exercise)||
      !['automatic','manual','mixed'].includes(String(r.origin))||!count(r.reps)||!count(r.detectedReps)||
      !time(r.startedAt)||r.startedAt<start||!time(r.lastRepAt)||r.lastRepAt<r.startedAt||r.lastRepAt>end||
      !(r.endedAt===null||(time(r.endedAt)&&r.endedAt>=r.lastRepAt&&r.endedAt<=end))||
      !(r.loadKg===null||(typeof r.loadKg==='number'&&Number.isFinite(r.loadKg)&&r.loadKg>=0&&r.loadKg<=99999.999))||
      !count(r.implementCount)||r.implementCount<1||r.implementCount>32767||
      !Array.isArray(r.sourceIds)||!r.sourceIds.length||r.sourceIds.some(id=>typeof id!=='string'||!id)||
      (r.loadEdited!==undefined&&typeof r.loadEdited!=='boolean')||
      (r.labelSource!==undefined&&!['automatic','profile','manual','mixed'].includes(String(r.labelSource)))||
      (r.rawExercise!==undefined&&r.rawExercise!==null&&!isExerciseId(r.rawExercise))||
      (r.rawExercise!=null&&r.labelSource!=='automatic'))return fail();
    if(r.mergedFrom!==undefined){if(!Array.isArray(r.mergedFrom)||r.mergedFrom.length<2)return fail();r.mergedFrom.forEach(x=>set(x,depth+1));}
  };
  s.sets.forEach(v=>set(v));
  const sets=s.sets as WorkoutSet[],open=sets.filter(r=>r.endedAt===null);
  if(new Set(sets.map(r=>r.id)).size!==sets.length||
    (s.currentSetId===null?open.length!==0:open.length!==1||open[0].id!==s.currentSetId||open[0]!==sets.at(-1))||
    (s.finishedAt!==null&&open.length))return fail();
  let previousEnd=start;
  const pauses=s.pauses;
  pauses.forEach((v,index)=>{
    const p=object(v,['start','end']);
    if(!time(p.start)||p.start<previousEnd||p.start>end||
      !(p.end===null||(time(p.end)&&p.end>=p.start&&p.end<=end))||
      (p.end===null&&(index!==pauses.length-1||s.finishedAt!==null)))return fail();
    previousEnd=p.end===null?end:p.end as number;
  });
  return structuredClone(value) as SessionSnapshot;
}
