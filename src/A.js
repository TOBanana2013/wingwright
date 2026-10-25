let mini = null, chart = null, hmap = null, hist = [], histT = 0, G0 = null, trail = [], trailT = 0, D0 = 1;
let flight = null, world = null, worldSeed = 0, raf = 0, last = 0, keys = { up: 0, down: 0, left: 0, right: 0 }, view, cockpit = true, shake = 0;
const hash = (i, k) => { const r = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return r - Math.floor(r); };
function nearRunway(e, n, m) { return world.runways.some(w => { const [a, c] = rwLocal(w, e, n); return a > -m && a < w.len + m && Math.abs(c) < w.wid / 2 + m; }); }
const hdgTxt = r => String(Math.round(((r / DEG) % 360 + 360) % 360)).padStart(3, '0') + '°';

function sizeAll() { view = sizeCanvas($('view')); mini = sizeCanvas($('mini')); chart = sizeCanvas($('pathchart')); hmap = sizeCanvas($('hmap')); }
function startFlight(newMission) {
  if (newMission || !world) { worldSeed = (Math.random() * 1e9) | 0; }
  world = makeWorld(spec, worldSeed);
  const tg = world.target;
  $('hangar').hidden = true; $('flight').hidden = false; $('result').hidden = true;
  const bear = Math.atan2(tg.e, tg.n) / DEG;
  $('m-title').textContent = `Target: runway ${tg.num}, ${tg.name}`;
  $('m-sub').textContent = `${plane.real ? plane.name : 'Your design'} · ${(Math.hypot(tg.e, tg.n) / 1000).toFixed(1)} km away, off to your ${bear < 0 ? 'left' : 'right'} · runway points ${hdgTxt(tg.hdg)} · ${tg.len} m long · ${world.runways.filter(r => r.kind === 'fake').length} closed decoys`;
  flight = newFlight(spec, world); setThrottle(0); for (const k in keys) keys[k] = 0; syncToggles();
  G0 = guide(flight, spec); D0 = G0.dtg; trail = []; trailT = 0;
  $('tip').hidden = false; $('tip').textContent = `Push the throttle up (E). At ${kmh(spec.vLift)} km/h, hold Nose up to lift off.`;
  sizeAll(); hist = []; histT = 0;
  cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  $('flight').scrollIntoView({ block: 'start' });
}
function setThrottle(v) { v = Math.max(0, Math.min(100, v)); $('thr').value = v; $('o-thr').textContent = v + '%'; if (flight) flight.throttle = v / 100; }
$('thr').addEventListener('input', e => pilotThrottle(+e.target.value));
const FLAPNAME = { 1: 'DOWN', 2: 'FLAT', 3: 'UP' }, FLAPVAL = { 1: 1, 2: 0, 3: -0.5 };
function syncToggles() { if (!flight) return; for (const k of [1, 2, 3]) $('b-f' + k).setAttribute('aria-pressed', flight.flapSet === k ? 'true' : 'false'); $('b-brake').setAttribute('aria-pressed', flight.brake ? 'true' : 'false'); }
function note(text, secs) { if (flight) flight.note = { text, until: flight.t + (secs || 4) }; }
function canAuto() { return flight && flight.flew && !flight.ground && G0 && (G0.phase === 'climb' || G0.phase === 'cruise' || G0.phase === 'goaround'); }
function setFlaps(k, byPilot = true) {
  if (!flight) return;
  flight.flapSet = Math.max(1, Math.min(3, k)); flight.flaps = FLAPVAL[flight.flapSet];
  if (byPilot && flight.flew) flight.pilotFlap = true;
  if (flight.flapSet === 2 && canAuto()) { if (!flight.ap || !flight.at) note('Flaps 2: automatic cruise on. It will steer towards the runway too.'); flight.ap = flight.at = true; }
  else if (flight.ap || flight.at) { flight.ap = flight.at = false; note('Autopilot off: you have control.'); }
  syncToggles();
}
function pilotThrottle(v) { if (flight && flight.at) { flight.at = false; note('You have the throttle. Autopilot still steering.'); } setThrottle(v); }
function toggleBrake() { if (flight) { flight.brake = flight.brake ? 0 : 1; syncToggles(); } }
for (const k of [1, 2, 3]) $('b-f' + k).addEventListener('click', () => setFlaps(k)); $('b-brake').addEventListener('click', toggleBrake);
function toggleView() { cockpit = !cockpit; $('viewbtn').textContent = cockpit ? 'Outside view (V)' : 'Cockpit view (V)'; }
$('viewbtn').addEventListener('click', toggleView);

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (flight && !flight.result) {
    let pitch = keys.up - keys.down, roll = keys.right - keys.left;
    G0 = guide(flight, spec);
    // automatic cruise on flaps 2
    if (!flight.pilotFlap && !flight.autoDone && canAuto() && flight.h > 100) { flight.autoDone = true; setFlaps(2, false); }
    if ((flight.ap || flight.at) && !canAuto()) { flight.ap = flight.at = false; note(G0.phase === 'approach' ? 'Descent point: autopilot off. You have control for the landing.' : 'Autopilot off: you have control.', 6); }
    if (flight.ap && (pitch || roll)) { flight.ap = false; note('You have the steering. Press 2 to turn the autopilot back on.'); }
    if (flight.ap) {
      pitch = Math.max(-1, Math.min(1, (G0.want - G0.gamma) * 0.35));
      const bankCmd = Math.max(-spec.maxBank, Math.min(spec.maxBank, G0.turn * 1.5));
      roll = Math.max(-1, Math.min(1, (bankCmd - flight.phi) / 8));
    }
    if (flight.at) {
      const v0 = Math.hypot(flight.vx, flight.vy), vT = Math.max(spec.vStall * 1.35, Math.min(spec.vMax * 0.6, spec.vStall * 1.6));
      const th = Math.max(0, Math.min(1, flight.throttle + (vT - v0) * 0.02 * dt * 4));
      flight.throttle = th; $('thr').value = Math.round(th * 100); $('o-thr').textContent = Math.round(th * 100) + '%';
    }
    for (let i = 0; i < 4; i++) stepFlight(flight, spec, { pitch, roll }, dt / 4);
    const v = Math.hypot(flight.vx, flight.vy);
    G0 = guide(flight, spec);
    if (flight.flew) {
      const g = G0, tip = $('tip'); let msg = '';
      const turnTxt = Math.abs(g.turn) > 12 ? `Turn ${g.turn > 0 ? 'right (D or →)' : 'left (A or ←)'} about ${Math.round(Math.abs(g.turn))}°` : '';
      if (flight.note && flight.t < flight.note.until) msg = flight.note.text;
      else if (flight.ap && flight.at) msg = '';
      else if (g.phase === 'flare') msg = Math.abs(flight.phi) > 6 ? 'Level the wings before touchdown!' : 'Nearly down. Hold the nose up gently for a soft touchdown.';
      else if (g.phase === 'goaround') msg = 'Missed it. Go around: climb, then follow the green route back to line up again.';
      else if (g.phase === 'approach' && !g.captured) msg = (turnTxt ? turnTxt + ' to reach the start of the final approach.' : 'Follow the green route on the map to line up with the runway.') + ' Start coming down.';
      else if (g.phase === 'approach') msg = Math.abs(g.cross) > 25 ? `Line up: you are ${Math.round(Math.abs(g.cross))} m to the ${g.cross > 0 ? 'right, steer left' : 'left, steer right'}.` : v > spec.vStallF * 1.5 ? 'Lined up. Throttle back and use the airbrake (B) to slow down.' : (flight.flapSet !== 1 && g.along < 3000 ? 'Final approach. Flaps 1 Down (press 1) and follow the green line down.' : 'Lined up. Follow the green line down.');
      else if (turnTxt) msg = turnTxt + ' to follow the green route.';
      else if (g.phase === 'cruise' && g.dtg - g.todDist < Math.max(1500, v * 25)) msg = 'Descent point coming up on the map. Get ready to throttle back.';
      else if (flight.flapSet === 1 && flight.h > 100) msg = 'Climbing nicely. Set flaps to 2 Flat (press 2) to fly faster.';
      tip.hidden = !msg; if (msg) tip.textContent = msg;
    } else if (v > spec.vLift) $('tip').textContent = 'Lift-off speed! Hold Nose up now.';
    histT += dt; trailT += dt;
    if (histT >= 0.2) { histT = 0; hist.push({ g: G0.gamma, w: G0.want }); if (hist.length > 150) hist.shift(); }
    if (trailT >= 0.5) { trailT = 0; trail.push({ d: G0.dtg, h: flight.h }); if (trail.length > 2400) trail.shift(); }
    if (flight.result) finish();
  }
  if (flight) { if (!G0) G0 = guide(flight, spec); render(); hud(); drawMini(); drawChart(); drawHeightMap(); }
  raf = requestAnimationFrame(loop);
}

