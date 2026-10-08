import type {ExerciseId} from '../domain/workout';
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
