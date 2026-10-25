const P=require('../src/physics.js');const REAL=require('../src/real.js');
const planes=['c172','spit','a380','dhc6','b787'];const tally={};const fails=[];
for(const seed of [5,13]) for(const type of P.NEW_TYPES) for(const map of P.NEW_MAPS) for(const pk of planes){
 const s=P.specs(REAL[pk]);const W=P.makeRandomSituation(s,type,map,seed);const f=P.newFlight(s,W);const dt=1/120;
 if(W.start){const st=W.start;Object.assign(f,{e:st.e,n:st.n,h:st.h,psi:st.psi,vx:st.v,vy:0,theta:2,ground:false,flew:true,x:1e5,flaps:st.flaps?1:0,flapSet:st.flaps?1:2,throttle:st.thr||0.6});}
 while(!f.result&&f.t<2400){const v=Math.hypot(f.vx,f.vy);const g=P.guide(f,s);let pitch,roll=0;
  if(f.ground&&!f.flew){f.throttle=1;f.brake=0;f.reverse=0;pitch=v>s.vLift?1:0;}
  else{const app=g.phase==='approach'||g.phase==='flare'; if(!app&&f.agl>100) f.flaps=0; if(app&&g.captured) f.flaps=1;
   const vT=app?P.approachSpeed(s,f.h):Math.max(s.vStall*1.35,Math.min(s.vMax*0.6,s.vStall*1.6))*(W.timeLimit?1.25:1);
   f.throttle=Math.max(0,Math.min(1,0.4+(vT-v)*0.08)); if(f.ground) f.throttle=0; f.brake=(app&&v>vT+8)||f.ground?1:0; f.reverse=f.ground&&f.flew?1:0;
   pitch=Math.max(-1,Math.min(1,(g.want-g.gamma)*0.35));
   const lim=g.phase==='flare'||f.agl<20?5:(f.agl<40?15:Math.min(30,s.maxBank)); const bc=Math.max(-lim,Math.min(lim,g.turn*1.5)); roll=Math.max(-1,Math.min(1,(bc-f.phi)/8));}
  P.stepFlight(f,s,{pitch,roll},dt);}
 const k=f.result?f.result.kind:'timeout'; tally[k]=(tally[k]||0)+1;
 if(k!=='win') fails.push([seed,type,map,pk,k,(f.result?f.result.why:'').slice(0,80),'t',f.t|0,'fuel',Math.round(f.fuel)].join(' '));}
console.log(tally);console.log(fails.join('\n'));
