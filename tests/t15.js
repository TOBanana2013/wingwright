const P=require('../src/physics.js');const REAL=require('../src/real.js');
const SIT={normal:'atr72',ocean:'c172',himalaya:'a320',storm:'b747',carrier:'f35'};
for(const seed of [3,7,11,19,23]) for(const [id,pk] of Object.entries(SIT)){
 const s=P.specs(REAL[pk]);const W=P.makeSituationWorld(s,id,seed);const f=P.newFlight(s,W);const dt=1/120;
 if(W.start){const st=W.start;Object.assign(f,{e:st.e,n:st.n,h:st.h,psi:st.psi,vx:st.v,vy:0,theta:2,ground:false,flew:true,x:1e5,flaps:0,flapSet:2,throttle:0.6});}
 let minAgl=1e9;
 while(!f.result&&f.t<1500){const v=Math.hypot(f.vx,f.vy);const g=P.guide(f,s);let pitch,roll=0;
  if(W.start&&W.start.engineOut&&f.t>W.start.engineOut)f.engineOut=true;
  if(f.ground&&!f.flew){f.throttle=1;pitch=v>s.vLift?1:0;}
  else{const app=g.phase==='approach'||g.phase==='flare'; if(!app&&f.agl>100) f.flaps=0; if((app&&g.captured)||f.engineOut) f.flaps=1;
   const vT=app||f.engineOut?P.approachSpeed(s,f.h):Math.max(s.vStall*1.35,Math.min(s.vMax*0.6,s.vStall*1.6));
   f.throttle=Math.max(0,Math.min(1,0.4+(vT-v)*0.08)); if(f.ground) f.throttle=0; f.brake=(app&&v>vT+8)||f.ground?1:0;
   let want=g.want; if(f.engineOut){ want = (f.agl<8? -1 : -6) + (v-vT)*0.6; want=Math.max(-12,Math.min(2,want)); }
   pitch=Math.max(-1,Math.min(1,(want-g.gamma)*0.35));
   const lim=g.phase==='flare'||f.agl<20?5:(f.agl<40?15:Math.min(30,s.maxBank)); const bc=Math.max(-lim,Math.min(lim,g.turn*1.5)); roll=Math.max(-1,Math.min(1,(bc-f.phi)/8));
   if(!f.ground) minAgl=Math.min(minAgl,f.agl);}
  P.stepFlight(f,s,{pitch,roll},dt);}
 console.log(seed,id.padEnd(9),pk.padEnd(6),(f.result?f.result.kind:'timeout').padEnd(8),(f.result?f.result.why:'').slice(0,85),'t',f.t|0,'minAGL',Math.round(minAgl));}
