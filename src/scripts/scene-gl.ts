// Единая 3D-сцена за всеми экранами (ТЗ — docs/СЦЕНА-3D-ТЗ.md): одно полотно WebGL, латунные частицы
// перетекают из фигуры в фигуру по номеру экрана: ключ → панели → сфера → путь → кольца замка → скважина.
// Чистый WebGL без библиотек. Пульт сцены — одно плавное число p (0…5).

type V3 = [number, number, number];
const TAU = Math.PI * 2;

// ---------- фигуры: N точек в пространстве примерно [-1.2, 1.2] ----------
function shapes(N: number): Float32Array[] {
  const R = Math.random;
  const pick = (parts: [number, () => V3][]) => {      // доля точек на каждую часть фигуры
    const tot = parts.reduce((s, p) => s + p[0], 0), out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let r = R() * tot, k = 0; while (r > parts[k][0] && k < parts.length - 1) { r -= parts[k][0]; k++; }
      const v = parts[k][1](); out.set(v, i * 3);
    }
    return out;
  };
  const ring = (cx: number, cy: number, r: number, th: number, zTh = th): V3 => {
    const a = R() * TAU, rr = r + (R() - 0.5) * th; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (R() - 0.5) * zTh];
  };
  const box = (x0: number, x1: number, y0: number, y1: number, z: number): V3 => [x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), (R() - 0.5) * z];
  // 1. ключ
  const key = pick([
    [5, () => ring(-0.72, 0, 0.36, 0.13, 0.12)],
    [5, () => box(-0.36, 1.12, -0.05, 0.05, 0.1)],
    [1, () => box(0.62, 0.72, -0.3, -0.05, 0.08)], [1, () => box(0.82, 0.9, -0.22, -0.05, 0.08)], [1, () => box(1.0, 1.1, -0.34, -0.05, 0.08)],
  ]);
  // 2. четыре панели по дуге (края плотнее)
  const panel = (k: number): V3 => {
    const x0 = -1.05 + k * 0.56, w = 0.46, h = 1.2;
    const edge = R() < 0.45; let u = R(), v = R();
    if (edge) { if (R() < 0.5) u = R() < 0.5 ? 0 : 1; else v = R() < 0.5 ? 0 : 1; }
    const x = x0 + u * w, y = -h / 2 + v * h; return [x, y, -0.35 * x * x + (R() - 0.5) * 0.03];
  };
  const panels = pick([0, 1, 2, 3].map((k) => [1, () => panel(k)] as [number, () => V3]));
  // 3. сфера-сеть: точки на сфере + меридианы
  const sphere = pick([
    [6, () => { const u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u); return [Math.cos(a) * s * 0.95, u * 0.95, Math.sin(a) * s * 0.95]; }],
    [3, () => { const m = Math.floor(R() * 6) / 6 * Math.PI, t = R() * TAU; return [Math.cos(t) * Math.cos(m) * 0.95, Math.sin(t) * 0.95, Math.cos(t) * Math.sin(m) * 0.95]; }],
    [1, () => { const r = R() * 0.25, u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u); return [Math.cos(a) * s * r, u * r, Math.sin(a) * s * r]; }],
  ]);
  // 4. путь с пятью узлами
  const pathY = (x: number) => Math.sin(x * 2.4) * 0.18;
  const path = pick([
    [4, () => { const x = -1.15 + R() * 2.3; return [x, pathY(x) + (R() - 0.5) * 0.04, (R() - 0.5) * 0.06]; }],
    [5, () => { const k = Math.floor(R() * 5), x = -1 + k * 0.5; return ring(x, pathY(x), 0.11, 0.05, 0.05); }],
  ]);
  // 5. три кольца кодового замка с наклоном
  const tilt = (v: V3, ax: number, ay: number): V3 => {
    let [x, y, z] = v; const cy = Math.cos(ay), sy = Math.sin(ay); [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    const cx = Math.cos(ax), sx = Math.sin(ax); [y, z] = [y * cx - z * sx, y * sx + z * cx]; return [x, y, z];
  };
  const rings = pick([
    [2, () => tilt(ring(0, 0, 0.42, 0.05, 0.06), 0.5, 0.2)],
    [3, () => tilt(ring(0, 0, 0.7, 0.05, 0.06), -0.35, 0.5)],
    [4, () => tilt(ring(0, 0, 0.98, 0.05, 0.06), 0.15, -0.4)],
  ]);
  // 6. замочная скважина (силуэт с толщиной) + ореол
  const keyhole = pick([
    [5, () => { const a = R() * TAU, r = Math.sqrt(R()) * 0.42; return [Math.cos(a) * r, 0.32 + Math.sin(a) * r, (R() - 0.5) * 0.12]; }],
    [5, () => { const v = R(), y = 0.05 - v * 0.95, hw = 0.13 + v * 0.17; return [(R() * 2 - 1) * hw, y, (R() - 0.5) * 0.12]; }],
    [2, () => { const a = R() * TAU, r = 0.75 + R() * 0.55; return [Math.cos(a) * r, 0.05 + Math.sin(a) * r * 0.9, (R() - 0.5) * 0.5]; }],
  ]);
  return [key, panels, sphere, path, rings, keyhole];
}