function hud() {
  const f = flight, v = Math.hypot(f.vx, f.vy), tg = world.target;
  $('h-spd').textContent = kmh(v) + ' km/h';
  $('h-alt').textContent = Math.round(f.h) + ' m';
  $('h-vs').textContent = (f.vy >= 0 ? '+' : '') + f.vy.toFixed(1) + ' m/s';
  const onT = runwayAt(world, f.e, f.n) === tg;
  $('h-tgt').textContent = onT ? 'On it' : (Math.hypot(tg.e - f.e, tg.n - f.n) / 1000).toFixed(2) + ' km';
  $('h-hdg').textContent = hdgTxt(f.psi) + (G0 && !f.ground && Math.abs(G0.turn) > 3 ? (G0.turn > 0 ? ' ▶' : ' ◀') + Math.round(Math.abs(G0.turn)) : '');
  $('h-g').textContent = (f.ground ? 1 : f.nLoad).toFixed(1) + ' g';
  $('g-load').classList.toggle('hot', !f.ground && f.nLoad > spec.nlim * 0.8);
  $('h-fuel').textContent = Math.ceil(f.fuel) + ' kg';
  $('g-fuel').classList.toggle('hot', f.fuel < spec.fuel * 0.15);
  $('stall').hidden = !f.stalled;
  $('h-cfg').textContent = FLAPNAME[f.flapSet] + ' · ' + (f.brake ? 'ON' : 'off');
  $('h-ap').textContent = f.ap && f.at ? 'ON' : f.ap ? 'STEERING' : f.at ? 'THROTTLE' : 'OFF';
  $('g-ap').classList.toggle('on', !!(f.ap || f.at));
}

