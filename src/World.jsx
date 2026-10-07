import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* Shared mutable state (read every frame, never re-renders React). */
export const S = { p: 0, ps: 0, t: 0, T: 0, vel: 0, x: 0, y: 0, mx: 0, my: 0, auto: 0, cx: 0, cy: 10, cz: 0 };
const { damp, clamp, smoothstep, lerp } = THREE.MathUtils;
const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = 2.4, TRAVEL = 140, NS = 5;
const rnd = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
const TIME = { value: 0 };

/* ---------- waves: one definition drives the water shader AND the ships' bobbing ---------- */
const WV = [[1, .2, .16, .9, .9], [-.5, 1, .27, .45, 1.2], [.3, -1, .5, .2, 1.7], [1, 1, .9, .08, 2.4], [-1, .4, 1.7, .03, 3.1]]
  .map(([dx, dz, k, a, w]) => { const l = Math.hypot(dx, dz); return { dx: dx / l, dz: dz / l, k, a, w }; });
export const waveH = (x, z, t) => { let h = 0; for (const w of WV) h += w.a * Math.sin((x * w.dx + z * w.dz) * w.k + t * w.w); return h; };
const f5 = (n) => Number(n).toFixed(5);
const WAVE_GLSL = `
float waveH(vec2 p,float t){ float h=0.;
${WV.map((w) => `h+=${f5(w.a)}*sin(dot(p,vec2(${f5(w.dx)},${f5(w.dz)}))*${f5(w.k)}+t*${f5(w.w)});`).join('\n')}
return h; }
vec2 waveG(vec2 p,float t){ vec2 g=vec2(0.);
${WV.map((w) => `g+=vec2(${f5(w.dx)},${f5(w.dz)})*${f5(w.a * w.k)}*cos(dot(p,vec2(${f5(w.dx)},${f5(w.dz)}))*${f5(w.k)}+t*${f5(w.w)});`).join('\n')}
return g; }`;
const NOISE_GLSL = `
float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }`;

/* ---------- colours: UI accent + time of day travel with the scroll ---------- */
const ACC = ['#ffcc1f', '#19c3d8', '#ff9f1c', '#e63946', '#f3e3b8'];
const cA = new THREE.Color(), cB = new THREE.Color(), out = new THREE.Color();
export function accentAt(x) { const i = Math.min(3, Math.max(0, Math.floor(x))); return out.copy(cA.set(ACC[i])).lerp(cB.set(ACC[i + 1]), clamp(x - i, 0, 1)); }
const SKY = [['#2a78c2', '#ffd9a0'], ['#0c63bd', '#a6e3ff'], ['#2b5f9e', '#ffc27a'], ['#3a2a6e', '#ff8f63'], ['#0b1238', '#7b4f8f']];
export const SKYC = { top: new THREE.Color(SKY[0][0]), hor: new THREE.Color(SKY[0][1]) };
const SUN = { dir: new THREE.Vector3(-0.35, 0.4, -1).normalize(), col: new THREE.Color('#fff1c0') };
const q1 = new THREE.Color(), q2 = new THREE.Color(), q3 = new THREE.Color('#ff7a45'), DEEP = new THREE.Color('#04283f'), SHAL = new THREE.Color('#0f7f93');
function skyAt(x) {
  const i = Math.min(3, Math.max(0, Math.floor(x))), k = clamp(x - i, 0, 1);
  SKYC.top.set(SKY[i][0]).lerp(q1.set(SKY[i + 1][0]), k); SKYC.hor.set(SKY[i][1]).lerp(q2.set(SKY[i + 1][1]), k);
}

