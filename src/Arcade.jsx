import { useEffect, useRef, useState } from 'react';
import { audio } from './audio.js';

const best = (k) => { try { return +localStorage.getItem(k) || 0; } catch { return 0; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/* GAME 1 — BLADE SLICE: drag to cut gems, avoid bombs, don't let gems fall. 3 lives. */
function Slice() {
  const cv = useRef(); const [run, setRun] = useState(0); const [ui, setUi] = useState({ s: 0, l: 3, over: false });
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d'), W = 900, H = 520; c.width = W; c.height = H; setUi({ s: 0, l: 3, over: false });
    let objs = [], sparks = [], trail = [], score = 0, lives = 3, over = false, spawn = 0.4, down = false, raf;
    const t0 = performance.now(); let last = t0; const COL = ['#ffcc1f', '#ff7a1a', '#19c3d8', '#7bd88f'];
    const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    const segDist = (a, b, p) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1; const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(a.x + u * dx - p.x, a.y + u * dy - p.y); };
    const burst = (x, y, col) => { for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283, s = 120 + Math.random() * 320; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, col }); } };
    const hurt = () => { lives--; setUi((u) => ({ ...u, l: lives })); if (lives <= 0) { over = true; if (score > best('sliceBest')) save('sliceBest', score); setUi((u) => ({ ...u, over: true })); audio.lose(); } else audio.hit(); };
    const onDown = (e) => { down = true; trail = [{ ...pt(e), t: performance.now() }]; };
    const onMove = (e) => {
      if (!down || over) return; const p = { ...pt(e), t: performance.now() }, q = trail[trail.length - 1] || p; trail.push(p);
      if (Math.hypot(p.x - q.x, p.y - q.y) < 4) return;
      objs.forEach((o) => { if (o.dead || segDist(q, p, o) >= o.r) return; o.dead = true;
        if (o.bomb) { burst(o.x, o.y, '#e63946'); hurt(); } else { score++; burst(o.x, o.y, o.col); audio.slash(0, 0.7); audio.coin(); setUi((u) => ({ ...u, s: score })); } });
    };
    const onUp = () => { down = false; };
    c.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const lvl = Math.min(1, (now - t0) / 60000);
      if (!over) { spawn -= dt; if (spawn <= 0) { spawn = 0.9 - lvl * 0.5 + Math.random() * 0.4;
        const n = 1 + (Math.random() < 0.3 + lvl * 0.4 ? 1 : 0) + (Math.random() < lvl * 0.3 ? 1 : 0);
        for (let i = 0; i < n; i++) { const x = 120 + Math.random() * (W - 240);
          objs.push({ x, y: H + 30, vx: (W / 2 - x) * 0.35 * (0.4 + Math.random() * 0.6), vy: -(760 + Math.random() * 130), r: 24 + Math.random() * 10, bomb: Math.random() < 0.16 + lvl * 0.1, col: COL[(Math.random() * 4) | 0], rot: 0 }); } } }
      objs.forEach((o) => { o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += dt * 3;
        if (!o.dead && !o.bomb && o.y > H + 40 && o.vy > 0) { o.dead = true; if (!over) hurt(); } });
      objs = objs.filter((o) => !o.dead && o.y < H + 80);
      sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt; s.life -= dt; }); sparks = sparks.filter((s) => s.life > 0);
      trail = trail.filter((p) => now - p.t < 180);
      g.clearRect(0, 0, W, H);
      objs.forEach((o) => { g.save(); g.translate(o.x, o.y); g.rotate(o.rot);
        if (o.bomb) { g.fillStyle = '#111'; g.strokeStyle = '#e63946'; g.lineWidth = 3; g.beginPath();
          for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = i % 2 ? o.r * 0.8 : o.r * 1.15; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); }
        else { g.fillStyle = o.col; g.shadowColor = o.col; g.shadowBlur = 18; g.beginPath(); g.moveTo(0, -o.r * 1.2); g.lineTo(o.r, 0); g.lineTo(0, o.r * 1.2); g.lineTo(-o.r, 0); g.closePath(); g.fill(); }
        g.restore(); });
      sparks.forEach((s) => { g.globalAlpha = Math.min(1, s.life * 2); g.strokeStyle = s.col; g.lineWidth = 2; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); g.stroke(); }); g.globalAlpha = 1;
      if (trail.length > 1) { g.strokeStyle = '#e8f0ff'; g.shadowColor = '#ffcc1f'; g.shadowBlur = 14; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
        trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.shadowBlur = 0; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); };
  }, [run]);
  return (
    <div className="game">
      <div className="hudbar"><span>SCORE {ui.s}</span><span>{'♥ '.repeat(Math.max(0, ui.l))}</span><span>BEST {best('sliceBest')}</span></div>
      <canvas ref={cv} />
      {ui.over && <div className="over"><b>GAME OVER</b><p>Score {ui.s}</p><button onClick={() => setRun((r) => r + 1)}>↻ AGAIN</button></div>}
      <p className="how">Drag across the screen to slice gems · avoid the spiked bombs · don’t let gems fall</p>
    </div>
  );
}