// Позиция и масштаб фигуры на каждом экране: [x, y, масштаб, яркость] — компьютер / телефон. Фигура не спорит с текстом.
const PLACE_D: number[][] = [[0.12, -0.02, 1.15, 0.34], [0, 0, 1.3, 0.3], [0.6, -0.05, 0.8, 0.42], [0, 0.04, 1.08, 0.5], [0.53, 0.05, 0.52, 0.8], [0.02, 0.02, 1.1, 0.55]];
const PLACE_M: number[][] = [[0, 0.42, 0.72, 0.35], [0, 0, 1.1, 0.28], [0, 0.4, 0.62, 0.4], [-0.86, -0.12, 0.6, 0.5], [0, 0.5, 0.5, 0.5], [0, 0.3, 0.8, 0.4]];

const VS = `
attribute vec3 a0,a1,a2,a3,a4,a5; attribute vec4 aR;
uniform float uP,uT,uAsp,uSz,uRm,uPulse,uRep,uVert; uniform vec2 uM,uMp; uniform vec4 uPl;
varying float vA,vDepth,vSpark;
float w(float k){return clamp(1.-abs(uP-k),0.,1.);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
void main(){
  float live=1.-uRm, dust=step(aR.w,.001);                          // dust: дальний слой пыли (не перетекает, плывёт сзади)
  // жизнь внутри фигур: кольца замка крутятся с разной скоростью, ореол скважины кружит
  vec3 b4=a4; b4.xy=rot(uT*.32*(1.35-length(a4))*live)*b4.xy;
  vec3 b5=a5; float h5=step(.72,length(a5.xy-vec2(0.,.05))); b5.xy=rot(uT*.07*h5*live)*b5.xy;
  vec3 b3=mix(a3,vec3(-a3.y,-a3.x,a3.z),uVert);                    // телефон: путь процесса вертикально, вдоль стержня ключа
  vec3 p=a0*w(0.)+a1*w(1.)+a2*w(2.)+b3*w(3.)+b4*w(4.)+b5*w(5.);
  float f=fract(uP), s=sin(f*3.14159)*live*(1.-dust);               // разлёт в середине перехода
  vec3 dir=normalize(aR.xyz*2.-1.+1e-4);
  p+=dir*s*(.35+aR.w*.6)+vec3(sin(uT*.6+aR.x*20.),cos(uT*.5+aR.y*20.),sin(uT*.4+aR.z*20.))*(.012+s*.05+dust*.05);
  // в покое фигура смотрит на зрителя (лёгкое покачивание), между экранами — разворот на пол-оборота; пыль поворачивается медленнее (глубина)
  float ay=(sin(uT*.25)*.35+sin(f*3.14159)*1.6)*live*(1.-dust*.7)+uM.x*(.35-dust*.2), ax=.12+uM.y*(.22-dust*.12)+sin(f*3.14159)*.35*(1.-dust);
  p.xz=rot(ay)*p.xz; p.yz=rot(ax)*p.yz;
  p*=uPl.z*(1.+uPulse*.07*(.4+aR.w))*(1.+s*.55);                  // пролёт камеры: в середине перехода летим сквозь облако                               // «вдох» сцены на событие (оффер, замок, заявка)
  float d=3.2-p.z;
  vec2 q=p.xy*2.2/d; q.x/=uAsp; q+=uPl.xy*(1.-dust*.6);
  // частицы расступаются вокруг курсора/пальца и светлеют рядом с ним
  vec2 dd=q-uMp; dd.x*=uAsp; float near=exp(-dot(dd,dd)*12.)*uRep*(1.-dust);
  vec2 push=normalize(dd+1e-5)*.14*near; push.x/=uAsp; q+=push;
  gl_Position=vec4(q,0.,1.);
  // свет внутри фигур: волна по панелям, импульсы по сфере, искра бежит по пути процесса
  float spark=fract(uT*.22)*2.6-1.3;
  float glow=w(1.)*(.5+.5*sin(a1.x*5.-uT*2.2))*.55
            +w(2.)*pow(.5+.5*sin(a2.y*9.-uT*1.8),3.)*.8
            +w(3.)*exp(-pow(a3.x-spark,2.)*40.)*2.2;
  float big=step(.985,aR.w);                                        // редкие крупные искры — блики на металле
  gl_PointSize=uSz*(.55+aR.w*.9+big*1.6)*(3.2/d)*(1.-dust*.45);
  vDepth=clamp((p.z+1.2)/2.4,0.,1.)*(1.-dust*.6);
  vSpark=clamp(big+glow*.5,0.,1.);
  vA=uPl.w*(1.+near*.9+uPulse*.7+glow)*(1.-dust*.55)*live+uPl.w*uRm*(1.-dust*.55);
}`;
const FS = `
precision mediump float; uniform vec3 uCol; uniform float uDark; varying float vA,vDepth,vSpark;
void main(){ vec2 c=gl_PointCoord-.5; float r=length(c); if(r>.5) discard;
  float a=smoothstep(.5,.0,r)*vA*(.35+vDepth*.65);
  vec3 hot=mix(vec3(1.,.9,.68),uCol,uDark);                          // искры светлее латуни (на жёлтом фоне — нет)
  gl_FragColor=vec4(mix(uCol*mix(.75,1.25,vDepth),hot,vSpark*(1.-uDark)),a*mix(.85,.9,uDark)); }`;

