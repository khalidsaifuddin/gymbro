import {useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
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

type Choice='auto'|ExerciseId;
const initial:WorkoutSummary={totalSets:0,totalReps:0,knownVolumeKg:0,volumeComplete:true,durationMs:0,pausedDurationMs:0,restDurationMs:0};
function Button({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
    style={[styles.button,disabled&&styles.disabled]}><Text style={styles.buttonLabel}>{label}</Text></Pressable>;
}
export default function CameraPrototype() {
  const account=useAccount(),local=useLocalWorkout(account.user?.id??null),{workout,getWorkout}=local;
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
  const [choice,setChoice]=useState<Choice>('auto'), [pendingChoice,setPendingChoice]=useState<ExerciseId|null>(null);
  const [pendingAuto,setPendingAuto]=useState<ExerciseId|null>(null),[exercise,setExercise]=useState<ExerciseId>('squat');
  const [reps,setReps]=useState('10'),[load,setLoad]=useState(''),[status,setStatus]=useState('Kamera belum aktif');
  const [running,setRunning]=useState(false),[loading,setLoading]=useState(false),[paused,setPaused]=useState(false);
  const [finished,setFinished]=useState(false),[recognized,setRecognized]=useState<ExerciseId|null>(null);
  const [summary,setSummary]=useState(initial),[sets,setSets]=useState<WorkoutSet[]>([]);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [mode,setMode]=useState<'camera'|'log'>('camera');
  const [cameraView,setCameraView]=useState<CameraView>('auto');
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
    recognizer.current=new TemporalExerciseRecognizer({cameraView:local.preferences.current.cameraView??'auto'});
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
              workout.current!.observe({...result.observation,labelSource:profile.current==='auto'?'automatic':'profile'});setRecognized(result.observation.exercise);
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
    else applyChoice(next);
  };
  const logManual=() => {
    try {getWorkout().addManualSet(exercise,Number(reps),load.trim()===''?null:Number(load));refresh();setStatus('Set manual dicatat');}
    catch {setStatus('Masukkan reps bulat positif dan beban kg yang valid.');}
  };
  const finish=() => {
    stopResources();getWorkout().finish();setRunning(false);setLoading(false);setFinished(true);setPendingChoice(null);setStatus('Workout selesai');refresh();
    if(recorder.current){setRecordBusy(true);void recorder.current.finish().then(blobs=>{
      releaseClips();const files=blobs.map(blob=>({url:URL.createObjectURL(blob),extension:blob.type.includes('mp4')?'mp4':'webm'}));
      clipUrls.current=files.map(file=>file.url);setClips(files);setRecordNotice(files.length?'Rekaman siap disimpan per segmen ke perangkat.':'Tidak ada rekaman tersedia.');
    }).catch(()=>setRecordNotice('Rekaman gagal. Hasil workout tetap disimpan; tidak ada pemulihan video setelah reload.')).finally(()=>setRecordBusy(false));}
  };
  const openRecord=(record:LocalWorkout)=>{
    stopResources();local.open(record);
    const p=local.preferences.current;profile.current=p.profile;setChoice(p.profile);
    setCameraView(p.cameraView??'auto');
    setExercise(p.manualExercise);setReps(p.manualReps);setLoad(p.manualLoad);
    setFinished(workout.current!.isFinished());setPaused(!workout.current!.isFinished());setRunning(false);
    setStatus(workout.current!.isFinished()?'Workout selesai':'Sesi dipulihkan dalam keadaan jeda. Aktifkan kamera kembali atau lanjutkan manual.');refresh();
  };
  const controlsDisabled=!account.ready||!local.ready||!!local.recovery;
  const active=sets.find(set=>set.endedAt===null),last=sets.at(-1);
  const restTarget=local.preferences.current.restSeconds[last?.exercise??exercise]??120;
  const rest=Math.floor((workout.current?.restElapsedMs()??0)/1000);
  const guidance=cameraGuidance(choice==='auto'?null:choice,cameraView,!!workout.current);
  const resetWorkout=()=>{stopResources();recorder.current=null;recordOptIn.current=false;setRecordEnabled(false);setRecordNotice('');local.newWorkout();setCameraView('auto');setFinished(false);setPaused(false);setRecognized(null);setPendingChoice(null);setPendingAuto(null);profile.current='auto';setChoice('auto');setExercise('squat');setReps('10');setLoad('');setStatus('Kamera belum aktif');refresh();};
  return <View style={styles.card}>
    <style>{`button,input,select{font:inherit;font-family:system-ui,sans-serif}label,.workout-log{font-family:system-ui,sans-serif} .workout-log button{background:#e9f3ff;border:0;border-radius:8px;padding:10px;color:#1268c8;cursor:pointer} .exercise-card{border:1px solid #e2e9f2;border-radius:14px;padding:16px;margin:16px 0} .exercise-card h2{font-size:20px;color:#1268c8;margin:0 0 8px} .exercise-card table{border-collapse:collapse;width:100%;min-width:540px} .exercise-card th{text-align:left;color:#63708a;font-size:13px;padding:12px 4px} .exercise-card td{padding:8px 4px;border-top:1px solid #edf1f7} .exercise-card input[type=number]{width:74px;box-sizing:border-box;border:1px solid #cbd5e1;padding:10px;border-radius:8px} .exercise-card small{display:block;color:#63708a;font-size:12px;padding-top:6px}`}</style>
    <Text style={styles.heading}>{mode==='camera'?'Workout dengan kamera':'Log workout'}</Text>
    <Text accessibilityLiveRegion="polite">{local.saveStatus}</Text>
    <Text>{offlineStatus}</Text>
    <Text>Hasil tamu disimpan di browser ini. Membersihkan data situs menghapus riwayat lokal.</Text>
    <label><input type="checkbox" aria-label="Rekam video di perangkat" checked={recordEnabled} disabled={!!workout.current||controlsDisabled}
      onChange={e=>{setRecordEnabled(e.target.checked);recordOptIn.current=e.target.checked;}}/> Rekam video di perangkat (opsional)</label>
    <Text>Aktifkan sebelum workout. Rekaman tidak diunggah dan tidak dipulihkan setelah reload.</Text>
    {!!recordNotice&&<Text>{recordNotice}</Text>}
    {clips.length>0&&<View style={styles.summary}>{clips.map((file,i)=><a key={file.url} href={file.url} download={`gymbro-segmen-${i+1}.${file.extension}`}>Simpan segmen {i+1}</a>)}
      <Button label="Buang rekaman" onPress={()=>{releaseClips();void recorder.current?.discard();setRecordNotice('Rekaman dibuang. Hasil workout tetap tersimpan.');}}/>
    </View>}
    <AccountPanel account={account} disabled={!local.ready||!!workout.current&&!finished||recordBusy||clips.length>0} onReset={resetWorkout} beforeAction={local.flush}/>
    {local.recovery&&<View style={styles.summary}><Text style={styles.heading}>Sesi belum selesai ditemukan</Text><Text>Pulihkan catatan terverifikasi. Video sebelumnya tidak dapat dipulihkan.</Text>
      <Button label="Pulihkan sesi" onPress={()=>openRecord(local.recovery!)}/></View>}
    <View style={styles.actions}><Button label="Mode kamera" onPress={()=>setMode('camera')}/><Button label="Mode log" onPress={()=>setMode('log')}/></View>
    <View style={styles.summary}>{mode==='camera'?<><Text testID="live-rep-counter" style={styles.counter}>{active?.reps??0}</Text><Text>Reps set aktif · Set {active?sets.filter(s=>s.exercise===active.exercise).length:sets.length+1}</Text></>:<Text style={styles.heading}>{summary.totalSets} set · {summary.totalReps} reps · {summary.knownVolumeKg} kg</Text>}
      <Text>Istirahat: {rest} / {restTarget} detik</Text><Text>Durasi aktif: {Math.floor(summary.durationMs/1000)} detik</Text></View>
    {mode==='camera'&&<Text>Mode otomatis memerlukan pengenalan pola awal. Pilih profil sebelum mulai untuk menghitung sejak pose awal.</Text>}
    <div style={{display:mode==='camera'?'block':'none',position:'relative',width:'100%',
      background:'#101b2d',borderRadius:12,overflow:'hidden'}}>
      <video ref={video} autoPlay muted playsInline aria-label="Kamera workout"
        onLoadedMetadata={()=>{
          if(video.current?.videoWidth&&video.current.videoHeight)
            setVideoAspectRatio(video.current.videoWidth/video.current.videoHeight);
        }}
        style={{display:'block',width:'100%',maxHeight:360,background:'#101b2d',objectFit:'contain'}}/>
      <CameraFramingOverlay frame={running?overlayFrame:null} exercise={choice==='auto'?null:choice}
        cameraView={cameraView} videoAspectRatio={videoAspectRatio}/>
    </div>
    <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
    <Text>Gerakan: {recognized?exerciseLabels[recognized]:'Belum dikenali'}</Text>
    <label>Sudut kamera <select aria-label="Sudut kamera" value={local.recovery?.preferences.cameraView??cameraView} disabled={controlsDisabled||!!workout.current}
      onChange={event=>{
        const next=event.target.value;
        if(workout.current||local.recovery||!isCameraView(next))return;
        local.preferences.current.cameraView=next;setCameraView(next);
      }} style={{padding:10,margin:8}}>
      {Object.entries(cameraViewLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select></label>
    <Text>Posisi kamera tetap dari awal hingga akhir sesi. Untuk mengganti posisi, selesaikan sesi dan mulai workout baru.</Text>
    <Text>Pilihan sudut belum membuktikan akurasi otomatis. Jika sendi terhalang, catat set manual.</Text>
    {mode==='camera'&&<><label>Profil kamera <select aria-label="Profil kamera" value={choice} disabled={finished}
      onChange={event=>choose(event.target.value as Choice)} style={{padding:10,margin:8}}>
      <option value="auto">Otomatis</option>
      {Object.entries(exerciseLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select></label>
    <Text testID="camera-guide" style={styles.guide}>{guidance}</Text>
    <ExerciseGuide exercise={choice==='auto'?exercise:choice}/></>}
    <View style={styles.actions}>
      <Button label={running?'Kamera aktif':paused?'Lanjutkan kamera':'Aktifkan kamera'} onPress={()=>void start()} disabled={controlsDisabled||running||loading||finished}/>
      {running&&<Button label="Jeda kamera" onPress={pause}/>}
      {!running&&!finished&&!paused&&workout.current&&<Button label="Jeda workout" onPress={pause}/>}
      {paused&&!finished&&<Button label="Lanjutkan workout manual" onPress={()=>{getWorkout().resume();setPaused(false);setStatus('Workout manual dilanjutkan');refresh();}}/>}
      <Button label="Akhiri set" onPress={()=>{workout.current?.endSet();refresh();}} disabled={controlsDisabled||finished}/>
    </View>
    {(pendingChoice||pendingAuto)&&<View><Text>Konfirmasi pergantian latihan; set aktif akan diakhiri.</Text>
      <Button label="Konfirmasi pergantian" onPress={()=>{
        if (pendingChoice) {workout.current?.endSet();applyChoice(pendingChoice);}
        else {workout.current?.confirmExerciseChange();refresh();}
      }}/></View>}
    {mode==='log'&&<WorkoutLog session={workout.current} sets={sets} history={local.history} preferences={local.preferences.current} refresh={refresh} onError={setStatus}/>}
    <Text style={styles.heading}>Catat set manual</Text>
    <label>Latihan <select aria-label="Latihan untuk set manual" value={exercise} disabled={finished}
      onChange={event=>{const next=event.target.value as ExerciseId;setExercise(next);local.preferences.current.manualExercise=next;refresh();}} style={{padding:10,margin:8}}>
      {Object.entries(exerciseLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select></label>
    <TextInput accessibilityLabel="Reps manual" value={reps} onChangeText={s=>{setReps(s);local.preferences.current.manualReps=s;refresh();}} editable={!finished} keyboardType="numeric" style={styles.input}/>
    <Text>{loadLabel(exercise)}</Text>
    <TextInput accessibilityLabel="Beban kg" value={load} onChangeText={s=>{setLoad(s);local.preferences.current.manualLoad=s;refresh();}} editable={!finished} keyboardType="decimal-pad" placeholder="Belum diisi" style={styles.input}/>
    {sets.at(-1)?.endedAt===null&&<Text>Set aktif akan diakhiri ketika mencatat set manual.</Text>}
    <Button label="Catat set manual" onPress={logManual} disabled={controlsDisabled||finished||paused}/>
    <View style={styles.summary}>
      <Text style={styles.heading}>Summary</Text>
      <Text>Total set: {summary.totalSets}</Text><Text>Total reps: {summary.totalReps}</Text>
      <Text>Volume diketahui: {summary.knownVolumeKg} kg</Text>
      {!summary.volumeComplete&&<Text>Beban belum lengkap</Text>}
      <Text>Istirahat antarset: {Math.floor(summary.restDurationMs/1000)} detik</Text><Text>Durasi jeda: {Math.floor(summary.pausedDurationMs/1000)} detik</Text>
      {sets.map(set=><Text key={set.id}>{exerciseLabels[set.exercise]} · {set.reps} reps · {set.origin==='automatic'?'kamera':set.origin==='mixed'?'campuran':'manual'}</Text>)}
    </View>
    <Button label="Selesaikan workout" onPress={finish} disabled={controlsDisabled||finished}/>
    <Button label="Ekspor hasil JSON" onPress={local.exportResults} disabled={!workout.current}/>
    {finished&&<Button label="Workout baru" disabled={clips.length>0||recordBusy} onPress={resetWorkout}/>}
    {clips.length>0&&<Text>Simpan file yang diinginkan, lalu buang salinan sementara sebelum workout baru.</Text>}
    {local.history.length>0&&<View style={styles.summary}><Text style={styles.heading}>Riwayat di perangkat</Text>
      {local.history.map(h=><View key={h.id}><Text>{new Date(h.snapshot.startedAt).toLocaleString('id-ID')} · {h.snapshot.sets.reduce((n,s)=>n+s.reps,0)} reps</Text><Button label="Lihat workout" onPress={()=>openRecord(h)} disabled={!!workout.current&&!finished||!!local.recovery||recordBusy||clips.length>0}/><Button label="Hapus workout" onPress={()=>setDeleteId(h.id)} disabled={!!workout.current&&!finished||recordBusy||clips.length>0}/>{deleteId===h.id&&<><Text>Hapus workout ini dari perangkat dan akun terkait?</Text><Button label="Konfirmasi hapus workout" onPress={()=>{void local.flush().then(async()=>{const binding=(await account.store.bindings()).find(b=>b.workoutId===h.id);if(binding){await account.store.deleteWorkout(h,binding.ownerId);await account.flush();}else await account.store.remove(h.id,h.revision);setDeleteId(null);resetWorkout();await local.reloadHistory();}).catch(()=>setStatus('Penghapusan gagal; hasil tetap tersimpan'));}}/><Button label="Batal hapus workout" onPress={()=>setDeleteId(null)}/></>}</View>)}
    </View>}
  </View>;
}
const styles=StyleSheet.create({
  card:{width:'100%',maxWidth:800,backgroundColor:'#fff',borderRadius:20,padding:20,gap:12},
  heading:{fontSize:23,fontWeight:'700',color:'#15233d'},counter:{fontSize:80,fontWeight:'800',color:'#1268c8'},status:{color:'#173d65',fontSize:16},
  guide:{backgroundColor:'#edf5ff',padding:12,borderRadius:8},actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
  button:{backgroundColor:'#1268c8',padding:12,borderRadius:10,alignSelf:'flex-start'},
  buttonLabel:{color:'#fff',fontWeight:'600'},disabled:{opacity:.45},
  input:{borderWidth:1,borderColor:'#b9c8db',borderRadius:8,padding:12,fontSize:16},
  summary:{backgroundColor:'#f4f7fb',padding:16,borderRadius:12,gap:8},
});
