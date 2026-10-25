const P=require('../src/physics.js');const REAL=require('../src/real.js');
const C={ultra:{length:5.5,height:1.0,width:0.8,span:9,chord:1.2,incidence:3,power:45,fuel:30,material:'carbon',shape:'rounded',tail:'medium'},
 bush:{length:12,height:1.8,width:1.6,span:16,chord:2,incidence:3,power:500,fuel:300,material:'alu',shape:'boxy',tail:'large'},
 airliner:{length:45,height:5,width:5,span:50,chord:6,incidence:3,power:6000,fuel:8000,material:'alu',shape:'rounded',tail:'large'},
 lifter:{length:75,height:8,width:8,span:85,chord:10,incidence:3,power:15000,fuel:25000,material:'alu',shape:'boxy',tail:'large'},
 whale:{length:150,height:16,width:16,span:200,chord:20,incidence:3,power:60000,fuel:100000,material:'carbon',shape:'rounded',tail:'large'},
 mega:{length:250,height:25,width:25,span:330,chord:32,incidence:3,power:180000,fuel:300000,material:'carbon',shape:'boxy',tail:'large'},
 an225:REAL.an225};
for(const mode of ['mission','free','challenge']) for(const seed of [3,7]) for(const [k,c] of Object.entries(C)){const s=P.specs(c);const W=P.makeWorld(s,seed,mode);
const f=P.newFlight(s,W);const dt=1/120;
while(!f.result&&f.t<1800&&!(mode==='free'&&f.landings)){const v=Math.hypot(f.vx,f.vy);const g=P.guide(f,s);let pitch,roll=0;
 if(f.ground&&!f.flew){f.throttle=1;f.brake=0;pitch=v>s.vLift?1:0;}
 else{const app=g.phase==='approach'||g.phase==='flare'; if(!app&&f.agl>100) f.flaps=0; if(app&&g.captured) f.flaps=1;
  const vT=app?s.vStallF*1.3:Math.max(s.vStall*1.35,Math.min(s.vMax*0.6,s.vStall*1.6));
  f.throttle=Math.max(0,Math.min(1,0.4+(vT-v)*0.08)); if(f.ground) f.throttle=0; f.brake=(app&&v>vT+8)||f.ground?1:0;
  pitch=Math.max(-1,Math.min(1,(g.want-g.gamma)*0.35));
  const lim=g.phase==='flare'?5:(f.agl<12?2:f.agl<40?15:Math.min(30,s.maxBank)); const bc=Math.max(-lim,Math.min(lim,g.turn*1.5)); roll=Math.max(-1,Math.min(1,(bc-f.phi)/8));}
 P.stepFlight(f,s,{pitch,roll},dt);}
const ok=(f.result&&f.result.kind==='win')||(mode==='free'&&f.landings);
console.log(mode.padEnd(9),seed,k.padEnd(9),ok?'OK':'FAIL',f.result?f.result.kind:'', (f.result&&f.result.why||'').slice(0,90),'t',f.t|0);}