export function initScene(canvas: HTMLCanvasElement, deck: HTMLElement) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', premultipliedAlpha: false });
  if (!gl) return;
  const root = document.documentElement;
  const phone = innerWidth <= 900;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  const N = phone || mem < 4 ? 6000 : 13000;
  const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const buf = (name: string, data: Float32Array, size: number) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const l = gl.getAttribLocation(pr, name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
  };
  const rnd = new Float32Array(N * 4); for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
  const sets = shapes(N);
  for (let i = 0; i < N; i++) {                                    // 11% — дальняя пыль: одна точка во всех фигурах, aR.w = 0
    if (rnd[i * 4 + 3] > 0.11) { if (rnd[i * 4 + 3] < 0.12) rnd[i * 4 + 3] = 0.12; continue; }
    rnd[i * 4 + 3] = 0;
    const x = (Math.random() * 2 - 1) * 2.6, y = (Math.random() * 2 - 1) * 1.6, z = -0.6 - Math.random() * 1.6;
    sets.forEach((sh) => sh.set([x, y, z], i * 3));
  }
  sets.forEach((sh, k) => buf('a' + k, sh, 3));
  buf('aR', rnd, 4);
  const U = (n: string) => gl.getUniformLocation(pr, n);
  const uPulse = U('uPulse'), uRep = U('uRep'), uMp = U('uMp');
  gl.uniform1f(U('uVert'), phone ? 1 : 0);
  const uP = U('uP'), uT = U('uT'), uAsp = U('uAsp'), uSz = U('uSz'), uM = U('uM'), uPl = U('uPl'), uCol = U('uCol'), uDark = U('uDark'), uRm = U('uRm');
  gl.uniform1f(uRm, reduce ? 1 : 0);
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
  let dpr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 1.75), count = N, probe = 0, slow = 0;
  const size = () => { canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr); gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform1f(uAsp, innerWidth / innerHeight); gl.uniform1f(uSz, (phone ? 2.2 : 2.6) * dpr); };
  size(); addEventListener('resize', size);
  const last = 5;
  let target = +(deck.dataset.i || 0), p = target, v = 0, mx = 0, my = 0, tmx = 0, tmy = 0, raf = 0, t0 = performance.now();
  let pulse = 0, rep = 0, repT = 0, px = 2, py = 2, drag = 0, dragT = 0;
  // события сайта → «вдох» сцены; свайп на телефоне → фигура начинает перетекать под пальцем
  addEventListener('scene:pulse', (e) => { pulse = Math.min(1.6, pulse + ((e as CustomEvent).detail ?? 0.6)); wake(); });
  addEventListener('scene:drag', (e) => { dragT = (e as CustomEvent).detail ?? 0; wake(); });
  const pointAt = (x: number, y: number) => { px = x / innerWidth * 2 - 1; py = -(y / innerHeight * 2 - 1); repT = 1; wake(); };
  addEventListener('pointermove', (e) => pointAt(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', (e) => pointAt(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  addEventListener('touchend', () => { repT = 0; }, { passive: true });
  document.addEventListener('mouseleave', () => { repT = 0; });
  new MutationObserver(() => { target = +(deck.dataset.i || 0); wake(); }).observe(deck, { attributes: true, attributeFilter: ['data-i'] });
  if (!phone) addEventListener('pointermove', (e) => { tmx = e.clientX / innerWidth * 2 - 1; tmy = e.clientY / innerHeight * 2 - 1; wake(); }, { passive: true });
  const place = (x: number) => {                                   // позиция/масштаб/яркость между экранами
    const T = phone ? PLACE_M : PLACE_D, a = Math.max(0, Math.min(last, Math.floor(x))), b = Math.min(last, a + 1), f = x - a;
    const e = f * f * (3 - 2 * f); return T[a].map((va, k) => va + (T[b][k] - va) * e);
  };
  const BG0 = [0.043, 0.047, 0.055], BG1 = [0.91, 0.69, 0.294], C1 = [0.1, 0.07, 0.02];
  // свой оттенок латуни на каждом экране: тёплый ключ, светлое золото кейсов, медь команды, чистая латунь процесса, янтарь замка
  const TINT = [[0.91, 0.69, 0.29], [0.96, 0.82, 0.52], [0.93, 0.58, 0.3], [0.91, 0.72, 0.36], [1, 0.66, 0.22], [0.91, 0.69, 0.29]];
  const frame = (now: number) => {
    raf = 0;
    if (root.classList.contains('trailer-on') && !root.classList.contains('trailer-out')) { t0 = now; raf = requestAnimationFrame(frame); return; }   // идёт трейлер — сцену за ним не рисуем
    // пружина к целевому экрану (~1,4 с), без перелёта
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2); v = (target - p) * k; p += v;
    if (Math.abs(target - p) < 0.0005) p = target;
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
    pulse *= Math.exp(-dt * 2.2); rep += (repT - rep) * (1 - Math.exp(-dt * 6)); repT *= Math.exp(-dt * 0.45);
    drag += (dragT - drag) * (1 - Math.exp(-dt * 12));
    const pe = Math.max(0, Math.min(last, p + drag));
    const dark = Math.max(0, Math.min(1, pe - (last - 1)));            // последний экран: фон латунный, частицы тёмные
    const ta = Math.floor(pe), tb = Math.min(last, ta + 1), tf = pe - ta;
    const C0 = TINT[ta].map((c, i) => c + (TINT[tb][i] - c) * tf);
    const bg = BG0.map((c, i) => c + (BG1[i] - c) * dark), col = C0.map((c, i) => c + (C1[i] - c) * dark);
    gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (dark > 0.5) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniform1f(uP, pe); gl.uniform1f(uT, now / 1000); gl.uniform2f(uM, mx, my);
    gl.uniform1f(uPulse, pulse); gl.uniform1f(uRep, rep); gl.uniform2f(uMp, px, py);
    gl.uniform4fv(uPl, place(pe)); gl.uniform3fv(uCol, col); gl.uniform1f(uDark, dark);
    // защита скорости: если кадр дольше ~22 мс (меньше 45 кадров/с), рисуем вдвое меньше частиц и снижаем плотность пикселей
    if (probe < 90 && dt > 0) { probe++; slow += dt > 0.022 ? 1 : 0; if (probe === 90 && slow > 30) { count = Math.floor(N / 2); dpr = 1; size(); } }
    gl.drawArrays(gl.POINTS, 0, count);
    if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', wake);
  root.classList.add('gl-on');
  wake();
}
