// Киносцена трейлера: 3D-ключ и замок из дымчатого стекла, снятые «камерой» в реальном времени (WebGL2, без библиотек и видео).
// Кадры: макро медальона → проезд вдоль зубцов → вход в замок (штифты едут по зубцам) → пять ячеек зажигаются → поворот → ключ-знак.
// Секунды те же, что в global.css (раздел ТРЕЙЛЕР) и playTrailerScore (feel.ts): менять вместе.
// Нет WebGL2 — startKeyFilm вернёт null, и трейлер покажет прежнюю SVG-схему.

type V = [number, number, number];
type Mesh = { vao: WebGLVertexArrayObject; n: number };
type Key = [number, V, V];                                           // секунда, позиция камеры, куда смотрит
export type KeyFilm = { stop: () => void; draw: (t: number) => void };

const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, f: number) => a + (b - a) * f;
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V): V => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------- матрицы (по столбцам) ----------
type M = number[];
const mul = (a: M, b: M): M => { const o: M = []; for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const tr = (x: number, y: number, z: number): M => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const sc = (x: number, y: number, z: number): M => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
const rx = (a: number): M => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
const rz = (a: number): M => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
const ry = (a: number): M => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
const persp = (fov: number, asp: number, n: number, f: number, oy: number): M => { const k = 1 / Math.tan(fov / 2); return [k / asp, 0, 0, 0, 0, k, 0, 0, 0, -oy, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
const look = (e: V, c: V): M => { const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; };

// ---------- геометрия: поверхность по сечениям ----------
// Грани с изломом больше ~38° остаются острыми (фаска держит блик), остальные сглаживаются.
function loft(loops: V[][], closeU = true, closeV = false): number[] {
  const R = loops.length, C = loops[0].length, rn = closeV ? R : R - 1, cn = closeU ? C : C - 1;
  const at = (r: number, c: number) => loops[(r + R) % R][(c + C) % C];
  const fn: V[][] = [];
  for (let r = 0; r < rn; r++) { fn[r] = []; for (let c = 0; c < cn; c++) fn[r][c] = norm(cross(sub(at(r + 1, c + 1), at(r, c)), sub(at(r + 1, c), at(r, c + 1)))); }
  const out: number[] = [];
  const vn = (r: number, c: number, vr: number, vc: number): V => {
    const me = fn[r][c]; let s: V = [0, 0, 0];
    for (const a of [vr - 1, vr]) for (const b of [vc - 1, vc]) {
      const rr = closeV ? (a + rn) % rn : a, cc = closeU ? (b + cn) % cn : b;
      const f = fn[rr]?.[cc]; if (f && dot(f, me) > 0.78) s = [s[0] + f[0], s[1] + f[1], s[2] + f[2]];
    }
    return norm(dot(s, s) ? s : me);
  };
  for (let r = 0; r < rn; r++) for (let c = 0; c < cn; c++) {
    const q = [[r, c], [r + 1, c], [r + 1, c + 1], [r, c + 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { const [a, b] = q[k]; out.push(...at(a, b), ...vn(r, c, a, b)); }
  }
  return out;
}
const circ = (n: number, f: (a: number) => V): V[] => Array.from({ length: n }, (_, i) => f(i / n * TAU));
const latheX = (p: [number, number][], n = 48) => loft(p.map(([x, r]) => circ(n, (a) => [x, Math.cos(a) * r, Math.sin(a) * r])));
const latheY = (p: [number, number][], n = 28) => loft(p.map(([y, r]) => circ(n, (a) => [Math.sin(a) * r, y, Math.cos(a) * r])));
const torus = (cx: number, R: number, r: number, z: number, n = 88, m = 14) =>
  loft(circ(n, (a) => [a, 0, 0]).map(([a]) => circ(m, (b) => [cx + Math.cos(a) * (R + Math.cos(b) * r), Math.sin(a) * (R + Math.cos(b) * r), z + Math.sin(b) * r])), true, true);

// ---------- размеры механизма ----------
const PX = [-1.7, -0.9, -0.1, 0.7, 1.5];                              // штифты вдоль оси замка
const CUT = [0.1, -0.1, 0.18, -0.04, 0.13];                           // глубина выреза под каждый штифт
const SHEAR = 0.62, BLADE0 = -2.7, BLADE1 = 2.4, BOW = -4.25;
const bladeTop = (x: number) => {
  let y = 0.32; PX.forEach((p, k) => { y = Math.min(y, CUT[k] + Math.max(0, Math.abs(x - p) - 0.1) * 1.35); });
  return Math.min(y, (BLADE1 - x) * 1.1 - 0.24);
};
const bladeBot = (x: number) => Math.max(-0.42, -0.24 - (BLADE1 - x) * 0.5);

function keyMesh(): number[] {
  const o: number[] = [], add = (m: number[]) => { for (let i = 0; i < m.length; i++) o.push(m[i]); };
  // лезвие: сечение с фаской, высота по профилю вырезов
  const xs: number[] = []; for (let x = BLADE0; x <= BLADE1 + 1e-6; x += 0.025) xs.push(x);
  add(loft(xs.map((x) => {
    const t = bladeTop(x), b = bladeBot(x), th = 0.105 * clamp((BLADE1 - x) * 4 + 0.25), bv = Math.min(0.035, (t - b) * 0.3);
    return [[x, t, th - bv], [x, t - bv, th], [x, b + bv, th], [x, b, th - bv], [x, b, -th + bv], [x, b + bv, -th], [x, t - bv, -th], [x, t, -th + bv]] as V[];
  })));
  // шейка: точёные кольца
  add(latheX([[-3.2, 0.02], [-3.2, 0.2], [-3.12, 0.27], [-3.04, 0.27], [-3.0, 0.21], [-2.96, 0.21], [-2.92, 0.38], [-2.86, 0.45], [-2.74, 0.45], [-2.68, 0.38], [-2.66, 0.3], [-2.6, 0.3], [-2.56, 0.02]], 56));
  // медальон с прорезью-скважиной: внешний круг → фаски → внутренний контур
  const N = 96, hole = (a: number): [number, number] => {              // контур скважины: круг + трапеция (повёрнута вдоль ключа)
    const c = Math.cos(a), s = Math.sin(a);
    let r = 0.27 / 1;                                                  // круг
    const L = 0.62;                                                    // «юбка» в сторону лезвия
    if (c > 0.15) { const w = (x: number) => 0.13 + x * 0.16; let best = r; for (let q = 0; q <= 60; q++) { const x = q / 60 * L; if (Math.abs(c * best) <= L && Math.abs(s) * x / Math.max(c, 1e-3) <= w(x)) best = Math.max(best, x / c); } r = Math.max(r, Math.min(best, L / c)); }
    return [c * r - 0.12, s * r];
  };
  const out = (R: number, z: number) => circ(N, (a) => [BOW + Math.cos(a) * R, Math.sin(a) * R, z]);
  const inn = (g: number, z: number) => circ(N, (a) => { const [x, y] = hole(a), l = Math.hypot(x + 0.12, y) || 1; return [BOW + x + (x + 0.12) / l * g, y + y / l * g, z]; });
  const T = 0.13;
  add(loft([out(1.0, -T), out(1.06, -T + 0.06), out(1.06, T - 0.06), out(1.0, T), out(0.9, T), out(0.86, T - 0.05), out(0.62, T - 0.05), inn(0.13, T - 0.05), inn(0.11, T), inn(0.05, T), inn(0, T - 0.05),
    inn(0, -T + 0.05), inn(0.05, -T), inn(0.11, -T), inn(0.13, -T + 0.05), out(0.62, -T + 0.05), out(0.86, -T + 0.05), out(0.9, -T)], true, true));
  add(torus(BOW, 1.08, 0.085, 0));
  add(torus(BOW, 0.76, 0.02, T - 0.045, 88, 8));
  return o;
}

// ---------- шейдеры ----------
const MESH_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; uniform mat4 uVP,uM; out vec3 vN,vW,vL;
void main(){ vec4 w=uM*vec4(aP,1.); vW=w.xyz; vN=mat3(uM)*aN; vL=aP; gl_Position=uVP*w; }`;
const MESH_FS = `#version 300 es
precision highp float; in vec3 vN,vW,vL; out vec4 o;
uniform vec3 uEye,uAlb,uAt; uniform float uKind,uRough,uSweep,uGlow,uVis;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
// студия: большой верхний софтбокс, два боковых полосовых, тёплый отскок снизу и «проезжающий» свет
vec3 env(vec3 r,float k){
  float s=mix(.05,.5,k); vec3 c=vec3(.012,.014,.02)+vec3(.05,.05,.06)*smoothstep(-.3,.9,r.y);
  if(r.y>.02){ vec2 p=r.xz/r.y; c+=vec3(3.,2.75,2.4)*smoothstep(1.7+s,1.7-s,abs(p.x))*smoothstep(.75+s,.75-s,abs(p.y-.55))*smoothstep(.02,.4,r.y); }
  float lon=atan(r.x,r.z), v=smoothstep(.85+s*.4,.85-s*.4,abs(r.y));
  c+=vec3(1.5,1.8,2.3)*smoothstep(.2+s*.5,.2-s*.5,abs(lon-1.25))*v;
  c+=vec3(2.6,1.9,1.1)*smoothstep(.12+s*.5,.12-s*.5,abs(lon+1.45))*v;
  c+=vec3(.5,.3,.12)*smoothstep(0.,-1.,r.y)*.5+vec3(.34,.3,.26)*smoothstep(.15,.62,r.y)*max(r.z,0.);
  float q=(r.x*.75+r.y*.45-uSweep)/(.09+k*.2); c+=vec3(1.7,1.25,.72)*exp(-q*q);
  return c; }
void main(){
  vec3 V=normalize(uEye-vW), N=normalize(vN); if(dot(N,V)<0.) N=-N;
  float nv=max(dot(N,V),0.); vec3 col;
  if(uKind<.5){
    float br=ns(vL.xy*vec2(6.,120.))+ns(vL.xz*vec2(9.,140.))-1.; float gr=1.;
    if(uGlow<-.5){                                                     // ключ: фрезерованная канавка вдоль лезвия и пескоструй в углублении медальона
      float face=step(.75,abs(normalize(vN).z*1.));
      float d=abs(vL.y+.16); float blade=step(-2.55,vL.x)*step(vL.x,2.05)*face;
      gr=mix(1.,mix(.28,1.,smoothstep(.045,.075,d)),blade); N=normalize(N+vec3(0.,(vL.y+.16)*9.*blade*smoothstep(.085,.05,d),0.));
      float rr=length(vL.xy-vec2(-4.25,0.)); float field=step(rr,.85)*step(.4,rr)*face;
      N=normalize(N+field*.06*vec3(ns(vL.xy*64.)-.5,ns(vL.xy*64.+31.)-.5,0.)); br=mix(br,0.,field);
    }
    N=normalize(N+vec3(0.,br,br)*.022);
    vec3 R=normalize(reflect(-V,N)+clamp((vW-uAt)*vec3(.2,.34,.2),-.42,.42)), F=uAlb+(1.-uAlb)*pow(1.-nv,5.);
    col=env(R,uRough)*F*gr+uAlb*uAlb*(.012+.03*max(N.y,0.))*gr+uAlb*max(uGlow,0.);
  } else if(uKind<1.5){                                                // дымчатое стекло: видна кромка и отражение, внутри — механика
    float f=pow(1.-nv,2.6); col=env(reflect(-V,N),.12)*(.004+f*.09)*vec3(.85,.95,1.1)+vec3(.01,.012,.016)*f;
  } else col=uAlb*uGlow;
  col*=uVis; o=vec4(sqrt(col/(1.+col)),1.); }`;
const PT_VS = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform float uH; out vec4 vC;
void main(){ gl_Position=uVP*vec4(aP.xyz,1.); gl_PointSize=clamp(aP.w*uH/max(gl_Position.w,.1),1.,uH*.9); vC=aC; }`;
const PT_FS = `#version 300 es
precision highp float; in vec4 vC; out vec4 o; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard;
  float soft=pow(1.-r,2.4), bok=smoothstep(1.,.8,r)*(.55+.45*smoothstep(.3,.95,r)); float a=mix(soft,bok,vC.a); o=vec4(vC.rgb*a,1.); }`;
const Q_VS = `#version 300 es
out vec2 u; void main(){ vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.); u=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;
const BLUR_FS = `#version 300 es
precision highp float; in vec2 u; out vec4 o; uniform sampler2D uTx; uniform vec2 uD; uniform float uTh;
vec3 dec(vec3 c){c=min(c*c,vec3(.84));return c/(1.-c);}
void main(){ vec3 s=vec3(0.); float w=0.; for(int i=-6;i<=6;i++){ float k=exp(-float(i*i)/14.); s+=dec(texture(uTx,u+uD*float(i)).rgb)*k; w+=k; }
  s/=w; float l=max(s.r,max(s.g,s.b)); s*=smoothstep(uTh*.55,uTh*1.4+.001,l); o=vec4(sqrt(s/(1.+s)),1.); }`;
const OUT_FS = `#version 300 es
precision highp float; in vec2 u; out vec4 o; uniform sampler2D uTx,uBl,uBm,uSt; uniform vec2 uFc; uniform float uDof,uAsp,uVert;
vec3 dec(vec3 c){c=min(c*c,vec3(.84));return c/(1.-c);}
void main(){ vec2 c=u-.5; vec2 ab=c*dot(c,c)*.012;
  vec3 s=vec3(dec(texture(uTx,u+ab).rgb).r,dec(texture(uTx,u).rgb).g,dec(texture(uTx,u-ab).rgb).b);
  float d=mix(abs(u.x-uFc.x)*uAsp*.8,abs(u.y-uFc.y)*1.3,uVert); d=smoothstep(.16,.72,d)*uDof;     // глубина резкости: кадр мягче вдали от точки фокуса
  s=mix(s,dec(texture(uBl,u).rgb),d);
  s+=dec(texture(uBm,u).rgb)*.3+dec(texture(uSt,u).rgb)*vec3(1.,.72,.4)*.22;
  s*=1.-dot(c*vec2(1.,.85),c)*1.1;
  s=(s*(2.51*s+.03))/(s*(2.43*s+.59)+.14);
  o=vec4(pow(clamp(s,0.,1.),vec3(1./2.2)),1.); }`;

const BRASS: V = [1.0, 0.71, 0.29], BRASS2: V = [0.98, 0.66, 0.24], STEEL: V = [0.62, 0.65, 0.7];
const IGN = (k: number) => 4.4 + k * 0.32;                            // когда зажигается ячейка k

// раскадровка: альбом (ключ горизонтально) и портрет (ключ идёт сверху вниз)
const LAND: Key[] = [
  [0.1, [-10.9, 0.7, 2.5], [-10.35, 0.08, 0]], [1.4, [-9.5, 0.75, 3.3], [-9.6, 0, 0]], [2.6, [-5.6, 0.95, 3.5], [-5.9, 0, 0]],
  [3.3, [-4.2, 1.9, 9.6], [-2.8, 0.45, 0]], [4.4, [-1.6, 1.7, 11.2], [-1.2, 0.42, 0]], [7.8, [0.0, 1.2, 10.4], [-1.0, 0.42, 0]],
  [11.4, [-3.6, 1.5, 7.6], [-1.2, 0.3, 0]], [13.4, [-6.4, 0.7, 5.6], [-2.0, 0.15, 0]]];
const PORT: Key[] = [
  [0.1, [0.5, 10.7, 4.0], [0, 10.35, 0]], [1.4, [0.9, 9.0, 5.6], [0, 9.3, 0]], [2.6, [1.0, 5.4, 6.0], [0.05, 5.8, 0]],
  [3.3, [1.6, 3.0, 15.5], [1.0, 1.6, 0]], [4.4, [2.3, 0.9, 17.6], [1.75, 0.35, 0]], [7.8, [1.5, 0.3, 16.8], [1.75, 0.2, 0]],
  [11.4, [-0.6, 3.6, 14.5], [0.4, 1.2, 0]], [13.4, [-1.0, 5.0, 10.5], [0.1, 2.0, 0]]];

export function startKeyFilm(canvas: HTMLCanvasElement, time: () => number, labels: HTMLElement[], signBox: () => DOMRect | undefined): KeyFilm | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const phone = innerWidth <= 900;
  const prog = (vs: string, fs: string) => {
    const p = gl.createProgram()!;
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as [number, string][]) { const x = gl.createShader(t)!; gl.shaderSource(x, s); gl.compileShader(x); gl.attachShader(p, x); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('key-film: ' + gl.getProgramInfoLog(p));
    const c = new Map<string, WebGLUniformLocation | null>();
    return { p, u: (n: string) => { if (!c.has(n)) c.set(n, gl.getUniformLocation(p, n)); return c.get(n)!; } };
  };
  let pm: ReturnType<typeof prog>, pp: typeof pm, pb: typeof pm, po: typeof pm;
  try { pm = prog(MESH_VS, MESH_FS); pp = prog(PT_VS, PT_FS); pb = prog(Q_VS, BLUR_FS); po = prog(Q_VS, OUT_FS); } catch (e) { console.warn(e); return null; }

  const mesh = (d: number[]): Mesh => {
    const vao = gl.createVertexArray()!; gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW);
    for (const k of [0, 1]) { gl.enableVertexAttribArray(k); gl.vertexAttribPointer(k, 3, gl.FLOAT, false, 24, k * 12); }
    return { vao, n: d.length / 6 };
  };
  const mKey = mesh(keyMesh());
  // штифт ключа: конус снизу, скругление сверху; длина своя — чтобы верх встал ровно на линию среза
  const mPin = CUT.map((c) => { const L = SHEAR - c; return mesh(latheY([[0, 0.02], [0, 0.07], [0.1, 0.17], [0.14, 0.18], [L - 0.04, 0.18], [L, 0.15], [L, 0.01]])); });
  const mDrv = mesh(latheY([[0, 0.01], [0, 0.15], [0.04, 0.18], [0.16, 0.18], [0.19, 0.14], [0.27, 0.14], [0.3, 0.18], [0.46, 0.18], [0.5, 0.15], [0.5, 0.01]]));
  const turns = 6, sn = 120;
  const mSpr = mesh(loft(Array.from({ length: sn + 1 }, (_, i) => { const f = i / sn, a = f * turns * TAU; return circ(7, (b) => { const R = 0.125 + Math.cos(b) * 0.026; return [Math.sin(a) * R, f + Math.sin(b) * 0.026, Math.cos(a) * R]; }); })));
  const mGlass = mesh(latheX([[-2.15, 0.2], [-2.15, 0.68], [-2.08, 0.74], [2.08, 0.74], [2.15, 0.68], [2.15, 0.2]], 64));
  const mCh = mesh(latheY([[0.66, 0.23], [2.0, 0.23], [2.05, 0.18], [2.05, 0.02]]));                        // стеклянные гильзы над штифтами
  const mBez = mesh(latheX([[-2.16, 0.5], [-2.3, 0.5], [-2.34, 0.54], [-2.34, 0.6], [-2.28, 0.63], [-2.28, 0.68], [-2.34, 0.71], [-2.34, 0.82], [-2.28, 0.88], [-2.12, 0.88], [-2.08, 0.82], [-2.08, 0.72]], 72));
  const mEnd = mesh(latheX([[2.06, 0.72], [2.06, 0.82], [2.12, 0.88], [2.3, 0.88], [2.36, 0.82], [2.36, 0.5], [2.3, 0.46], [2.3, 0.02]], 72));
  const mCap = mesh(latheY([[2.04, 0.02], [2.04, 0.24], [2.08, 0.28], [2.2, 0.28], [2.25, 0.22], [2.25, 0.02]]));
  const bx = (w: number, hh: number, d: number) => mesh(loft([-w, w].map((x) => [[x, hh, d], [x, -hh, d], [x, -hh, -d], [x, hh, -d]] as V[])));
  const mLine = bx(2.1, 0.008, 0.008), mRail = bx(2.1, 0.035, 0.05);

  const ptBuf = gl.createBuffer(), ptVao = gl.createVertexArray(); gl.bindVertexArray(ptVao); gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
  for (const k of [0, 1]) { gl.enableVertexAttribArray(k); gl.vertexAttribPointer(k, 4, gl.FLOAT, false, 32, k * 16); }
  const dust = Array.from({ length: phone ? 70 : 120 }, () => [Math.random(), Math.random(), Math.random(), Math.random()]);

  // ---------- буферы кадра ----------
  let W = 0, H = 0, w4 = 0, h4 = 0, scale = 1, msf: WebGLFramebuffer, tFull: { f: WebGLFramebuffer; t: WebGLTexture }, q: (typeof tFull)[] = [], junk: (() => void)[] = [];
  const target = (w: number, h: number) => {
    const t = gl.createTexture()!, f = gl.createFramebuffer()!; gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    junk.push(() => { gl.deleteTexture(t); gl.deleteFramebuffer(f); }); return { f, t };
  };
  const size = () => {
    const d = Math.min(devicePixelRatio || 1, phone ? 2 : 1.5) * scale, w = Math.max(2, Math.round(innerWidth * d)), h = Math.max(2, Math.round(innerHeight * d));
    if (w === W && h === H) return; W = w; H = h; canvas.width = W; canvas.height = H; junk.forEach((f) => f()); junk = [];
    const ms = Math.min(4, gl.getParameter(gl.MAX_SAMPLES)), c = gl.createRenderbuffer()!, z = gl.createRenderbuffer()!; msf = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, msf);
    gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ms, gl.RGBA8, W, H); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    gl.bindRenderbuffer(gl.RENDERBUFFER, z); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ms, gl.DEPTH_COMPONENT24, W, H); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, z);
    const m = msf; junk.push(() => { gl.deleteRenderbuffer(c); gl.deleteRenderbuffer(z); gl.deleteFramebuffer(m); });
    tFull = target(W, H); w4 = W >> 2 || 1; h4 = H >> 2 || 1; q = [0, 1, 2, 3].map(() => target(w4, h4));
  };

  const shot = (keys: Key[], t: number): [V, V] => {                   // плавный проезд: сплайн Эрмита по ключам, без рывков на стыках
    let k = 0; while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
    const a = keys[k], b = keys[k + 1], dt = b[0] - a[0], f = clamp((t - a[0]) / dt);
    const tan = (j: number, w: 1 | 2, c: number) => { const p = keys[Math.max(0, j - 1)], n = keys[Math.min(keys.length - 1, j + 1)]; return p === n ? 0 : (n[w][c] - p[w][c]) / (n[0] - p[0]); };
    const g = (w: 1 | 2): V => [0, 1, 2].map((c) => { const f2 = f * f, f3 = f2 * f; return (2 * f3 - 3 * f2 + 1) * a[w][c] + (f3 - 2 * f2 + f) * dt * tan(k, w, c) + (3 * f2 - 2 * f3) * b[w][c] + (f3 - f2) * dt * tan(k + 1, w, c); }) as V;
    return [g(1), g(2)];
  };

  function draw(t: number) {
    size();
    const asp = W / H, sign = t > 18.4, port = asp < 0.85 && !sign;
    const kx = sign ? 0 : mix(-6.1, -5.7, ss(0, 3, t)) + (t > 3 ? 5.7 * (() => { const f = clamp((t - 3) / 1.3); return f * f * f * (f * (6 * f - 15) + 10); })() : 0);
    const turn = sign ? -0.95 + ss(18.6, 21.5, t) * 0.75 : t < 12 ? 0 : -Math.PI / 2 * (() => { const f = clamp((t - 12.1) / 0.9); return f * f * (3 - 2 * f) * (1 + 0.05 * Math.sin(f * Math.PI)); })();
    const vis = sign ? 0 : ss(2.2, 3.4, t), root = port ? rz(-Math.PI / 2) : tr(0, 0, 0);
    const ig = PX.map((_, k) => ss(IGN(k), IGN(k) + 0.25, t) * (1 + 1.6 * Math.exp(-Math.max(0, t - IGN(k) - 0.1) * 4)));
    const open = ss(12.2, 13.1, t);

    let eye: V, at: V, fov = port ? 0.7 : 0.56, oy = 0;
    if (sign) {
      const b = signBox(); at = [-1.15, 0, 0]; const want = b && b.width ? b.width / innerWidth : 0.36;
      const dist = 7.6 / (2 * Math.tan(fov / 2) * asp * want); eye = [at[0] + 0.9, dist * 0.1, dist];
      if (b && b.width) oy = 1 - 2 * (b.top + b.height / 2) / innerHeight;
    } else {
      [eye, at] = shot(port ? PORT : LAND, t);
      const far = port ? Math.max(1, 0.46 / asp) : Math.max(1, (t < 3 ? 1 : 1.55) / asp);
      eye = [at[0] + (eye[0] - at[0]) * far, at[1] + (eye[1] - at[1]) * far, at[2] + (eye[2] - at[2]) * far];
      eye[0] += Math.sin(t * 0.7) * 0.03; eye[1] += Math.cos(t * 0.9) * 0.025;                             // лёгкое «дыхание» камеры
    }
    const VP = mul(persp(fov, asp, 0.3, 90, oy), look(eye, at));
    const P = (p: V): [number, number, number] => { const o = [0, 1, 3].map((r) => VP[r] * p[0] + VP[4 + r] * p[1] + VP[8 + r] * p[2] + VP[12 + r]); return [o[0] / o[2] * 0.5 + 0.5, o[1] / o[2] * 0.5 + 0.5, o[2]]; };
    const Wd = (p: V): V => (port ? [p[1], -p[0], p[2]] : p);

    gl.bindFramebuffer(gl.FRAMEBUFFER, msf); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(pm.p); gl.uniformMatrix4fv(pm.u('uVP'), false, VP); gl.uniform3fv(pm.u('uEye'), eye); gl.uniform3fv(pm.u('uAt'), at);
    const sweep = sign ? mix(-1.5, 1.4, ss(18.8, 21, t)) : t < 3.4 ? mix(-1.5, 1.5, (t * 0.46) % 1) : t < 11 ? mix(-1.6, 1.8, ss(3.6, 6.8, t)) : mix(-1.4, 1.2, ss(11.6, 13.2, t));
    gl.uniform1f(pm.u('uSweep'), sweep);
    const put = (m: Mesh, M0: M, alb: V, rough: number, o: { kind?: number; glow?: number; vis?: number } = {}) => {
      gl.uniformMatrix4fv(pm.u('uM'), false, mul(root, M0)); gl.uniform3fv(pm.u('uAlb'), alb); gl.uniform1f(pm.u('uRough'), rough);
      gl.uniform1f(pm.u('uKind'), o.kind ?? 0); gl.uniform1f(pm.u('uGlow'), o.glow ?? 0); gl.uniform1f(pm.u('uVis'), o.vis ?? 1);
      gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n);
    };
    const roll = sign ? mul(ry(-0.16 + ss(18.6, 21.5, t) * 0.14), rx(turn)) : rx(turn + (t < 3 ? mix(0.34, 0, ss(0.2, 2.9, t)) : 0));
    put(mKey, mul(tr(kx, 0, 0), roll), BRASS, 0.16, { glow: -1 });
    if (vis > 0.004) {
      PX.forEach((x, k) => {
        const rel = x - kx, bot = rel > BLADE0 && rel < BLADE1 ? Math.max(-0.36, bladeTop(rel)) : -0.36, top = bot + SHEAR - CUT[k];
        const lit = Math.min(ig[k], 2.2);
        put(mPin[k], mul(rx(turn), tr(x, bot, 0)), BRASS2, 0.2, { glow: lit * 0.24, vis });
        put(mDrv, tr(x, top + 0.006, 0), STEEL, 0.24, { vis });
        put(mSpr, mul(tr(x, top + 0.51, 0), sc(1, Math.max(0.2, 2.03 - top - 0.51), 1)), STEEL, 0.3, { vis });
        put(mCap, tr(x, 0, 0), BRASS2, 0.3, { vis: vis * 0.85 });
      });
      put(mBez, rx(turn), BRASS, 0.2, { vis }); put(mEnd, tr(0, 0, 0), STEEL, 0.28, { vis: vis * 0.8 });
      put(mRail, tr(0, 2.14, -0.02), STEEL, 0.3, { vis: vis * 0.6 });
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      put(mGlass, tr(0, 0, 0), STEEL, 0.1, { kind: 1, vis });
      PX.forEach((x, k) => put(mCh, tr(x, 0, 0), STEEL, 0.1, { kind: 1, vis: vis * (1 + ig[k] * 0.5) }));
      put(mLine, tr(0, SHEAR, 0.2), [1, 0.78, 0.4], 0, { kind: 2, glow: (ss(5.75, 6.4, t) * 0.9 + open * 2) * vis });
    }

    // ---------- свет и пыль ----------
    const pts: number[] = [], pt = (p: V, s: number, c: V, a: number, bok = 0) => { if (a > 0.003) pts.push(...p, s, c[0] * a, c[1] * a, c[2] * a, bok); };
    PX.forEach((x, k) => { const g = ig[k] * vis * (1 - ss(13, 13.5, t)); pt(Wd([x, SHEAR, 0.25]), 0.8, [1, 0.6, 0.22], g * 0.2); pt(Wd([x, SHEAR, 0.25]), 0.16, [1, 0.86, 0.6], g * 0.34); pt(Wd([x, 1.3, 0.2]), 1.2, [1, 0.5, 0.15], g * 0.06); });
    pt(Wd([-2.4, 0, 0.1]), 4.2, [1, 0.6, 0.22], open * 0.28); pt(Wd([-2.4, 0, 0.2]), 1.0, [1, 0.88, 0.62], open * 0.55);
    if (t < 3.2) pt(Wd([kx + BOW - 0.1, 0, -0.5]), 2.4, [1, 0.5, 0.14], 0.22 * ss(0.2, 1.2, t) * (1 - ss(2.2, 3.2, t)));     // тёплый свет за прорезью-скважиной
    if (sign) pt([-1.15, 0, -3], 7, [1, 0.5, 0.15], 0.035);
    dust.forEach(([a, b, c, e], n) => {
      const d = mix(1.2, 9, c), hh = 2 * Math.tan(fov / 2) * d, f = norm(sub(at, eye)), r = norm(cross(f, [0, 1, 0])), up = cross(r, f);
      const sx = (((a + t * 0.006 * (e - 0.3)) % 1 + 1) % 1 - 0.5) * hh * asp * 1.2, sy = (((b + t * 0.012 * (0.3 + e)) % 1) - 0.5) * hh * 1.2, near = c < 0.22 ? 1 : 0;
      pt([0, 1, 2].map((k) => eye[k] + f[k] * d + r[k] * sx + up[k] * sy) as V, near ? 0.09 + e * 0.12 : 0.02 + e * 0.02, [1, 0.74, 0.4], (near ? 0.05 : 0.3) * (0.5 + 0.5 * Math.sin(t * 1.3 + n)) * ss(0, 1, t), near);
    });
    if (pts.length) {
      gl.useProgram(pp.p); gl.uniformMatrix4fv(pp.u('uVP'), false, VP); gl.uniform1f(pp.u('uH'), H / Math.tan(fov / 2));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(ptVao); gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW); gl.drawArrays(gl.POINTS, 0, pts.length / 8);
    }
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);

    // ---------- оптика: размытие, свечение, анаморфный блик ----------
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msf); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, tFull.f); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.useProgram(pb.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pb.u('uTx'), 0); gl.viewport(0, 0, w4, h4); gl.bindVertexArray(ptVao);
    const blur = (src: WebGLTexture, dst: number, dx: number, dy: number, th = 0) => { gl.bindFramebuffer(gl.FRAMEBUFFER, q[dst].f); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(pb.u('uD'), dx, dy); gl.uniform1f(pb.u('uTh'), th); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const px = 1 / w4, py = 1 / h4, wide = h4 / 225;
    blur(tFull.t, 3, px * wide, 0); blur(q[3].t, 0, 0, py * wide);                                          // 0 — мягкая картинка для глубины резкости
    blur(q[0].t, 3, px * 2.2 * wide, 0, 0.95); blur(q[3].t, 1, 0, py * 2.2 * wide);                         // 1 — свечение
    blur(q[0].t, 3, px * 5 * wide, 0, 1.9); blur(q[3].t, 2, px * 9 * wide, 0);                              // 2 — горизонтальный блик
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(po.p);
    [['uTx', tFull.t], ['uBl', q[0].t], ['uBm', q[1].t], ['uSt', q[2].t]].forEach(([n, x], k) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, x as WebGLTexture); gl.uniform1i(po.u(n as string), k); });
    const foc = P(Wd(sign ? [-1, 0, 0] : t < 3.1 ? [mix(kx + BOW, kx + 0.6, ss(0.9, 2.5, t)), 0, 0] : t < 11 ? [0, 0.6, 0] : [-2.2, 0, 0]));
    gl.uniform2f(po.u('uFc'), foc[0], foc[1]); gl.uniform1f(po.u('uDof'), sign ? 0.15 : t < 3.6 ? 1 - ss(2.7, 3.6, t) * 0.75 : t < 11 ? 0.25 : 0.7);
    gl.uniform1f(po.u('uAsp'), asp); gl.uniform1f(po.u('uVert'), port ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (t > 4 && t < 8.4) labels.forEach((el, k) => {                                                       // подписи привязаны к штифтам в 3D
      const [x, y] = P(Wd(port ? [PX[k], 2.6, 0] : [PX[k], -1.15, 0]));
      el.style.left = `${(x * innerWidth).toFixed(1)}px`; el.style.top = `${((1 - y) * innerHeight).toFixed(1)}px`;
    });
  }

  let raf = 0, dead = false, n = 0, slow = 0, last = 0;
  const loop = (now: number) => {
    if (dead) return; raf = requestAnimationFrame(loop);
    const t = time(); if (t <= 0 || (t > 13.8 && t < 18.4)) return;                                         // кадров ключа нет — видеочип отдыхает
    if (last && now - last < 200 && n < 400) { n++; if (now - last > 24) slow++; if (n % 30 === 0) { if (slow > 14 && scale > 0.5) scale *= 0.75; slow = 0; } }   // слабое устройство — меньше пикселей
    last = now; draw(t);
  };
  raf = requestAnimationFrame(loop);
  return { draw, stop: () => { dead = true; cancelAnimationFrame(raf); gl.getExtension('WEBGL_lose_context')?.loseContext(); } };
}
