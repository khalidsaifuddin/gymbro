import type {ExerciseId} from '../domain/workout';
import type {CameraView} from '../domain/camera-view';
export const cameraViewLabels:Record<CameraView,string>={
  auto:'Panduan latihan (default)',front:'Depan',back:'Belakang',
  'front-left':'Kiri depan','front-right':'Kanan depan','rear-left':'Kiri belakang','rear-right':'Kanan belakang',
  'side-left':'Samping kiri','side-right':'Samping kanan',
};
export const exerciseLabels: Record<ExerciseId,string>={
  squat:'Squat', 'push-up':'Push-up','dumbbell-curl':'Dumbbell curl',
  'machine-shoulder-press':'Seated machine shoulder press','bench-press':'Flat barbell bench press',
};
export const cameraGuides:Record<ExerciseId,string>={
  squat:'Kamera dari samping agak menyerong. Pastikan kedua bahu, pinggul, lutut, dan pergelangan kaki terlihat.',
  'push-up':'Kamera dari samping. Pastikan bahu, siku, pergelangan tangan, dan pinggul terlihat; tubuh horizontal di atas lantai.',
  'dumbbell-curl':'Kamera dari depan agak menyerong. Pastikan kedua bahu, siku, pergelangan tangan, dan pinggul terlihat; gerakkan kedua lengan serempak.',
  'machine-shoulder-press':'Kamera dari samping agak menyerong. Pastikan bahu, siku, pergelangan tangan, pinggul, lutut, dan pergelangan kaki terlihat dalam posisi duduk.',
  'bench-press':'Kamera dari samping bangku. Pastikan bahu, siku, pergelangan tangan, dan pinggul terlihat; hindari bar atau alat menutupi sendi.',
};
const visibilityGuides:Record<ExerciseId,string>={
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
