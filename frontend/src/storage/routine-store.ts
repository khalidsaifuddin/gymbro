import {validatePlan,type PlannedExercise} from '../domain/session-plan';

export type Routine={id:string;revision:number;name:string;exercises:PlannedExercise[];createdAt:number;updatedAt:number};

function validateRoutine(value:Routine):Routine{
 if(!value||typeof value!=='object'||Object.keys(value).some(key=>!['id','revision','name','exercises','createdAt','updatedAt'].includes(key))||
  typeof value.id!=='string'||!value.id||!Number.isSafeInteger(value.revision)||value.revision<0||
  !Number.isSafeInteger(value.createdAt)||!Number.isSafeInteger(value.updatedAt)||value.updatedAt<value.createdAt)throw new Error('Invalid routine record');
 if(typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>80)throw new Error('Invalid routine name');
 const exercises=validatePlan(value.exercises);
 if(!exercises.length)throw new Error('Routine requires at least one exercise');
 return {...value,name:value.name.trim(),exercises};
}

export class RoutineStore {
 private database:Promise<IDBDatabase>|null=null;
 constructor(private factory:IDBFactory|undefined,private name='gymbro-routines-v1'){}
 private open():Promise<IDBDatabase>{
  if(!this.factory)return Promise.reject(new Error('Browser storage unavailable'));
  return this.database??=new Promise((resolve,reject)=>{
   const request=this.factory!.open(this.name,1);
   request.onupgradeneeded=()=>request.result.createObjectStore('routines',{keyPath:'id'});
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.database=null;};resolve(db);};
   request.onerror=()=>{this.database=null;reject(request.error??new Error('Routine storage failed'));};
   request.onblocked=()=>{this.database=null;reject(new Error('Routine storage upgrade blocked'));};
  });
 }
 async list():Promise<Routine[]>{
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('routines','readonly'),request=tx.objectStore('routines').getAll();
   tx.oncomplete=()=>{try{resolve(request.result.map(validateRoutine).sort((a,b)=>b.updatedAt-a.updatedAt));}catch(error){reject(error);}};
   tx.onabort=()=>reject(tx.error??new Error('Routine storage read failed'));
  });
 }
 async save(value:Routine,expectedRevision:number):Promise<Routine>{
  const routine=validateRoutine(value),db=await this.open();
  if(routine.revision!==expectedRevision)throw new Error('Routine revision conflict');
  const saved={...routine,revision:expectedRevision+1};
  await this.mutate(db,routine.id,expectedRevision,store=>store.put(saved));return saved;
 }
 async remove(id:string,expectedRevision:number):Promise<void>{
  const db=await this.open();await this.mutate(db,id,expectedRevision,store=>store.delete(id));
 }
 private mutate(db:IDBDatabase,id:string,revision:number,write:(store:IDBObjectStore)=>void):Promise<void>{
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('routines','readwrite'),store=tx.objectStore('routines'),request=store.get(id);
   let failure:Error|null=null;
   request.onsuccess=()=>{
    if((request.result?.revision??0)!==revision){failure=new Error('Routine revision conflict');tx.abort();return;}
    try{write(store);}catch(error){failure=error instanceof Error?error:new Error('Routine storage write failed');tx.abort();}
   };
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??new Error('Routine storage write failed'));
  });
 }
 async close():Promise<void>{if(this.database)(await this.database).close();this.database=null;}
}
