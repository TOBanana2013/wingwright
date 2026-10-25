function drawTargets(ctx, cam, F2) {
  const F = fight; if (!F || !F.tgts) return;
  const t = flight.t, list = F.tgts.map(x => [x, Math.hypot(x.e - cam.eye[0], x.n - cam.eye[1])]).filter(x => x[1] < 12000).sort((a, b) => b[1] - a[1]);
  for (const [tg, d] of list) {
    if (tg.len && tg.sink >= 29) continue;
    const gz = groundAt(world, tg.e, tg.n);
    if (tg.len && tg.alive) {   // wake
      const fx = Math.sin(tg.psi), fy = Math.cos(tg.psi), rx = Math.cos(tg.psi), ry = -Math.sin(tg.psi), L = tg.len / 2, W = tg.wid / 2;
      cam.poly(ctx, [[tg.e - fx * L + rx * W, tg.n - fy * L + ry * W, 0.3], [tg.e - fx * (L + 500) + rx * W * 5, tg.n - fy * (L + 500) + ry * W * 5, 0.3], [tg.e - fx * (L + 500) - rx * W * 5, tg.n - fy * (L + 500) - ry * W * 5, 0.3], [tg.e - fx * L - rx * W, tg.n - fy * L - ry * W, 0.3]], 'rgba(235,245,250,.45)');
    }
    const xf = attitudeXf([tg.e, tg.n, gz - tg.sink], tg.psi, 0, tg.len && !tg.alive ? Math.min(12, tg.sink) * DEG : 0);
    drawModel(ctx, tg.alive ? tg.faces : tg.dead, xf, cam, {});
    if (!tg.alive && tg.sink < 20) {   // fire and smoke
      for (let k = 0; k < 6; k++) { const age = ((t * 0.35 + k / 6) % 1), q = cam.proj(tg.e + Math.sin(k * 2.1) * 8 + age * 25, tg.n + Math.cos(k * 1.7) * 8, gz + 12 + age * 120); if (!q) continue;
        const r = Math.max(2, (10 + age * 40) * F2 / q[2]); ctx.fillStyle = `rgba(55,55,58,${0.5 * (1 - age)})`; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); }
      const q = cam.proj(tg.e, tg.n, gz + 10); if (q) { const r = Math.max(2, (9 + Math.random() * 5) * F2 / q[2]); ctx.fillStyle = 'rgba(255,140,40,.85)'; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}
function drawBombFX(ctx, cam, F2) {
  const F = fight, t = flight.t;
  for (const b of F.bombs) { const q = cam.proj(...b.p); if (!q) continue; ctx.fillStyle = '#26282c'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.4, 0.9 * F2 / q[2]), 0, Math.PI * 2); ctx.fill(); }
  for (const p of F.puffs) { const q = cam.proj(...p.p); if (!q) continue; const age = (t - p.t) / 3.5, r = Math.max(2, (8 + age * 14) * F2 / q[2]);
    if (age < 0.06) { ctx.fillStyle = 'rgba(255,170,70,.9)'; ctx.beginPath(); ctx.arc(q[0], q[1], r * 0.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(30,30,32,${0.75 * (1 - age)})`; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); }
  if (F.ip && !flight.result) {   // where the bombs would land right now
    const gz = groundAt(world, F.ip[0], F.ip[1]), R0 = F.B.blast, pts = Array.from({ length: 24 }, (_, i) => cam.proj(F.ip[0] + Math.sin(i / 24 * 2 * Math.PI) * R0, F.ip[1] + Math.cos(i / 24 * 2 * Math.PI) * R0, gz + 1));
    if (pts.every(Boolean)) { ctx.strokeStyle = F.onTarget ? '#ff3b30' : '#ffe14a'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); }
  }
}
function drawBombSight(ctx, w, h) {
  const F = fight, P = F.agents[0]; if (!F.ip) return;
  const R0 = Math.max(52, Math.min(74, w * 0.07)), cx = 14 + R0, cy = h * 0.5, k = R0 / 600, fx = Math.sin(P.psi), fy = Math.cos(P.psi);
  const toS = (e, n) => { const de = e - F.ip[0], dn = n - F.ip[1]; return [cx + (de * fy - dn * fx) * k, cy - (de * fx + dn * fy) * k]; };
  ctx.save(); ctx.fillStyle = 'rgba(10,16,22,.72)'; ctx.beginPath(); ctx.arc(cx, cy, R0 + 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = world.seaBase ? 'rgba(40,90,125,.6)' : 'rgba(80,100,70,.55)'; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
  for (const tg of F.tgts) {
    const q = toS(tg.e, tg.n); ctx.fillStyle = tg.alive ? (tg === F.aim ? '#ff8a3c' : '#ffb02e') : 'rgba(90,90,90,.8)';
    ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(tg.psi - P.psi);
    if (tg.len) ctx.fillRect(-tg.wid / 2 * k, -tg.len / 2 * k, Math.max(2, tg.wid * k), tg.len * k); else ctx.fillRect(-Math.max(2.5, tg.r * k), -Math.max(2.5, tg.r * k), Math.max(5, tg.r * 2 * k), Math.max(5, tg.r * 2 * k));
    ctx.restore();
  }
  const pq = toS(P.e, P.n); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pq[0], pq[1]); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.strokeStyle = F.onTarget ? '#ff3b30' : '#ffe14a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, F.B.blast * k), 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - R0, cy); ctx.lineTo(cx - 8, cy); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + R0, cy); ctx.moveTo(cx, cy - R0); ctx.lineTo(cx, cy - 8); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + R0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.stroke();
  if (F.aim) { const q = toS(F.aim.e, F.aim.n), dx = q[0] - cx, dy = q[1] - cy, d = Math.hypot(dx, dy);
    if (d > R0) { const ux = dx / d, uy = dy / d, ax = cx + ux * (R0 - 4), ay = cy + uy * (R0 - 4); ctx.fillStyle = '#ff8a3c'; ctx.beginPath(); ctx.moveTo(ax + ux * 8, ay + uy * 8); ctx.lineTo(ax - uy * 6, ay + ux * 6); ctx.lineTo(ax + uy * 6, ay - ux * 6); ctx.closePath(); ctx.fill(); } }
  ctx.font = '600 10px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillStyle = F.onTarget ? '#ff6a5e' : '#e8eef5';
  ctx.fillText(F.onTarget ? 'DROP!' : 'BOMB SIGHT', cx, cy - R0 - 10); ctx.fillStyle = '#e8eef5'; ctx.fillText(`${F.bombsLeft} bombs · ${Math.round(F.ip[2])} s fall`, cx, cy + R0 + 18);
}
function drawTargetMarkers(ctx, cam) {
  const F = fight; ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'center';
  for (const tg of F.tgts) { if (!tg.alive) continue; const q = cam.proj(tg.e, tg.n, groundAt(world, tg.e, tg.n) + 10); if (!q) continue;
    const s = tg === F.aim ? 12 : 8; ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = tg === F.aim ? 2 : 1.5; ctx.beginPath(); ctx.moveTo(q[0], q[1] - s); ctx.lineTo(q[0] + s, q[1] + s * 0.7); ctx.lineTo(q[0] - s, q[1] + s * 0.7); ctx.closePath(); ctx.stroke();
    if (tg === F.aim) { ctx.fillStyle = '#ffd27a'; ctx.fillText(`${tg.name} ${q[2] < 1000 ? Math.round(q[2]) + ' m' : (q[2] / 1000).toFixed(1) + ' km'}`, q[0], q[1] + s + 14); } }
}