/* ---------- five ships, five camera stations ---------- */
const BASE = [[0, 0], [42, -80], [-40, -160], [36, -240], [-30, -320]];
const OFF = [[-0.55, 30, 9], [0.9, 26, 6], [-1.35, 34, 5], [0.4, 28, 12], [2.9, 30, 4]]; // angle, distance, height
const CFG = [
  { hull: '#6a4526', sail: '#f3e8cc', flag: '#e63946', s: 1, masts: 3 }, { hull: '#33364a', sail: '#ecebe2', flag: '#15161d', s: 1.15, masts: 3 },
  { hull: '#7a4519', sail: '#dccb9f', flag: '#ffcc1f', s: 0.9, masts: 2 }, { hull: '#4a362c', sail: '#f6f0e0', flag: '#19c3d8', s: 1.25, masts: 3 },
  { hull: '#5b2424', sail: '#f0e2d0', flag: '#f3e3b8', s: 1, masts: 3 }];
const shipZ = (i) => BASE[i][1] - S.t;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), l1 = new THREE.Vector3(), l2 = new THREE.Vector3();
function station(j, pos, look) {
  const x = BASE[j][0], z = shipZ(j), y = waveH(x, z, S.T) * 0.85, [a, d, h] = OFF[j];
  pos.set(x + Math.sin(a) * d, y + h, z + Math.cos(a) * d); look.set(x, y + 8, z - 3);
}

/* Camera: sits on ship i, then lifts off and flies to ship i+1 as the section changes. */
function Rig() {
  const size = useThree((s) => s.size);
  useFrame(({ camera }, dt) => {
    S.T += dt; TIME.value = S.T; const T = S.T, r = REDUCE ? 0 : 1;
    S.auto += REDUCE ? 0 : dt * SPEED; S.ps = damp(S.ps, S.p, 2.2, dt);
    const prev = S.t; S.t = S.auto + S.ps * TRAVEL; S.vel = damp(S.vel, (S.t - prev) / Math.max(dt, 1e-3), 4, dt);
    S.mx = damp(S.mx, REDUCE ? 0 : S.x, 2.5, dt); S.my = damp(S.my, REDUCE ? 0 : S.y, 2.5, dt);
    const f = clamp(S.ps * (NS - 1), 0, NS - 1), i = Math.min(NS - 2, Math.floor(f)), e = smoothstep(f - i, 0.18, 0.82);
    station(i, v1, l1); station(i + 1, v2, l2);
    camera.position.lerpVectors(v1, v2, e); camera.position.y += Math.sin(Math.PI * e) * 18;
    l1.lerp(l2, e);
    camera.position.x += S.mx * 2.4 + Math.sin(T * 0.2) * 1.2 * r; camera.position.y += S.my * 1.5 + Math.sin(T * 0.27) * 0.6 * r;
    const minY = waveH(camera.position.x, camera.position.z, T) + 3; if (camera.position.y < minY) camera.position.y = minY;
    camera.lookAt(l1); camera.rotation.z += Math.sin(T * 0.6) * 0.012 * r;
    camera.fov = 58 + clamp(S.vel * 0.12, 0, 8) + Math.sin(Math.PI * e) * 8;
    if (size.width > 800) camera.setViewOffset(size.width, size.height, -size.width * 0.12, 0, size.width, size.height); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    S.cx = camera.position.x; S.cy = camera.position.y; S.cz = camera.position.z;
  });
  return null;
}