/* GAME 2 — QUICK DRAW: wait for the signal, then strike faster than the rival. Each win makes the rival faster. */
function Duel() {
  const [st, setSt] = useState('idle'); const [lvl, setLvl] = useState(0); const [ms, setMs] = useState(0); const [streak, setStreak] = useState(0);
  const timer = useRef(), t0 = useRef(0); const foe = Math.max(170, 330 - lvl * 20);
  useEffect(() => () => clearTimeout(timer.current), []);
  const begin = () => { setSt('wait'); audio.tick(); timer.current = setTimeout(() => { t0.current = performance.now(); setSt('go'); audio.slash(0, 1.2); }, 1200 + Math.random() * 2800); };
  const press = () => {
    if (st === 'wait') { clearTimeout(timer.current); setSt('early'); setStreak(0); audio.lose(); return; }
    if (st === 'go') { const r = Math.round(performance.now() - t0.current); setMs(r);
      if (r <= foe) { setSt('win'); setLvl((l) => l + 1); setStreak((s) => s + 1); audio.win(); } else { setSt('lose'); setStreak(0); audio.hit(); } return; }
    begin();
  };
  const msg = { idle: 'TAP TO DRAW', wait: 'STEADY…', go: 'STRIKE!', win: `CLEAN CUT · ${ms}ms`, lose: `TOO SLOW · ${ms}ms`, early: 'TOO EARLY — YOU FLINCHED' }[st];
  return (
    <div className="game">
      <div className="hudbar"><span>STREAK {streak}</span><span>RIVAL {foe}ms</span><span>LEVEL {lvl + 1}</span></div>
      <button className={`duel ${st}`} onPointerDown={press}>{msg}</button>
      <p className="how">Wait for “STRIKE!” then tap as fast as you can. Beat the rival’s reaction time to level up.</p>
    </div>
  );
}


