// Живая скважина (v0.21): объёмный тёплый свет за дверью на WebGL. Только десктоп с мышью; телефон и «уменьшить движение» — прежний CSS.
// Грузится отдельным файлом после загрузки страницы (не влияет на первый экран). Нет WebGL — тихо остаётся CSS-версия.
// Геометрия совпадает с --keyhole (viewBox 100×100): круг r=18 в точке (50,40) + трапеция до y=86. Холст — 240% от кнопки, центр в центре круга.

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FRAG = `precision highp float;
uniform vec2 uRes;uniform float uT;uniform vec2 uM;uniform float uHover;uniform float uOpen;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int k=0;k<4;k++){s+=a*noise(p);p=p*2.03+7.1;a*=.5;}return s;}
float sdTrap(vec2 p,float r1,float r2,float he){vec2 k1=vec2(r2,he);vec2 k2=vec2(r2-r1,2.*he);p.x=abs(p.x);
  vec2 ca=vec2(p.x-min(p.x,(p.y<0.)?r1:r2),abs(p.y)-he);
  vec2 cb=p-k1+k2*clamp(dot(k1-p,k2)/dot(k2,k2),0.,1.);
  float s=(cb.x<0.&&ca.y<0.)?-1.:1.;return s*sqrt(min(dot(ca,ca),dot(cb,cb)));}
float key(vec2 p){return min(length(p)-18.,sdTrap(p-vec2(0.,31.4),6.5,13.,14.6));}
void main(){
  vec2 p=(gl_FragCoord.xy/uRes-.5)*240.;p.y=-p.y;
  float d=key(p);
  float dBack=key(p+uM*vec2(4.,3.));              // дальняя кромка двери: сдвигается за курсором — видна толщина
  vec2 L=vec2(0.,6.)-uM*vec2(9.,6.);              // источник света за дверью — в противофазе курсору
  float r=length(p-L);
  float haze=fbm(p*.06+vec2(0.,-uT*.12))*.6+fbm(p*.15+vec2(uT*.05,-uT*.2))*.4;
  vec3 deep=vec3(.23,.15,.03),amber=vec3(.79,.54,.13),gold=vec3(.95,.79,.46),hot=vec3(1.,.95,.81);
  float g=exp(-r/16.);
  vec3 light=mix(deep,amber,smoothstep(0.,.35,g));
  light=mix(light,gold,smoothstep(.3,.7,g));
  light=mix(light,hot,smoothstep(.65,1.,g));
  light*=(.72+.56*haze)*(1.+uHover*.25);
  vec2 q=p*.22+vec2(uT*.03,-uT*.11)+uM*1.5;vec2 id=floor(q);vec2 f=fract(q)-.5;float h=hash(id);
  vec2 o=(vec2(hash(id+3.1),hash(id+7.7))-.5)*.6;
  float mote=smoothstep(.09,0.,length(f-o))*step(.72,h)*(.5+.5*sin(uT*2.+h*40.));
  light+=hot*mote*.6;                              // пылинки в луче
  float inside=smoothstep(.6,-.6,d);
  float back=smoothstep(.6,-.6,dBack);
  vec3 wall=vec3(.09,.065,.02)+amber*g*.55;
  vec3 inner=mix(wall,light,back)*(1.+uOpen*1.6);
  vec2 dir=normalize(p-L+vec2(.001));
  float rays=fbm(dir*2.8+vec2(uT*.05,uT*.02))*.6+fbm(dir*7.5-vec2(uT*.04,1.7))*.4;
  rays=pow(rays,2.2)*2.4;
  float dd=max(d,0.);
  float outA=(rays*exp(-dd/26.)*.42+exp(-dd/7.)*.5)*(1.+uHover*.45+uOpen*2.2);
  outA*=smoothstep(118.,78.,length(p));            // к краю холста — в ноль
  vec3 outC=mix(amber,gold,exp(-dd/7.))*outA;
  gl_FragColor=vec4(mix(outC,inner,inside),mix(outA*.22,1.,inside));
}`;

export function initKeyholeGL() {
  const root = document.documentElement;
  const btn = document.querySelector<HTMLElement>('.keyhole');
  const canvas = document.querySelector<HTMLCanvasElement>('.k-gl');
  if (!btn || !canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uT = U('uT'), uM = U('uM'), uHover = U('uHover'), uOpen = U('uOpen');

  let mx = 0, my = 0, sx = 0, sy = 0, hover = 0, hoverT = 0, open = 0, leftAt = 0, shown = false, lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; root.classList.remove('k-gl-on'); });
  addEventListener('mousemove', (e) => {
    const r = btn.getBoundingClientRect(); if (!r.width) return;
    mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.45)));
    my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.4)) / (innerHeight * 0.45)));
  }, { passive: true });
  btn.addEventListener('mouseenter', () => (hoverT = 1)); btn.addEventListener('mouseleave', () => (hoverT = 0));
  let slide = root.dataset.slide;
  new MutationObserver(() => { const s = root.dataset.slide; if (s !== slide) { if (slide === '0') leftAt = performance.now(); slide = s; } })
    .observe(root, { attributes: true, attributeFilter: ['data-slide'] });

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (lost || document.hidden) return;
    const leaving = slide !== '0' && now - leftAt < 1300;                       // вспышка при входе в портфолио
    const covered = root.classList.contains('trailer-on') && !root.classList.contains('trailer-out');
    if ((slide !== '0' && !leaving) || covered || !root.classList.contains('deck-on')) return;
    const w = canvas.clientWidth; if (!w) return;
    const px = Math.round(Math.min(760, w * Math.min(devicePixelRatio || 1, 1.5)));
    if (canvas.width !== px) { canvas.width = canvas.height = px; gl.viewport(0, 0, px, px); }
    sx += (mx - sx) * 0.06; sy += (my - sy) * 0.06; hover += (hoverT - hover) * 0.08;
    open += ((leaving ? 1 : 0) - open) * 0.12;
    gl.uniform2f(uRes, px, px); gl.uniform1f(uT, now / 1000); gl.uniform2f(uM, sx, sy); gl.uniform1f(uHover, hover); gl.uniform1f(uOpen, open);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; root.classList.add('k-gl-on'); }
  };
  requestAnimationFrame(frame);
}
