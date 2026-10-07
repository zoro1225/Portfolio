// All sound is synthesized with the Web Audio API — no files. Browsers need a click before audio can start (the ENTER gate).
let ctx, master, amb, nbuf, on = true, ambOn = false;
const noteHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp); comp.connect(ctx.destination);
  amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
  nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
const noise = (loop) => { const s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = !!loop; return s; };
const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
function tone(type, f0, f1, t, dur, vol, dest) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.005, vol, dur); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
}
const seq = (type, notes, step, vol) => { const t = ctx.currentTime; notes.forEach((f, i) => tone(type, f, null, t + i * step, step * 1.6, vol)); };

/* Permanent background: detuned drone + slow filter sweep + wind + a sparse minor-pentatonic pad. Never stops. */
function ambience() {
  if (ambOn) return; ambOn = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
  const dg = ctx.createGain(); dg.gain.value = 0.2; lp.connect(dg); dg.connect(amb);
  [[55, 'sawtooth'], [55.4, 'sawtooth'], [110.2, 'triangle'], [27.5, 'sine']].forEach(([f, ty]) => {
    const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f; o.connect(lp); o.start();
  });
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 150; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  const w = noise(true), bp = ctx.createBiquadFilter(), wg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6; wg.gain.value = 0.05;
  w.connect(bp); bp.connect(wg); wg.connect(amb); w.start();
  const scale = [57, 60, 64, 67, 69, 72, 76];
  const pad = () => { if (!on) return; const n = scale[(Math.random() * scale.length) | 0], t = ctx.currentTime;
    tone('sine', noteHz(n), null, t, 3.2, 0.07, amb); tone('triangle', noteHz(n - 12), null, t, 3.6, 0.05, amb); };
  pad(); setInterval(pad, 3400);
  amb.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 4);
}

const PENT = [62, 66, 69, 71, 74, 78, 81, 83]; // D-major pentatonic: bright, adventurous
const brass = (f, t, dur, vol) => {
  const lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.08);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  [f, f * 1.005].forEach((x) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = x; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); });
  lp.connect(g); g.connect(master);
};

function splashAt(t, vol) {
  const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
  env(g, t, 0.01, vol, 0.22); s.connect(lp); lp.connect(g); g.connect(master); s.start(t, Math.random() * 1.5); s.stop(t + 0.35);
}

