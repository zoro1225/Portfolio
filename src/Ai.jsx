import { useEffect, useRef, useState } from 'react';
import { reply, prompts, projects, stack, links } from './data.js';
import { audio } from './audio.js';

const NAMES = ['HOME', 'WORK', 'STACK', 'ABOUT', 'CONTACT'];
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const goto = (i) => window.dispatchEvent(new CustomEvent('goto', { detail: i }));
const greet = () => { const h = new Date().getHours(); return `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}! I’m Shivam’s AI assistant. Ask me about his work, skills, background or how to get in touch — type it, or tap the mic and just talk.`; };

/* Rich blocks that appear under an answer: project cards, skill chips, contact links, jump buttons. */
function Blocks({ rep }) {
  return (
    <div className="aiblocks">
      {rep.cards && <div className="aicards">{projects.map((p) => <button key={p.n} className="aicard" onClick={() => goto(1)}><img src={p.img} alt="" /><span><b>{p.title}</b><small>{p.tag}</small></span></button>)}</div>}
      {rep.chips && <div className="aitags">{stack.map(([n]) => <span key={n}>{n}</span>)}</div>}
      {rep.links && <div className="ailinks"><a href={`mailto:${links.email}`}>✉ EMAIL</a><a href={links.github} target="_blank" rel="noreferrer">GITHUB</a><a href={links.linkedin} target="_blank" rel="noreferrer">LINKEDIN</a><a href={links.instagram} target="_blank" rel="noreferrer">INSTAGRAM</a></div>}
      {rep.nav != null && <button className="ainav" onClick={() => goto(rep.nav)}>↗ VIEW {NAMES[rep.nav]} SECTION</button>}
      {rep.action === 'arcade' && <button className="ainav" onClick={() => window.dispatchEvent(new Event('open-arcade'))}>▶ OPEN THE ARCADE</button>}
    </div>
  );
}
function Bubble({ m }) {
  if (m.r === 'me') return <p className="me">{m.t}</p>;
  if (m.think) return <div className="ai"><span className="dots"><i /><i /><i /></span></div>;
  const shown = m.full.slice(0, m.pos), k = shown.lastIndexOf(' ') + 1;
  return (<div className="ai"><p>{m.done ? shown : <>{shown.slice(0, k)}<mark>{shown.slice(k)}</mark></>}</p>{m.done && m.rep && <Blocks rep={m.rep} />}</div>);
}