/* GAME 3 — SEA DODGER: steer your ship (mouse / touch / ← →), dodge rocks, grab coins. */
function Dodge() {
  const cv = useRef(); const [run, setRun] = useState(0); const [ui, setUi] = useState({ s: 0, l: 3, over: false });
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d'), W = 900, H = 520; c.width = W; c.height = H; setUi({ s: 0, l: 3, over: false });
    let bx = W / 2, tx = W / 2, objs = [], score = 0, lives = 3, over = false, spawn = 0, off = 0, inv = 0, shown = 0, shownL = 3, shownO = false, raf; const t0 = performance.now(); let last = t0;
    const pt = (e) => { const r = c.getBoundingClientRect(); tx = (e.clientX - r.left) * W / r.width; };
    const key = (e) => { if (e.key === 'ArrowLeft') tx -= 80; if (e.key === 'ArrowRight') tx += 80; };
    c.addEventListener('pointermove', pt); addEventListener('keydown', key);
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const sp = 260 + Math.min(260, (now - t0) / 150); off = (off + sp * dt) % 70;
      if (!over) {
        spawn -= dt; if (spawn <= 0) { spawn = 0.6 - Math.min(0.3, (now - t0) / 90000) + Math.random() * 0.3; objs.push({ x: 60 + Math.random() * (W - 120), y: -30, coin: Math.random() < 0.35, r: 20 + Math.random() * 10, seed: Math.random() * 6 }); }
        tx = Math.max(40, Math.min(W - 40, tx)); bx += (tx - bx) * Math.min(1, dt * 8); inv -= dt; score += dt * 3;
        objs.forEach((o) => { o.y += sp * dt; if (Math.hypot(o.x - bx, o.y - (H - 70)) < o.r + 30) { o.dead = true;
          if (o.coin) { score += 10; audio.coin(); } else if (inv <= 0) { lives--; inv = 1.2; audio.hit(); audio.splash(); if (lives <= 0) { over = true; if (score > best('dodgeBest')) save('dodgeBest', Math.floor(score)); audio.lose(); } } } });
        objs = objs.filter((o) => !o.dead && o.y < H + 50);
        if (Math.floor(score) !== shown || shownL !== lives || shownO !== over) { shown = Math.floor(score); shownL = lives; shownO = over; setUi({ s: shown, l: lives, over }); }
      }
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0f6a8c'); bg.addColorStop(1, '#04283f'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; for (let y = -70 + off; y < H; y += 70) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 5); g.stroke(); }
      objs.forEach((o) => { g.save(); g.translate(o.x, o.y);
        if (o.coin) { g.fillStyle = '#ffcc1f'; g.shadowColor = '#ffcc1f'; g.shadowBlur = 14; g.beginPath(); g.arc(0, 0, 15, 0, 6.283); g.fill(); g.shadowBlur = 0; g.fillStyle = '#b8860b'; g.font = '800 16px sans-serif'; g.textAlign = 'center'; g.fillText('฿', 0, 6); }
        else { g.fillStyle = '#5d5a55'; g.strokeStyle = '#2b2926'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = o.r * (0.78 + 0.3 * Math.sin(i * 2.1 + o.seed)); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); }
        g.restore(); });
      g.save(); g.translate(bx, H - 70); if (inv > 0 && Math.floor(now / 90) % 2) g.globalAlpha = 0.35;
      g.fillStyle = '#6a4526'; g.beginPath(); g.moveTo(-34, 0); g.lineTo(34, 0); g.lineTo(22, 24); g.lineTo(-22, 24); g.closePath(); g.fill();
      g.strokeStyle = '#3b2412'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -58); g.stroke();
      g.fillStyle = '#f3e8cc'; g.beginPath(); g.moveTo(3, -54); g.lineTo(3, -6); g.lineTo(32, -6); g.closePath(); g.fill(); g.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointermove', pt); removeEventListener('keydown', key); };
  }, [run]); // eslint-disable-line
  return (
    <div className="game">
      <div className="hudbar"><span>SCORE {ui.s}</span><span>{'♥ '.repeat(Math.max(0, ui.l))}</span><span>BEST {best('dodgeBest')}</span></div>
      <canvas ref={cv} />
      {ui.over && <div className="over"><b>SHIPWRECKED</b><p>Score {ui.s}</p><button onClick={() => setRun((r) => r + 1)}>↻ SAIL AGAIN</button></div>}
      <p className="how">Move the mouse (or ← →) to steer · dodge the rocks · collect gold coins</p>
    </div>
  );
}