function render() { if (cockpit) renderCockpit(); else renderOutside(); drawCompass(view.ctx, view.w); }

// heading tape across the top of the view, green bug = heading to steer
function drawCompass(ctx, w) {
  const f = flight, cw = Math.min(320, w * 0.42), x0 = w / 2 - cw / 2, y0 = 22, hgt = 30, span = 80;
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,30,.72)'; ctx.fillRect(x0, y0, cw, hgt);
  ctx.beginPath(); ctx.rect(x0, y0, cw, hgt); ctx.clip();
  const hd = f.psi / DEG, X = d => w / 2 + d / span * cw;
  ctx.font = '10px ' + css('--f-mono'); ctx.textAlign = 'center';
  for (let a = Math.floor((hd - span / 2) / 5) * 5; a <= hd + span / 2; a += 5) {
    const x = X(a - hd), big = a % 10 === 0;
    ctx.fillStyle = '#a9c0d2'; ctx.fillRect(x, y0 + hgt - (big ? 9 : 5), 1, big ? 9 : 5);
    if (a % 30 === 0) { const n = ((a % 360) + 360) % 360; ctx.fillStyle = '#eef4f8'; ctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] || String(n / 10), x, y0 + 13); }
  }
  if (G0 && f.flew) {
    const d = G0.turn, cl = Math.max(-span / 2 + 3, Math.min(span / 2 - 3, d)), x = X(cl);
    ctx.fillStyle = '#3cff8a';
    if (Math.abs(d) < span / 2 - 3) { ctx.fillRect(x - 6, y0 + hgt - 5, 12, 5); ctx.beginPath(); ctx.moveTo(x - 6, y0 + hgt - 5); ctx.lineTo(x, y0 + hgt - 12); ctx.lineTo(x + 6, y0 + hgt - 5); ctx.fill(); }
    else { ctx.beginPath(); const s = Math.sign(d); ctx.moveTo(x + s * 4, y0 + hgt / 2); ctx.lineTo(x - s * 6, y0 + 6); ctx.lineTo(x - s * 6, y0 + hgt - 6); ctx.fill(); }
  }
  ctx.restore();
  ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(w / 2, y0 + hgt + 1); ctx.lineTo(w / 2 - 6, y0 + hgt + 9); ctx.lineTo(w / 2 + 6, y0 + hgt + 9); ctx.fill();
  ctx.fillStyle = '#eef4f8'; ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillText(hdgTxt(f.psi), w / 2, y0 + hgt + 21);
}

