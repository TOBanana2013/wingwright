// ---------- Outside (side) view, looking at the plane from its left side ----------
function renderOutside() {
  const { ctx, w, h } = view, f = flight;
  const ppm = Math.max(1.6, Math.min(7, 7 - f.h / 120)) * Math.min(1, 14 / plane.length);
  const groundPad = 56, planeX = w * 0.34;
  const camH = Math.max(0, f.h - (h - groundPad - h * 0.42) / ppm);
  const camX = f.x - planeX / ppm;
  const SX = x => (x - camX) * ppm, SY = a => h - groundPad - (a - camH) * ppm;
  const sp = Math.sin(f.psi), cp = Math.cos(f.psi);
  const world2 = s => [f.e + sp * (s - f.x), f.n + cp * (s - f.x)];   // odometer position -> world point on the current track
  const t = Math.min(1, f.h / 3000);
  const sg = ctx.createLinearGradient(0, 0, 0, h);
  sg.addColorStop(0, `rgb(${Math.round(70 - 40 * t)},${Math.round(140 - 60 * t)},${Math.round(210 - 40 * t)})`);
  sg.addColorStop(1, '#cfe6f5'); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  for (let k = Math.floor((camX * 0.5 - 1000) / 160); k < (camX * 0.5 + w / ppm * 2) / 160; k++) {
    const cxw = k * 160 + hash(k, 1) * 140, ch = 180 + hash(k, 2) * 2600, s = 0.6 + hash(k, 3) * 1.2;
    const sx = (cxw - camX * 0.5) * ppm * 0.5 + w * 0.2, sy = SY(ch), sz = 40 * s * Math.max(0.6, ppm / 4);
    if (sx < -sz * 2 || sx > w + sz * 2 || sy < -sz || sy > h + sz) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(sx, sy, sz, sz * 0.38, 0, 0, Math.PI * 2); ctx.ellipse(sx + sz * .5, sy - sz * .18, sz * .6, sz * .32, 0, 0, Math.PI * 2); ctx.fill();
  }
  const gy = SY(0);
  ctx.fillStyle = '#7fae7a'; ctx.beginPath(); ctx.moveTo(0, gy);
  for (let x = 0; x <= w; x += 8) { const wx = camX * 0.3 + x / ppm * 0.3; ctx.lineTo(x, gy - (18 + 14 * Math.sin(wx / 90) + 8 * Math.sin(wx / 37)) * Math.min(1.5, ppm / 3)); }
  ctx.lineTo(w, gy); ctx.closePath(); ctx.fill();
  if (gy < h) {
    ctx.fillStyle = '#5c8f4e'; ctx.fillRect(0, gy, w, h - gy);
    // runways that lie along the current track
    for (const r of world.runways) {
      const ends = [rwPt(r, 0, 0), rwPt(r, r.len, 0)].map(p => { const de = p[0] - f.e, dn = p[1] - f.n; return [de * sp + dn * cp, de * cp - dn * sp]; });
      if (Math.max(Math.abs(ends[0][1]), Math.abs(ends[1][1])) > 300) continue;
      const s0 = f.x + Math.min(ends[0][0], ends[1][0]), s1 = f.x + Math.max(ends[0][0], ends[1][0]);
      const r0 = SX(s0), r1 = SX(s1); if (r1 < 0 || r0 > w) continue;
      ctx.fillStyle = r.kind === 'fake' ? '#6d6c66' : '#4b4f55'; ctx.fillRect(r0, gy, Math.max(3, r1 - r0), Math.min(10, h - gy));
      ctx.fillStyle = '#f2f2f2'; for (let m = s0 + 10; m < s1; m += 30) ctx.fillRect(SX(m), gy + 4, 12 * ppm / 4, 2);
      if (r.kind === 'fake') { ctx.fillStyle = '#f2c230'; ctx.font = '800 22px ' + css('--f-display'); ctx.textAlign = 'center'; for (let m = s0 + 100; m < s1; m += 220) ctx.fillText('X', SX(m), gy - 4); }
      if (r.kind === 'target') { const mx = SX((s0 + s1) / 2); ctx.fillStyle = '#e2560e'; ctx.fillRect(mx, gy - 28, 2, 28); ctx.beginPath(); ctx.moveTo(mx + 2, gy - 28); ctx.lineTo(mx + 20, gy - 23); ctx.lineTo(mx + 2, gy - 18); ctx.fill(); }
    }
    for (let i = Math.floor(camX / 45); i < (camX + w / ppm) / 45 + 1; i++) {
      const wx = i * 45 + hash(i, 5) * 20, p = world2(wx); if (nearRunway(p[0], p[1], 40)) continue;
      const th = 7 + hash(i, 6) * 6, x = SX(wx);
      ctx.fillStyle = '#5b4632'; ctx.fillRect(x - 1, gy - th * ppm * 0.4, 2, th * ppm * 0.4);
      ctx.fillStyle = '#2f6b3a'; ctx.beginPath(); ctx.ellipse(x, gy - th * ppm * 0.6, th * ppm * 0.22, th * ppm * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (G0) {
    ctx.save(); ctx.strokeStyle = 'rgba(80,230,140,.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath();
    for (let x = 0; x <= w; x += 6) { const s = camX + x / ppm - f.x, y = SY(G0.alt(f.x + s, G0.dtg - s)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  }
  if (f.h < 200 && gy < h) { ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - f.h / 200)})`; ctx.beginPath(); ctx.ellipse(SX(f.x), gy + 2, plane.length * ppm * 0.5, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  drawSide(ctx, SX(f.x), SY(f.h), Math.max(ppm, 80 / plane.length), f.theta, f.fuel > 0 ? f.throttle : 0, f.result && f.result.kind === 'crash');
  if (Math.abs(f.phi) > 2) { ctx.fillStyle = '#eef4f8'; ctx.font = '600 12px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillText(`Banked ${Math.abs(f.phi).toFixed(0)}° ${f.phi > 0 ? 'right' : 'left'}`, SX(f.x), SY(f.h) - 40); }
}

// ---------- Mini map (top-down, heading up: the way you are flying is always up) ----------
const RANGES = [500, 800, 1200, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 50000];
let mapWide = false;
function drawMini() {
  if (!mini) return;
  const { ctx, w, h } = mini, f = flight, tg = world.target, g = G0;
  const py = h * 0.72, cx = w / 2, sp = Math.sin(f.psi), cp = Math.cos(f.psi);
  const distT = Math.hypot(tg.e - f.e, tg.n - f.n) + tg.len, v = Math.hypot(f.vx, f.vy);
  const want = mapWide ? Math.max(distT, Math.hypot(f.e, f.n)) * 1.05 : Math.min(distT, Math.max(600, v * 22));
  const range = RANGES.find(r => r * 0.7 >= want) || RANGES[RANGES.length - 1];
  const ppm = (py - 20) / (range * 0.7);
  const M = (e, n) => { const de = e - f.e, dn = n - f.n; return [cx + (de * cp - dn * sp) * ppm, py - (de * sp + dn * cp) * ppm]; };
  const polyM = (pts, col, stroke) => { ctx.beginPath(); pts.forEach((p, i) => { const q = M(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); if (col) { ctx.fillStyle = col; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  ctx.fillStyle = '#466f43'; ctx.fillRect(0, 0, w, h);
  // field patches anchored to the ground
  const C = range / 6, R = range * 1.1, ci = Math.floor(f.e / C), cj = Math.floor(f.n / C), n = Math.ceil(R / C);
  for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) {
    const r = hash(i * 7 + 1, j * 3 + range); if (r < 0.5) continue;
    polyM([[i * C + C * .07, j * C + C * .07], [(i + .93) * C, j * C + C * .07], [(i + .93) * C, (j + .93) * C], [i * C + C * .07, (j + .93) * C]], r > 0.82 ? '#5d8a4f' : r > 0.66 ? '#3c6239' : '#7a8f4f');
  }
  if (range <= 2000) {
    const TC = 55, nT = Math.ceil(range / TC), ti = Math.floor(f.e / TC), tj = Math.floor(f.n / TC);
    ctx.fillStyle = '#2b5230';
    for (let i = ti - nT; i <= ti + nT; i++) for (let j = tj - nT; j <= tj + nT; j++) {
      if (hash(i * 3 + 11, j * 5 + 13) > 0.3) continue;
      const te = (i + hash(i, j)) * TC, tn = (j + hash(j, i)) * TC, q = M(te, tn);
      if (q[0] < 0 || q[0] > w || q[1] < 0 || q[1] > h || nearRunway(te, tn, 35)) continue;
      ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.5, 4 * ppm), 0, Math.PI * 2); ctx.fill();
    }
  }
  // runways
  for (const r of world.runways) {
    const ww = Math.max(r.wid, 5 / ppm) / 2;
    const corners = [rwPt(r, 0, -ww), rwPt(r, 0, ww), rwPt(r, r.len, ww), rwPt(r, r.len, -ww)];
    polyM(corners, r.kind === 'fake' ? '#7b786c' : r.kind === 'home' ? '#2b3036' : '#3a3f46');
    const mid = rwPt(r, r.len / 2, 0), q = M(mid[0], mid[1]);
    if (r.kind === 'target') {
      ctx.lineWidth = 2; polyM([rwPt(r, -15, -ww - 15), rwPt(r, -15, ww + 15), rwPt(r, r.len + 15, ww + 15), rwPt(r, r.len + 15, -ww - 15)], null, '#3cff8a');
      ctx.fillStyle = '#3cff8a'; ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText('RWY ' + r.num, q[0] + 8, q[1] + 4);
    } else if (r.kind === 'fake') {
      ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 1.5; const s = 5;
      ctx.beginPath(); ctx.moveTo(q[0] - s, q[1] - s); ctx.lineTo(q[0] + s, q[1] + s); ctx.moveTo(q[0] + s, q[1] - s); ctx.lineTo(q[0] - s, q[1] + s); ctx.stroke();
    } else { ctx.fillStyle = '#a9c0d2'; ctx.font = '10px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText('HOME', q[0] + 8, q[1] + 4); }
  }
  // planned route: plane -> start of final -> runway
  if (g && f.flew) {
    const route = [[f.e, f.n]]; if (!g.captured) route.push(g.faf); route.push(rwPt(tg, 0, 0), rwPt(tg, tg.len, 0));
    ctx.strokeStyle = '#8ff0b4'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath();
    route.forEach((p, i) => { const q = M(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.setLineDash([]);
    // extended centreline of the target
    const a = M(...rwPt(tg, -g.Ff, 0)), b = M(...rwPt(tg, 0, 0));
    ctx.strokeStyle = 'rgba(143,240,180,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    // descent point along the route
    let left = g.dtg - g.todDist;
    if (left > 0) for (let i = 0; i < route.length - 1; i++) {
      const L = Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]);
      if (left <= L) { const k = left / L, p = M(route[i][0] + (route[i + 1][0] - route[i][0]) * k, route[i][1] + (route[i + 1][1] - route[i][1]) * k);
        ctx.fillStyle = '#8ff0b4'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); ctx.font = '10px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText('DESCEND', p[0] + 7, p[1] + 3); break; }
      left -= L;
    }
  }
  // target off the edge: arrow on the border
  const tq = M(...rwPt(tg, tg.len / 2, 0));
  if (tq[0] < 8 || tq[0] > w - 8 || tq[1] < 26 || tq[1] > h - 24) {
    const ang = Math.atan2(tq[0] - cx, py - tq[1]);
    const ex = Math.max(14, Math.min(w - 14, cx + Math.sin(ang) * w)), ey = Math.max(32, Math.min(h - 30, py - Math.cos(ang) * h));
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = '#3cff8a'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 5); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#3cff8a'; ctx.font = '600 10px ' + css('--f-mono'); ctx.textAlign = ex > w / 2 ? 'right' : 'left';
    ctx.fillText('RWY ' + tg.num, ex + (ex > w / 2 ? -10 : 10), ey + 4);
  }
  // plane icon (always pointing up)
  ctx.save(); ctx.translate(cx, py); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#e2560e'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(1.6, -3); ctx.lineTo(8, 1); ctx.lineTo(8, 3); ctx.lineTo(1.6, 1); ctx.lineTo(1.2, 6); ctx.lineTo(3.5, 8); ctx.lineTo(3.5, 9.5);
  ctx.lineTo(-3.5, 9.5); ctx.lineTo(-3.5, 8); ctx.lineTo(-1.2, 6); ctx.lineTo(-1.6, 1); ctx.lineTo(-8, 3); ctx.lineTo(-8, 1); ctx.lineTo(-1.6, -3); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  // north arrow, title and scale bar
  ctx.fillStyle = 'rgba(10,20,30,.7)'; ctx.fillRect(0, 0, w, 18); ctx.fillRect(0, h - 18, w, 18);
  ctx.fillStyle = '#a9c0d2'; ctx.font = '10px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText(mapWide ? 'MAP · ROUTE (M)' : 'MAP · CLOSE (M)', 7, 12);
  ctx.save(); ctx.translate(w - 14, 34); ctx.rotate(-f.psi); ctx.fillStyle = '#eef4f8'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(4, 3); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill();
  ctx.font = '600 9px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillText('N', 0, 13); ctx.restore();
  ctx.fillStyle = '#a9c0d2'; ctx.font = '10px ' + css('--f-mono'); ctx.textAlign = 'right'; ctx.fillText(((distT - tg.len) / 1000).toFixed(1) + ' KM', w - 7, 12);
  const bar = range / 4 * ppm; ctx.strokeStyle = '#eef4f8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(8, h - 6); ctx.lineTo(8, h - 10); ctx.lineTo(8 + bar, h - 10); ctx.lineTo(8 + bar, h - 6); ctx.stroke();
  ctx.fillStyle = '#eef4f8'; ctx.textAlign = 'left'; ctx.fillText((range / 4 >= 1000 ? range / 4000 + ' km' : range / 4 + ' m'), 14 + bar, h - 6);
  ctx.textAlign = 'right'; ctx.fillText(Math.round(f.h) + ' m up', w - 7, h - 6);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

// ---------- Height map: height against distance still to fly ----------
function drawHeightMap() {
  if (!hmap || !G0) return;
  const { ctx, w, h } = hmap, f = flight, g = G0, tg = world.target;
  const ink = css('--ink'), muted = css('--muted'), line = css('--line'), acc = css('--accent'), ok = css('--ok'), panel = css('--panel');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = panel; ctx.fillRect(0, 0, w, h);
  const L = 44, Rt = w - 64, T = 16, B = h - 20;
  const maxD = Math.max(D0, ...trail.map(p => p.d), g.dtg) * 1.02, maxH = Math.max(g.cruise * 1.35, f.maxH * 1.1, 50);
  const X = d => Rt - Math.max(0, Math.min(maxD, d)) / maxD * (Rt - L), Y = a => B - Math.max(0, a) / maxH * (B - T);
  ctx.font = '10px ' + css('--f-mono');
  // grid
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = muted; ctx.textAlign = 'right';
  const step = maxH > 1200 ? 500 : maxH > 500 ? 200 : 100;
  for (let a = 0; a <= maxH; a += step) { const y = Y(a); ctx.beginPath(); ctx.moveTo(L, y + .5); ctx.lineTo(Rt, y + .5); ctx.stroke(); ctx.fillText(a + ' m', L - 6, y + 3); }
  const kmStep = maxD > 30000 ? 10000 : maxD > 12000 ? 5000 : maxD > 5000 ? 2000 : 1000;
  ctx.textAlign = 'center';
  for (let d = kmStep; d < maxD; d += kmStep) { const x = X(d); ctx.fillRect(x, B, 1, 4); ctx.fillText((d / 1000) + ' km', x, h - 5); }
  // planned profile
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const d = maxD * (1 - i / 120), a = g.alt(Math.max(0, D0 - d), d), x = X(d), y = Y(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.lineTo(X(0), B); ctx.lineTo(X(maxD), B); ctx.closePath();
  ctx.fillStyle = 'rgba(29,127,71,.12)'; ctx.fill();
  ctx.strokeStyle = ok; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const d = maxD * (1 - i / 120), a = g.alt(Math.max(0, D0 - d), d), x = X(d), y = Y(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]);
  // descent point
  const tx = X(g.todDist); ctx.strokeStyle = ok; ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(tx + .5, T); ctx.lineTo(tx + .5, B); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = ok; ctx.textAlign = 'center'; ctx.fillText('DESCEND', tx, T - 4);
  // ground, home and target
  ctx.fillStyle = ink; ctx.fillRect(L, B, Rt - L, 2);
  ctx.fillStyle = acc; ctx.fillRect(X(0) - 2, B - 3, Math.max(8, tg.len / maxD * (Rt - L)), 5);
  ctx.textAlign = 'left'; ctx.font = '600 11px ' + css('--f-mono'); ctx.fillText('RWY ' + tg.num, X(0) + 10, B - 6);
  ctx.font = '10px ' + css('--f-mono'); ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.fillText('HOME', X(D0) - 12, T - 4);
  // flown trail
  if (trail.length > 1) { ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); trail.forEach((p, i) => { const x = X(p.d), y = Y(p.h); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.lineTo(X(g.dtg), Y(f.h)); ctx.stroke(); }
  // the plane
  const px = X(g.dtg), py = Y(f.h);
  ctx.save(); ctx.translate(px, py); ctx.rotate(-g.gamma * DEG);
  ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = ink; ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = px > w / 2 ? 'right' : 'left';
  ctx.fillText(Math.round(f.h) + ' m · ' + (g.dtg / 1000).toFixed(1) + ' km to go', px + (px > w / 2 ? -12 : 12), Math.max(T + 8, py - 8));
  ctx.fillStyle = muted; ctx.font = '10px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText('HEIGHT MAP', 2, 10);
}

