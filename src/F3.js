let fight = null;
function startFight() {
  const kind = fightKind, B = kind === 'bomber' ? BOMBERS[bomberKey] : null, ww = kind === 'ww2', agents = [];
  const n = fightSize, nRed = B ? [2, 4, 8][[1, 2, 8].indexOf(n)] : n, nBlue = B ? (B.stealth ? 1 : 1 + Math.floor(nRed / 2)) : n;
  const side = ww ? WW2[ww2Key].side : 'allies';
  const redKeys = B ? (B.era === 'jet' ? ['redhawk'] : B.red) : ww ? (side === 'allies' ? ['fw190', 'zero'] : ['spit', 'p51', 'yak3']) : ['redhawk'];
  const blueKey = i => i === 0 ? fightPlane() : B ? (B.era === 'jet' ? (i % 2 ? 'f22' : 'f35') : 'p51') : ww ? WW2[ww2Key].plane : (i % 2 ? 'f22' : 'f35');
  const startH = B ? B.alt : ww ? 2500 : 3000, sep = ww ? 9000 : 16000;
  const tgts = B ? makeTargets(B) : null, zone = tgts ? zoneOf(tgts) : null;
  const mk = (team, i, key) => {
    const row = Math.floor(i / 2), col = i % 2 ? 1 : -1, pr = REAL[key].engine === 'prop';
    let e, nn, h, psi;
    if (team === 'blue') { e = i ? col * (180 + row * 160) : 0; nn = i ? -120 - row * 200 : 0; h = startH + (i ? 40 : 0); psi = 0; }
    else if (B) { const a = i / nRed * 2 * Math.PI; e = zone[0] + Math.sin(a) * 2500; nn = zone[1] + Math.cos(a) * 2500; h = startH + 300 + (i % 3) * 150; psi = a + Math.PI / 2; }
    else { e = col * (180 + row * 160); nn = sep + row * 220; h = startH + (i % 3) * 120; psi = Math.PI; }
    const hp = team === 'blue' && i === 0 ? (B ? B.hp : ww ? 150 : 200) : 100;
    return { team, key, e, n: nn, h, psi, theta: 0, phi: 0, v: pr ? 125 : 235, vc: pr ? 125 : 235, vb: pr ? 145 : 290, vmin: pr ? 85 : 150,
      gmax: pr ? (team === 'red' ? 1.7 : 2.0) : (team === 'red' ? 5.5 : 6.5), prop: pr, hp, alive: true, missiles: pr ? 0 : (team === 'blue' ? 4 : 2), flares: pr ? 0 : 6,
      cool: team === 'blue' ? 4 + Math.random() * 4 : 12 + Math.random() * 8, lastFlare: -9, wob: Math.random() * 10, smoke: [], engaged: !B, slot: i, patrolH: h,
      name: team === 'blue' ? (i ? (B ? 'Escort ' : 'Wingman ') + i : 'You') : (B || ww ? `${SHORT[key]} ${i + 1}` : 'Red ' + (i + 1)) };
  };
  for (let i = 0; i < nBlue; i++) agents.push(mk('blue', i, blueKey(i)));
  for (let i = 0; i < nRed; i++) agents.push(mk('red', i, redKeys[i % redKeys.length]));
  agents[0].player = true;
  const jetGuns = kind === 'jets' || (B && B.era === 'jet');
  fight = { kind, B, ww, agents, missiles: [], flares: [], booms: [], chutes: [], tracers: [], lockT: 0, lock: null, target: null, missilesLeft: kind === 'jets' ? 6 : 0, flaresLeft: jetGuns ? 12 : 0, kills: 0, gunKills: 0, warn: false, gunT: 0,
    noLock: kind !== 'jets', hp0: agents[0].hp, tgts, zone, bombs: [], bombsLeft: B ? B.bombs : 0, bombsUsed: 0, stickQ: 0, stickT: 0, dropCool: 0, puffs: [], flakT: 1, gunT2: 0, alerted: false, ip: null, bombTip: '' };
  others = agents.filter(a => !a.player);
  const s0 = spec, sig = Math.exp(-startH / 8500), v0 = Math.min(s0.vMax * 0.85, Math.max(s0.vStall / Math.sqrt(sig) * 1.5, s0.vStall * 1.8));
  airborne(flight, { e: 0, n: 0, h: startH, psi: 0, v: kind === 'jets' ? 240 : v0, thr: 0.8 });
}
function fwdOf(a) { return [Math.sin(a.psi) * Math.cos(a.theta * DEG), Math.cos(a.psi) * Math.cos(a.theta * DEG), Math.sin(a.theta * DEG)]; }
function syncPlayerAgent() {
  const p = fight.agents[0], f = flight, v = Math.hypot(f.vx, f.vy);
  Object.assign(p, { e: f.e, n: f.n, h: f.h + gearH(plane) + plane.height / 2, psi: f.psi, theta: f.theta, phi: f.phi, v });
  p.vel = [Math.sin(f.psi) * f.vx, Math.cos(f.psi) * f.vx, f.vy];
}
function kill(a, by, how) {
  a.alive = false; a.falling = true; a.hp = 0;
  fight.booms.push({ p: [a.e, a.n, a.h], t: flight.t });
  fight.chutes.push({ p: [a.e, a.n, a.h + 20], t: flight.t, team: a.team });
  if (by && by.player) { fight.kills++; if (how === 'gunner') fight.gunKills++; note(how === 'gunner' ? `Your gunners got ${a.name}! The pilot bailed out safely.` : `SPLASH! You knocked out ${a.name}. The pilot ${a.prop ? 'bailed out' : 'ejected'} safely.`, 4); }
  if (a.player) flight.result = { kind: 'shotdown', why: `You were hit by ${by ? by.name : 'the enemy'}. You ${a.prop ? 'bailed out' : 'ejected'} and your parachute opened safely. ${fight.B ? `Targets destroyed: ${fight.tgts.filter(t => !t.alive).length} of ${fight.tgts.length}.` : `Enemies knocked out: ${fight.kills}.`}` };
}
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
function fightUpdate(dt) {
  const F = fight, A = F.agents, t = flight.t, B = F.B; syncPlayerAgent();
  const P = A[0];
  const enemiesOf = a => A.filter(b => b.alive && b.team !== a.team);
  if (B) {   // moving ships, enemy radar
    for (const tg of F.tgts) { if (tg.alive && tg.sp) { tg.e += Math.sin(tg.psi) * tg.sp * dt; tg.n += Math.cos(tg.psi) * tg.sp * dt; } if (!tg.alive && tg.len) tg.sink = Math.min(30, tg.sink + dt * 0.7); }
    F.zone = zoneOf(F.tgts);
    if (!F.alerted && A.some(b => b.team === 'blue' && b.alive && A.some(r => r.team === 'red' && r.alive && Math.hypot(r.e - b.e, r.n - b.n, r.h - b.h) < (b.player && B.stealth ? 3000 : 10000)))) {
      F.alerted = true; for (const r of A) if (r.team === 'red') r.engaged = true; note(B.stealth ? 'They spotted you up close! Enemy fighters are coming.' : 'Enemy fighters are scrambling to stop you!', 4);
    }
  }
  for (const a of A) {
    if (a.player) continue;
    if (!a.alive) { if (a.falling) { a.theta = Math.max(-70, a.theta - 25 * dt); a.phi += 120 * dt; const fw = fwdOf(a); a.e += fw[0] * a.v * dt; a.n += fw[1] * a.v * dt; a.h += fw[2] * a.v * dt; if (Math.random() < 0.5) { a.smoke.push([a.e, a.n, a.h]); if (a.smoke.length > 40) a.smoke.shift(); } if (a.h < 0) a.falling = false; } continue; }
    const red = a.team === 'red', maxRate = a.gmax * G / Math.max(a.prop ? 70 : 120, a.v);
    let dYaw = a.psi, dPitch = 0, vWant = null;
    if (B && !a.engaged && red) {   // patrol a circle over the target
      const dx = a.e - F.zone[0], dy = a.n - F.zone[1], r = Math.hypot(dx, dy), ang = Math.atan2(dx, dy);
      dYaw = ang + Math.PI / 2 + Math.max(-0.7, Math.min(0.7, (r - 2500) / 1500)); dPitch = Math.max(-0.2, Math.min(0.2, (a.patrolH - a.h) / 600)); vWant = a.vc * 0.85;
    } else if (B && !a.engaged) {   // escort: hold formation on the bomber
      if (A.some(r => r.team === 'red' && r.alive && r.engaged && Math.hypot(r.e - a.e, r.n - a.n) < 7000)) a.engaged = true;
      const fx = Math.sin(P.psi), fy = Math.cos(P.psi), back = 140 * Math.ceil(a.slot / 2), sd = (a.slot % 2 ? 1 : -1) * 170;
      const se = P.e - fx * back + fy * sd, sn = P.n - fy * back - fx * sd;
      dYaw = Math.atan2(se + fx * 500 - a.e, sn + fy * 500 - a.n); dPitch = Math.max(-0.3, Math.min(0.3, Math.atan2(P.h + 40 - a.h, 500)));
      vWant = Math.max(a.vmin, Math.min(a.vb, P.v - ((a.e - se) * fx + (a.n - sn) * fy) * 0.08));
    } else {
      if (!a.tgt || !a.tgt.alive) {
        const es = enemiesOf(a), load = x => A.filter(b => b.alive && b.tgt === x).length;
        a.tgt = (B && red && a.slot % 2 === 0 && P.alive) ? P : es.sort((x, y) => (load(x) - load(y)) * 1e6 + Math.hypot(x.e - a.e, x.n - a.n) - Math.hypot(y.e - a.e, y.n - a.n))[0] || null;
      }
      const threat = F.missiles.find(m => m.target === a && m.alive && Math.hypot(m.p[0] - a.e, m.p[1] - a.n, m.p[2] - a.h) < 3500);
      if (threat) {
        dYaw = Math.atan2(threat.p[0] - a.e, threat.p[1] - a.n) + (a.wob % 2 > 1 ? 1 : -1) * Math.PI / 2; dPitch = -0.15;
        if (a.flares > 0 && t - a.lastFlare > 1.2) { a.flares--; a.lastFlare = t; F.flares.push({ p: [a.e, a.n, a.h], v: [0, 0, -20], t }); }
      } else if (a.tgt) {
        const g = a.tgt, d = Math.hypot(g.e - a.e, g.n - a.n, g.h - a.h), lead = Math.min(2, d / (a.prop ? 400 : 700)), gv = g.vel || fwdOf(g).map(x => x * g.v);
        const pe = g.e + gv[0] * lead, pn = g.n + gv[1] * lead, ph = g.h + gv[2] * lead;
        dYaw = Math.atan2(pe - a.e, pn - a.n) + (red ? Math.sin(t * 0.7 + a.wob) * 0.12 : 0);
        dPitch = Math.max(-0.5, Math.min(0.5, Math.atan2(ph - a.h, Math.hypot(pe - a.e, pn - a.n))));
        const fw = fwdOf(a), to = [g.e - a.e, g.n - a.n, g.h - a.h], off = Math.acos(Math.max(-1, Math.min(1, (fw[0] * to[0] + fw[1] * to[1] + fw[2] * to[2]) / (d || 1)))) / DEG;
        a.cool -= dt;
        if (a.missiles > 0 && a.cool <= 0 && d > 1200 && d < (red ? 5500 : 7000) && off < 20) { a.missiles--; a.cool = red ? 14 + Math.random() * 8 : 7; launch(a, g); }
        if (d < (a.prop ? 650 : 900) && off < (a.prop ? 5 : 4)) { const dmg = (red ? 14 : 26) * dt * (Math.random() < 0.7 ? 1 : 0); g.hp -= dmg; F.tracers.push({ a: [a.e, a.n, a.h], b: [g.e, g.n, g.h], t }); if (g.hp <= 0 && g.alive) kill(g, a); }
        if (F.kind !== 'jets') vWant = d > 4000 ? a.vb : d < 1000 ? Math.max(a.vmin, Math.min(a.vb, (g.v || a.vc) + 12)) : a.vc;
        else vWant = Math.hypot(g.e - a.e, g.n - a.n) > 4000 ? 290 : 235;
      }
    }
    if (a.h < (a.prop ? 400 : 700)) dPitch = Math.max(dPitch, 0.25);
    if (a.h > 9000) dPitch = Math.min(dPitch, -0.05);
    const yr = Math.max(-maxRate, Math.min(maxRate, wrap(dYaw - a.psi) * 1.6));
    a.psi = wrap(a.psi + yr * dt);
    a.theta += Math.max(-maxRate * 0.7 / DEG, Math.min(maxRate * 0.7 / DEG, (dPitch / DEG - a.theta) * 1.3)) * dt;
    a.phi += (Math.atan(yr * a.v / G) / DEG - a.phi) * Math.min(1, 4 * dt);
    a.v += ((vWant === null ? a.vc : vWant) - a.v) * 0.3 * dt;
    const fw = fwdOf(a); a.e += fw[0] * a.v * dt; a.n += fw[1] * a.v * dt; a.h += fw[2] * a.v * dt; a.vel = fw.map(x => x * a.v);
    if (a.hp < 60 && Math.random() < 0.4) { a.smoke.push([a.e, a.n, a.h]); if (a.smoke.length > 30) a.smoke.shift(); }
  }
  const pf = fwdOf(P);
  if (!B) {   // player gun
    const rng = F.ww ? 800 : 1200;
    if (keys.gun) {
      F.gunT += dt;
      if (F.gunT > 0.06) { F.gunT = 0; F.tracers.push({ a: [P.e, P.n, P.h], b: [P.e + pf[0] * rng, P.n + pf[1] * rng, P.h + pf[2] * rng], t, mine: true }); }
      for (const e of enemiesOf(P)) { const to = [e.e - P.e, e.n - P.n, e.h - P.h], d = Math.hypot(...to); if (d > rng) continue;
        const off = Math.acos(Math.max(-1, Math.min(1, (pf[0] * to[0] + pf[1] * to[1] + pf[2] * to[2]) / d))) / DEG;
        if (off < 3 + 30 / d) { e.hp -= 55 * dt; if (e.hp <= 0 && e.alive) kill(e, P); } }
    }
  } else {
    // bombs: Space drops a stick
    F.dropCool -= dt;
    if (keys.gun && F.stickQ === 0 && F.dropCool <= 0) {
      if (F.bombsLeft > 0) { F.stickQ = Math.min(B.stick, F.bombsLeft); F.dropCool = 0.9; F.stickT = 0; }
      else if (F.dropCool < -2) { note('Bomb bay empty!', 2); F.dropCool = 0; }
    }
    if (F.stickQ > 0) { F.stickT -= dt; if (F.stickT <= 0) { F.stickT = 0.15; F.stickQ--; F.bombsLeft--; F.bombsUsed++; F.bombs.push({ p: [P.e, P.n, P.h - 2], v: P.vel.slice(), alive: true, guided: B.guided }); } }
    for (const b of F.bombs) {
      if (!b.alive) continue;
      if (b.guided) { const ip = impactOf(b.p, b.v), tg = F.tgts.filter(x => x.alive).map(x => [x, Math.hypot(x.e - ip[0], x.n - ip[1])]).sort((x, y) => x[1] - y[1])[0];
        if (tg && tg[1] < 320 && ip[2] > 0.5) { for (const [i, c] of [[0, tg[0].e], [1, tg[0].n]]) b.v[i] += Math.max(-14, Math.min(14, 2 * (c - ip[i]) / (ip[2] * ip[2]))) * dt; } }
      b.v[2] -= G * dt; for (let i = 0; i < 3; i++) b.p[i] += b.v[i] * dt;
      const gz = groundAt(world, b.p[0], b.p[1]);
      if (b.p[2] <= gz) {
        b.alive = false; const wet = hasWater(b.p[0], b.p[1]);
        F.booms.push({ p: [b.p[0], b.p[1], gz + 4], t, big: true, splash: wet });
        for (const tg of F.tgts) if (tg.alive && hitsTarget(tg, b.p, B.blast)) {
          tg.hp -= 100;
          if (tg.hp <= 0) { tg.alive = false; const left = F.tgts.filter(x => x.alive).length; note(`${tg.len ? 'DIRECT HIT! ' : ''}${tg.name} destroyed! ${left ? left + ' to go.' : ''}`, 4); }
          else note(`Hit on the ${tg.name.toLowerCase()}! One more to finish it.`, 3);
        }
      }
    }
    F.bombs = F.bombs.filter(b => b.alive);
    // defensive gunners
    if (B.guns) {
      const gc = B.guns, cands = enemiesOf(P).map(e => [e, Math.hypot(e.e - P.e, e.n - P.n, e.h - P.h)])
        .filter(([e, d]) => d < gc.range && (!gc.tail || ((e.e - P.e) * pf[0] + (e.n - P.n) * pf[1] + (e.h - P.h) * pf[2]) / d < -0.3)).sort((x, y) => x[1] - y[1]).slice(0, gc.n);
      F.gunT2 += dt; const shot = F.gunT2 > 0.09; if (shot) F.gunT2 = 0;
      for (const [e, d] of cands) {
        if (Math.random() < 0.5) { e.hp -= gc.dps * dt * 2 * (1 - 0.5 * d / gc.range); if (e.hp <= 0 && e.alive) kill(e, P, 'gunner'); }
        if (shot) F.tracers.push({ a: [P.e, P.n, P.h], b: [e.e + gauss() * 15, e.n + gauss() * 15, e.h + gauss() * 10], t, mine: true });
      }
    }
    // flak over the target
    const flakOn = F.tgts.some(x => x.alive) && Math.hypot(P.e - F.zone[0], P.n - F.zone[1]) < 4500;
    if (flakOn) { F.flakT -= dt; if (F.flakT <= 0) { F.flakT = 0.3 + Math.random() * 0.4; const sg = (B.stealth ? 300 : 95) + P.h * 0.02;
      const p = [P.e + P.vel[0] * 0.4 + gauss() * sg, P.n + P.vel[1] * 0.4 + gauss() * sg, P.h + gauss() * sg * 0.6]; F.puffs.push({ p, t });
      if (Math.hypot(p[0] - P.e, p[1] - P.n, p[2] - P.h) < 50) { P.hp -= 15; note('Flak hit! Get through the target area quickly.', 2); if (P.hp <= 0 && P.alive) kill(P, { name: "anti-aircraft flak" }); } } }
    F.puffs = F.puffs.filter(q => t - q.t < 3.5);
    // bomb sight
    F.ip = impactOf([P.e, P.n, P.h], P.vel);
    const live = F.tgts.filter(x => x.alive), aim = live.map(x => [x, Math.hypot(x.e - F.ip[0], x.n - F.ip[1])]).sort((x, y) => x[1] - y[1])[0];
    F.aim = aim ? aim[0] : null; F.onTarget = !!(F.aim && hitsTarget(F.aim, F.ip, B.blast));
    if (F.aim) {
      const ta = F.aim, fx = Math.sin(P.psi), fy = Math.cos(P.psi), along = (ta.e - F.ip[0]) * fx + (ta.n - F.ip[1]) * fy;
      const brg = wrap(Math.atan2(ta.e - P.e, ta.n - P.n) - P.psi) / DEG, dd = Math.hypot(ta.e - P.e, ta.n - P.n), agl = P.h - groundAt(world, P.e, P.n);
      if (B.ships && agl < 700 && flight.theta < -15) F.bombTip = 'PULL UP! Nose up now!';
      else if (F.onTarget) F.bombTip = 'ON TARGET: press Space to drop!';
      else if (Math.abs(brg) > 25 || along < -150) F.bombTip = `${ta.name}: turn ${brg > 0 ? 'right' : 'left'} ${Math.round(Math.abs(brg))}°, ${(dd / 1000).toFixed(1)} km away.`;
      else if (B.ships && dd < 3200 && flight.theta > -30) F.bombTip = `${ta.name} below! Airbrake (B) out, push the nose down into a steep dive and put the sight on the ship.`;
      else F.bombTip = `${ta.name} ahead: ${Math.round(Math.abs(brg))}° ${brg > 0 ? 'right' : 'left'}. Bombs away when it reaches the sight circle (${(Math.max(0, along) / 1000).toFixed(1)} km).`;
    } else F.bombTip = '';
  }
  // target selection and lock
  const es = enemiesOf(P);
  if (!F.target || !F.target.alive) F.target = es.map(e => [e, offAngle(P, e)]).sort((x, y) => x[1] - y[1])[0]?.[0] || null;
  if (F.target) { const d = Math.hypot(F.target.e - P.e, F.target.n - P.n, F.target.h - P.h), off = offAngle(P, F.target);
    if (d < 9000 && off < 30) F.lockT = Math.min(1.5, F.lockT + dt); else F.lockT = Math.max(0, F.lockT - dt * 2); }
  // missiles
  for (const m of F.missiles) {
    if (!m.alive) continue; m.life -= dt; if (m.life <= 0) { m.alive = false; continue; }
    const g = m.target;
    if (g && g.alive) {
      if (g.lastFlare !== undefined && t - g.lastFlare < 1.2 && !m.flareChecked && Math.hypot(g.e - m.p[0], g.n - m.p[1]) < 2500) { m.flareChecked = true; if (Math.random() < 0.65) { m.target = null; if (g.player) note('Flares worked! The missile went for a flare.', 3); } }
    }
    const tg = m.target;
    if (tg && tg.alive) {
      const tv = tg.vel || [0, 0, 0], d = Math.hypot(tg.e - m.p[0], tg.n - m.p[1], tg.h - m.p[2]), tgo = d / m.speed;
      const want = [tg.e + tv[0] * tgo - m.p[0], tg.n + tv[1] * tgo - m.p[1], tg.h + tv[2] * tgo - m.p[2]], wm = Math.hypot(...want) || 1;
      const cur = m.v.map(x => x / m.speed), des = want.map(x => x / wm), maxT = (m.team === 'red' ? 18 : 28) * G / m.speed * dt;
      const ang = Math.acos(Math.max(-1, Math.min(1, cur[0] * des[0] + cur[1] * des[1] + cur[2] * des[2]))), k = ang > maxT ? maxT / ang : 1;
      const nv = cur.map((c, i) => c + (des[i] - c) * k), nm = Math.hypot(...nv); m.v = nv.map(x => x / nm * m.speed);
      if (d < 28) { m.alive = false; tg.hp -= 100; fight.booms.push({ p: [tg.e, tg.n, tg.h], t, small: true }); if (tg.hp <= 0 && tg.alive) kill(tg, m.owner); }
    }
    for (let i = 0; i < 3; i++) m.p[i] += m.v[i] * dt;
    m.trail.push(m.p.slice()); if (m.trail.length > 30) m.trail.shift();
  }
  F.missiles = F.missiles.filter(m => m.alive || m.trail.length && t - (m.dead || (m.dead = t)) < 2);
  for (const fl of F.flares) { fl.v[2] -= 9.8 * dt * 0.3; for (let i = 0; i < 3; i++) fl.p[i] += fl.v[i] * dt; }
  F.flares = F.flares.filter(fl => t - fl.t < 4); F.tracers = F.tracers.filter(tr => t - tr.t < 0.25); F.booms = F.booms.filter(b => t - b.t < (b.big ? 5 : 3));
  for (const c of F.chutes) c.p[2] = Math.max(0, c.p[2] - 6 * dt);
  F.warn = F.missiles.some(m => m.alive && m.target === P && Math.hypot(m.p[0] - P.e, m.p[1] - P.n, m.p[2] - P.h) < 6000);
  $('missile').hidden = !F.warn;
  const blue = A.filter(a => a.team === 'blue' && a.alive).length, redN = A.filter(a => a.team === 'red' && a.alive).length, hpTxt = `you ${Math.max(0, Math.round(P.hp / F.hp0 * 100))}%`;
  if (B) {
    const left = F.tgts.filter(x => x.alive).length;
    $('h-stunt').textContent = `${left} of ${F.tgts.length} left · ${F.bombsLeft} bombs · ${hpTxt}`;
    if (!left && !flight.result) flight.result = { kind: 'victory', why: `All ${F.tgts.length} targets destroyed using ${F.bombsUsed} bomb${F.bombsUsed > 1 ? 's' : ''}!${F.kills ? ` Your gunners shot down ${F.kills} fighter${F.kills > 1 ? 's' : ''}.` : ''} ${redN ? 'Head for home!' : 'No enemy fighters left in the sky.'}` };
    else if (!F.bombsLeft && !F.stickQ && !F.bombs.length && left && !flight.result) flight.result = { kind: 'nobombs', why: `Out of bombs with ${left} target${left > 1 ? 's' : ''} still standing. Next time line the target up in the bomb sight circle before you drop.` };
  } else {
    $('h-stunt').textContent = F.kind === 'jets' ? `${blue} v ${redN} · M${F.missilesLeft} F${F.flaresLeft}` : `${blue} v ${redN} · ${hpTxt}`;
    if (!redN && !flight.result) { const nR = A.filter(a => a.team === 'red').length;
      flight.result = { kind: 'victory', why: F.kind === 'jets' ? `${nR === 1 ? 'The Red Hawk is' : `All ${nR} Red Hawks are`} knocked out! You got ${F.kills} yourself. Every enemy pilot ejected safely.` : `${nR === 1 ? 'The enemy fighter is' : `All ${nR} enemy fighters are`} down! You got ${F.kills} yourself. Every pilot bailed out with a parachute.` }; }
  }
}