export const audio = {
  start(sound) { init(); ctx.resume(); on = !!sound; master.gain.value = on ? 0.8 : 0; if (on) { ambience(); this.horn(); } },
  setOn(v) { if (!ctx) return; on = v; master.gain.setTargetAtTime(v ? 0.8 : 0, ctx.currentTime, 0.1); if (v) ambience(); },
  duck(v) { if (ctx && ambOn) amb.gain.setTargetAtTime(v ? 0.15 : 0.5, ctx.currentTime, 0.3); },

  /* Text reveal — a different game-style sound for each section. sec: 0 hero, 1 work, 2 stack, 3 about, 4 contact */
  reveal(i = 0, vol = 1, sec = 0) {
    if (!ctx || !on) return; const t = ctx.currentTime + i * 0.09 + 0.05, v = vol;
    const hz = noteHz(PENT[(i * 2 + ((Math.random() * 3) | 0)) % PENT.length]);
    if (sec === 0) { [0, 4, 7, 12].forEach((st, k) => tone('square', hz * Math.pow(2, st / 12), null, t + k * 0.035, 0.09, 0.03 * v)); splashAt(t, 0.05 * v); }        // power-up arpeggio
    else if (sec === 1) { tone('triangle', hz * 2, null, t, 0.5, 0.06 * v); tone('sine', hz * 3, null, t + 0.04, 0.35, 0.035 * v); tone('sine', hz * 4.01, null, t + 0.08, 0.3, 0.02 * v); } // treasure chime
    else if (sec === 2) { tone('sine', 300 + Math.random() * 200, 1100 + Math.random() * 500, t, 0.1, 0.07 * v); tone('square', hz * 2, null, t + 0.06, 0.06, 0.025 * v); }    // bubble pop + blip
    else if (sec === 3) { const f = 380 + Math.random() * 380; tone('triangle', f, f * 1.12, t, 0.05, 0.06 * v); tone('triangle', f * 1.5, null, t + 0.045, 0.04, 0.035 * v); }      // RPG dialogue blips
    else { [0, 2, 4, 7, 9].forEach((st, k) => tone('sine', hz * Math.pow(2, st / 12), null, t + k * 0.045, 0.5, 0.04 * v)); }                                                    // quest-complete harp
  },
  /* Section change: a rolling wave swell, sometimes with a seagull overhead. */
  whoosh() {
    if (!ctx || !on) return; const t = ctx.currentTime, s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(1800, t + 0.5); lp.frequency.exponentialRampToValueAtTime(350, t + 1.3);
    env(g, t, 0.45, 0.16, 0.8); s.connect(lp); lp.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 1.4);
    if (Math.random() < 0.35) this.gull();
  },
  gull() { if (!ctx || !on) return; const t = ctx.currentTime + 0.3; tone('triangle', 2100, 1400, t, 0.28, 0.035); tone('triangle', 1900, 1200, t + 0.32, 0.32, 0.03); },
  tick() { if (ctx && on) tone('triangle', 700, 300, ctx.currentTime, 0.06, 0.05); },                       // wooden deck tap
  click() { if (ctx && on) { const t = ctx.currentTime; tone('sine', 1046, null, t, 0.7, 0.07); tone('sine', 2886, null, t, 0.4, 0.03); tone('sine', 5650, null, t, 0.25, 0.015); } }, // ship's bell
  coin() { if (ctx && on) { const t = ctx.currentTime; tone('square', 988, null, t, 0.08, 0.05); tone('square', 1319, null, t + 0.07, 0.2, 0.05); } }, // berries
  horn() {                                                                                                    // ship horn on boarding
    if (!ctx || !on) return; const t = ctx.currentTime, lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    [110, 165, 220.5].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 1.9); }); lp.connect(g); g.connect(master);
  },
  denden() { if (!ctx || !on) return; const t = ctx.currentTime; for (let k = 0; k < 3; k++) { tone('square', 820, 760, t + k * 0.2, 0.13, 0.035); tone('square', 1030, 980, t + k * 0.2, 0.13, 0.025); } }, // snail-phone ring
  hit() {                                                                                                     // cannon boom
    if (!ctx || !on) return; const t = ctx.currentTime, s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    tone('sine', 95, 28, t, 0.7, 0.32); tone('sawtooth', 60, 30, t, 0.4, 0.1); lp.type = 'lowpass'; lp.frequency.value = 500; env(g, t, 0.004, 0.35, 0.45);
    s.connect(lp); lp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.6);
  },
  win() { if (!ctx || !on) return; const t = ctx.currentTime; [293.7, 370, 440, 587.3, 740].forEach((f, i) => brass(f, t + i * 0.1, i === 4 ? 0.7 : 0.18, 0.07)); }, // brass fanfare
  lose() { if (ctx && on) seq('sawtooth', [311, 294, 277, 262], 0.2, 0.06); },
  /* Water slice — used by the Blade Slice game: a splash cut with a rising bubble. */
  slash(delay = 0, vol = 1) {
    if (!ctx || !on) return; const t = ctx.currentTime + delay; splashAt(t, 0.28 * vol);
    tone('sine', 500, 1500, t, 0.12, 0.06 * vol); tone('sine', 800, 2200, t + 0.05, 0.1, 0.04 * vol);
  },
  splash(vol = 1) { if (ctx && on) splashAt(ctx.currentTime, 0.25 * vol); },
  bubble() { if (ctx && on) { const t = ctx.currentTime; tone('sine', 280 + Math.random() * 120, 900 + Math.random() * 300, t, 0.12, 0.06); } },
};
