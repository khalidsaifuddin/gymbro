import {describe,it,expect} from 'vitest';
import {LocalRecorder,type RecorderPort} from './local-recorder';
class FakeRecorder implements RecorderPort {
 state='inactive';ondataavailable:((e:{data:Blob})=>void)|null=null;onstop:(()=>void)|null=null;onerror:(()=>void)|null=null;
 start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['valid-segment'],{type:'video/webm'})});this.onstop?.();});}
}
function fixture(supported=true){const made:FakeRecorder[]=[];const recorder=new LocalRecorder({isTypeSupported:()=>supported,create:()=>{const r=new FakeRecorder();made.push(r);return r;}});return {recorder,made};}
describe('device-only segmented recorder',()=>{
 it('creates no MediaRecorder unless recording is opted in',async()=>{
  const {recorder,made}=fixture();await recorder.start({} as MediaStream);expect(made).toHaveLength(0);expect(await recorder.finish()).toEqual([]);
 });
 it('retains independently valid segments across pause and resume',async()=>{
  const {recorder,made}=fixture();await recorder.start({} as MediaStream,true);expect(made[0].state).toBe('recording');
  await recorder.pause();expect(made[0].state).toBe('inactive');
  await recorder.start({} as MediaStream,true);const segments=await recorder.finish();
  expect(segments).toHaveLength(2);expect(await segments[0].text()).toBe('valid-segment');expect(await segments[1].text()).toBe('valid-segment');
 });
 it('rejects unsupported recording before touching the stream',async()=>{
  const {recorder,made}=fixture(false);await expect(recorder.start({} as MediaStream,true)).rejects.toThrow(/unsupported/i);expect(made).toHaveLength(0);
 });
 it('releases recordings on discard without affecting workout results',async()=>{
  const {recorder}=fixture();await recorder.start({} as MediaStream,true);await recorder.finish();await recorder.discard();expect(await recorder.finish()).toEqual([]);
 });
 it('stops once when pause and finish happen together',async()=>{
  const {recorder,made}=fixture();await recorder.start({} as MediaStream,true);const p=recorder.pause();await recorder.finish();await p;
  expect(made).toHaveLength(1);expect(await recorder.finish()).toHaveLength(1);
 });
 it('surfaces recorder failure and drops a broken segment',async()=>{
  const {recorder,made}=fixture();await recorder.start({} as MediaStream,true);made[0].onerror?.();
  await expect(recorder.finish()).rejects.toThrow(/recording/i);
  await recorder.discard();expect(await recorder.finish()).toEqual([]);
 });
 it('surfaces a failed stop instead of leaving finish pending forever',async()=>{
  const {recorder,made}=fixture();await recorder.start({} as MediaStream,true);
  made[0].stop=()=>{throw new Error('device-ended');};
  await expect(recorder.finish()).rejects.toThrow(/recording/i);await recorder.discard();
 });
});
