export type RecorderPort={state:string;start:(timeslice?:number)=>void;stop:()=>void;
 ondataavailable:((event:{data:Blob})=>void)|null;onstop:(()=>void)|null;onerror:(()=>void)|null};
export type RecorderEnvironment={isTypeSupported:(mime:string)=>boolean;create:(stream:MediaStream,mime:string)=>RecorderPort};
export class LocalRecorder {
 private current:RecorderPort|null=null;
 private segments:Blob[]=[];
 private stopping:Promise<void>|null=null;
 private stopped:(()=>void)|null=null;
 private failure:Error|null=null;
 constructor(private environment:RecorderEnvironment){}
 async start(stream:MediaStream,enabled=false):Promise<void> {
  if(!enabled)return;
  await this.pause();if(this.failure)throw this.failure;
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(m=>this.environment.isTypeSupported(m));
  if(!mime)throw new Error('Recording format unsupported');
  const recorder=this.environment.create(stream,mime),chunks:Blob[]=[];
  let broken=false;
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  recorder.onerror=()=>{broken=true;this.failure=new Error('Recording failed; workout results are retained separately');};
  recorder.onstop=()=>{
   if(!broken&&chunks.length)this.segments.push(new Blob(chunks,{type:mime}));
   this.current=null;this.stopped?.();this.stopped=null;this.stopping=null;
  };
  this.current=recorder;
  try{recorder.start(1000);}catch(error){this.current=null;throw error;}
 }
 pause():Promise<void> {
  if(this.stopping)return this.stopping;
  if(!this.current)return Promise.resolve();
  const recorder=this.current;
  this.stopping=new Promise(resolve=>{this.stopped=resolve;});
  const result=this.stopping;
  // Inactive after a browser error may still have a pending stop event.
  if(recorder.state!=='inactive')try{recorder.stop();}catch{
   this.failure=new Error('Recording stop failed');this.current=null;this.stopped?.();this.stopped=null;this.stopping=null;
  }
  return result;
 }
 error():Error|null{return this.failure;}
 isRecording():boolean{return this.current?.state==='recording';}
 async finish():Promise<Blob[]> {await this.pause();if(this.failure)throw this.failure;return [...this.segments];}
 async discard():Promise<void>{await this.pause();this.segments=[];this.failure=null;}
}
export function browserRecorderEnvironment():RecorderEnvironment {
 return {isTypeSupported:m=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(m),create:(stream,mime)=>{
  const recorder=new MediaRecorder(stream,{mimeType:mime});
  const port:RecorderPort={get state(){return recorder.state;},start:t=>recorder.start(t),stop:()=>recorder.stop(),ondataavailable:null,onstop:null,onerror:null};
  recorder.ondataavailable=e=>port.ondataavailable?.(e);recorder.onstop=()=>port.onstop?.();recorder.onerror=()=>port.onerror?.();return port;
 }};
}
