import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import World, { S, accentAt } from './World.jsx';
import { projects, stack, about, links } from './data.js';
import { audio } from './audio.js';
import Arcade from './Arcade.jsx';
import Ai from './Ai.jsx';

const NAV = ['HOME', 'WORK', 'STACK', 'ABOUT', 'CONTACT'];
const N = NAV.length;
const CAT = { Frontend: '#ffcc1f', Core: '#ffcc1f', Backend: '#19c3d8', ML: '#ff6a3d', Data: '#ff6a3d', Database: '#7bd88f', Markup: '#ffcc1f', Arch: '#19c3d8', Tools: '#c8a6ff', Design: '#ff8fc8', Framework: '#19c3d8', CSS: '#ffcc1f', Cloud: '#5ab0ff' };

/* Kinetic word: masked, rises into place when its panel becomes active. */
const Kin = ({ t, cls = '', o = 0 }) => (
  <span className={`kin ${cls}`}>
    {t.split(' ').map((w, i) => <span className="km" key={i}><span className="k" style={{ '--i': i + o }}>{w}</span></span>)}
  </span>
);
/* Hero word: same mask reveal, but every letter is its own element so it can react to the pointer. */
const Word = ({ t, cls = '', o = 0 }) => (
  <span className={`kin ${cls}`}><span className="km"><span className="k" style={{ '--i': o }}>{[...t].map((c, i) => <span className="l" key={i}>{c}</span>)}</span></span></span>
);
const Lt = ({ t, cls = '' }) => <span className={cls}>{[...t].map((c, i) => <span className="l" key={i}>{c}</span>)}</span>;