/* Floating AI assistant: chat, spoken replies with word-by-word highlighting, mic input, hands-free mode, voice settings, live talking orb. */
export default function Ai() {
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([]), [q, setQ] = useState(''), [mode, setMode] = useState('idle');
  const [voiceOn, setVoiceOn] = useState(true), [big, setBig] = useState(false), [cfg, setCfg] = useState(false), [live, setLive] = useState(false), [nudge, setNudge] = useState(false);
  const [voices, setVoices] = useState([]), [uri, setUri] = useState(ls.get('aiVoice', '')), [rate, setRate] = useState(+ls.get('aiRate', '1.03')), [follow, setFollow] = useState(prompts);
  const cv = useRef(), log = useRef(), rec = useRef(), timer = useRef(), inp = useRef(), R = useRef({}), uid = useRef(0), pulse = useRef(0), modeRef = useRef('idle'), last = useRef(null), greeted = useRef(false);
  modeRef.current = mode; R.current = { voiceOn, live, uri, rate, voices };
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stopAll = () => { uid.current++; clearInterval(timer.current); if (canSpeak) speechSynthesis.cancel(); try { rec.current && rec.current.abort(); } catch { /* ignore */ } audio.duck(false); };
  const upd = (patch) => setMsgs((m) => { const c = m.slice(); c[c.length - 1] = { ...c[c.length - 1], ...patch }; return c; });

  const say = (rep) => {
    const full = rep.text, id = ++uid.current, { voiceOn: vo, uri: u0, rate: rt, voices: vs } = R.current, hasVoice = vo && canSpeak; let bnd = false, t0 = performance.now();
    clearInterval(timer.current); upd({ think: false, full, pos: 0, done: false, rep }); setFollow(rep.follow || prompts); last.current = rep.id;
    if (rep.auto) setTimeout(() => { if (id !== uid.current) return; if (rep.action === 'arcade') window.dispatchEvent(new Event('open-arcade')); else goto(rep.nav); }, 1100);
    const finish = () => { clearInterval(timer.current); upd({ pos: full.length, done: true }); setMode('idle'); audio.duck(false); if (R.current.live) setTimeout(() => { if (id === uid.current) listen(); }, 450); };
    const run = (cps) => { timer.current = setInterval(() => { if (bnd) return; const p = Math.min(full.length, Math.floor((performance.now() - t0) / 1000 * cps)); pulse.current = Math.max(pulse.current, 0.5); upd({ pos: p }); if (p >= full.length && !hasVoice) finish(); }, 40); };
    if (hasVoice) {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(full);
      const pick = vs.find((v) => v.voiceURI === u0) || vs.find((v) => /en-IN/i.test(v.lang)) || vs[0]; if (pick) u.voice = pick; u.rate = rt; u.pitch = 1.05;
      u.onstart = () => { t0 = performance.now(); setMode('speaking'); audio.duck(true); };
      u.onboundary = (e) => { bnd = true; pulse.current = 1; upd({ pos: Math.min(full.length, e.charIndex + (e.charLength || 6)) }); };
      u.onend = u.onerror = () => { if (id === uid.current) finish(); };
      speechSynthesis.speak(u); run(15 * rt);
    } else { setMode('speaking'); run(34); }
  };
  const ask = (text) => {
    text = text.trim(); if (!text) return; setQ(''); uid.current++; clearInterval(timer.current); if (canSpeak) speechSynthesis.cancel();
    setMsgs((m) => [...m, { r: 'me', t: text }, { r: 'ai', think: true }]); setMode('thinking'); setTimeout(() => say(reply(text, last.current)), 500);
  };
  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMsgs((m) => [...m, { r: 'ai', full: 'Voice input isn’t supported in this browser. Try Chrome or Edge, or type your question.', pos: 999, done: true }]); return; }
    if (modeRef.current === 'listening') { rec.current && rec.current.stop(); return; }
    uid.current++; clearInterval(timer.current); if (canSpeak) speechSynthesis.cancel();
    const r = new SR(); r.lang = 'en-IN'; r.interimResults = true; rec.current = r;
    r.onstart = () => setMode('listening');
    r.onresult = (e) => { let s = ''; for (const res of e.results) s += res[0].transcript; setQ(s); if (e.results[e.results.length - 1].isFinal) ask(s); };
    r.onend = () => setMode((m) => (m === 'listening' ? 'idle' : m)); r.onerror = () => setMode('idle'); r.start();
  };
  const toggle = () => {
    if (open) { stopAll(); setMode('idle'); setOpen(false); return; }
    setOpen(true); setNudge(false);
    if (!greeted.current) { greeted.current = true; setMsgs([{ r: 'ai', think: true }]); setTimeout(() => say({ id: 'greet', text: greet(), follow: prompts }), 300); }
    setTimeout(() => inp.current && inp.current.focus(), 450);
  };

  useEffect(() => { const h = () => !open && toggle(); window.addEventListener('open-ai', h); return () => window.removeEventListener('open-ai', h); });
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && toggle(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); });
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [msgs]);
  useEffect(() => { if (!canSpeak) return; const load = () => setVoices(speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang))); load(); speechSynthesis.addEventListener('voiceschanged', load); return () => speechSynthesis.removeEventListener('voiceschanged', load); }, []); // eslint-disable-line
  useEffect(() => { const a = setTimeout(() => setNudge(true), 9000), b = setTimeout(() => setNudge(false), 20000); return () => { clearTimeout(a); clearTimeout(b); }; }, []);
  useEffect(() => () => stopAll(), []); // eslint-disable-line

  /* Talking orb: radial bars + pulsing core. Pulses on every spoken word (speech boundary events). */
  useEffect(() => {
    if (!open || !cv.current) return; const c = cv.current, g = c.getContext('2d'), W = (c.width = 260), H = (c.height = 260); let raf, t = 0, amp = 0.1;
    const loop = () => {
      t += 0.016; pulse.current *= 0.88; const m = modeRef.current;
      const target = m === 'speaking' ? 0.28 + pulse.current * 0.55 + 0.12 * Math.sin(t * 9) * Math.sin(t * 3.1) + Math.random() * 0.1 : m === 'listening' ? 0.35 + 0.2 * Math.sin(t * 6) : m === 'thinking' ? 0.25 + 0.1 * Math.sin(t * 12) : 0.08 + 0.04 * Math.sin(t * 2);
      amp += (target - amp) * 0.3; const col = m === 'listening' ? '#e63946' : '#ffcc1f', cx = W / 2, cy = H / 2, r0 = 46;
      g.clearRect(0, 0, W, H);
      const gr = g.createRadialGradient(cx, cy, r0 * 0.3, cx, cy, r0 * (2.2 + amp)); gr.addColorStop(0, col + '99'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r0 * 2.6, 0, 6.283); g.fill();
      g.strokeStyle = col; g.lineWidth = 3; g.lineCap = 'round'; const n = 72;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, wob = 0.5 + 0.5 * Math.sin(a * 5 + t * 4) * Math.sin(a * 3 - t * 5), len = 5 + amp * 46 * wob;
        g.globalAlpha = 0.55 + 0.45 * wob; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r0 + 6), cy + Math.sin(a) * (r0 + 6)); g.lineTo(cx + Math.cos(a) * (r0 + 6 + len), cy + Math.sin(a) * (r0 + 6 + len)); g.stroke(); }
      g.globalAlpha = 1; const cg = g.createRadialGradient(cx - 12, cy - 14, 4, cx, cy, r0 * (1 + amp * 0.18)); cg.addColorStop(0, '#fff'); cg.addColorStop(0.4, col); cg.addColorStop(1, '#04121f');
      g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, r0 * (1 + amp * 0.18), 0, 6.283); g.fill();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [open]);

  const label = { idle: live ? 'HANDS-FREE · READY' : 'READY — ASK ABOUT SHIVAM', thinking: 'THINKING…', speaking: 'SPEAKING…', listening: 'LISTENING…' }[mode];
  return (
    <>
      {open && (
        <div className={`aipanel ${big ? 'big' : ''}`} role="dialog" aria-label="AI assistant">
          <div className="aihead">
            <canvas ref={cv} />
            <div className="st"><b>AI ASSISTANT</b><br />{label}</div>
            <button onClick={() => setCfg((v) => !v)} title="Voice settings" className={cfg ? 'on' : ''}>⚙</button>
            <button onClick={() => setBig((v) => !v)} title="Expand">{big ? '⤡' : '⤢'}</button>
            <button onClick={() => { setVoiceOn((v) => !v); if (canSpeak) speechSynthesis.cancel(); }} title="Toggle voice">{voiceOn ? '🔊' : '🔇'}</button>
            <button onClick={toggle} title="Close">✕</button>
          </div>
          {cfg && (
            <div className="aicfg">
              <label>VOICE<select value={uri} onChange={(e) => { setUri(e.target.value); ls.set('aiVoice', e.target.value); }}><option value="">Auto (English)</option>{voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</select></label>
              <label>SPEED {rate.toFixed(2)}×<input type="range" min="0.8" max="1.4" step="0.05" value={rate} onChange={(e) => { setRate(+e.target.value); ls.set('aiRate', e.target.value); }} /></label>
              <label className="chk"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> HANDS-FREE — listen again after each reply</label>
            </div>
          )}
          <div className="ailog" ref={log} data-lenis-prevent>{msgs.map((m, i) => <Bubble key={i} m={m} />)}</div>
          <div className="aichips">{follow.map((p) => <button key={p} onClick={() => ask(p)}>{p}</button>)}</div>
          <form className="aiform" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <button type="button" className={`mic ${mode === 'listening' ? 'on' : ''}`} onClick={listen} aria-label="Speak your question">🎙</button>
            <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'listening' ? 'Listening…' : 'Ask something about Shivam…'} aria-label="Ask about Shivam" />
            <button type="submit" className="send">SEND ↗</button>
          </form>
        </div>
      )}
      {nudge && !open && <div className="ainudge" onClick={toggle}>Questions about Shivam? <b>Ask me</b> — I can talk, too.</div>}
      <button className="aiorb" onClick={toggle} aria-label="Ask about Shivam"><span className="tip">ASK ABOUT SHIVAM</span>{open ? '✕' : '✦'}</button>
    </>
  );
}
