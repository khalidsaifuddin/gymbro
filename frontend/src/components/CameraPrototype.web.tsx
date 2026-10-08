import {useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {WorkoutSession,type ExerciseId,type WorkoutSet,type WorkoutSummary} from '../domain/workout';
import {BrowserPoseDetector} from '../detection/browser-pose-detector';
import {TemporalExerciseRecognizer} from '../detection/temporal-exercise-recognizer';
import {cameraGuides,exerciseLabels} from '../detection/camera-guides';

type Choice='auto'|ExerciseId;
const initial:WorkoutSummary={totalSets:0,totalReps:0,knownVolumeKg:0,volumeComplete:true,durationMs:0,pausedDurationMs:0,restDurationMs:0};
function Button({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
    style={[styles.button,disabled&&styles.disabled]}><Text style={styles.buttonLabel}>{label}</Text></Pressable>;
}
export default function CameraPrototype() {
  const video=useRef<HTMLVideoElement>(null), workout=useRef<WorkoutSession|null>(null);
  const detector=useRef<BrowserPoseDetector|null>(null), recognizer=useRef(new TemporalExerciseRecognizer());
  const stream=useRef<MediaStream|null>(null), epoch=useRef(0), animation=useRef(0), live=useRef(false);
  const lastObservation=useRef(0);
  const profile=useRef<Choice>('auto');
  const [choice,setChoice]=useState<Choice>('auto'), [pendingChoice,setPendingChoice]=useState<ExerciseId|null>(null);
  const [pendingAuto,setPendingAuto]=useState<ExerciseId|null>(null),[exercise,setExercise]=useState<ExerciseId>('squat');
  const [reps,setReps]=useState('10'),[load,setLoad]=useState(''),[status,setStatus]=useState('Kamera belum aktif');
  const [running,setRunning]=useState(false),[loading,setLoading]=useState(false),[paused,setPaused]=useState(false);
  const [finished,setFinished]=useState(false),[recognized,setRecognized]=useState<ExerciseId|null>(null);
  const [summary,setSummary]=useState(initial),[sets,setSets]=useState<WorkoutSet[]>([]);
  const refresh=() => {
    if (!workout.current) return;
    setSummary(workout.current.summary());setSets(workout.current.getSets());
    setPendingAuto(workout.current.getPendingExercise());
  };
  const getWorkout=() => workout.current ??=new WorkoutSession({clock:Date.now,idFactory:()=>crypto.randomUUID()});
  const stopResources=() => {
    epoch.current++;live.current=false;cancelAnimationFrame(animation.current);
    detector.current?.stop();detector.current=null;
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
    if (video.current) {video.current.pause();video.current.srcObject=null;}
  };
  const pause=() => {
    getWorkout().pause();stopResources();setRunning(false);setLoading(false);setPaused(true);
    setStatus('Kamera dijeda');refresh();
  };
  useEffect(() => {
    const hidden=() => {if (document.hidden&&(live.current||detector.current||stream.current)) pause();};
    document.addEventListener('visibilitychange',hidden);
    const timer=setInterval(()=>{
      if (live.current&&lastObservation.current&&Date.now()-lastObservation.current>1000) {
        workout.current?.observe({exercise:null,visible:false,phase:'moving'});
        setStatus('Tracking terputus. Pastikan tubuh dan sendi terlihat.');
      }
      workout.current?.tick();refresh();
    },250);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);stopResources();};
  },[]);
  const start=async () => {
    if (loading||finished) return;
    if (document.hidden) {pause();return;}
    const token=++epoch.current;
    getWorkout().resume();setLoading(true);setStatus('Memuat kamera dan model…');
    const worker=new BrowserPoseDetector();detector.current=worker;
    recognizer.current=new TemporalExerciseRecognizer();
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
              const result=recognizer.current.process(pose);
              workout.current!.observe(result.observation);setRecognized(result.observation.exercise);
              setStatus(result.reason==='camera-position'?'Sesuaikan kamera agar sendi terlihat.'
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
  };
  const guidance=choice==='auto'?'Satu orang, kamera diam, seluruh tubuh terlihat. Pilih profil latihan untuk panduan posisi khusus.':cameraGuides[choice];
  return <View style={styles.card}>
    <Text style={styles.heading}>Workout dengan kamera</Text>
    <Text>Hasil sesi ini belum disimpan. Hindari menutup halaman sebelum mencatat summary.</Text>
    <Text>Mode otomatis memerlukan pengenalan pola awal. Pilih profil sebelum mulai untuk menghitung sejak pose awal.</Text>
    <video ref={video} autoPlay muted playsInline aria-label="Kamera workout"
      style={{width:'100%',maxHeight:360,background:'#101b2d',objectFit:'contain',borderRadius:12}}/>
    <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
    <Text>Gerakan: {recognized?exerciseLabels[recognized]:'Belum dikenali'}</Text>
    <label>Profil kamera <select aria-label="Profil kamera" value={choice} disabled={finished}
      onChange={event=>choose(event.target.value as Choice)} style={{padding:10,margin:8}}>
      <option value="auto">Otomatis</option>
      {Object.entries(exerciseLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select></label>
    <Text testID="camera-guide" style={styles.guide}>{guidance}</Text>
    <View style={styles.actions}>
      <Button label={running?'Kamera aktif':paused?'Lanjutkan kamera':'Aktifkan kamera'} onPress={()=>void start()} disabled={running||loading||finished}/>
      {running&&<Button label="Jeda kamera" onPress={pause}/>}
      <Button label="Akhiri set" onPress={()=>{workout.current?.endSet();refresh();}} disabled={finished}/>
    </View>
    {(pendingChoice||pendingAuto)&&<View><Text>Konfirmasi pergantian latihan; set aktif akan diakhiri.</Text>
      <Button label="Konfirmasi pergantian" onPress={()=>{
        if (pendingChoice) {workout.current?.endSet();applyChoice(pendingChoice);}
        else {workout.current?.confirmExerciseChange();refresh();}
      }}/></View>}
    <Text style={styles.heading}>Catat set manual</Text>
    <label>Latihan <select aria-label="Latihan untuk set manual" value={exercise} disabled={finished}
      onChange={event=>setExercise(event.target.value as ExerciseId)} style={{padding:10,margin:8}}>
      {Object.entries(exerciseLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select></label>
    <TextInput accessibilityLabel="Reps manual" value={reps} onChangeText={setReps} editable={!finished} keyboardType="numeric" style={styles.input}/>
    <Text>{exercise==='dumbbell-curl'?'Beban kg per dumbbell':exercise==='bench-press'?'Beban kg total, termasuk bar':'Beban kg eksternal (opsional untuk bodyweight)'}</Text>
    <TextInput accessibilityLabel="Beban kg" value={load} onChangeText={setLoad} editable={!finished} keyboardType="decimal-pad" placeholder="Belum diisi" style={styles.input}/>
    {sets.at(-1)?.endedAt===null&&<Text>Set aktif akan diakhiri ketika mencatat set manual.</Text>}
    <Button label="Catat set manual" onPress={logManual} disabled={finished}/>
    <View style={styles.summary}>
      <Text style={styles.heading}>Summary</Text>
      <Text>Total set: {summary.totalSets}</Text><Text>Total reps: {summary.totalReps}</Text>
      <Text>Volume diketahui: {summary.knownVolumeKg} kg</Text>
      {!summary.volumeComplete&&<Text>Beban belum lengkap</Text>}
      <Text>Durasi aktif: {Math.floor(summary.durationMs/1000)} detik</Text>
      {sets.map(set=><Text key={set.id}>{exerciseLabels[set.exercise]} · {set.reps} reps · {set.origin==='automatic'?'kamera':set.origin==='mixed'?'campuran':'manual'}</Text>)}
    </View>
    <Button label="Selesaikan workout" onPress={finish} disabled={finished}/>
  </View>;
}
const styles=StyleSheet.create({
  card:{width:'100%',maxWidth:800,backgroundColor:'#fff',borderRadius:20,padding:20,gap:12},
  heading:{fontSize:23,fontWeight:'700',color:'#15233d'},status:{color:'#173d65',fontSize:16},
  guide:{backgroundColor:'#edf5ff',padding:12,borderRadius:8},actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
  button:{backgroundColor:'#1268c8',padding:12,borderRadius:10,alignSelf:'flex-start'},
  buttonLabel:{color:'#fff',fontWeight:'600'},disabled:{opacity:.45},
  input:{borderWidth:1,borderColor:'#b9c8db',borderRadius:8,padding:12,fontSize:16},
  summary:{backgroundColor:'#f4f7fb',padding:16,borderRadius:12,gap:8},
});
