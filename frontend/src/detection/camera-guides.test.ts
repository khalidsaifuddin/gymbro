import {it,expect} from 'vitest';
import {cameraGuidance} from './camera-guides';

it('keeps the current exercise in view and allows a new angle after its set',()=>{
 expect(cameraGuidance('bench-press','auto',true)).not.toContain('Kamera dari');
 expect(cameraGuidance('bench-press','auto',true)).toContain('terlihat');
 expect(cameraGuidance('bench-press','auto',true)).toContain('Sudut dapat diubah setelah set aktif berakhir');
});
it('offers exercise-specific placement before the session and retains an explicit fixed direction',()=>{
 expect(cameraGuidance('bench-press','auto',false)).toContain('Kamera dari samping bangku');
 expect(cameraGuidance('bench-press','rear-left',true)).toContain('Kamera dari kiri belakang');
});
