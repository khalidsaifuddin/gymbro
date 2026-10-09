// Original geometric illustrations. CC-BY-4.0, Gymbro contributors.
// Edit joint coordinates here and run `node scripts/generate-exercise-guides.mjs`.
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('../public/exercises/',import.meta.url));
await mkdir(directory,{recursive:true});
const skeleton=[['shoulder','hip'],['shoulder','elbow'],['elbow','hand'],['shoulder2','elbow2'],['elbow2','hand2'],['hip','knee'],['knee','ankle'],['hip','knee2'],['knee2','ankle2']];
const pose=(head,shoulder,hip,elbow,hand,knee,ankle,elbow2=elbow,hand2=hand,knee2=knee,ankle2=ankle,shoulder2=shoulder)=>({head,shoulder,shoulder2,hip,elbow,hand,elbow2,hand2,knee,ankle,knee2,ankle2});
const definitions=[
 {id:'squat',label:'Squat',view:'Vue latérale',equipment:'',
  ready:pose([150,52],[146,80],[145,145],[171,108],[195,108],[149,178],[149,212],[168,105],[193,103],[142,178],[138,212]),
  peak:pose([180,85],[162,108],[122,158],[192,112],[224,106],[171,178],[149,212],[191,109],[224,102],[160,180],[138,212])},
 {id:'push-up',label:'Push-up',view:'Kamera samping',equipment:'',
  ready:pose([72,89],[106,101],[190,132],[101,154],[100,209],[230,168],[260,208],[113,154],[113,209],[239,169],[269,208]),
  peak:pose([68,153],[103,163],[193,181],[132,188],[100,209],[234,194],[260,208],[146,188],[113,209],[242,194],[269,208])},
 {id:'dumbbell-curl',label:'Dumbbell curl bilateral',view:'Kamera depan menyerong',equipment:'dumbbells',
  ready:pose([150,46],[128,75],[150,146],[123,118],[123,159],[131,181],[124,212],[177,118],[177,159],[169,181],[177,212],[172,75]),
  peak:pose([150,46],[128,75],[150,146],[123,118],[140,85],[131,181],[124,212],[177,118],[160,85],[169,181],[177,212],[172,75])},
 {id:'machine-shoulder-press',label:'Seated machine shoulder press',view:'Kamera samping menyerong',equipment:'machine',
  ready:pose([141,55],[138,82],[145,149],[107,107],[108,77],[202,149],[202,208],[170,107],[169,77],[189,152],[189,208]),
  peak:pose([141,55],[138,82],[145,149],[119,55],[127,22],[202,149],[202,208],[160,55],[152,22],[189,152],[189,208])},
 {id:'bench-press',label:'Flat barbell bench press',view:'Kamera samping bangku',equipment:'bench',
  ready:pose([64,155],[103,159],[191,164],[78,164],[105,125],[223,184],[223,212],[88,167],[116,125],[213,188],[213,212]),
  peak:pose([64,155],[103,159],[191,164],[106,111],[107,61],[223,184],[223,212],[116,112],[119,61],[213,188],[213,212])},
 {id:'lat-pulldown',label:'Lat pulldown bilateral ke depan dada',view:'Kamera samping menyerong',equipment:'cable',pulley:[270,20],
  ready:pose([140,55],[140,82],[145,149],[140,48],[145,20],[200,149],[205,212],[150,48],[157,20],[189,152],[194,212]),
  peak:pose([140,55],[140,82],[145,149],[123,128],[166,108],[200,149],[205,212],[135,128],[178,108],[189,152],[194,212])},
 {id:'seated-cable-row',label:'Seated cable row bilateral',view:'Kamera samping menyerong',equipment:'cable',pulley:[270,112],
  ready:pose([125,55],[125,82],[126,149],[171,88],[217,94],[185,149],[207,212],[180,94],[226,100],[178,153],[198,212]),
  peak:pose([125,55],[125,82],[126,149],[95,120],[151,139],[185,149],[207,212],[107,126],[162,145],[178,153],[198,212])},
 {id:'face-pull',label:'Rope face pull bilateral',view:'Kamera depan menyerong',equipment:'cable',pulley:[270,66],
  ready:pose([125,50],[100,82],[125,149],[161,85],[222,88],[108,180],[101,212],[191,88],[232,94],[142,180],[149,212],[150,82]),
  peak:pose([125,50],[100,82],[125,149],[79,89],[114,65],[108,180],[101,212],[182,81],[139,65],[142,180],[149,212],[150,82])},
 {id:'straight-arm-pulldown',label:'Straight-arm cable pulldown bilateral',view:'Kamera samping menyerong',equipment:'cable',pulley:[270,20],
  ready:pose([116,50],[120,80],[120,149],[165,80],[210,80],[118,179],[114,212],[173,85],[218,85],[130,179],[126,212]),
  peak:pose([116,50],[120,80],[120,149],[137,115],[154,150],[118,179],[114,212],[147,117],[164,152],[130,179],[126,212])},
];
const anim=(name,a,b)=>`<animate attributeName="${name}" values="${a};${a};${b};${b};${a}" keyTimes="0;0.15;0.5;0.65;1" dur="3s" repeatCount="indefinite"/>`;
function line(a,b,c,d,animated,color='#1268c8',width=9){return `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${color}" stroke-width="${width}" stroke-linecap="round">${animated||''}</line>`;}
function figure(def,moving=false,peak=false){
 const a=peak?def.peak:def.ready,b=def.peak;
 let svg=skeleton.map(([from,to],i)=>line(...a[from],...a[to],moving?anim('x1',a[from][0],b[from][0])+anim('y1',a[from][1],b[from][1])+anim('x2',a[to][0],b[to][0])+anim('y2',a[to][1],b[to][1]):'',i>2?'#5495d7':'#1268c8',i===0?13:8)).join('');
 const neck=p=>{const target=[(p.shoulder[0]+p.shoulder2[0])/2,(p.shoulder[1]+p.shoulder2[1])/2],dx=target[0]-p.head[0],dy=target[1]-p.head[1],length=Math.hypot(dx,dy);return [p.head[0]+dx*14/length,p.head[1]+dy*14/length,...target];};
 const n=neck(a),m=neck(b);svg+=line(...n,moving?anim('x1',n[0],m[0])+anim('y1',n[1],m[1])+anim('x2',n[2],m[2])+anim('y2',n[3],m[3]):'','#15233d',6);
 if(def.equipment==='dumbbells')svg+=line(...a.shoulder,...a.shoulder2,'','#1268c8',8)+line(...a.shoulder2,...a.hip,'','#1268c8',10);
 for(const key of ['head','hand','hand2','knee','elbow'])svg+=`<circle data-joint="${key}" cx="${a[key][0]}" cy="${a[key][1]}" r="${key==='head'?15:4}" fill="${key==='head'?'#15233d':'#f7ad45'}">${moving?anim('cx',a[key][0],b[key][0])+anim('cy',a[key][1],b[key][1]):''}</circle>`;
 if(def.equipment==='dumbbells')for(const key of ['hand','hand2'])svg+=line(a[key][0]-13,a[key][1],a[key][0]+13,a[key][1],moving?anim('x1',a[key][0]-13,b[key][0]-13)+anim('x2',a[key][0]+13,b[key][0]+13)+anim('y1',a[key][1],b[key][1])+anim('y2',a[key][1],b[key][1]):'','#15233d',10);
 if(def.equipment==='bench')svg+=line(75,a.hand[1],142,a.hand[1],moving?anim('y1',a.hand[1],b.hand[1])+anim('y2',a.hand[1],b.hand[1]):'','#15233d',7);
 if(def.equipment==='machine')for(const key of ['hand','hand2'])svg+=line(a[key][0]-8,a[key][1],a[key][0]+8,a[key][1],moving?anim('x1',a[key][0]-8,b[key][0]-8)+anim('x2',a[key][0]+8,b[key][0]+8)+anim('y1',a[key][1],b[key][1])+anim('y2',a[key][1],b[key][1]):'','#15233d',7);
 if(def.equipment==='cable'){
  if(def.id==='face-pull')svg+=line(...a.shoulder,...a.shoulder2,'','#1268c8',8)+line(...a.shoulder2,...a.hip,'','#1268c8',10);
  // One shared attachment/stack: cable to hand midpoint, bar/rope joins hands.
  const mid=p=>[(p.hand[0]+p.hand2[0])/2+(def.id==='face-pull'?18:0),(p.hand[1]+p.hand2[1])/2],ma=mid(a),mb=mid(b);
  svg+=line(...def.pulley,...ma,moving?anim('x2',ma[0],mb[0])+anim('y2',ma[1],mb[1]):'','#63708a',2);
  if(def.id==='face-pull')for(const key of ['hand','hand2'])svg+=line(...ma,...a[key],moving?anim('x1',ma[0],mb[0])+anim('y1',ma[1],mb[1])+anim('x2',a[key][0],b[key][0])+anim('y2',a[key][1],b[key][1]):'','#15233d',4);
  else svg+=line(...a.hand,...a.hand2,moving?anim('x1',a.hand[0],b.hand[0])+anim('y1',a.hand[1],b.hand[1])+anim('x2',a.hand2[0],b.hand2[0])+anim('y2',a.hand2[1],b.hand2[1]):'','#15233d',5);
 }
 return svg;
}
function equipment(def){
 if(def.equipment==='cable')return `<path d="M270 18V213M249 213H287" stroke="#91a0b4" stroke-width="7" fill="none"/><rect x="253" y="166" width="25" height="32" rx="3" fill="#c3d0e0"/><circle cx="${def.pulley[0]}" cy="${def.pulley[1]}" r="7" fill="#63708a"/>`+(def.id==='lat-pulldown'||def.id==='seated-cable-row'?'<path d="M107 155H159M128 155V213" stroke="#91a0b4" stroke-width="6" fill="none"/>':'');
 if(def.equipment==='bench')return '<path d="M51 179H203M72 179V214M186 179V214" stroke="#91a0b4" stroke-width="7" fill="none"/>';
 if(def.equipment==='machine')return '<path d="M125 154H175M128 92V154M150 154V214M94 214V28M94 28H188M188 28V214" stroke="#91a0b4" stroke-width="7" fill="none"/>';
 return '';
}
const metadata='<metadata>Original artwork by Gymbro contributors. License: Creative Commons Attribution 4.0 International (CC-BY-4.0). https://creativecommons.org/licenses/by/4.0/ Source: scripts/generate-exercise-guides.mjs. Attribution: Gymbro contributors, Gymbro exercise guides, CC-BY-4.0. Illustrative guide; not model accuracy evidence.</metadata>';
for(const def of definitions){
 if(def.view==='Vue latérale')def.view='Kamera samping menyerong';
 const opening=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" role="img"><title>${def.label}</title><desc>Ilustrasi gerakan dan posisi kamera. ${def.view}. Satu orang; sendi harus terlihat.</desc>${metadata}`;
 await writeFile(`${directory}/${def.id}.svg`,`${opening}<rect width="300" height="260" rx="16" fill="#edf5ff"/><path d="M28 218H281" stroke="#c3d0e0" stroke-width="3"/>${equipment(def)}${figure(def,true)}<text x="150" y="246" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#173d65">${def.view} · sendi terlihat</text></svg>\n`);
 await writeFile(`${directory}/${def.id}-poses.svg`,`${opening.replace('0 0 300 260','0 0 600 280')}<rect width="600" height="280" rx="16" fill="#edf5ff"/><g>${equipment(def)}${figure(def)}<text x="150" y="245" text-anchor="middle" font-family="sans-serif" font-size="16">Pose awal</text></g><g transform="translate(300 0)">${equipment(def)}${figure(def,false,true)}<text x="150" y="245" text-anchor="middle" font-family="sans-serif" font-size="16">Pose akhir fase</text></g><text x="300" y="268" text-anchor="middle" font-family="sans-serif" font-size="12">${def.view} · kembali ke pose awal untuk satu rep</text></svg>\n`);
}
await writeFile(`${directory}/manifest.json`,JSON.stringify({creator:'Gymbro contributors',license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:'Gymbro contributors — Gymbro exercise guides — CC-BY-4.0',source:'frontend/scripts/generate-exercise-guides.mjs',exercises:definitions.map(d=>({id:d.id,animation:`${d.id}.svg`,poses:`${d.id}-poses.svg`}))},null,2)+'\n');
console.log(`Generated ${definitions.length} original animated SVGs and start/end pose guides`);