/* Sky dome: gradient, sun disc + glow, and procedural volumetric-looking clouds. */
function Sky() {
  const { scene } = useThree(); const m = useRef();
  const u = useMemo(() => ({ uTop: { value: SKYC.top }, uHor: { value: SKYC.hor }, uSun: { value: SUN.dir }, uSunCol: { value: SUN.col }, uTime: TIME, uT: { value: 0 } }), []);
  useFrame(() => {
    skyAt(S.ps * 4); SUN.dir.set(-0.35, 0.42 - S.ps * 0.3, -1).normalize(); SUN.col.set('#fff1c0').lerp(q3, smoothstep(S.ps, 0.4, 1));
    if (scene.fog) scene.fog.color.copy(SKYC.hor); u.uT.value = S.t; m.current.position.set(S.cx, S.cy, S.cz);
  });
  return (
    <mesh ref={m} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[700, 32, 20]} />
      <shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={u}
        vertexShader="varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }"
        fragmentShader={`uniform vec3 uTop,uHor,uSun,uSunCol; uniform float uTime,uT; varying vec3 vD; ${NOISE_GLSL}
          void main(){ vec3 d=normalize(vD); vec3 c=mix(uHor,uTop,smoothstep(-.02,.7,d.y));
            float s=max(dot(d,uSun),0.); c+=uSunCol*(smoothstep(.9992,.9997,s)*3.+pow(s,60.)*.7+pow(s,6.)*.14);
            if(d.y>0.){ vec2 uv=d.xz/(d.y+.3)*1.6+vec2(uT*.0012,uTime*.004); float n=fbm(uv); float cl=smoothstep(.48,.8,n)*smoothstep(.02,.3,d.y);
              vec3 cc=mix(uHor,vec3(1.),.55)*(.82+.35*fbm(uv*3.+4.)); cc+=uSunCol*pow(s,8.)*.45; c=mix(c,cc,cl*.88); }
            gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>

          }`} />
    </mesh>
  );
}

function Lights() {
  const light = useMemo(() => new THREE.DirectionalLight('#fff', 2.6), []); const h = useRef();
  useFrame(() => {
    light.position.set(S.cx + SUN.dir.x * 120, SUN.dir.y * 120, S.cz + SUN.dir.z * 120); light.color.copy(SUN.col);
    light.target.position.set(S.cx, 0, S.cz); light.target.updateMatrixWorld(); h.current.color.copy(SKYC.top).lerp(SKYC.hor, 0.5);
  });
  return (<><primitive object={light} /><primitive object={light.target} /><hemisphereLight ref={h} args={['#cfe6ff', '#0a3a55', 1.0]} /></>);
}

/* Ocean: multi-wave displacement + analytic normals, ripples, Fresnel sky reflection, sun glitter, crest foam, depth tint. */
function Sea() {
  const ref = useRef(); const geo = useMemo(() => new THREE.PlaneGeometry(500, 500, 240, 240).rotateX(-Math.PI / 2), []);
  const u = useMemo(() => ({ uTime: TIME, uTop: { value: SKYC.top }, uHor: { value: SKYC.hor }, uSun: { value: SUN.dir }, uSunCol: { value: SUN.col }, uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() } }), []);
  useFrame(() => {
    const g = 500 / 240, k = 1 - smoothstep(S.ps, 0.6, 1) * 0.6;
    u.uDeep.value.copy(DEEP).multiplyScalar(k); u.uShallow.value.copy(SHAL).multiplyScalar(k);
    ref.current.position.set(Math.round(S.cx / g) * g, 0, Math.round(S.cz / g) * g);
  });
  return (
    <mesh ref={ref} frustumCulled={false}>
      <primitive object={geo} attach="geometry" />
      <shaderMaterial uniforms={u}
        vertexShader={`uniform float uTime; varying vec3 vW; varying float vH; varying vec3 vN; ${WAVE_GLSL}
          void main(){ vec4 w=modelMatrix*vec4(position,1.); float h=waveH(w.xz,uTime); vec2 g=waveG(w.xz,uTime);
            w.y+=h; vW=w.xyz; vH=h; vN=normalize(vec3(-g.x,1.,-g.y)); gl_Position=projectionMatrix*viewMatrix*w; }`}
        fragmentShader={`uniform vec3 uTop,uHor,uSun,uSunCol,uDeep,uShallow; uniform float uTime; varying vec3 vW; varying float vH; varying vec3 vN; ${NOISE_GLSL}
          void main(){
            vec3 V=normalize(cameraPosition-vW); float dist=length(cameraPosition-vW); vec2 q=vW.xz;
            vec2 rip=vec2(vnoise(q*1.3+vec2(uTime*.4,0.))-.5,vnoise(q*2.2-vec2(0.,uTime*.5))-.5)+vec2(vnoise(q*4.+uTime*.8)-.5,vnoise(q*4.1-uTime*.7)-.5)*.5;
            vec3 N=normalize(vN+vec3(rip.x,0.,rip.y)*.4/(1.+dist*.02));
            float fres=pow(1.-max(dot(N,V),0.),4.)*.95+.04;
            vec3 R=reflect(-V,N); R.y=abs(R.y);
            vec3 sky=mix(uHor,uTop,smoothstep(0.,.6,R.y)); float sl=max(dot(R,uSun),0.);
            sky+=uSunCol*(pow(sl,700.)*6.+pow(sl,45.)*.5);
            vec3 body=mix(uDeep,uShallow,smoothstep(-.8,1.1,vH)*.9+.1); body+=uShallow*smoothstep(.2,1.,vH)*.3;
            vec3 col=mix(body,sky,fres);
            float foam=smoothstep(.72,1.15,vH+(vnoise(q*2.4+uTime*.3)-.5)*.5); col=mix(col,vec3(.93,.97,1.),foam*.65);
            col=mix(col,uHor,smoothstep(40.,230.,dist));
            gl_FragColor=vec4(col,1.);
#include <colorspace_fragment>

          }`} />
    </mesh>
  );
}

