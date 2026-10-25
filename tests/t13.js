const P=require('../src/physics.js');const REAL=require('../src/real.js');
const custom={trainer:{length:8.5,height:1.3,width:1.1,span:10,chord:1.5,incidence:3,power:120,fuel:100,material:'alu',shape:'rounded',tail:'medium'}};
const mode=process.argv[2]||'challenge'; let wins=0,n=0;
for(const seed of [3,7,11,19]) for(const [k,c] of Object.entries({extra:REAL.extra})){const s=P.specs(c);const W=P.makeWorld(s,seed,mode);
const f=P.newFlight(s,W);const dt=1/120;let minAgl=1e9;
while(!f.result&&f.t<1800&&!(mode==='free'&&f.landings)){const v=Math.hypot(f.vx,f.vy);const g=P.guide(f,s);let pitch,roll=0;
 if(f.ground&&!f.flew){f.throttle=1;f.brake=0;pitch=v>s.vLift?1:0;}
 else{const app=g.phase==='approach'||g.phase==='flare'; if(!app&&f.agl>100) f.flaps=0; if(app&&g.captured) f.flaps=1;
  const vT=app?s.vStallF*1.3:Math.max(s.vStall*1.35,Math.min(s.vMax*0.6,s.vStall*1.6));
  f.throttle=Math.max(0,Math.min(1,0.4+(vT-v)*0.08)); if(f.ground) f.throttle=0; f.brake=(app&&v>vT+8)||f.ground?1:0;
  pitch=Math.max(-1,Math.min(1,(g.want-g.gamma)*0.35));
  const lim=g.phase==='flare'?5:(f.agl<40?15:Math.min(30,s.maxBank)); const bc=Math.max(-lim,Math.min(lim,g.turn*1.5)); roll=Math.max(-1,Math.min(1,(bc-f.phi)/8));
  if(f.flew&&!f.ground) minAgl=Math.min(minAgl, f.agl>5? f.agl: 1e9);}
 P.stepFlight(f,s,{pitch,roll},dt);}
n++; const ok=(f.result&&f.result.kind==='win')||(mode==='free'&&f.landings); if(ok)wins++;
console.log(seed,k.padEnd(7),f.result?f.result.kind:(f.landings?'landed:'+f.lastLand.name:'timeout'),(f.result&&f.result.why||'').slice(0,70),'t',f.t|0,'elev',W.elev||0,'minAGL',Math.round(minAgl),'peaks',W.peaks?W.peaks.length:0);}
console.log(mode,'wins',wins,'/',n);