/* GAME 4 — CANNON FIRE: aim with the mouse (distance = power), click to fire, sink the enemy ships. 12 shots. */
function CannonGame() {
  const cv = useRef(); const [run, setRun] = useState(0); const [ui, setUi] = useState({ s: 0, n: 12, over: false });
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d'), W = 900, H = 520, CX = 80, CY = 430, WL = 450; c.width = W; c.height = H; setUi({ s: 0, n: 12, over: false });
    let aim = { x: 400, y: 250 }, balls = [], parts = [], score = 0, shots = 12, over = false, raf, last = performance.now();
    const mkShip = () => ({ x: 380 + Math.random() * 460, sp: (Math.random() < 0.5 ? -1 : 1) * (35 + Math.random() * 45), sink: 0 });
    let ships = [mkShip(), mkShip(), mkShip()];
    const vec = () => { const dx = aim.x - CX, dy = aim.y - CY; const a = Math.max(0.05, Math.min(1.45, Math.atan2(-dy, Math.max(dx, 1)))); const p = Math.max(300, Math.min(950, Math.hypot(dx, dy) * 2.4)); return [Math.cos(a) * p, -Math.sin(a) * p]; };
    const pt = (e) => { const r = c.getBoundingClientRect(); aim = { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    const fire = (e) => { pt(e); if (over || shots <= 0) return; const [vx, vy] = vec(); balls.push({ x: CX + 30, y: CY - 12, vx, vy }); shots--; audio.hit(); setUi((u) => ({ ...u, n: shots })); };
    c.addEventListener('pointermove', pt); c.addEventListener('pointerdown', fire);
    const boom = (x, y, col) => { for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283, s = 80 + Math.random() * 260; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.7, col }); } };
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ships.forEach((s) => { if (s.sink) { s.sink += dt; if (s.sink > 1.2) Object.assign(s, mkShip()); } else { s.x += s.sp * dt; if (s.x < 300 || s.x > W - 50) s.sp *= -1; } });
      balls.forEach((b) => { b.vy += 500 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        ships.forEach((s) => { if (!s.sink && !b.dead && Math.abs(b.x - s.x) < 50 && b.y > 360 && b.y < WL) { b.dead = true; s.sink = 0.001; score++; boom(b.x, b.y, '#ff9f1c'); audio.coin(); audio.hit(); setUi((u) => ({ ...u, s: score })); } });
        if (!b.dead && b.y > WL) { b.dead = true; boom(b.x, WL, '#bfe9ff'); audio.splash(); } });
      balls = balls.filter((b) => !b.dead && b.x < W + 40); parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }); parts = parts.filter((p) => p.life > 0);
      if (!over && shots <= 0 && balls.length === 0) { over = true; if (score > best('cannonBest')) save('cannonBest', score); setUi((u) => ({ ...u, over: true })); audio.win(); }
      const sky = g.createLinearGradient(0, 0, 0, WL); sky.addColorStop(0, '#2a78c2'); sky.addColorStop(1, '#ffd9a0'); g.fillStyle = sky; g.fillRect(0, 0, W, WL);
      const sea = g.createLinearGradient(0, WL - 10, 0, H); sea.addColorStop(0, '#1a8aa8'); sea.addColorStop(1, '#04283f'); g.fillStyle = sea; g.fillRect(0, WL - 10, W, H);
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; for (let y = WL + 8; y < H; y += 18) { g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.04 + now / 400 + y) * 3); g.stroke(); }
      ships.forEach((s) => { g.save(); g.translate(s.x, WL - 6 + s.sink * 60); g.rotate(s.sink * 0.5); g.globalAlpha = s.sink ? Math.max(0, 1 - s.sink) : 1;
        g.fillStyle = '#4a2f18'; g.beginPath(); g.moveTo(-48, -22); g.lineTo(48, -22); g.lineTo(32, 6); g.lineTo(-32, 6); g.closePath(); g.fill();
        g.strokeStyle = '#2a1a0c'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -22); g.lineTo(0, -92); g.stroke();
        g.fillStyle = '#f3e8cc'; g.beginPath(); g.moveTo(3, -88); g.lineTo(3, -30); g.lineTo(38, -30); g.closePath(); g.fill(); g.fillStyle = '#e63946'; g.fillRect(0, -100, 16, 9); g.restore(); });
      g.fillStyle = '#3b2412'; g.fillRect(0, CY - 8, 120, H - CY + 8); g.save(); g.translate(CX, CY - 12); const [vx, vy] = vec(); g.rotate(Math.atan2(vy, vx)); g.fillStyle = '#222'; g.fillRect(-10, -12, 56, 24); g.fillStyle = '#ffcc1f'; g.fillRect(40, -14, 8, 28); g.restore();
      if (!over && shots > 0) { g.fillStyle = 'rgba(255,255,255,.7)'; let px = CX + 30, py = CY - 12, pvx = vx, pvy = vy; for (let i = 0; i < 28; i++) { g.beginPath(); g.arc(px, py, 2.4, 0, 6.283); g.fill(); pvy += 500 * 0.05; px += pvx * 0.05; py += pvy * 0.05; if (py > WL) break; } }
      g.fillStyle = '#111'; balls.forEach((b) => { g.beginPath(); g.arc(b.x, b.y, 7, 0, 6.283); g.fill(); });
      parts.forEach((p) => { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 3, 0, 6.283); g.fill(); }); g.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointermove', pt); c.removeEventListener('pointerdown', fire); };
  }, [run]);
  return (
    <div className="game">
      <div className="hudbar"><span>SUNK {ui.s}</span><span>{'● '.repeat(Math.max(0, ui.n))}</span><span>BEST {best('cannonBest')}</span></div>
      <canvas ref={cv} />
      {ui.over && <div className="over"><b>BATTLE OVER</b><p>Ships sunk {ui.s}</p><button onClick={() => setRun((r) => r + 1)}>↻ REMATCH</button></div>}
      <p className="how">Move the mouse to aim — farther from the cannon means more power · click to fire · 12 cannonballs</p>
    </div>
  );
}