/* ---------- ship assets (procedural, generated once) ---------- */
let TEX, HULL, DECK, WAKE;
function textures() {
  if (TEX) return TEX;
  const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const wood = mk(256, 256, (g, w, h) => { for (let y = 0; y < h; y += 16) { const l = 175 + Math.random() * 60; g.fillStyle = `rgb(${l},${(l * 0.92) | 0},${(l * 0.8) | 0})`; g.fillRect(0, y, w, 16);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, y, w, 2); for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(60,30,10,.14)'; g.fillRect(Math.random() * w, y + Math.random() * 14, 40 + Math.random() * 80, 1); } } });
  const sail = mk(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#e2d3b0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,100,60,.28)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(120,90,50,${Math.random() * 0.07})`; g.fillRect(Math.random() * w, Math.random() * h, 30, 30); } });
  return (TEX = { wood, sail });
}
const halfW = (t) => lerp(3.6 * Math.pow(Math.max(Math.sin(Math.PI * Math.pow(t, 0.75)), 0), 0.5), 2.2, smoothstep(t, 0.82, 1));
function hullGeo() {
  if (HULL) return HULL;
  const M = 28, K = 7, len = 22, pos = [], uv = [], idx = [];
  for (let side = 0; side < 2; side++) { const sg = side ? -1 : 1;
    for (let m = 0; m <= M; m++) { const t = m / M, z = -11 + t * len, w = halfW(t), keel = -1.8 + 1.4 * Math.pow(Math.abs(t - 0.5) * 2, 2.2), deck = 2.5 + 1.3 * Math.pow(Math.abs(t - 0.42) * 2, 2);
      for (let j = 0; j <= K; j++) { const s = j / K, a = s * Math.PI / 2; pos.push(sg * w * Math.sin(a), keel + (deck - keel) * (1 - Math.cos(a)), z); uv.push(t * 5, s * 1.6 + side * 1.6); } } }
  const row = K + 1, per = (M + 1) * row;
  for (let side = 0; side < 2; side++) for (let m = 0; m < M; m++) for (let j = 0; j < K; j++) { const a = side * per + m * row + j, b = a + row, c = b + 1, d = a + 1; if (side) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return (HULL = g);
}
function deckGeo() {
  if (DECK) return DECK;
  const sh = new THREE.Shape(), N = 20;
  for (let m = 0; m <= N; m++) { const t = m / N; const x = halfW(t) * 0.93, z = -11 + t * 22; m ? sh.lineTo(x, z) : sh.moveTo(x, z); }
  for (let m = N; m >= 0; m--) { const t = m / N; sh.lineTo(-halfW(t) * 0.93, -11 + t * 22); }
  return (DECK = new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2));
}
const wakeGeo = () => (WAKE = WAKE || new THREE.PlaneGeometry(10, 46, 10, 46).rotateX(-Math.PI / 2));
function sailGeo(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 10, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5, v = p.getY(i) / h + 0.5; p.setZ(i, -Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.12 + v * 0.76)) * w * 0.16); }
  g.computeVertexNormals(); return g;
}
const MASTS = { 3: [{ z: -4.8, h: 14 }, { z: 0.8, h: 19 }, { z: 6.6, h: 12 }], 2: [{ z: -3, h: 15 }, { z: 4, h: 19 }] };
const DS = THREE.DoubleSide;

