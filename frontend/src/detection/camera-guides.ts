import type {ExerciseId} from '../domain/workout';
import {exerciseCatalog} from '../domain/exercises';
import type {CameraView} from '../domain/camera-view';
export const cameraViewLabels:Record<CameraView,string>={
  auto:'Panduan latihan (default)',front:'Depan',back:'Belakang',
  'front-left':'Kiri depan','front-right':'Kanan depan','rear-left':'Kiri belakang','rear-right':'Kanan belakang',
  'side-left':'Samping kiri','side-right':'Samping kanan',
};
export const exerciseLabels=Object.fromEntries(Object.entries(exerciseCatalog).map(([id,e])=>[id,e.label])) as Record<ExerciseId,string>;
export const cameraGuides:Record<ExerciseId,string>={
  'lat-pulldown':'Kamera dari samping menyerong. Pastikan kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki terlihat dalam posisi duduk. Tarik ke depan dada.',
  'seated-cable-row':'Kamera dari samping menyerong. Pastikan kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki terlihat. Tetap duduk dan tarik ke torso.',
  'face-pull':'Kamera dari depan menyerong. Pastikan wajah, kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki terlihat. Tarik rope ke wajah dengan kedua tangan.',
  'straight-arm-pulldown':'Kamera dari samping menyerong. Pastikan kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki terlihat dalam posisi berdiri; tangan bergerak ke pinggul.',
  squat:'Kamera dari samping agak menyerong. Pastikan kedua bahu, pinggul, lutut, dan pergelangan kaki terlihat.',
  'push-up':'Kamera dari samping. Pastikan bahu, siku, pergelangan tangan, dan pinggul terlihat; tubuh horizontal di atas lantai.',
  'dumbbell-curl':'Kamera dari depan agak menyerong. Pastikan kedua bahu, siku, pergelangan tangan, dan pinggul terlihat; gerakkan kedua lengan serempak.',
  'machine-shoulder-press':'Kamera dari samping agak menyerong. Pastikan bahu, siku, pergelangan tangan, pinggul, lutut, dan pergelangan kaki terlihat dalam posisi duduk.',
  'bench-press':'Kamera dari samping bangku. Pastikan bahu, siku, pergelangan tangan, dan pinggul terlihat; hindari bar atau alat menutupi sendi.',
};
const visibilityGuides:Record<ExerciseId,string>={
  'lat-pulldown':'Kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki harus terlihat. Duduk dan tarik ke depan dada, bukan belakang leher.',
  'seated-cable-row':'Kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki harus terlihat dalam posisi duduk. Tarik ke torso dengan kedua tangan.',
  'face-pull':'Wajah serta kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki harus terlihat. Berdiri dan tarik rope ke wajah.',
  'straight-arm-pulldown':'Kedua bahu, siku, tangan, pinggul, lutut dan pergelangan kaki harus terlihat. Berdiri dan gerakkan tangan ke pinggul dengan siku relatif lurus.',
  squat:'Pastikan bahu, pinggul, lutut, dan pergelangan kaki pada sisi yang dipantau terlihat.',
  'push-up':'Pastikan bahu, siku, pergelangan tangan, dan pinggul pada sisi yang dipantau terlihat; tubuh horizontal di atas lantai.',
  'dumbbell-curl':'Pastikan kedua bahu, siku, pergelangan tangan, dan pinggul terlihat; kedua lengan bergerak serempak.',
  'machine-shoulder-press':'Pastikan bahu, siku, pergelangan tangan, pinggul, lutut, dan pergelangan kaki pada sisi yang dipantau terlihat dalam posisi duduk.',
  'bench-press':'Pastikan bahu, siku, pergelangan tangan, dan pinggul pada sisi yang dipantau terlihat; tubuh horizontal dan alat tidak menutupi sendi.',
};
export function cameraGuidance(exercise:ExerciseId|null,view:CameraView,locked=false):string {
  const needs=exercise?visibilityGuides[exercise]:'Satu orang, seluruh tubuh dan sendi yang diperlukan terlihat. Pilih profil latihan untuk panduan khusus.';
  const position=view==='auto'?(exercise&&!locked?cameraGuides[exercise]:needs):`Kamera dari ${cameraViewLabels[view].toLowerCase()}. ${needs}`;
  const bilateral=view==='front'||view==='back'?' Pandangan depan/belakang memerlukan kedua sisi tubuh terlihat; jika sudut sendi tidak terbaca, catat manual.':'';
  return `${position}${bilateral} Kiri/kanan mengacu pada tubuh pengguna, bukan preview. Posisi kamera tetap selama seluruh sesi, termasuk istirahat dan pergantian latihan. Untuk posisi lain, mulai sesi baru.`;
}