// ---------- First-person view ----------
function makeCam(f, w, h, cx, cy, F) {
  const camH = f.h + gearH(plane) + plane.height * 0.85;
  const sp = Math.sin(f.psi), cp = Math.cos(f.psi), p = f.theta * DEG, cP = Math.cos(p), sP = Math.sin(p);
  const toCam = (E, N, U) => { const dE = E - f.e, dN = N - f.n, d = dE * sp + dN * cp, r = dE * cp - dN * sp, u = U - camH; return [r, -d * sP + u * cP, d * cP + u * sP]; };
  const scr = q => [cx + F * q[0] / q[2], cy - F * q[1] / q[2]];
  const proj = (E, N, U) => { const q = toCam(E, N, U); return q[2] < 1 ? null : [...scr(q), q[2]]; };
  const poly = (ctx, pts, col) => {
    let c = pts.map(p => toCam(p[0], p[1], p[2] || 0)), out = [];
    for (let i = 0; i < c.length; i++) {
      const A = c[i], B = c[(i + 1) % c.length], ia = A[2] >= 1, ib = B[2] >= 1;
      if (ia) out.push(A);
      if (ia !== ib) { const t = (1 - A[2]) / (B[2] - A[2]); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, 1]); }
    }
    if (out.length < 3) return false;
    ctx.fillStyle = col; ctx.beginPath(); out.forEach((q, i) => { const s = scr(q); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); ctx.fill(); return true;
  };
  return { camH, proj, poly, toCam, fwd: [sp, cp] };
}