function Ship({ i }) {
  const c = CFG[i], g = useRef(), flag = useRef(), T = useMemo(textures, []), hull = useMemo(hullGeo, []), deck = useMemo(deckGeo, []), wg = useMemo(wakeGeo, []);
  const masts = MASTS[c.masts];
  const sails = useMemo(() => masts.flatMap((m) => { const lw = 0.36 * m.h + 1.2, lh = 0.38 * m.h, uw = 0.26 * m.h + 1, uh = 0.26 * m.h, y2 = 3.6 + lh + 0.35;
    return [{ z: m.z, w: lw, y: 3.6 + lh / 2, g: sailGeo(lw, lh) }, { z: m.z, w: uw, y: y2 + uh / 2, g: sailGeo(uw, uh) }]; }), [masts]);
  const rig = useMemo(() => { const p = []; masts.forEach((m) => p.push(new THREE.Vector3(0, m.h, m.z), new THREE.Vector3(0, 5.5, -14.2), new THREE.Vector3(0, m.h, m.z), new THREE.Vector3(0, 3.6, 11))); return new THREE.BufferGeometry().setFromPoints(p); }, [masts]);
  useFrame(() => {
    const x = BASE[i][0], z = shipZ(i), s = c.s, t = S.T;
    const h = waveH(x, z, t), hb = waveH(x, z - 11 * s, t), hs = waveH(x, z + 11 * s, t), hl = waveH(x - 3 * s, z, t), hr = waveH(x + 3 * s, z, t);
    g.current.position.set(x, h * 0.85 - 0.2, z);
    g.current.rotation.set(Math.atan2(hb - hs, 22 * s) * 0.9, 0, Math.atan2(hr - hl, 6 * s) * 0.9);
    flag.current.rotation.y = Math.sin(t * 3 + i) * 0.45;
  });
  const wood = <meshStandardMaterial map={T.wood} color={c.hull} roughness={0.85} side={DS} />;
  const sailMat = <meshStandardMaterial map={T.sail} color={c.sail} roughness={1} side={DS} />;
  return (
    <group ref={g} scale={c.s}>
      <mesh geometry={hull}>{wood}</mesh>
      <mesh geometry={deck} position={[0, 2.6, 0]}><meshStandardMaterial map={T.wood} color="#b08a5a" roughness={0.9} side={DS} /></mesh>
      <mesh position={[0, 3.9, 7.6]}>{<boxGeometry args={[4.3, 2.6, 5.6]} />}{wood}</mesh>
      <mesh position={[0, 3.4, -7.2]}><boxGeometry args={[3.5, 1.6, 3.4]} />{wood}</mesh>
      {[-1.4, 0, 1.4].map((x) => <mesh key={x} position={[x, 4.1, 10.45]}><boxGeometry args={[0.7, 0.6, 0.1]} /><meshStandardMaterial color="#ffb347" emissive="#ffb347" emissiveIntensity={1.8} /></mesh>)}
      <mesh position={[0, 3.7, -13.3]} rotation={[Math.PI / 2 + 0.28, 0, 0]}><cylinderGeometry args={[0.16, 0.22, 6.4, 6]} /><meshStandardMaterial color="#4a2f18" /></mesh>
      {masts.map((m) => (<group key={m.z}>
        <mesh position={[0, m.h / 2 + 2.5, m.z]}><cylinderGeometry args={[0.14, 0.26, m.h, 8]} /><meshStandardMaterial color="#4a2f18" roughness={0.9} /></mesh>
        <mesh position={[0, 3.6 + 0.38 * m.h, m.z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.36 * m.h + 1.6, 6]} /><meshStandardMaterial color="#4a2f18" /></mesh>
      </group>))}
      {sails.map((s, k) => <mesh key={k} geometry={s.g} position={[0, s.y, s.z + 0.2]}>{sailMat}</mesh>)}
      <group ref={flag} position={[0, MASTS[c.masts][1].h + 3, MASTS[c.masts][1].z]}><mesh position={[0.9, 0, 0]}><planeGeometry args={[1.8, 0.9]} /><meshBasicMaterial color={c.flag} side={DS} /></mesh></group>
      <lineSegments geometry={rig}><lineBasicMaterial color="#1b110a" /></lineSegments>
      <mesh position={[0, 0, 34]} frustumCulled={false} renderOrder={2}>
        <primitive object={wg} attach="geometry" />
        <shaderMaterial transparent depthWrite={false} uniforms={{ uTime: TIME }}
          vertexShader={`uniform float uTime; varying vec2 vUv; ${WAVE_GLSL} void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); w.y=waveH(w.xz,uTime)+.4; gl_Position=projectionMatrix*viewMatrix*w; }`}
          fragmentShader={`uniform float uTime; varying vec2 vUv; ${NOISE_GLSL}
            void main(){ float v=1.-vUv.y, x=abs(vUv.x*2.-1.), wd=.25+v*.75; float core=smoothstep(wd,wd*.25,x);
              float st=vnoise(vec2(vUv.x*14.,v*18.-uTime*1.5))*.6+vnoise(vec2(vUv.x*30.,v*40.-uTime*2.))*.4;
              float a=core*(1.-v)*smoothstep(.15,.65,st+core*.35); a+=smoothstep(.12,0.,v)*smoothstep(1.,.3,x)*.6;
              gl_FragColor=vec4(.95,.98,1.,a*.85);
#include <colorspace_fragment>
 }`} />
      </mesh>
    </group>
  );
}

