import {useEffect,useRef,useState} from 'react';
import {type ExerciseId,type WorkoutSet,type WorkoutSummary} from '../domain/workout';
import {reconcileSessionSetRows,withoutSessionSetRow,type SessionSetRow,type SessionSetRows} from '../domain/session-set-rows';
import type {SetTarget} from '../domain/session-plan';
import AccountPanel from './AccountPanel.web';
import {useAccount} from '../sync/use-account.web';
import {useLocalWorkout} from '../storage/use-local-workout.web';
import WorkoutLog from './WorkoutLog.web';
import type {LocalWorkout} from '../storage/workout-store';
import {useOfflineCache} from '../storage/use-offline-cache.web';
import {LocalRecorder,browserRecorderEnvironment} from '../recording/local-recorder';
import ExerciseGuide from './ExerciseGuide.web';
import {BrowserPoseDetector} from '../detection/browser-pose-detector';
import {TemporalExerciseRecognizer} from '../detection/temporal-exercise-recognizer';
import {cameraGuidance,cameraViewLabels,exerciseLabels} from '../detection/camera-guides';
import {isCameraView,type CameraView} from '../domain/camera-view';
import type {PoseFrame} from '../detection/pose-phase-adapter';
import CameraFramingOverlay from './CameraFramingOverlay.web';
import {copyPlan,emptyTargets,type PlannedExercise} from '../domain/session-plan';
import {useRoutines} from '../storage/use-routines.web';
import type {Routine} from '../storage/routine-store';
import RoutineEditor from './RoutineEditor.web';
import ExerciseBrowser from './ExerciseBrowser.web';
import ExerciseDetails from './ExerciseDetails.web';
import ExercisePlanCards from './ExercisePlanCards.web';
import {exerciseCatalog,isSupportedExerciseId,supportedExerciseIds,type SupportedExerciseId} from '../domain/exercises';

