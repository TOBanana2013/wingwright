// =================== Situation, Fight and Stunt modes ===================
const SITS = {
  normal: { title: 'Normal flight', map: 'Green Valley', plane: 'atr72', icon: '✈', text: 'A regular trip: take off, climb, cruise and land at Lowmoor Regional.' },
  ocean: { title: 'Engine failure over the ocean', map: 'Open Atlantic', plane: 'c172', icon: '🌊', text: 'Your engine stops over the sea. Glide down and land gently on the water near the rescue boat, or bail out (P) while you are still high.' },
  himalaya: { title: 'Through the Himalayas', map: 'Himalaya', plane: 'a320', icon: '⛰', text: 'Fly up a narrow valley between giant snowy peaks to a runway 2,300 m up. The air is thin, so you land faster.' },
  storm: { title: 'Storm landing', map: 'Storm Island', plane: 'b747', icon: '⛈', text: 'Heavy turbulence, rain and fog. Bring a jumbo jet down onto a small island runway.' },
  carrier: { title: 'Aircraft carrier landing', map: 'Carrier group', plane: 'f35', icon: '⚓', text: 'Land on a 250 m deck at sea. No flare: fly the green line into the deck and the wire stops you.' }
};
let sitId = 'normal', fightJet = 'f35', fightSize = 1;
function buildModePanel() {
  const p = $('modepanel'); p.hidden = !['situation', 'fight', 'stunt'].includes(gameMode);
  if (p.hidden) return;
  if (gameMode === 'situation') {
    const done = stats.sits || {};
    p.innerHTML = '<div class="sitlist">' + Object.entries(SITS).map(([k, s]) => `<button class="pc sit" data-s="${k}" aria-pressed="${k === sitId}"><b>${s.icon} ${s.title}${done[k] ? ' <i class="tag ok">Done</i>' : ''}</b><span class="n">${REAL[s.plane].name.replace('Lockheed Martin ', '')}<br>${s.map}</span><span class="r">${s.text}</span></button>`).join('') + '</div>';
    p.querySelectorAll('.sit').forEach(b => b.addEventListener('click', () => { sitId = b.dataset.s; buildModePanel(); }));
  } else if (gameMode === 'fight') {
    p.innerHTML = `<div class="seg"><span class="label">Your jet</span><div class="opts two">
      <input type="radio" name="fj" id="fj-f35" value="f35" ${fightJet === 'f35' ? 'checked' : ''}><label class="o" for="fj-f35">F-35A Lightning II</label>
      <input type="radio" name="fj" id="fj-f22" value="f22" ${fightJet === 'f22' ? 'checked' : ''}><label class="o" for="fj-f22">F-22A Raptor</label></div></div>
      <div class="seg"><span class="label">Battle</span><div class="opts">
      ${[1, 2, 8].map(n => `<input type="radio" name="fs" id="fs-${n}" value="${n}" ${fightSize === n ? 'checked' : ''}><label class="o" for="fs-${n}">${n} v ${n}</label>`).join('')}</div>
      <span class="hint">Enemy “Red Hawk” jets are made up for the game. Hit planes trail smoke and the pilot ejects with a parachute. Keys: Space gun · F missile · T next target · G flares.</span></div>`;
    p.querySelectorAll('input[name=fj]').forEach(i => i.addEventListener('change', () => { fightJet = i.value; }));
    p.querySelectorAll('input[name=fs]').forEach(i => i.addEventListener('change', () => { fightSize = +i.value; }));
  } else {
    p.innerHTML = '<ol class="routine">' + STUNTS.filter(s => s.type !== 'rejoin').map(s => `<li><b>${s.name}</b> <span>${s.group ? 'group' : 'solo'}</span></li>`).join('') + '</ol><p class="hint">You fly the Extra 330SC on the leader’s left wing in a four-plane display team. Each stunt is scored; rejoin the green ring between stunts.</p>';
  }
}
function usePlane(key) { mode = 'real'; realKey = key; $('tab-custom').setAttribute('aria-selected', 'false'); $('tab-real').setAttribute('aria-selected', 'true'); $('custom').hidden = true; $('realpanel').hidden = false; document.querySelectorAll('.pc[data-k]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === key ? 'true' : 'false')); refresh(); }
function airborne(f, st) {
  Object.assign(f, { e: st.e, n: st.n, h: st.h, psi: st.psi, vx: st.v, vy: 0, theta: 2, phi: 0, ground: false, flew: true, x: 1e5, flaps: 0, flapSet: 2, autoDone: true, pilotFlap: true });
  setThrottle(Math.round((st.thr || 0.6) * 100));
}
const hasWater = (e, n) => world && world.water && world.water(e, n);

// ---------- other aircraft (enemies, wingmen, display team) ----------
let others = [];
function drawOthers(ctx, cam, F) {
  for (const o of others) {
    if (!o.alive && !o.falling) continue;
    const d = Math.hypot(o.e - cam.eye[0], o.n - cam.eye[1], o.h - cam.eye[2]);
    if (d > 4500) continue;
    const xf = attitudeXf([o.e, o.n, o.h], o.psi, o.theta * DEG, o.phi * DEG);
    if (o.smoke && o.smoke.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < o.smoke.length; i++) { const a = cam.proj(...o.smoke[i - 1]), c = cam.proj(...o.smoke[i]); if (!a || !c) continue;
        ctx.strokeStyle = o.alive ? 'rgba(255,255,255,.55)' : 'rgba(60,60,60,.6)'; ctx.lineWidth = Math.max(1, Math.min(30, 2 * F / c[2])); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
    }
    drawModel(ctx, modelForKey(o.key, false), xf, cam, { propStill: false });
  }
}

// ---------- FIGHT ----------
let fight = null;
function startFight() {
  const n = fightSize, agents = [];
  const mk = (team, i, key) => { const side = team === 'blue' ? 1 : -1, row = Math.floor(i / 2), col = i % 2 ? 1 : -1;
    return { team, key, e: (i ? col * (180 + row * 160) : 0), n: team === 'blue' ? -row * 220 : 16000 + row * 220, h: 3000 + (i % 3) * 120,
      psi: team === 'blue' ? 0 : Math.PI, theta: 0, phi: 0, v: 240, hp: 100, alive: true, missiles: team === 'blue' ? 4 : 3, flares: 6, cool: 4 + Math.random() * 4, lastFlare: -9, wob: Math.random() * 10, smoke: [], name: team === 'blue' ? (i ? 'Wingman ' + i : 'You') : 'Red ' + (i + 1) }; };
  for (let i = 0; i < n; i++) agents.push(mk('blue', i, i ? (i % 2 ? 'f22' : 'f35') : fightJet));
  for (let i = 0; i < n; i++) agents.push(mk('red', i, 'redhawk'));
  agents[0].player = true;
  fight = { agents, missiles: [], flares: [], booms: [], chutes: [], tracers: [], lockT: 0, lock: null, target: null, missilesLeft: 6, flaresLeft: 12, kills: 0, warn: false, gunT: 0 };
  others = agents.filter(a => !a.player);
  airborne(flight, { e: 0, n: 0, h: 3000, psi: 0, v: 240, thr: 0.8 });
}
function fwdOf(a) { return [Math.sin(a.psi) * Math.cos(a.theta * DEG), Math.cos(a.psi) * Math.cos(a.theta * DEG), Math.sin(a.theta * DEG)]; }
function syncPlayerAgent() {
  const p = fight.agents[0], f = flight, v = Math.hypot(f.vx, f.vy);
  Object.assign(p, { e: f.e, n: f.n, h: f.h + gearH(plane) + plane.height / 2, psi: f.psi, theta: f.theta, phi: f.phi, v });
  p.vel = [Math.sin(f.psi) * f.vx, Math.cos(f.psi) * f.vx, f.vy];
}
function kill(a, by) {
  a.alive = false; a.falling = true; a.hp = 0;
  fight.booms.push({ p: [a.e, a.n, a.h], t: flight.t });
  fight.chutes.push({ p: [a.e, a.n, a.h + 20], t: flight.t, team: a.team });
  if (by && by.player) { fight.kills++; note(`SPLASH! You knocked out ${a.name}. The pilot ejected safely.`, 4); }
  if (a.player) flight.result = { kind: 'shotdown', why: `You were hit by ${by ? by.name : 'the enemy'}. You ejected and your parachute opened safely. Enemies knocked out: ${fight.kills}.` };
}
function fightUpdate(dt) {
  const F = fight, A = F.agents, t = flight.t; syncPlayerAgent();
  const enemiesOf = a => A.filter(b => b.alive && b.team !== a.team);
  for (const a of A) {
    if (a.player) continue;
    if (!a.alive) { if (a.falling) { a.theta = Math.max(-70, a.theta - 25 * dt); a.phi += 120 * dt; const fw = fwdOf(a); a.e += fw[0] * a.v * dt; a.n += fw[1] * a.v * dt; a.h += fw[2] * a.v * dt; if (Math.random() < 0.5) { a.smoke.push([a.e, a.n, a.h]); if (a.smoke.length > 40) a.smoke.shift(); } if (a.h < 0) a.falling = false; } continue; }
    if (!a.tgt || !a.tgt.alive) { const es = enemiesOf(a); a.tgt = es.sort((x, y) => Math.hypot(x.e - a.e, x.n - a.n) - Math.hypot(y.e - a.e, y.n - a.n))[0] || null; }
    const red = a.team === 'red', gmax = red ? 5.5 : 6.5, maxRate = gmax * G / Math.max(120, a.v);
    let dYaw = a.psi, dPitch = 0;
    const threat = F.missiles.find(m => m.target === a && m.alive && Math.hypot(m.p[0] - a.e, m.p[1] - a.n, m.p[2] - a.h) < 3500);
    if (threat) {
      dYaw = Math.atan2(threat.p[0] - a.e, threat.p[1] - a.n) + (a.wob % 2 > 1 ? 1 : -1) * Math.PI / 2; dPitch = -0.15;
      if (a.flares > 0 && t - a.lastFlare > 1.2) { a.flares--; a.lastFlare = t; F.flares.push({ p: [a.e, a.n, a.h], v: [0, 0, -20], t }); }
    } else if (a.tgt) {
      const g = a.tgt, d = Math.hypot(g.e - a.e, g.n - a.n, g.h - a.h), lead = Math.min(2, d / 700), gv = g.vel || fwdOf(g).map(x => x * g.v);
      const pe = g.e + gv[0] * lead, pn = g.n + gv[1] * lead, ph = g.h + gv[2] * lead;
      dYaw = Math.atan2(pe - a.e, pn - a.n) + (red ? Math.sin(t * 0.7 + a.wob) * 0.12 : 0);
      dPitch = Math.max(-0.5, Math.min(0.5, Math.atan2(ph - a.h, Math.hypot(pe - a.e, pn - a.n))));
      // weapons
      const fw = fwdOf(a), to = [g.e - a.e, g.n - a.n, g.h - a.h], off = Math.acos(Math.max(-1, Math.min(1, (fw[0] * to[0] + fw[1] * to[1] + fw[2] * to[2]) / (d || 1)))) / DEG;
      a.cool -= dt;
      if (a.missiles > 0 && a.cool <= 0 && d > 1200 && d < 7000 && off < 20) { a.missiles--; a.cool = red ? 11 + Math.random() * 6 : 7; launch(a, g); }
      if (d < 900 && off < 4) { const dmg = (red ? 14 : 26) * dt * (Math.random() < 0.7 ? 1 : 0); g.hp -= dmg; F.tracers.push({ a: [a.e, a.n, a.h], b: [g.e, g.n, g.h], t }); if (g.hp <= 0 && g.alive) kill(g, a); }
    }
    if (a.h < 700) dPitch = Math.max(dPitch, 0.25);
    if (a.h > 9000) dPitch = Math.min(dPitch, -0.05);
    const yr = Math.max(-maxRate, Math.min(maxRate, wrap(dYaw - a.psi) * 1.6));
    a.psi = wrap(a.psi + yr * dt);
    a.theta += Math.max(-maxRate * 0.7 / DEG, Math.min(maxRate * 0.7 / DEG, (dPitch / DEG - a.theta) * 1.3)) * dt;
    a.phi += (Math.atan(yr * a.v / G) / DEG - a.phi) * Math.min(1, 4 * dt);
    a.v += ((a.tgt && Math.hypot(a.tgt.e - a.e, a.tgt.n - a.n) > 4000 ? 290 : 235) - a.v) * 0.3 * dt;
    const fw = fwdOf(a); a.e += fw[0] * a.v * dt; a.n += fw[1] * a.v * dt; a.h += fw[2] * a.v * dt; a.vel = fw.map(x => x * a.v);
    if (a.hp < 60 && Math.random() < 0.4) { a.smoke.push([a.e, a.n, a.h]); if (a.smoke.length > 30) a.smoke.shift(); }
  }
  // player weapons
  const P = A[0], pf = fwdOf(P);
  if (keys.gun) {
    F.gunT += dt;
    if (F.gunT > 0.06) { F.gunT = 0; F.tracers.push({ a: [P.e, P.n, P.h], b: [P.e + pf[0] * 1100, P.n + pf[1] * 1100, P.h + pf[2] * 1100], t, mine: true }); }
    for (const e of enemiesOf(P)) { const to = [e.e - P.e, e.n - P.n, e.h - P.h], d = Math.hypot(...to); if (d > 1200) continue;
      const off = Math.acos(Math.max(-1, Math.min(1, (pf[0] * to[0] + pf[1] * to[1] + pf[2] * to[2]) / d))) / DEG;
      if (off < 3 + 30 / d) { e.hp -= 55 * dt; if (e.hp <= 0 && e.alive) kill(e, P); } }
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
      const cur = m.v.map(x => x / m.speed), des = want.map(x => x / wm), maxT = 28 * G / m.speed * dt;
      const ang = Math.acos(Math.max(-1, Math.min(1, cur[0] * des[0] + cur[1] * des[1] + cur[2] * des[2]))), k = ang > maxT ? maxT / ang : 1;
      const nv = cur.map((c, i) => c + (des[i] - c) * k), nm = Math.hypot(...nv); m.v = nv.map(x => x / nm * m.speed);
      if (d < 28) { m.alive = false; tg.hp -= 100; fight.booms.push({ p: [tg.e, tg.n, tg.h], t, small: true }); if (tg.hp <= 0 && tg.alive) kill(tg, m.owner); }
    }
    for (let i = 0; i < 3; i++) m.p[i] += m.v[i] * dt;
    m.trail.push(m.p.slice()); if (m.trail.length > 30) m.trail.shift();
  }
  F.missiles = F.missiles.filter(m => m.alive || m.trail.length && t - (m.dead || (m.dead = t)) < 2);
  for (const fl of F.flares) { fl.v[2] -= 9.8 * dt * 0.3; for (let i = 0; i < 3; i++) fl.p[i] += fl.v[i] * dt; }
  F.flares = F.flares.filter(fl => t - fl.t < 4); F.tracers = F.tracers.filter(tr => t - tr.t < 0.25); F.booms = F.booms.filter(b => t - b.t < 3);
  for (const c of F.chutes) c.p[2] = Math.max(0, c.p[2] - 6 * dt);
  F.warn = F.missiles.some(m => m.alive && m.target === P && Math.hypot(m.p[0] - P.e, m.p[1] - P.n, m.p[2] - P.h) < 6000);
  $('missile').hidden = !F.warn;
  const blue = A.filter(a => a.team === 'blue' && a.alive).length, redN = A.filter(a => a.team === 'red' && a.alive).length;
  $('h-stunt').textContent = `Blue ${blue} · Red ${redN} · M${F.missilesLeft} · Fl${F.flaresLeft}`;
  if (!redN && !flight.result) flight.result = { kind: 'victory', why: `All ${A.filter(a => a.team === 'red').length} Red Hawks knocked out! You got ${F.kills} yourself. Every enemy pilot ejected safely.` };
}
function offAngle(P, e) { const pf = fwdOf(P), to = [e.e - P.e, e.n - P.n, e.h - P.h], d = Math.hypot(...to) || 1; return Math.acos(Math.max(-1, Math.min(1, (pf[0] * to[0] + pf[1] * to[1] + pf[2] * to[2]) / d))) / DEG; }
function launch(owner, target) {
  const fw = fwdOf(owner), sp = 430;
  fight.missiles.push({ p: [owner.e + fw[0] * 20, owner.n + fw[1] * 20, owner.h - 3], v: fw.map(x => x * sp), speed: sp, target, owner, team: owner.team, life: 14, alive: true, trail: [] });
}
function fireMissile() {
  const F = fight; if (!F) return;
  if (!F.target || F.lockT < 1.2) { note('No lock yet: keep the red box in front of you until it says LOCK.', 2.5); return; }
  if (F.missilesLeft <= 0) { note('Out of missiles: use the gun (Space).', 2.5); return; }
  F.missilesLeft--; launch(F.agents[0], F.target); note('Fox two! Missile away.', 2);
}
function dropFlares() { const F = fight; if (!F) return; if (F.flaresLeft <= 0) { note('No flares left!', 2); return; } F.flaresLeft--; const P = F.agents[0]; P.lastFlare = flight.t; for (let i = 0; i < 4; i++) F.flares.push({ p: [P.e, P.n, P.h], v: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, -10], t: flight.t }); }
function nextTarget() { const F = fight; if (!F) return; const es = F.agents.filter(a => a.alive && a.team === 'red'); if (!es.length) return; const i = es.indexOf(F.target); F.target = es[(i + 1) % es.length]; F.lockT = 0; }
function drawFightFX(ctx, cam, F2) {
  const F = fight, t = flight.t;
  for (const tr of F.tracers) { const a = cam.proj(...tr.a), b = cam.proj(...tr.b); if (!a || !b) continue; ctx.strokeStyle = tr.mine ? 'rgba(255,220,120,.9)' : 'rgba(255,120,90,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  for (const m of F.missiles) {
    ctx.strokeStyle = 'rgba(240,240,240,.7)'; ctx.lineCap = 'round';
    for (let i = 1; i < m.trail.length; i++) { const a = cam.proj(...m.trail[i - 1]), b = cam.proj(...m.trail[i]); if (!a || !b) continue; ctx.lineWidth = Math.max(1, Math.min(12, 2.5 * F2 / b[2])); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    if (m.alive) { const q = cam.proj(...m.p); if (q) { ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(2, Math.min(6, 4 * F2 / q[2])), 0, Math.PI * 2); ctx.fill(); } }
  }
  for (const fl of F.flares) { const q = cam.proj(...fl.p); if (!q) continue; ctx.fillStyle = `rgba(255,${180 + Math.random() * 60 | 0},80,${1 - (t - fl.t) / 4})`; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(2, 6 * F2 / q[2]), 0, Math.PI * 2); ctx.fill(); }
  for (const b of F.booms) { const q = cam.proj(...b.p); if (!q) continue; const age = (t - b.t) / 3, r = (b.small ? 15 : 35) * (0.4 + age * 1.5) * F2 / q[2];
    ctx.fillStyle = `rgba(255,${140 - age * 80 | 0},40,${0.85 * (1 - age)})`; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(3, r), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(80,80,80,${0.5 * (1 - age)})`; ctx.beginPath(); ctx.arc(q[0], q[1] - r * 0.6, Math.max(3, r * 0.8), 0, Math.PI * 2); ctx.fill(); }
  for (const c of F.chutes) { const q = cam.proj(...c.p); if (!q || q[2] > 6000) continue; const r = Math.max(3, 4 * F2 / q[2]); ctx.fillStyle = c.team === 'blue' ? '#e8eef5' : '#f3d3cf'; ctx.beginPath(); ctx.arc(q[0], q[1] - r, r, Math.PI, 0); ctx.fill(); ctx.strokeStyle = 'rgba(40,40,40,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q[0] - r, q[1] - r); ctx.lineTo(q[0], q[1] + r); ctx.lineTo(q[0] + r, q[1] - r); ctx.stroke(); }
}
function drawMarkers(ctx, cam, w, h) {
  // markers on every other aircraft; red brackets and lock on the current target
  const list = world.mode === 'fight' ? fight.agents.filter(a => !a.player && a.alive) : others;
  ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'center';
  for (const a of list) {
    const q = cam.proj(a.e, a.n, a.h), red = a.team === 'red', isT = world.mode === 'fight' && a === fight.target;
    if (!q) continue;
    const d = q[2], s = isT ? 16 : 9;
    ctx.strokeStyle = red ? '#ff5a4a' : '#5ab0ff'; ctx.lineWidth = isT ? 2 : 1.5;
    if (red) ctx.strokeRect(q[0] - s, q[1] - s, s * 2, s * 2); else { ctx.beginPath(); ctx.moveTo(q[0], q[1] - s); ctx.lineTo(q[0] + s, q[1]); ctx.lineTo(q[0], q[1] + s); ctx.lineTo(q[0] - s, q[1]); ctx.closePath(); ctx.stroke(); }
    ctx.fillStyle = red ? '#ffb3a8' : '#bfe0ff'; ctx.fillText((d / 1000).toFixed(1) + ' km', q[0], q[1] + s + 13);
    if (isT) { const lk = fight.lockT >= 1.2; ctx.strokeStyle = lk ? '#ff2d2d' : 'rgba(255,90,74,.7)'; ctx.beginPath(); ctx.arc(q[0], q[1], s + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fight.lockT / 1.2)); ctx.stroke(); if (lk) { ctx.fillStyle = '#ff2d2d'; ctx.fillText('LOCK', q[0], q[1] - s - 8); } }
  }
}

// ---------- STUNT TEAM ----------
const STUNTS = [
  { name: 'Formation flying', type: 'form', dur: 22, pass: 0.5, group: true, msg: 'Hold your slot on the leader’s left wing: fly into the green ring and stay there.' },
  { name: 'Solo loop', type: 'loops', count: 1, dur: 35, msg: 'Your solo! Pull a full loop: hold Nose up until you come back level.' },
  { name: 'Rejoin', type: 'rejoin', dur: 35, msg: 'Rejoin the team: fly back into the green ring.' },
  { name: 'Group loop', type: 'formLoop', dur: 17, pass: 0.35, group: true, msg: 'Group loop! The leader pulls up: stay in your ring all the way round.' },
  { name: 'Solo double roll', type: 'rolls', count: 2, dur: 22, msg: 'Solo double roll: hold Left or Right for two full rolls.' },
  { name: 'Rejoin', type: 'rejoin', dur: 35, msg: 'Rejoin the team: fly back into the green ring.' },
  { name: 'Bomb-burst break', type: 'break', dur: 22, group: true, msg: 'BREAK! The team splits. Turn hard left until you face the other way (180°).' },
  { name: 'Inverted pass', type: 'inverted', secs: 5, dur: 28, msg: 'Inverted pass: roll upside down and hold it for 5 seconds. Push a little to keep your height.' },
  { name: 'Rejoin', type: 'rejoin', dur: 45, msg: 'Rejoin the team: the green ring is on the map. Catch up!' },
  { name: 'Solo corkscrew', type: 'corks', count: 1, dur: 25, msg: 'Solo corkscrew: pull the nose up and roll at the same time.' },
  { name: 'Rejoin', type: 'rejoin', dur: 35, msg: 'Rejoin the team: fly back into the green ring.' },
  { name: 'Final flypast', type: 'form', dur: 16, pass: 0.5, group: true, msg: 'Final formation flypast: hold your slot for the crowd!' }
];
const SLOTS = { lead: [0, 0, 0], right: [-12, 15, 0], left: [-12, -15, 0], trail: [-24, 0, -3] };
let team = null;
function startStunt() {
  const L = { key: 'extra', e: 0, n: 0, h: 700, psi: 0, theta: 0, phi: 0, v: 62, alive: true, smoke: [], role: 'lead' };
  const mates = [L, { key: 'extra', alive: true, smoke: [], role: 'right' }, { key: 'extra', alive: true, smoke: [], role: 'trail' }];
  team = { L, mates, i: -1, t0: 0, score: 0, results: [], inT: 0, totT: 0, startPsi: 0, invT: 0, base: {} };
  others = mates; placeMates(1);
  const sl = slotPoint('left');
  airborne(flight, { e: sl[0], n: sl[1], h: sl[2] - gearH(plane) - plane.height / 2, psi: 0, v: 62, thr: 0.5 });
  nextStunt();
}
function slotPoint(role) { const L = team.L; return attitudeXf([L.e, L.n, L.h], L.psi, L.theta * DEG, L.phi * DEG)(SLOTS[role]); }
function placeMates(k) {
  for (const m of team.mates) { if (m.role === 'lead' || m.free) continue; const p = slotPoint(m.role);
    m.e = m.e === undefined ? p[0] : m.e + (p[0] - m.e) * k; m.n = m.n === undefined ? p[1] : m.n + (p[1] - m.n) * k; m.h = m.h === undefined ? p[2] : m.h + (p[2] - m.h) * k;
    m.psi = team.L.psi; m.theta = team.L.theta; m.phi = team.L.phi; }
}
function nextStunt() {
  const T = team; T.i++;
  if (T.i >= STUNTS.length) { const max = STUNTS.filter(s => s.type !== 'rejoin').length * 100, stars = T.score >= max * 0.8 ? 3 : T.score >= max * 0.5 ? 2 : T.score >= max * 0.2 ? 1 : 0;
    flight.result = { kind: 'stuntdone', why: `Display finished! Score ${T.score} of ${max} ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}. ${T.results.join(' · ')}` }; return; }
  const s = STUNTS[T.i], f = flight; T.t0 = f.t; T.inT = 0; T.totT = 0; T.invT = 0; T.startPsi = f.psi;
  T.base = { loops: f.loops || 0, rolls: (f.rolls || 0) + (f.corks || 0), corks: f.corks || 0 };
  for (const m of T.mates) m.free = false;
  if (s.type === 'break') T.mates.forEach((m, k) => { m.free = true; m.turn = [0, 1, -0.2][k] * 0.4; m.climb = [0.3, 0, 0.5][k]; });
  note(`${s.type === 'rejoin' ? '' : `Stunt ${STUNTS.slice(0, T.i + 1).filter(x => x.type !== 'rejoin').length}: `}${s.name}. ${s.msg}`, 6);
}
function stuntUpdate(dt) {
  const T = team, L = T.L, f = flight, s = STUNTS[T.i]; if (!s) return;
  const el = f.t - T.t0;
  // leader flying
  if (s.type === 'formLoop' && el > 2 && el < 16) L.theta += 360 / 13 * dt; else if (L.theta > 300 || (s.type !== 'formLoop' && Math.abs(L.theta) > 0.5)) L.theta = 0;
  if (L.theta >= 360) L.theta -= 360;
  const fw = [Math.sin(L.psi) * Math.cos(L.theta * DEG), Math.cos(L.psi) * Math.cos(L.theta * DEG), Math.sin(L.theta * DEG)];
  L.v = 62; L.e += fw[0] * L.v * dt; L.n += fw[1] * L.v * dt; L.h += fw[2] * L.v * dt; if (s.type !== 'formLoop') L.h += (700 - L.h) * 0.2 * dt;
  // a gentle racetrack so the show stays near the crowd
  if (s.type !== 'formLoop' && s.type !== 'break' && Math.hypot(L.e, L.n) > 6000) { L.psi = wrap(L.psi + 0.12 * dt); L.phi += (20 - L.phi) * dt; } else L.phi += (0 - L.phi) * Math.min(1, 2 * dt);
  placeMates(Math.min(1, 6 * dt));
  for (const m of T.mates) if (m.free) { m.psi = wrap(m.psi + m.turn * dt); m.phi += (m.turn * 120 - m.phi) * dt; m.theta += (m.climb * 30 - m.theta) * dt; const v = [Math.sin(m.psi) * Math.cos(m.theta * DEG), Math.cos(m.psi) * Math.cos(m.theta * DEG), Math.sin(m.theta * DEG)]; m.e += v[0] * 62 * dt; m.n += v[1] * 62 * dt; m.h += v[2] * 62 * dt; }
  for (const m of T.mates) { m.smoke.push([m.e, m.n, m.h]); if (m.smoke.length > 120) m.smoke.shift(); }
  // judge
  const me = [f.e, f.n, f.h + gearH(plane) + plane.height / 2], sl = slotPoint('left'), dSlot = Math.hypot(me[0] - sl[0], me[1] - sl[1], me[2] - sl[2]);
  T.dSlot = dSlot; T.totT += dt; if (dSlot < 30) T.inT += dt;
  if (Math.abs(f.phi) > 150) T.invT += dt;
  let done = false, ok = false;
  if (s.type === 'form' || s.type === 'formLoop') { if (el >= s.dur) { done = true; ok = T.inT / T.totT >= s.pass; T.lastPct = Math.round(T.inT / T.totT * 100); } }
  else if (s.type === 'rejoin') { if (dSlot < 30 && T.inT > 2.5) done = true, ok = true; else if (dSlot >= 30) T.inT = 0; if (el > s.dur) { done = true; ok = true; snapPlayerToSlot(); } }
  else if (s.type === 'loops') { if ((f.loops || 0) > T.base.loops) done = ok = true; }
  else if (s.type === 'rolls') { if ((f.rolls || 0) + (f.corks || 0) - T.base.rolls >= s.count) done = ok = true; }
  else if (s.type === 'corks') { if ((f.corks || 0) > T.base.corks) done = ok = true; }
  else if (s.type === 'inverted') { if (T.invT >= s.secs) done = ok = true; }
  else if (s.type === 'break') { if (Math.abs(wrap(f.psi - T.startPsi)) > 150 * DEG) done = ok = true; }
  if (!done && el >= s.dur) done = true;
  if (done) {
    if (s.type !== 'rejoin') { const pts = ok ? (s.type === 'form' || s.type === 'formLoop' ? 60 + Math.round(40 * Math.min(1, T.inT / T.totT / 0.9)) : 100) : 0; T.score += pts;
      T.results.push(`${s.name} ${ok ? '✓' : '✗'}`); note(ok ? `${s.name}: great! +${pts} points.${T.lastPct !== undefined && (s.type === 'form' || s.type === 'formLoop') ? ` In your slot ${T.lastPct}% of the time.` : ''}` : `${s.name}: missed it. On to the next one.`, 4); T.lastPct = undefined; }
    if (s.type === 'break') T.mates.forEach(m => { m.free = false; });
    setTimeout(() => {}, 0); nextStunt();
  }
  const s2 = STUNTS[T.i]; if (!s2) return;
  $('h-stunt').textContent = `${s2.name} · ${Math.max(0, Math.ceil(s2.dur - (f.t - T.t0)))} s · ${T.score} pts`;
}
function snapPlayerToSlot() {
  // a rejoin that ran out of time: the team circles back and picks you up
  const sl = slotPoint('left'), L = team.L;
  Object.assign(flight, { e: sl[0], n: sl[1], h: sl[2] - gearH(plane) - plane.height / 2, psi: L.psi, theta: 0, phi: 0, vx: 62, vy: 0 });
  note('The team circled back to pick you up. Stay in the green ring!', 4);
}
function drawSlotRing(ctx, cam, F) {
  const s = STUNTS[team.i]; if (!s) return;
  const p = slotPoint('left'), q = cam.proj(...p); if (!q) return;
  const r = Math.max(10, 12 * F / q[2]), inside = team.dSlot < 30;
  ctx.strokeStyle = inside ? '#3cff8a' : 'rgba(80,230,140,.85)'; ctx.lineWidth = inside ? 4 : 2.5; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#8ff0b4'; ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillText(inside ? 'IN SLOT' : Math.round(team.dSlot) + ' m', q[0], q[1] + r + 14);
}

// ---------- bail out ----------
function bailOut() {
  if (!flight || flight.result || !(world.mode === 'situation')) return;
  if (!flight.flew || flight.ground) { note('You are on the ground: just climb out!', 3); return; }
  if ((flight.agl || 0) < 120) { note('Too low to bail out safely (you need 120 m). Land on the water instead!', 4); return; }
  const water = hasWater(flight.e, flight.n);
  flight.result = water ? { kind: 'bailed', why: `You bailed out at ${Math.round(flight.agl)} m. Your parachute opened, you splashed into the sea in your life jacket and the rescue boat picked you up. The plane sank far from anyone.` }
    : { kind: 'crash', why: 'You bailed out over land: you are safe, but the plane crashed near houses. Bail out over the water next time.' };
}