/* Distant rocky islands, recycled around the camera so the sea never ends. */
const ISL = Array.from({ length: 8 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (80 + rnd(i, 1) * 70), z: -(i * 55 + rnd(i, 2) * 30), s: 0.9 + rnd(i, 3) * 1.1 }));
function rockGeo(i) {
  const g = new THREE.IcosahedronGeometry(14, 3), p = g.attributes.position, v = new THREE.Vector3();
  for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); v.multiplyScalar(1 + 0.25 * Math.sin(v.x * 0.5 + i * 3.1) * Math.cos(v.z * 0.45 + i) + 0.12 * Math.sin(v.y * 0.9 + v.x * 0.3)); v.y *= 1.25; p.setXYZ(k, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function Island({ o, i }) {
  const g = useRef(), geo = useMemo(() => rockGeo(i), [i]);
  useFrame(() => { const L = 440; g.current.position.set(o.x, -3, o.z + L * Math.round((S.cz - o.z) / L)); });
  return (
    <group ref={g} scale={o.s}>
      <mesh geometry={geo} scale={[1.4, 0.9, 1.2]}><meshStandardMaterial color="#5b5a55" flatShading roughness={1} /></mesh>
      <mesh geometry={geo} position={[0, 4.5, 0]} scale={[1.05, 0.55, 0.95]}><meshStandardMaterial color="#3d7a45" flatShading roughness={1} /></mesh>
    </group>
  );
}

export default function World() {
  return (
    <Canvas flat camera={{ position: [0, 10, 30], fov: 58, near: 0.5, far: 900 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
      <fog attach="fog" args={['#ffd9a0', 90, 520]} />
      <Rig /><Sky /><Lights /><Sea />
      {CFG.map((_, i) => <Ship key={i} i={i} />)}
      {ISL.map((o, i) => <Island key={i} o={o} i={i} />)}
    </Canvas>
  );
}