/* GAME 5 — KRAKEN SMASH: 30 seconds. Smash the krakens, don't hit the anchors. */
function Kraken() {
  const [run, setRun] = useState(0); const [st, setSt] = useState({ s: 0, t: 30, over: false }); const [cur, setCur] = useState(null);
  useEffect(() => {
    setSt({ s: 0, t: 30, over: false }); setCur(null); let alive = true, t = 30, h;
    const tick = setInterval(() => { t--; setSt((x) => ({ ...x, t: Math.max(0, t) })); if (t <= 0) { clearInterval(tick); clearTimeout(h); alive = false; setCur(null); setSt((x) => { if (x.s > best('krakenBest')) save('krakenBest', x.s); return { ...x, over: true }; }); audio.win(); } }, 1000);
    const spawn = () => { if (!alive) return; setCur({ i: (Math.random() * 9) | 0, bad: Math.random() < 0.2, id: Math.random() }); audio.bubble();
      h = setTimeout(() => { setCur(null); h = setTimeout(spawn, 180 + Math.random() * 240); }, Math.max(480, 900 - (30 - t) * 14)); };
    spawn(); return () => { alive = false; clearInterval(tick); clearTimeout(h); };
  }, [run]);
  const hit = (i) => { if (!cur || cur.i !== i || st.over) return; setCur(null);
    if (cur.bad) { setSt((x) => ({ ...x, s: Math.max(0, x.s - 2) })); audio.hit(); } else { setSt((x) => ({ ...x, s: x.s + 1 })); audio.splash(0.8); audio.coin(); } };
  return (
    <div className="game">
      <div className="hudbar"><span>SCORE {st.s}</span><span>⏱ {st.t}s</span><span>BEST {best('krakenBest')}</span></div>
      <div className="holes">{Array.from({ length: 9 }, (_, i) => (
        <button key={i} className="hole" onPointerDown={() => hit(i)} aria-label={`Hole ${i + 1}`}><span className={`kr ${cur && cur.i === i ? 'up' : ''}`}>{cur && cur.i === i ? (cur.bad ? '⚓' : '🐙') : ''}</span></button>))}</div>
      {st.over && <div className="over"><b>TIME’S UP</b><p>Score {st.s}</p><button onClick={() => setRun((r) => r + 1)}>↻ AGAIN</button></div>}
      <p className="how">Smash the krakens 🐙 as they surface · avoid the anchors ⚓ (−2)</p>
    </div>
  );
}

const GAMES = [
  { id: 'slice', tag: '01 · REFLEX', name: 'BLADE SLICE', d: 'Cut gems mid-air. Dodge bombs.', C: Slice },
  { id: 'duel', tag: '02 · DUEL', name: 'QUICK DRAW', d: 'Wait for the signal. Strike first.', C: Duel },
  { id: 'dodge', tag: '03 · VOYAGE', name: 'SEA DODGER', d: 'Steer through rocks. Grab the gold.', C: Dodge },
  { id: 'cannon', tag: '04 · BATTLE', name: 'CANNON FIRE', d: 'Aim, fire, sink the fleet.', C: CannonGame },
  { id: 'kraken', tag: '05 · MONSTER', name: 'KRAKEN SMASH', d: '30 seconds. Smash them all.', C: Kraken },
];

export default function Arcade({ onClose }) {
  const [g, setG] = useState(null); const G = GAMES.find((x) => x.id === g);
  useEffect(() => { const k = (e) => e.key === 'Escape' && (g ? setG(null) : onClose()); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [g, onClose]);
  return (
    <div className="arcade" role="dialog" aria-label="Arcade" data-lenis-prevent>
      <button className="x" onClick={onClose}>✕ CLOSE</button>
      <p className="kick">ARCADE — A SEPARATE SPACE FROM THE PORTFOLIO</p>
      <h2>{[...'ARCADE'].map((c, i) => <span className="al" key={i} style={{ '--i': i }}>{c}</span>)}</h2>
      {!G ? (
        <div className="menu">{GAMES.map((x) => (
          <button key={x.id} className="tilt" onClick={() => setG(x.id)}><small>{x.tag}</small><b>{x.name}</b><p>{x.d}</p><span className="play">PLAY ▶</span></button>))}</div>
      ) : (<><button className="back" onClick={() => setG(null)}>← BACK TO MENU</button><G.C /></>)}
    </div>
  );
}
