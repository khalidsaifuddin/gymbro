import {useEffect,useRef,useState} from 'react';
import {type ExerciseId,type WorkoutSet,type WorkoutSummary} from '../domain/workout';
import AccountPanel from './AccountPanel.web';
import {useAccount} from '../sync/use-account.web';
import {useLocalWorkout} from '../storage/use-local-workout.web';
import WorkoutLog,{loadLabel} from './WorkoutLog.web';
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
  const [pendingAuto,setPendingAuto]=useState<ExerciseId|null>(null),[exercise,setExercise]=useState<ExerciseId>('squat');
  const [reps,setReps]=useState('10'),[load,setLoad]=useState(''),[status,setStatus]=useState('Kamera belum aktif');
  const [running,setRunning]=useState(false),[loading,setLoading]=useState(false),[paused,setPaused]=useState(false);
  const [finished,setFinished]=useState(false),[recognized,setRecognized]=useState<SupportedExerciseId|null>(null);
  const [summary,setSummary]=useState(initial),[sets,setSets]=useState<WorkoutSet[]>([]);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [mode,setMode]=useState<'camera'|'log'>('camera');
  const [cameraView,setCameraView]=useState<CameraView>('auto');
  const [screen,setScreen]=useState<'home'|'editor'|'explore'|'picker'|'session'|'camera'|'summary'>('home');
  const [pickerFor,setPickerFor]=useState<'routine'|'session'>('session');
  const [draft,setDraft]=useState<Routine|null>(null),[routineError,setRoutineError]=useState('');
  const [routineBusy,setRoutineBusy]=useState(false),[deleteRoutineId,setDeleteRoutineId]=useState<string|null>(null);
  const [cameraExercise,setCameraExercise]=useState<SupportedExerciseId>('squat');
  const viewFor=(id:SupportedExerciseId)=>local.preferences.current.cameraViews?.[id]??local.preferences.current.cameraView??'auto';
  const refresh=(checkpoint=false) => {
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
        stopResources();setRunning(false);setLoading(false);setStatus('Kamera terputus. Aktifkan kembali atau catat set manual.');refresh();
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
        if (timestamp-last>=100) {
          last=timestamp;
          try {
            const pose=await worker.detect(await createImageBitmap(video.current!),timestamp);
            if (epoch.current!==token||!live.current) return;
            if (pose) {
              lastObservation.current=Date.now();
              setOverlayFrame(pose);
              const result=recognizer.current.process(pose);
              workout.current!.observe({...result.observation,labelSource:profile.current==='auto'?'automatic':'profile'});setRecognized(isSupportedExerciseId(result.observation.exercise)?result.observation.exercise:null);
              setStatus(result.reason==='camera-position'?'Pastikan sendi terlihat dari posisi kamera semula, atau catat set manual.'
                :result.reason==='visible-side-changed'?'Sisi tubuh yang terlihat berubah. Siklus terputus dibuang; pertahankan posisi kamera semula.'
                :result.reason==='curl-not-bilateral'?'Gerakkan kedua lengan serempak atau catat set manual.'
                :result.reason==='exercise-unknown'||result.reason==='exercise-ambiguous'?'Gerakan belum dikenali. Pilih profil latihan atau catat set manual.'
                :result.reason?'Tracking terputus. Pastikan tubuh dan sendi terlihat.':'Tracking aktif');
              refresh();
            }
          } catch {
            if (epoch.current!==token) return;
            workout.current!.observe({exercise:null,visible:false,phase:'moving'});
            stopResources();setRunning(false);setStatus('Deteksi berhenti. Aktifkan kamera kembali atau catat set manual.');refresh();return;
          }
        }
        animation.current=requestAnimationFrame(frame);
      };
      animation.current=requestAnimationFrame(frame);
    } catch(error) {
      if (epoch.current!==token) return;
      stopResources();setLoading(false);setRunning(false);
      setStatus(error instanceof DOMException&&error.name==='NotAllowedError'
        ?'Izin kamera ditolak. Aktifkan izin browser atau catat set manual.'
        :'Kamera/model tidak tersedia. Gunakan HTTPS, periksa kamera, atau catat set manual.');
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
  const logManual=() => {
    try {getWorkout().addManualSet(exercise,Number(reps),load.trim()===''?null:Number(load));refresh();setStatus('Set manual dicatat');}
    catch {setStatus('Masukkan reps bulat positif dan beban kg yang valid.');}
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
    setExercise(p.manualExercise);setReps(p.manualReps);setLoad(p.manualLoad);
    setFinished(workout.current!.isFinished());setPaused(!workout.current!.isFinished());setRunning(false);
    setStatus(workout.current!.isFinished()?'Workout selesai':'Sesi dipulihkan dalam keadaan jeda. Aktifkan kamera kembali atau lanjutkan manual.');refresh();
    setScreen(workout.current!.isFinished()?'summary':'session');
  };
  const controlsDisabled=!account.ready||!local.ready||!!local.recovery;
  const active=sets.find(set=>set.endedAt===null),last=sets.at(-1);
  const restTarget=local.preferences.current.restSeconds[last?.exercise??exercise]??120;
  const rest=Math.floor((workout.current?.restElapsedMs()??0)/1000);
  const guidance=cameraGuidance(choice==='auto'?null:choice,cameraView,!!workout.current);
  const resetWorkout=()=>{stopResources();recorder.current=null;recordOptIn.current=false;setRecordEnabled(false);setRecordNotice('');local.newWorkout();setCameraView('auto');setFinished(false);setPaused(false);setRecognized(null);setPendingChoice(null);setPendingAuto(null);profile.current='auto';setChoice('auto');setExercise('squat');setReps('10');setLoad('');setStatus('Kamera belum aktif');setScreen('home');refresh();};
  const plan=local.preferences.current.exercisePlan??[];
  const updatePlan=(next:PlannedExercise[])=>{local.preferences.current.exercisePlan=copyPlan(next);refresh();};
  const beginWorkout=(next:PlannedExercise[])=>{
    local.preferences.current.exercisePlan=copyPlan(next);getWorkout();setFinished(false);setPaused(false);setRecognized(null);
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
    setExercise(id);setScreen('session');
  };
  const completePlannedSet=(id:ExerciseId,index:number)=>{
    const target=plan.find(row=>row.exercise===id)?.targets[index];
    if(!target?.reps){setStatus('Enter a positive rep target before completing a set.');return;}
    try{getWorkout().addManualSet(id,target.reps,target.loadKg);setStatus('Set manual dicatat');refresh();}
    catch{setStatus('Set could not be completed. Check reps and kg.');}
  };
  const openCamera=(id:SupportedExerciseId)=>{
    const current=sets.find(set=>set.endedAt===null);
    if(current&&current.exercise!==id){setPendingChoice(id);return;}
    applyChoice(id);setCameraExercise(id);setCameraView(viewFor(id));setScreen('camera');
  };
  const openAutoCamera=()=>{const first=plan.find(row=>isSupportedExerciseId(row.exercise))?.exercise;if(!isSupportedExerciseId(first))return;applyChoice('auto');setCameraExercise(first);setCameraView(viewFor(first));setScreen('camera');};
  const closeCamera=()=>{stopResources();setRunning(false);setLoading(false);setStatus('Kamera berhenti. Hasil set tetap tersimpan.');setScreen('session');refresh();};
  useEffect(()=>{
    if(screen!=='camera')return;
    const before=document.body.style.overflow;document.body.style.overflow='hidden';
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')closeCamera();};document.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=before;document.removeEventListener('keydown',key);};
  },[screen]);
  const cameraSet=sets.find(set=>set.endedAt===null&&(choice==='auto'||set.exercise===cameraExercise));
  const cameraSetNumber=sets.filter(set=>set.exercise===(cameraSet?.exercise??cameraExercise)&&set.endedAt!==null).length+1;
  if(screen==='camera')return <div className="gymbro-camera" data-testid="full-screen-camera" role="dialog" aria-label={`Camera ${choice==='auto'?'automatic detection':exerciseLabels[cameraExercise]}`}>
    <header className="gymbro-camera-head">
      <button className="saka-btn saka-btn--sm" onClick={closeCamera}>Back to workout</button>
      <div><div className="saka-kicker">Live detection</div><strong>{choice==='auto'?'Automatic detection':exerciseLabels[cameraExercise]}</strong></div>
      <span className="gymbro-live-pill">{running?'● LIVE':loading?'LOADING':'READY'}</span>
    </header>
    <div className="gymbro-camera-stage">
      <video ref={video} autoPlay muted playsInline aria-label="Kamera workout" onLoadedMetadata={()=>{
        if(video.current?.videoWidth&&video.current.videoHeight)setVideoAspectRatio(video.current.videoWidth/video.current.videoHeight);
      }}/>
      <CameraFramingOverlay frame={running?overlayFrame:null} exercise={choice==='auto'?null:cameraExercise} cameraView={cameraView} videoAspectRatio={videoAspectRatio}/>
      <div className="gymbro-camera-readout"><div><span className="saka-kicker">Set {cameraSetNumber}</span><strong data-testid="live-rep-counter">{cameraSet?.reps??0}</strong><span>REPS</span></div></div>
      <div className="gymbro-camera-recognized">{recognized?`Detected: ${exerciseLabels[recognized]}`:'Gerakan: Belum dikenali'}</div>
    </div>
    <footer className="gymbro-camera-foot">
      <div className="gymbro-camera-status" aria-live="polite">{status}</div>
      {!!recordNotice&&<div className="gymbro-camera-status">{recordNotice}</div>}
      <div className="gymbro-camera-mini"><span>Total reps: {summary.totalReps}</span><span>Completed sets: {summary.totalSets}</span></div>
      <label className="gymbro-profile-control">Profil kamera <select className="saka-select" aria-label="Profil kamera" value={choice} disabled={finished} onChange={event=>choose(event.target.value as Choice)}>
        <option value="auto">Otomatis</option>{Object.entries(exerciseLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <div className="gymbro-camera-controls">
        <button className="saka-btn is-filled" onClick={()=>void start()} disabled={controlsDisabled||running||loading||finished}>{paused?'Lanjutkan kamera':'Aktifkan kamera'}</button>
        {running&&<button className="saka-btn" onClick={pause}>Jeda kamera</button>}
        <button className="saka-btn" onClick={()=>{workout.current?.endSet();refresh();}} disabled={controlsDisabled||finished}>Akhiri set</button>
        <button className="saka-btn" onClick={finish} disabled={controlsDisabled||finished}>Selesaikan workout</button>
      </div>
      {(pendingChoice||pendingAuto)&&<div className="saka-alert is-warning"><span>Konfirmasi pergantian latihan; set aktif akan diakhiri.</span>
        <button className="saka-btn saka-btn--sm" onClick={()=>{
          if(pendingChoice){workout.current?.endSet();stopResources();setRunning(false);setLoading(false);setCameraView(viewFor(pendingChoice));applyChoice(pendingChoice);setCameraExercise(pendingChoice);}
          else{workout.current?.confirmExerciseChange();refresh();}
        }}>Konfirmasi pergantian</button></div>}
      <details className="gymbro-camera-guide"><summary>Camera placement guide</summary><p data-testid="camera-guide">{guidance}</p></details>
    </footer>
  </div>;

  if(screen==='editor'&&draft)return <main className="gymbro-shell"><header className="gymbro-topbar"><span className="gymbro-brand">GYMBRO<span>_</span></span><span className="saka-kicker">Routine planning</span></header>
    <RoutineEditor draft={draft} onChange={setDraft} onError={setRoutineError} onAdd={()=>{setPickerFor('routine');setScreen('picker');}}
      onSave={()=>void saveRoutine()} onCancel={()=>{setDraft(null);setScreen('home');}} error={routineError} busy={routineBusy}/></main>;
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
        <p className="saka-prose">{routine.exercises.map(row=>exerciseCatalog[row.exercise].label).join(' · ')}</p>
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
        <div className="saka-cluster"><Button label="Konfirmasi hapus workout" onPress={()=>{void local.flush().then(async()=>{const binding=(await account.store.bindings()).find(item=>item.workoutId===record.id);if(binding){await account.store.deleteWorkout(record,binding.ownerId);await account.flush();}else await account.store.remove(record.id,record.revision);setDeleteId(null);await local.reloadHistory();}).catch(()=>setStatus('Penghapusan gagal; hasil tetap tersimpan'));}}/>
          <Button label="Batal hapus workout" onPress={()=>setDeleteId(null)}/></div></div>}
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
        <ExercisePlanCards plan={plan} mode="session" sets={sets} history={local.history} onChange={updatePlan} onComplete={completePlannedSet}
          onCamera={openCamera} onError={setStatus} cameraViews={Object.fromEntries(supportedExerciseIds.map(id=>[id,viewFor(id)]))}
          onCameraViewChange={(id,view)=>{if(!isCameraView(view))return;local.preferences.current.cameraViews={...local.preferences.current.cameraViews,[id]:view};if(cameraExercise===id)setCameraView(view);refresh();}}
          restSeconds={local.preferences.current.restSeconds}
          onRestChange={(id,seconds)=>{local.preferences.current.restSeconds[id]=seconds;refresh();}}/>
        <button className="saka-btn is-filled saka-btn--block" onClick={()=>{setPickerFor('session');setScreen('picker');}}>+ Add Exercise</button>
        {plan.some(row=>isSupportedExerciseId(row.exercise))&&<button className="saka-btn saka-btn--block" onClick={openAutoCamera}>Open automatic camera</button>}
        <div className="saka-cluster gymbro-mode-tabs"><button className={`saka-btn ${mode==='camera'?'is-filled':''}`} onClick={()=>setMode('camera')}>Mode kamera</button>
          <button className={`saka-btn ${mode==='log'?'is-filled':''}`} onClick={()=>setMode('log')}>Mode log</button></div>
        {mode==='log'&&<WorkoutLog session={workout.current} sets={sets} history={local.history} preferences={local.preferences.current} refresh={refresh} onError={setStatus}/>}
        <div className="saka-card gymbro-manual"><div className="saka-kicker">Fallback entry</div><h2 className="gymbro-section-title">Catat set manual</h2>
          <div className="gymbro-manual-grid"><label className="saka-field"><span className="saka-label">Latihan</span><select className="saka-select" aria-label="Latihan untuk set manual" value={exercise} onChange={event=>{
            const next=event.target.value as ExerciseId;setExercise(next);local.preferences.current.manualExercise=next;refresh();}}>
            {[...new Set([...supportedExerciseIds,...plan.map(row=>row.exercise),exercise])].map(id=><option key={id} value={id}>{exerciseCatalog[id].label}</option>)}</select></label>
            <label className="saka-field"><span className="saka-label">Reps manual</span><input className="saka-input" aria-label="Reps manual" type="number" value={reps} onChange={event=>{setReps(event.target.value);local.preferences.current.manualReps=event.target.value;refresh();}}/></label>
            <label className="saka-field"><span className="saka-label">Beban kg</span><input className="saka-input" aria-label="Beban kg" type="number" step="0.001" placeholder="Belum diisi" value={load} onChange={event=>{setLoad(event.target.value);local.preferences.current.manualLoad=event.target.value;refresh();}}/></label></div>
          <p className="saka-prose">{loadLabel(exercise)}</p><button className="saka-btn" onClick={logManual} disabled={controlsDisabled||finished||paused}>Catat set manual</button>
        </div>
        {paused&&<button className="saka-btn" onClick={()=>{getWorkout().resume();setPaused(false);setStatus('Workout manual dilanjutkan');refresh();}}>Lanjutkan workout manual</button>}
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