export default function App() {
  const panels = useRef([]), dots = useRef([]), lenis = useRef(), h1 = useRef(), cnt = useRef(), entered = useRef(false);
  const [gate, setGate] = useState(true), [arcade, setArcade] = useState(false), [snd, setSnd] = useState(true);
  const enter = (s) => { audio.start(s); setSnd(s); entered.current = true; setGate(false); };
  const toggleSnd = () => { const v = !snd; audio.setOn(v); setSnd(v); };
  useEffect(() => { const lx = lenis.current; if (!lx) return; arcade ? lx.stop() : lx.start(); audio.duck(arcade); if (arcade) audio.denden(); }, [arcade]);

  useEffect(() => {
    const lx = new Lenis({ lerp: 0.09 }); lenis.current = lx;
    lx.on('scroll', (l) => { S.p = l.limit ? l.scroll / l.limit : 0; });
    const ptr = { x: -999, y: -999 };
    const move = (e) => { if (e.pointerType === 'touch') return; ptr.x = e.clientX; ptr.y = e.clientY; S.x = (e.clientX / innerWidth - 0.5) * 2; S.y = -(e.clientY / innerHeight - 0.5) * 2; };
    addEventListener('pointermove', move, { passive: true });
    let lastT = null;
    const over = (e) => { const t = e.target.closest && e.target.closest('button,a,.tilt'); if (t && t !== lastT) audio.tick(); lastT = t; };
    const clk = (e) => { if (e.target.closest && e.target.closest('button,a')) audio.click(); };
    /* Tilt + spotlight on any .tilt element (cards, hero boxes, facts, arcade menu). */
    const tilt = (e) => { const t = e.target.closest && e.target.closest('.tilt'); if (!t) return; const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      t.style.setProperty('--rx', (0.5 - py) * 12 + 'deg'); t.style.setProperty('--ry', (px - 0.5) * 14 + 'deg'); t.style.setProperty('--mx', px * 100 + '%'); t.style.setProperty('--my', py * 100 + '%'); };
    const tiltOut = (e) => { const t = e.target.closest && e.target.closest('.tilt'); if (t && !t.contains(e.relatedTarget)) { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); } };
    addEventListener('pointerover', over); addEventListener('click', clk); addEventListener('pointermove', tilt, { passive: true }); addEventListener('pointerout', tiltOut);

    const words = [...document.querySelectorAll('.hero h1 .k')].map((k) => { const els = [...k.querySelectorAll('.l')]; return { k, els, st: els.map(() => 0) }; });
    let cur = -1, raf;
    const loop = (time) => {
      lx.raf(time);
      const ps = S.ps; let act = 0, best = 9;
      panels.current.forEach((el, i) => {
        if (!el) return;
        const d = (ps - i / (N - 1)) * (N - 1), a = Math.abs(d), o = Math.max(0, Math.min(1, 1.25 - a * 1.9));
        el.style.opacity = o; el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        el.style.transform = `translateZ(${d > 0 ? d * 520 : d * 760}px) rotateY(${d * -9}deg) scale(${1 + (d > 0 ? d * 0.15 : 0)})`;
        el.style.filter = a > 0.05 ? `blur(${Math.min(a * 9, 12)}px)` : 'none';
        el.style.pointerEvents = o > 0.7 ? 'auto' : 'none';
        const now = entered.current && a < 0.5;
        if (now && !el.classList.contains('in')) { const n = el.querySelectorAll('.k').length; for (let j = 0; j < n; j++) audio.reveal(j, 0.9, i); }
        el.classList.toggle('in', now);
        if (a < best) { best = a; act = i; }
      });
      if (act !== cur) { if (cur !== -1) audio.whoosh(); cur = act; dots.current.forEach((b, i) => b && b.classList.toggle('on', i === act)); if (cnt.current) cnt.current.textContent = `0${act + 1} / 0${N}`; }
      if (h1.current) {
        h1.current.style.setProperty('--ls', `${0.012 + Math.min(Math.abs(ps * (N - 1)), 1) * 0.16}em`);
        h1.current.style.transform = `rotateX(${S.my * 5}deg) rotateY(${S.mx * 9}deg)`;
      }
      const hp = panels.current[0];
      if (hp && parseFloat(hp.style.opacity) > 0.4) words.forEach((w) => {
        const rc = w.k.getBoundingClientRect(), n = w.els.length;
        w.els.forEach((l, j) => {
          const cx = rc.left + (j + 0.5) * rc.width / n, cy = rc.top + rc.height / 2, dx = cx - ptr.x, dy = cy - ptr.y, d = Math.hypot(dx, dy), inf = Math.pow(Math.max(0, 1 - d / 210), 2);
          w.st[j] += (inf - w.st[j]) * 0.14; const h = w.st[j];
          l.style.transform = `translate(${d ? dx / d * h * 16 : 0}px,${-h * 26}px) rotate(${dx / 210 * h * 12}deg) scale(${1 + h * 0.2})`; l.style.setProperty('--h', h.toFixed(3));
        });
      });
      document.documentElement.style.setProperty('--acc', accentAt(ps * (N - 1)).getStyle());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move); removeEventListener('pointerover', over); removeEventListener('click', clk); removeEventListener('pointermove', tilt); removeEventListener('pointerout', tiltOut); lx.destroy(); };
  }, []);

  const go = (i) => lenis.current.scrollTo((i / (N - 1)) * lenis.current.limit, { duration: 2.4 });
  const P = (i) => (el) => (panels.current[i] = el);
  useEffect(() => { const g = (e) => go(e.detail), o = () => setArcade(true); addEventListener('goto', g); addEventListener('open-arcade', o); return () => { removeEventListener('goto', g); removeEventListener('open-arcade', o); }; }, []);

  return (
    <>
      {gate && (
        <div className="gate">
          <p>SHIVAM BANDE · PORTFOLIO / 2026</p>
          <h1><Lt t="ENTER" /> <Lt t="PORTFOLIO" cls="serif" /></h1>
          <p>BEST EXPERIENCED WITH SOUND ON · ALL AUDIO IS GENERATED LIVE</p>
          <div><button onClick={() => enter(true)}>ENTER WITH SOUND</button><button className="ghost" onClick={() => enter(false)}>ENTER SILENT</button></div>
        </div>
      )}
      {arcade && <Arcade onClose={() => setArcade(false)} />}
      <div className="world"><World /></div>
      <div className="vig" />
      <header className="hud">
        <b className="brand">SB<i>®</i></b>
        <nav>{NAV.map((n, i) => <button key={n} ref={(e) => (dots.current[i] = e)} onClick={() => go(i)}>{n}</button>)}</nav>
        <div className="right"><button className="snd" onClick={toggleSnd}>♪ {snd ? 'ON' : 'OFF'}</button><button className="arc" onClick={() => setArcade(true)}>▶ ARCADE</button><span className="cnt" ref={cnt} /></div>
      </header>

      <div className="stage">
        <section className="panel hero" ref={P(0)}>
          <p className="kick">CREATIVE DEVELOPER · NAGPUR / INDIA</p>
          <h1 ref={h1}><Word t="SHIVAM" /><br /><Word t="BANDE" cls="serif" o={1} /></h1>
          <p className="sub">I build web products, AI interfaces and interactive worlds with code and design.</p>
        </section>

        <section className="panel" ref={P(1)}>
          <p className="kick">02 / WORK</p>
          <h2><Kin t="SELECTED WORK" /></h2>
          <div className="cards">{projects.map((p) => (
            <article className="card tilt" key={p.n}>
              <div className="shot"><img src={p.img} alt={p.title} loading="lazy" /></div>
              <small>{p.n} / {p.tag}</small><h3>{p.title}</h3><p>{p.desc}</p><span>{p.role}</span>
            </article>))}</div>
        </section>

        <section className="panel" ref={P(2)}>
          <p className="kick">03 / SKILLS</p>
          <h2><Kin t="TECH STACK" /></h2>
          <div className="chipgrid">{stack.map(([n, c], i) => <div className="sc tilt" key={n} style={{ '--j': i, '--c': CAT[c] || '#ffcc1f' }}><i /><b>{n}</b><small>{c}</small></div>)}</div>
        </section>

        <section className="panel" ref={P(3)}>
          <p className="kick">04 / ABOUT</p>
          <h2><Kin t="ABOUT ME" /></h2>
          <div className="aboutgrid">
            <div className="bio">{about.bio.map((t, i) => <p key={i}>{t}</p>)}</div>
            <div className="facts">{about.facts.map(([k, v]) => <div className="fact tilt" key={k}><small>{k}</small><b>{v}</b></div>)}</div>
          </div>
        </section>

        <section className="panel" ref={P(4)}>
          <p className="kick">05 / CONTACT</p>
          <h2 className="huge"><Kin t="GET IN" /> <Kin t="TOUCH." cls="serif" o={2} /></h2>
          <a className="mail" href={`mailto:${links.email}`}>{links.email} ↗</a>
          <div className="links"><a href={links.github} target="_blank" rel="noreferrer">GITHUB ↗</a><a href={links.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a><a href={links.instagram} target="_blank" rel="noreferrer">INSTAGRAM ↗</a></div>
          <button className="again" onClick={() => go(0)}>↻ BACK TO TOP</button>
        </section>
      </div>

      <Ai />
      <div className="spacer" />
      <div className="hint">SCROLL TO EXPLORE</div>
    </>
  );
}