type Choice='auto'|SupportedExerciseId;
const initial:WorkoutSummary={totalSets:0,totalReps:0,knownVolumeKg:0,volumeComplete:true,durationMs:0,pausedDurationMs:0,restDurationMs:0};
function Button({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
  return <button className="saka-btn" aria-label={label} onClick={onPress} disabled={disabled}>{label}</button>;
}
export default function CameraPrototype() {
  const account=useAccount(),local=useLocalWorkout(account.user?.id??null),{workout,getWorkout}=local;
  const routines=useRoutines();
  const offlineStatus=useOfflineCache();
  const video=useRef<HTMLVideoElement>(null);
  const [overlayFrame,setOverlayFrame]=useState<PoseFrame|null>(null);
  const [videoAspectRatio,setVideoAspectRatio]=useState(16/9);
  const detector=useRef<BrowserPoseDetector|null>(null), recognizer=useRef(new TemporalExerciseRecognizer());
  const stream=useRef<MediaStream|null>(null), epoch=useRef(0), animation=useRef(0), live=useRef(false);
  const lastObservation=useRef(0);
  const recorder=useRef<LocalRecorder|null>(null),recordOptIn=useRef(false),clipUrls=useRef<string[]>([]);
  const [recordEnabled,setRecordEnabled]=useState(false),[recordNotice,setRecordNotice]=useState('');
  const [recordBusy,setRecordBusy]=useState(false);
  const [clips,setClips]=useState<{url:string;extension:string}[]>([]);
  const releaseClips=()=>{clipUrls.current.forEach(url=>URL.revokeObjectURL(url));clipUrls.current=[];setClips([]);};
  const profile=useRef<Choice>('auto');
  const [choice,setChoice]=useState<Choice>('auto'), [pendingChoice,setPendingChoice]=useState<SupportedExerciseId|null>(null);
  const [pendingAuto,setPendingAuto]=useState<ExerciseId|null>(null),[status,setStatus]=useState('Kamera belum aktif');
  const [running,setRunning]=useState(false),[loading,setLoading]=useState(false),[paused,setPaused]=useState(false);
  const [finished,setFinished]=useState(false),[recognized,setRecognized]=useState<SupportedExerciseId|null>(null);
  const [summary,setSummary]=useState(initial),[sets,setSets]=useState<WorkoutSet[]>([]);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [mode,setMode]=useState<'camera'|'log'>('camera');
  const [cameraView,setCameraView]=useState<CameraView>('auto');
  const [cameraControlsOpen,setCameraControlsOpen]=useState(false);
  const cameraAutoStarted=useRef(false);
  const [screen,setScreen]=useState<'home'|'editor'|'explore'|'picker'|'session'|'camera'|'summary'|'exercise-detail'>('home');
  const [detailExercise,setDetailExercise]=useState<ExerciseId|null>(null),[detailReturnScreen,setDetailReturnScreen]=useState<'home'|'editor'|'session'>('session');
  const [pickerFor,setPickerFor]=useState<'routine'|'session'>('session');
  const [draft,setDraft]=useState<Routine|null>(null),[routineError,setRoutineError]=useState('');
  const [routineBusy,setRoutineBusy]=useState(false),[deleteRoutineId,setDeleteRoutineId]=useState<string|null>(null);
  const [cameraExercise,setCameraExercise]=useState<SupportedExerciseId>('squat');
  const viewFor=(id:SupportedExerciseId)=>local.preferences.current.cameraViews?.[id]??local.preferences.current.cameraView??'auto';
  const refresh=(checkpoint=false) => {
    if(workout.current){
      const prefs=local.preferences.current,next=reconcileSessionSetRows(prefs.sessionRows,prefs.exercisePlan??[],workout.current.getSets(),()=>crypto.randomUUID());
      if(JSON.stringify(next)!==JSON.stringify(prefs.sessionRows))prefs.sessionRows=next;
    }
    local.refresh(checkpoint);
    if (!workout.current) {setSummary(initial);setSets([]);return;}
    setSummary(workout.current.summary());setSets(workout.current.getSets());
    setPendingAuto(workout.current.getPendingExercise());
  };
  const stopResources=() => {
    epoch.current++;live.current=false;cancelAnimationFrame(animation.current);
    setOverlayFrame(null);
    detector.current?.stop();detector.current=null;
    if(recorder.current?.isRecording())setRecordNotice('Rekaman berhenti. Segmen tersedia saat workout selesai.');
    void recorder.current?.pause();
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
    if (video.current) {video.current.pause();video.current.srcObject=null;}
  };
  const pause=() => {
    getWorkout().pause();stopResources();setRunning(false);setLoading(false);setPaused(true);
    setStatus('Kamera dijeda');refresh();
    if(recordOptIn.current)setRecordNotice('Rekaman dijeda. Saat dilanjutkan, video menjadi segmen baru.');
  };
  useEffect(() => {
    const hidden=() => {if (document.hidden&&workout.current&&!workout.current.isFinished()&&!workout.current.isPaused()) pause();};
    document.addEventListener('visibilitychange',hidden);
    const timer=setInterval(()=>{
      if(recorder.current?.error())setRecordNotice('Rekaman gagal. Hasil workout tetap disimpan; tidak ada pemulihan video setelah reload.');
      if(!workout.current)return;
      if (live.current&&lastObservation.current&&Date.now()-lastObservation.current>1000) {
        workout.current?.observe({exercise:null,visible:false,phase:'moving'});
        setOverlayFrame(null);
        setStatus('Tracking terputus. Pastikan tubuh dan sendi terlihat.');
      }
      workout.current?.tick();refresh(true);
    },250);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);stopResources();clipUrls.current.forEach(url=>URL.revokeObjectURL(url));};
  },[]);
  const start=async () => {
    if (loading||finished) return;
    if (document.hidden) {pause();return;}
    const token=++epoch.current;
    getWorkout().resume();setLoading(true);setOverlayFrame(null);setStatus('Memuat kamera dan model…');
    const worker=new BrowserPoseDetector();detector.current=worker;
    recognizer.current=new TemporalExerciseRecognizer({cameraView:cameraView});
    recognizer.current.selectManual(profile.current==='auto'?null:profile.current);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('secure-context');
      const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
      if (epoch.current!==token) {acquired.getTracks().forEach(track=>track.stop());return;}
      stream.current=acquired;
      for (const track of acquired.getVideoTracks()) track.addEventListener('ended',()=>{
        if (epoch.current!==token) return;
        workout.current?.observe({exercise:null,visible:false,phase:'moving'});
        stopResources();setRunning(false);setLoading(false);setStatus('Kamera terputus. Aktifkan kembali untuk melanjutkan.');refresh();
      });
      await worker.initialize();
      if (epoch.current!==token) return;
      video.current!.srcObject=acquired;await video.current!.play();
      if(recordOptIn.current){
        recorder.current??=new LocalRecorder(browserRecorderEnvironment());
        try{await recorder.current.start(acquired,true);setRecordNotice('Rekaman aktif di perangkat');}
        catch{setRecordNotice('Perekaman tidak tersedia. Workout tetap dapat dilanjutkan.');}
      }
      if(epoch.current!==token){void recorder.current?.pause();return;}
      lastObservation.current=0;live.current=true;setRunning(true);setLoading(false);setPaused(false);
      let last=-Infinity;
      const frame=async (timestamp:number) => {
        if (epoch.current!==token||!live.current) return;
        if (timestamp-last>=1000/30) {
          last=timestamp;
          try {
            const pose=await worker.detect(await createImageBitmap(video.current!),timestamp);
            if (epoch.current!==token||!live.current) return;
            if (pose) {
              lastObservation.current=Date.now();
              setOverlayFrame(pose);
              const result=recognizer.current.process(pose);
              workout.current!.observe({...result.observation,labelSource:profile.current==='auto'?'automatic':'profile'});setRecognized(isSupportedExerciseId(result.observation.exercise)?result.observation.exercise:null);
              setStatus(result.reason==='camera-position'?'Pastikan sendi terlihat dari posisi kamera semula.'
                :result.reason==='visible-side-changed'?'Sisi tubuh yang terlihat berubah. Siklus terputus dibuang; pertahankan posisi kamera semula.'
                :result.reason==='curl-not-bilateral'?'Gerakkan kedua lengan serempak.'
                :result.reason==='exercise-unknown'||result.reason==='exercise-ambiguous'?'Gerakan belum dikenali. Pilih profil latihan.'
                :result.reason?'Tracking terputus. Pastikan tubuh dan sendi terlihat.':'Tracking aktif');
              refresh();
            }
          } catch {
            if (epoch.current!==token) return;
            workout.current!.observe({exercise:null,visible:false,phase:'moving'});
            stopResources();setRunning(false);setStatus('Deteksi berhenti. Aktifkan kamera kembali untuk melanjutkan.');refresh();return;
          }
        }
        animation.current=requestAnimationFrame(frame);
      };
      animation.current=requestAnimationFrame(frame);
    } catch(error) {
      if (epoch.current!==token) return;
      stopResources();setLoading(false);setRunning(false);
      setStatus(error instanceof DOMException&&error.name==='NotAllowedError'
        ?'Izin kamera ditolak. Aktifkan izin browser untuk menggunakan deteksi.'
        :'Kamera/model tidak tersedia. Gunakan HTTPS dan periksa kamera.');
    }
  };
  const applyChoice=(next:Choice) => {
    profile.current=next;setChoice(next);recognizer.current.selectManual(next==='auto'?null:next);
    local.preferences.current.profile=next;
    workout.current?.observe({exercise:null,visible:false,phase:'moving'});setPendingChoice(null);refresh();
  };
  const choose=(next:Choice) => {
    const current=workout.current?.getSets().at(-1);
    if (current&&current.endedAt===null&&next!=='auto'&&next!==current.exercise) setPendingChoice(next);
    else {if(next!=='auto'&&next!==cameraExercise){stopResources();setRunning(false);setLoading(false);setCameraView(viewFor(next));setStatus('Profil berubah. Aktifkan kamera kembali.');}applyChoice(next);if(next!=='auto')setCameraExercise(next);}
  };
  const finish=() => {
    stopResources();getWorkout().finish();setRunning(false);setLoading(false);setFinished(true);setPendingChoice(null);setStatus('Workout selesai');refresh();
    setScreen('summary');
    if(recorder.current){setRecordBusy(true);void recorder.current.finish().then(blobs=>{
      releaseClips();const files=blobs.map(blob=>({url:URL.createObjectURL(blob),extension:blob.type.includes('mp4')?'mp4':'webm'}));
      clipUrls.current=files.map(file=>file.url);setClips(files);setRecordNotice(files.length?'Rekaman siap disimpan per segmen ke perangkat.':'Tidak ada rekaman tersedia.');
    }).catch(()=>setRecordNotice('Rekaman gagal. Hasil workout tetap disimpan; tidak ada pemulihan video setelah reload.')).finally(()=>setRecordBusy(false));}
  };
  const openRecord=(record:LocalWorkout)=>{
    stopResources();local.open(record);
    const p=local.preferences.current;profile.current=p.profile==='auto'||isSupportedExerciseId(p.profile)?p.profile:'auto';setChoice(profile.current);
    setCameraView(viewFor(cameraExercise));
    setFinished(workout.current!.isFinished());setPaused(!workout.current!.isFinished());setRunning(false);
    setStatus(workout.current!.isFinished()?'Workout selesai':'Sesi dipulihkan dalam keadaan jeda. Aktifkan kamera kembali untuk melanjutkan.');refresh();
    setScreen(workout.current!.isFinished()?'summary':'session');
  };
  const controlsDisabled=!account.ready||!local.ready||!!local.recovery;
  const active=sets.find(set=>set.endedAt===null),last=sets.at(-1);
  const restTarget=local.preferences.current.restSeconds[last?.exercise??cameraExercise]??120;
  const rest=Math.floor((workout.current?.restElapsedMs()??0)/1000);
  const guidance=cameraGuidance(choice==='auto'?null:choice,cameraView,!!workout.current);
  const resetWorkout=()=>{stopResources();recorder.current=null;recordOptIn.current=false;setRecordEnabled(false);setRecordNotice('');local.newWorkout();setCameraView('auto');setFinished(false);setPaused(false);setRecognized(null);setPendingChoice(null);setPendingAuto(null);profile.current='auto';setChoice('auto');setStatus('Kamera belum aktif');setScreen('home');refresh();};
  const plan=local.preferences.current.exercisePlan??[];
  const updatePlan=(next:PlannedExercise[])=>{local.preferences.current.exercisePlan=copyPlan(next);refresh();};
  const beginWorkout=(next:PlannedExercise[])=>{
    local.newWorkout();local.preferences.current.exercisePlan=copyPlan(next);local.preferences.current.sessionRows={};getWorkout();setFinished(false);setPaused(false);setRecognized(null);
    setPendingChoice(null);setPendingAuto(null);setMode('camera');setScreen('session');refresh();
  };
  const editRoutine=(routine?:Routine)=>{
    const now=Date.now();setDraft(routine?structuredClone(routine):{id:crypto.randomUUID(),revision:0,name:'',exercises:[],createdAt:now,updatedAt:now});
    setRoutineError('');setScreen('editor');
  };
  const saveRoutine=async()=>{
    if(!draft||routineBusy)return;
    setRoutineBusy(true);setRoutineError('');
    try{await routines.save({...draft,updatedAt:Math.max(Date.now(),draft.createdAt)});setDraft(null);setScreen('home');}
    catch(error){setRoutineError(error instanceof Error?error.message:'Could not save routine.');}
    finally{setRoutineBusy(false);}
  };
  const chooseFromPicker=(id:ExerciseId)=>{
    if(pickerFor==='routine'&&draft){
      if(!draft.exercises.some(row=>row.exercise===id))setDraft({...draft,exercises:[...draft.exercises,{exercise:id,targets:emptyTargets()}]});
      setScreen('editor');return;
    }
    if(!plan.some(row=>row.exercise===id))updatePlan([...plan,{exercise:id,targets:emptyTargets()}]);
    setScreen('session');
  };
  const openExerciseDetails=(id:ExerciseId)=>{setDetailExercise(id);setDetailReturnScreen(screen==='editor'||screen==='session'?screen:'home');setScreen('exercise-detail');};
  const updateSessionTarget=(id:ExerciseId,row:SessionSetRow,target:SetTarget)=>{
    const prefs=local.preferences.current,rows=structuredClone(prefs.sessionRows??{});
    rows[id]=(rows[id]??[]).map(item=>item.id===row.id?{...item,target}:item);prefs.sessionRows=rows;refresh();
  };
  const toggleSessionSet=(id:ExerciseId,row:SessionSetRow,checked:boolean)=>{
    if(checked){
      try{
        let resultId:string;
        if(row.savedResult){resultId=row.savedResult.id;getWorkout().restoreCompletedSet(row.savedResult,{reps:row.target.reps??row.savedResult.reps,loadKg:row.target.loadKg});}
        else {if(!row.target.reps){setStatus('Enter a positive rep target before completing a set.');return;}resultId=getWorkout().addManualSet(id,row.target.reps,row.target.loadKg);}
        const rows=structuredClone(local.preferences.current.sessionRows??{});rows[id]=(rows[id]??[]).map(item=>{if(item.id!==row.id)return item;const next={...item,resultSetId:resultId,target:row.target};delete next.savedResult;return next;});local.preferences.current.sessionRows=rows;
        setStatus('Set saved');refresh();
      }catch{setStatus('Set could not be completed. Check reps and kg.');}
      return;
    }
    if(!row.resultSetId)return;
    try{
      const removed=getWorkout().removeCompletedSet(row.resultSetId),rows=structuredClone(local.preferences.current.sessionRows??{});
      rows[id]=(rows[id]??[]).map(item=>item.id===row.id?{...item,target:{reps:removed.reps,loadKg:removed.loadKg},savedResult:removed,resultSetId:undefined}:item);
      rows[id]=rows[id]!.map(item=>{if(item.id===row.id)delete item.resultSetId;return item;});local.preferences.current.sessionRows=rows;setStatus('Set unchecked; values are kept for restore.');refresh();
    }catch{setStatus('End the live set before unchecking it.');}
  };
  const editSessionSet=(id:ExerciseId,row:SessionSetRow,reps:number,loadKg:number|null)=>{
    const current=getWorkout().getSets().find(set=>set.id===row.resultSetId);if(!current||current.endedAt===null){setStatus('End the live set before editing it.');return;}
    try{getWorkout().correctSet(current.id,reps);getWorkout().setLoad(current.id,loadKg);setStatus('Set updated');refresh();}catch{setStatus('Set values were not changed. Check reps and kg.');}
  };
  const deleteSessionSet=(id:ExerciseId,row:SessionSetRow)=>{
    try{
      if(row.resultSetId)getWorkout().removeCompletedSet(row.resultSetId);
      const prefs=local.preferences.current,index=(prefs.sessionRows?.[id]??[]).findIndex(item=>item.id===row.id),rows=withoutSessionSetRow(prefs.sessionRows??{},id,row.id);prefs.sessionRows=rows;
      const plan=prefs.exercisePlan??[];
      prefs.exercisePlan=copyPlan(plan.map(item=>item.exercise===id&&index<item.targets.length?{...item,targets:item.targets.filter((_,i)=>i!==index)}:item));
      setStatus('Set deleted');refresh();
    }catch{setStatus('The live set cannot be deleted. End it first.');}
  };
  const openCamera=(id:SupportedExerciseId)=>{
    const current=sets.find(set=>set.endedAt===null);
    if(current&&current.exercise!==id){setPendingChoice(id);return;}
    applyChoice(id);setCameraExercise(id);setCameraView(viewFor(id));setCameraControlsOpen(false);setScreen('camera');
  };
  const openAutoCamera=()=>{const first=plan.find(row=>isSupportedExerciseId(row.exercise))?.exercise;if(!isSupportedExerciseId(first))return;applyChoice('auto');setCameraExercise(first);setCameraView(viewFor(first));setCameraControlsOpen(false);setScreen('camera');};
  const closeCamera=()=>{stopResources();setRunning(false);setLoading(false);setStatus('Kamera berhenti. Hasil set tetap tersimpan.');setScreen('session');refresh();};
  const endSetAndReturn=()=>{
    if(controlsDisabled||finished||loading)return;
    stopResources();workout.current?.endSet();setRunning(false);setLoading(false);setStatus('Set diakhiri. Kembali ke workout session.');refresh();setScreen('session');
  };
  useEffect(()=>{
    if(screen!=='camera')return;
    const before=document.body.style.overflow;document.body.style.overflow='hidden';
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')closeCamera();};document.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=before;document.removeEventListener('keydown',key);};
  },[screen]);
  useEffect(()=>{
    if(screen!=='camera'){
      cameraAutoStarted.current=false;
      setCameraControlsOpen(false);
      return;
    }
    if(cameraAutoStarted.current)return;
    cameraAutoStarted.current=true;
    void start();
  },[screen]);
  const cameraSet=sets.find(set=>set.endedAt===null&&(choice==='auto'||set.exercise===cameraExercise));
  const cameraSetNumber=sets.filter(set=>set.exercise===(cameraSet?.exercise??cameraExercise)&&set.endedAt!==null).length+1;
  if(screen==='camera')return <div className="gymbro-camera" data-testid="full-screen-camera" role="dialog" aria-label={`Camera ${choice==='auto'?'automatic detection':exerciseLabels[cameraExercise]}`}>
    <div className="gymbro-camera-stage">
      <video ref={video} autoPlay muted playsInline aria-label="Kamera workout" onLoadedMetadata={()=>{
        if(video.current?.videoWidth&&video.current.videoHeight)setVideoAspectRatio(video.current.videoWidth/video.current.videoHeight);
      }}/>
      <CameraFramingOverlay frame={running?overlayFrame:null} exercise={choice==='auto'?null:cameraExercise} cameraView={cameraView} videoAspectRatio={videoAspectRatio} status={status}/>
      <div className="gymbro-camera-readout"><div><span className="saka-kicker">Set {cameraSetNumber}</span><strong data-testid="live-rep-counter">{cameraSet?.reps??0}</strong><span>REPS</span></div></div>
      <div className="gymbro-camera-recognized">{recognized?`Detected: ${exerciseLabels[recognized]}`:'Gerakan: Belum dikenali'}</div>
      <div className="gymbro-camera-mini"><span>Total reps: {summary.totalReps}</span><span>Completed sets: {summary.totalSets}</span></div>
    </div>
    <header className="gymbro-camera-head"><div><span className="saka-kicker">{choice==='auto'?'Automatic detection':exerciseLabels[cameraExercise]}</span>
      <span className="gymbro-live-pill">{running?'● LIVE':loading?'LOADING':'READY'}</span></div>
      <button className="gymbro-camera-menu-toggle" aria-label={cameraControlsOpen?'Close camera controls':'Open camera controls'} aria-expanded={cameraControlsOpen} aria-controls="gymbro-camera-controls-panel" onClick={()=>setCameraControlsOpen(open=>!open)}>
        <span aria-hidden="true">{cameraControlsOpen?'×':'☰'}</span>
      </button></header>
    {cameraControlsOpen&&<aside id="gymbro-camera-controls-panel" className="gymbro-camera-panel" aria-label="Camera controls">
      <button className="gymbro-camera-icon-button" aria-label="Back to workout" title="Back to workout" onClick={closeCamera}><span aria-hidden="true">←</span></button>
      <label className="gymbro-profile-control">Profil kamera <select className="saka-select" aria-label="Profil kamera" value={choice} disabled={finished} onChange={event=>choose(event.target.value as Choice)}>
        <option value="auto">Otomatis</option>{Object.entries(exerciseLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <div className="gymbro-camera-controls">
        {!running&&<button className="gymbro-camera-icon-button is-filled" aria-label={paused?'Lanjutkan kamera':'Aktifkan kamera'} title={paused?'Resume camera':'Start camera'} onClick={()=>void start()} disabled={controlsDisabled||loading||finished}><span aria-hidden="true">▶</span></button>}
        {running&&<button className="gymbro-camera-icon-button" aria-label="Jeda kamera" title="Pause camera" onClick={pause}><span aria-hidden="true">Ⅱ</span></button>}
        <button className="gymbro-camera-icon-button" aria-label="Akhiri set" title="End set" onClick={()=>{workout.current?.endSet();refresh();}} disabled={controlsDisabled||finished}><span aria-hidden="true">■</span></button>
        <button className="gymbro-camera-icon-button" aria-label="Akhiri set & kembali ke workout session" title="End set and return to workout" onClick={endSetAndReturn} disabled={controlsDisabled||finished||loading}><span aria-hidden="true">↩</span></button>
        <button className="gymbro-camera-icon-button" aria-label="Selesaikan workout" title="Finish workout" onClick={finish} disabled={controlsDisabled||finished}><span aria-hidden="true">✓</span></button>
      </div>
      {!!recordNotice&&<div className="gymbro-camera-status">{recordNotice}</div>}
      {(pendingChoice||pendingAuto)&&<div className="saka-alert is-warning"><span>Konfirmasi pergantian latihan; set aktif akan diakhiri.</span>
        <button className="gymbro-camera-icon-button" aria-label="Konfirmasi pergantian" title="Confirm exercise change" onClick={()=>{
          if(pendingChoice){workout.current?.endSet();stopResources();setRunning(false);setLoading(false);setCameraView(viewFor(pendingChoice));applyChoice(pendingChoice);setCameraExercise(pendingChoice);}
          else{workout.current?.confirmExerciseChange();refresh();}
        }}><span aria-hidden="true">✓</span></button></div>}
      <details className="gymbro-camera-guide"><summary>Camera placement guide</summary><p data-testid="camera-guide">{guidance}</p></details>
    </aside>}
  </div>;

  if(screen==='exercise-detail'&&detailExercise)return <main className="gymbro-shell"><header className="gymbro-topbar"><span className="gymbro-brand">GYMBRO<span>_</span></span><span className="saka-kicker">Exercise library</span></header>
    <ExerciseDetails exercise={detailExercise} onBack={()=>setScreen(detailReturnScreen)}/></main>;

  if(screen==='editor'&&draft)return <main className="gymbro-shell"><header className="gymbro-topbar"><span className="gymbro-brand">GYMBRO<span>_</span></span><span className="saka-kicker">Routine planning</span></header>
    <RoutineEditor draft={draft} onChange={setDraft} onError={setRoutineError} onAdd={()=>{setPickerFor('routine');setScreen('picker');}}
      onSave={()=>void saveRoutine()} onCancel={()=>{setDraft(null);setScreen('home');}} onDetails={openExerciseDetails} error={routineError} busy={routineBusy}/></main>;
  if(screen==='explore'||screen==='picker')return <main className="gymbro-shell"><header className="gymbro-topbar"><span className="gymbro-brand">GYMBRO<span>_</span></span><span className="saka-kicker">Exercise library</span></header>
    <ExerciseBrowser onBack={()=>setScreen(screen==='explore'?'home':pickerFor==='routine'?'editor':'session')}
      onSelect={screen==='picker'?chooseFromPicker:undefined} excluded={screen==='picker'?(pickerFor==='routine'?draft?.exercises:plan)?.map(row=>row.exercise):[]}/></main>;

  if(screen==='home')return <main className="gymbro-shell">
    <header className="gymbro-topbar"><span className="gymbro-brand">GYMBRO<span>_</span></span><span className="saka-kicker">Workout control</span></header>
    <section className="gymbro-hero saka-stack"><div className="saka-kicker">Your training starts here</div><h1 className="gymbro-title">Workout</h1>
      <p className="saka-prose">Start with an empty session, or launch a routine you have planned.</p>
      <button className="saka-btn is-filled saka-btn--lg saka-btn--block" onClick={()=>beginWorkout([])} disabled={controlsDisabled}>+ Start Empty Workout</button>
    </section>
    {local.recovery&&<div className="saka-card gymbro-recovery"><strong>Sesi belum selesai ditemukan</strong><p className="saka-prose">Pulihkan catatan terverifikasi. Video sebelumnya tidak dapat dipulihkan.</p>
      <button className="saka-btn is-filled" onClick={()=>openRecord(local.recovery!)}>Pulihkan sesi</button></div>}
    <section className="saka-stack"><div className="saka-split"><div><div className="saka-kicker">Saved locally</div><h2 className="gymbro-section-title">Routines</h2></div><span className="gymbro-count">{routines.routines.length}</span></div>
      <div className="gymbro-home-actions"><button className="saka-btn" onClick={()=>editRoutine()} disabled={!routines.ready}>+ New Routine</button>
        <button className="saka-btn" onClick={()=>setScreen('explore')}>⌕ Explore</button></div>
      {routines.error&&<div className="saka-alert is-warning" role="alert">{routines.error}</div>}
      {routineError&&<div className="saka-alert is-warning" role="alert">{routineError}</div>}
      {routines.routines.length?<div className="gymbro-routine-grid">{routines.routines.map(routine=><article className="saka-card gymbro-routine-card" key={routine.id}>
        <div className="saka-split"><div><div className="saka-kicker">{routine.exercises.length} exercises</div><h3>{routine.name}</h3></div><span className="gymbro-card-index">▣</span></div>
        <div className="gymbro-routine-exercises">{routine.exercises.map(row=><button className="gymbro-detail-link" key={row.exercise} onClick={()=>{setDetailReturnScreen('home');setDetailExercise(row.exercise);setScreen('exercise-detail');}}>{exerciseCatalog[row.exercise].label}</button>)}</div>
        <button className="saka-btn is-filled saka-btn--block" aria-label={`Start ${routine.name}`} onClick={()=>beginWorkout(routine.exercises)} disabled={controlsDisabled}>Start Routine</button>
        <div className="saka-cluster"><button className="saka-btn saka-btn--sm" aria-label={`Edit ${routine.name}`} onClick={()=>editRoutine(routine)}>Edit</button>
          <button className="saka-btn saka-btn--sm" aria-label={`Delete ${routine.name}`} onClick={()=>setDeleteRoutineId(routine.id)}>Delete</button></div>
        {deleteRoutineId===routine.id&&<div className="saka-alert is-danger"><span>Delete {routine.name} from this browser?</span>
          <div className="saka-cluster"><button className="saka-btn saka-btn--sm" aria-label="Confirm delete routine" onClick={()=>{void routines.remove(routine).then(()=>setDeleteRoutineId(null)).catch(()=>setRoutineError('Could not delete routine.'));}}>Confirm delete routine</button>
            <button className="saka-btn saka-btn--sm" onClick={()=>setDeleteRoutineId(null)}>Cancel</button></div></div>}
      </article>)}</div>:<div className="saka-card gymbro-empty"><strong>No routines yet</strong><p className="saka-prose">Build one with exercises and editable set targets.</p></div>}
    </section>
    <section className="saka-card gymbro-settings"><div className="saka-kicker">Before your session</div><h2 className="gymbro-section-title">Recording</h2>
      <label className="gymbro-check"><input type="checkbox" aria-label="Rekam video di perangkat" checked={recordEnabled} disabled={controlsDisabled}
        onChange={event=>{setRecordEnabled(event.target.checked);recordOptIn.current=event.target.checked;}}/> Record video locally (optional)</label>
      <p className="saka-prose">Set the camera angle on each supported exercise. Video is not uploaded or recovered after reload.</p>
    </section>
    <details className="saka-accordion gymbro-secondary"><summary>Account and sync</summary><div className="saka-accordion__panel"><AccountPanel account={account} disabled={!local.ready} onReset={resetWorkout} beforeAction={local.flush}/></div></details>
    {local.history.length>0&&<section className="saka-stack"><h2 className="gymbro-section-title">Workout history</h2>{local.history.map(record=><div className="saka-card" key={record.id}>
      <div className="saka-split"><span>{new Date(record.snapshot.startedAt).toLocaleString('id-ID')} · {record.snapshot.sets.reduce((sum,set)=>sum+set.reps,0)} reps</span>
        <div className="saka-cluster"><Button label="Lihat workout" onPress={()=>openRecord(record)}/><Button label="Hapus workout" onPress={()=>setDeleteId(record.id)}/></div></div>
      {deleteId===record.id&&<div className="saka-alert is-danger"><span>Hapus workout ini dari perangkat dan akun terkait?</span>
        <div className="saka-cluster"><Button label="Hapus" onPress={()=>{void local.flush().then(async()=>{const binding=(await account.store.bindings()).find(item=>item.workoutId===record.id);if(binding){await account.store.deleteWorkout(record,binding.ownerId);await account.flush();}else await account.store.remove(record.id,record.revision);setDeleteId(null);await local.reloadHistory();}).catch(()=>setStatus('Penghapusan gagal; hasil tetap tersimpan'));}}/>
          <Button label="Batal" onPress={()=>setDeleteId(null)}/></div></div>}
    </div>)}</section>}
    <footer className="gymbro-page-foot"><span>{local.saveStatus}</span><span>{offlineStatus}</span><span>Routines stay in this browser.</span></footer>
  </main>;

  return <main className="gymbro-shell">
    <header className="gymbro-topbar"><span className="gymbro-brand">GYMBRO<span>_</span></span><span className="saka-kicker">{screen==='summary'?'Session complete':'Live workout'}</span></header>
    <div className="saka-stack gymbro-page">
      <div className="saka-split gymbro-session-head"><div><div className="saka-kicker">{screen==='summary'?'Workout result':'Training in progress'}</div>
        <h1 className="gymbro-title">{screen==='summary'?'Workout complete':'Log Workout'}</h1></div>
        {screen==='session'&&<button className="saka-btn is-filled" onClick={finish} disabled={controlsDisabled||finished}>Selesaikan workout</button>}
      </div>
      <div className="gymbro-stats"><div className="saka-card"><span className="saka-kicker">Duration</span><strong>{Math.floor(summary.durationMs/1000)}s</strong></div>
        <div className="saka-card"><span className="saka-kicker">Volume</span><strong>{summary.knownVolumeKg} kg</strong></div>
        <div className="saka-card"><span className="saka-kicker">Sets</span><strong>{summary.totalSets}</strong></div></div>
      <div className="gymbro-summary-line"><span>Total set: {summary.totalSets}</span><span>Total reps: {summary.totalReps}</span><span>Volume diketahui: {summary.knownVolumeKg} kg</span></div>
      {!summary.volumeComplete&&<p className="saka-prose">Beban belum lengkap</p>}
      <div className="saka-split gymbro-rest-banner"><span>Rest: {rest} / {restTarget} sec</span><span>Durasi aktif: {Math.floor(summary.durationMs/1000)} detik</span></div>
      {screen==='session'&&<label className="gymbro-check"><input type="checkbox" aria-label="Rekam video di perangkat" checked={recordEnabled} disabled readOnly/>Record video locally (locked for this session)</label>}
      {screen==='session'&&<>
        {!plan.length&&!sets.length&&<div className="saka-card gymbro-empty"><span className="gymbro-empty-symbol">＋</span><strong>No exercises yet</strong>
          <p className="saka-prose">Add an exercise to start your workout.</p></div>}
        <ExercisePlanCards plan={plan} mode="session" sets={sets} history={local.history} sessionRows={local.preferences.current.sessionRows} onChange={updatePlan} onDetails={openExerciseDetails}
          onTargetChange={updateSessionTarget} onToggleSet={toggleSessionSet} onEditSet={editSessionSet} onDeleteSet={deleteSessionSet}
          onCamera={openCamera} onError={setStatus} cameraViews={Object.fromEntries(supportedExerciseIds.map(id=>[id,viewFor(id)]))}
          onCameraViewChange={(id,view)=>{if(!isCameraView(view))return;local.preferences.current.cameraViews={...local.preferences.current.cameraViews,[id]:view};if(cameraExercise===id)setCameraView(view);refresh();}}
          restSeconds={local.preferences.current.restSeconds}
          onRestChange={(id,seconds)=>{local.preferences.current.restSeconds[id]=seconds;refresh();}}/>
        <button className="saka-btn is-filled saka-btn--block" onClick={()=>{setPickerFor('session');setScreen('picker');}}>+ Add Exercise</button>
        {plan.some(row=>isSupportedExerciseId(row.exercise))&&<button className="saka-btn saka-btn--block" onClick={openAutoCamera}>Open automatic camera</button>}
        <div className="saka-cluster gymbro-mode-tabs"><button className={`saka-btn ${mode==='camera'?'is-filled':''}`} onClick={()=>setMode('camera')}>Mode kamera</button>
          <button className={`saka-btn ${mode==='log'?'is-filled':''}`} onClick={()=>setMode('log')}>Mode log</button></div>
        {mode==='log'&&<WorkoutLog session={workout.current} sets={sets} history={local.history} preferences={local.preferences.current} refresh={refresh} onError={setStatus}/>}
        {paused&&<button className="saka-btn" onClick={()=>{getWorkout().resume();setPaused(false);setStatus('Workout dilanjutkan');refresh();}}>Lanjutkan workout</button>}
        {!paused&&<button className="saka-btn" onClick={pause}>Jeda workout</button>}
        {(pendingChoice||pendingAuto)&&<div className="saka-alert is-warning"><span>Konfirmasi pergantian latihan; set aktif akan diakhiri.</span>
          <button className="saka-btn saka-btn--sm" onClick={()=>{if(pendingChoice){workout.current?.endSet();const next=pendingChoice;applyChoice(next);setCameraExercise(next);setCameraView(viewFor(next));setScreen('camera');}else{workout.current?.confirmExerciseChange();refresh();}}}>Konfirmasi pergantian</button></div>}
      </>}
      <div className="gymbro-status" aria-live="polite">{status}</div>
      <div className="saka-cluster saka-kicker"><span>{local.saveStatus}</span><span>{offlineStatus}</span></div>
      {screen==='summary'&&<>
        <div className="saka-card"><h2 className="gymbro-section-title">Summary</h2>
          <p>Completed sets: {summary.totalSets}</p><p>Repetitions: {summary.totalReps}</p>
          <p>Known volume: {summary.knownVolumeKg} kg</p><p>Istirahat antarset: {Math.floor(summary.restDurationMs/1000)} detik</p>
          {sets.map(set=><p key={set.id}>{exerciseCatalog[set.exercise].label} · {set.reps} reps · {set.origin==='automatic'?'kamera':set.origin==='mixed'?'campuran':'manual'}</p>)}</div>
        <div className="saka-cluster"><button className="saka-btn" onClick={()=>setMode(mode==='log'?'camera':'log')}>Mode log</button>
          <Button label="Ekspor hasil JSON" onPress={local.exportResults}/><Button label="Workout baru" onPress={resetWorkout} disabled={clips.length>0||recordBusy}/>
          <button className="saka-btn is-filled" onClick={resetWorkout} disabled={clips.length>0||recordBusy}>Back to Workouts</button></div>
        {mode==='log'&&<WorkoutLog session={workout.current} sets={sets} history={local.history} preferences={local.preferences.current} refresh={refresh} onError={setStatus}/>}
        {!!recordNotice&&<p className="saka-prose">{recordNotice}</p>}
        {clips.length>0&&<div className="saka-card saka-stack">{clips.map((file,index)=><a className="saka-btn" key={file.url} href={file.url} download={`gymbro-segmen-${index+1}.${file.extension}`}>Simpan segmen {index+1}</a>)}
          <Button label="Buang rekaman" onPress={()=>{releaseClips();void recorder.current?.discard();setRecordNotice('Rekaman dibuang. Hasil workout tetap tersimpan.');}}/></div>}
      </>}
      {screen==='session'&&<div className="saka-cluster"><Button label="Ekspor hasil JSON" onPress={local.exportResults}/></div>}
      <details className="saka-accordion gymbro-secondary" open={screen==='summary'}><summary>Account and sync</summary>
        <div className="saka-accordion__panel"><AccountPanel account={account}
          disabled={!local.ready||!!workout.current&&!finished||recordBusy||clips.length>0} onReset={resetWorkout} beforeAction={local.flush}/></div></details>
    </div>
  </main>;
}