function renderCockpit() {
  const { ctx, w, h } = view, f = flight;
  const v = Math.hypot(f.vx, f.vy);
  shake = f.ground && v > 2 ? (Math.random() - 0.5) * Math.min(3, v / 12) : 0;
  const dashH = Math.min(h * 0.24, 130);
  const F = h * 0.95, cx = w / 2, cy = (h - dashH) * 0.52 + shake;
  const cam = makeCam(f, w, h, cx, cy, F), camH = cam.camH;
  const horizon = cy + F * Math.tan(f.theta * DEG);
  const R = Math.hypot(w, h);
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-f.phi * DEG); ctx.translate(-cx, -cy);
  // sky and base ground
  const t = Math.min(1, f.h / 3000);
  const sg = ctx.createLinearGradient(0, horizon - h, 0, horizon);
  sg.addColorStop(0, `rgb(${Math.round(60 - 30 * t)},${Math.round(125 - 50 * t)},${Math.round(205 - 40 * t)})`);
  sg.addColorStop(1, '#d6e9f4');
  ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R * 2, R * 2, R * 3);
  ctx.fillStyle = '#9db99a'; ctx.fillRect(cx - R, horizon, R * 2, R * 2);
  // field patches, anchored to the ground
  const C = 200, Rg = Math.min(4500, 1800 + camH * 6);
  const ci = Math.floor(f.e / C), cj = Math.floor(f.n / C), nC = Math.ceil(Rg / C);
  const patches = [];
  for (let i = ci - nC; i <= ci + nC; i++) for (let j = cj - nC; j <= cj + nC; j++) {
    const r = hash(i * 31 + 7, j * 17 + 3); if (r < 0.4) continue;
    const ce = (i + 0.5) * C, cn = (j + 0.5) * C, de = ce - f.e, dn = cn - f.n, dist = Math.hypot(de, dn);
    if (dist > Rg || de * cam.fwd[0] + dn * cam.fwd[1] < -C) continue;
    patches.push([dist, i, j, r]);
  }
  patches.sort((a, b) => b[0] - a[0]);
  for (const [dist, i, j, r] of patches) {
    const fade = Math.min(1, dist / Rg), base = r > 0.75 ? [84, 140, 74] : r > 0.55 ? [118, 160, 86] : [140, 150, 90], hz = [157, 185, 154];
    cam.poly(ctx, [[i * C, j * C], [(i + 1) * C, j * C], [(i + 1) * C, (j + 1) * C], [i * C, (j + 1) * C]], `rgb(${base.map((c, k) => Math.round(c + (hz[k] - c) * fade)).join(',')})`);
  }
  const hg = ctx.createLinearGradient(0, horizon - 2, 0, horizon + 30);
  hg.addColorStop(0, 'rgba(214,233,244,0.95)'); hg.addColorStop(1, 'rgba(214,233,244,0)');
  ctx.fillStyle = hg; ctx.fillRect(cx - R, horizon - 2, R * 2, 32);
  // runways, far to near
  world.runways.map(r => [Math.hypot(r.e - f.e, r.n - f.n), r]).filter(a => a[0] < 16000).sort((a, b) => b[0] - a[0]).forEach(([, r]) => drawRunway3D(ctx, r, cam));
  // clouds
  const CC = 700;
  for (let i = Math.floor(f.e / CC) - 12; i <= Math.floor(f.e / CC) + 12; i++) for (let j = Math.floor(f.n / CC) - 12; j <= Math.floor(f.n / CC) + 12; j++) {
    if (hash(i * 13 + 1, j * 7 + 2) > 0.28) continue;
    const ce = (i + hash(i, j + 50)) * CC, cn = (j + hash(i + 50, j)) * CC, ch = 300 + hash(i + 9, j + 9) * 2200;
    const c = cam.proj(ce, cn, ch); if (!c) continue;
    const r = 160 * (0.6 + hash(i + 3, j + 3)) * F / c[2]; if (r < 3 || r > w * 3) continue;
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, 0.3 + r / 40)})`;
    ctx.beginPath(); ctx.ellipse(c[0], c[1], r, r * 0.35, 0, 0, Math.PI * 2); ctx.ellipse(c[0] + r * .5, c[1] - r * .16, r * .6, r * .3, 0, 0, Math.PI * 2); ctx.ellipse(c[0] - r * .5, c[1] - r * .05, r * .5, r * .25, 0, 0, Math.PI * 2); ctx.fill();
  }
  // trees, far to near
  const TC = 55, nT = Math.ceil(1600 / TC), ti = Math.floor(f.e / TC), tj = Math.floor(f.n / TC), trees = [];
  for (let i = ti - nT; i <= ti + nT; i++) for (let j = tj - nT; j <= tj + nT; j++) {
    if (hash(i * 3 + 11, j * 5 + 13) > 0.3) continue;
    const te = (i + hash(i, j)) * TC, tn = (j + hash(j, i)) * TC;
    const q = cam.toCam(te, tn, 0); if (q[2] < 2 || q[2] > 1600) continue;
    if (nearRunway(te, tn, 35)) continue;
    trees.push([q[2], te, tn, 8 + hash(i + 1, j + 1) * 8]);
  }
  trees.sort((a, b) => b[0] - a[0]);
  for (const [d, te, tn, th] of trees) {
    const b = cam.proj(te, tn, 0), tp = cam.proj(te, tn, th); if (!b || !tp) continue;
    const hh = Math.hypot(b[0] - tp[0], b[1] - tp[1]); if (hh < 1.2) continue;
    const fade = Math.min(1, d / 1600);
    ctx.fillStyle = `rgba(60,48,34,${1 - fade * 0.6})`; ctx.fillRect(b[0] - hh * 0.04, b[1] - hh * 0.35, hh * 0.08, hh * 0.35);
    ctx.fillStyle = `rgb(${Math.round(40 + fade * 100)},${Math.round(92 + fade * 80)},${Math.round(52 + fade * 100)})`;
    ctx.beginPath(); ctx.ellipse(b[0], b[1] - hh * 0.62, hh * 0.28, hh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // cockpit frame (fixed to the plane, so it does not roll)
  const fill = css('--' + plane.material);
  ctx.fillStyle = '#1d2329';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, 14); ctx.quadraticCurveTo(w / 2, 34, 0, 14); ctx.fill();
  ctx.lineWidth = Math.max(8, w * 0.012); ctx.strokeStyle = '#1d2329';
  ctx.beginPath(); ctx.moveTo(w * 0.12, h - dashH); ctx.lineTo(w * 0.24, 16); ctx.moveTo(w * 0.88, h - dashH); ctx.lineTo(w * 0.76, 16); ctx.stroke();
  if (!noseProp()) {
    ctx.fillStyle = '#1d2329'; ctx.beginPath(); ctx.moveTo(0, h - dashH - 14); ctx.quadraticCurveTo(cx, h - dashH - 40, w, h - dashH - 14); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  } else {
    const cowlW = Math.min(w * 0.5, w * 0.16 * plane.width + 60);
    ctx.fillStyle = fill; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - cowlW, h - dashH + 2);
    ctx.quadraticCurveTo(cx, h - dashH - (plane.shape === 'sleek' ? 34 : plane.shape === 'rounded' ? 26 : 14), cx + cowlW, h - dashH + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    const pr = Math.min(w * 0.4, 120 + propR() * 90);
    if (f.throttle > 0 && f.fuel > 0) { ctx.fillStyle = `rgba(20,25,30,${0.03 + 0.05 * f.throttle})`; ctx.beginPath(); ctx.ellipse(cx, h - dashH - 30, pr, pr * 0.92, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = '#1d2329'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(cx - pr, h - dashH - 30); ctx.lineTo(cx + pr, h - dashH - 30); ctx.stroke(); }
  }
  drawDash(ctx, w, h, dashH, f, v);
  if (f.result && f.result.kind === 'crash') { ctx.fillStyle = 'rgba(194,47,47,.35)'; ctx.fillRect(0, 0, w, h); }
}

function drawRunway3D(ctx, r, cam) {
  const hw = r.wid / 2, P = (a, c, u) => { const p = rwPt(r, a, c); return [p[0], p[1], u || 0]; };
  const quad = (a1, a2, c1, c2, col) => cam.poly(ctx, [P(a1, c1), P(a1, c2), P(a2, c2), P(a2, c1)], col);
  const fake = r.kind === 'fake', d = Math.hypot(r.e - flight.e, r.n - flight.n);
  quad(-8, r.len + 8, -hw - 8, hw + 8, fake ? '#8d9a7a' : '#7d8a74');
  quad(0, r.len, -hw, hw, fake ? '#6d6c66' : '#4a4e55');
  if (d > 9000) return;
  const bars = Math.max(4, Math.round(r.wid / 6)), bw = r.wid / (bars * 2 + 1);
  for (let i = 0; i < bars; i++) for (const sgn of [-1, 1]) { const c0 = sgn * (bw * (1 + 2 * i)); quad(6, 36, c0, c0 + sgn * bw * 0.8, '#eceff1'); quad(r.len - 36, r.len - 6, c0, c0 + sgn * bw * 0.8, '#eceff1'); }
  for (let a = 60; a < r.len - 60; a += 50) quad(a, a + 28, -0.6, 0.6, fake ? '#bdb9a8' : '#eceff1');
  if (fake) {
    for (let a = 80; a < r.len - 60; a += 220) {
      cam.poly(ctx, [P(a, -hw * 0.8), P(a + 8, -hw * 0.8), P(a + 68, hw * 0.8), P(a + 60, hw * 0.8)], '#f2c230');
      cam.poly(ctx, [P(a, hw * 0.8), P(a + 8, hw * 0.8), P(a + 68, -hw * 0.8), P(a + 60, -hw * 0.8)], '#f2c230');
    }
  } else {
    const dot = (a, c, col, rad) => { const p = rwPt(r, a, c), q = cam.proj(p[0], p[1], 0.3); if (!q) return; const rr = Math.max(1.2, rad * 900 / q[2]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], Math.min(rr, 6), 0, Math.PI * 2); ctx.fill(); };
    for (let a = 0; a <= r.len; a += 60) { dot(a, -hw - 2, '#fff7d6', 1); dot(a, hw + 2, '#fff7d6', 1); }
    if (r.kind === 'target') {
      for (let c = -hw; c <= hw; c += 4) dot(-2, c, '#3cff8a', 1.3);
      const ph = Math.floor((performance.now() / 70) % 12);
      for (let i = 1; i <= 12; i++) dot(-i * 30, 0, ph === 12 - i ? '#ffffff' : '#9fffc4', ph === 12 - i ? 2.4 : 1.1);
    }
  }
}

