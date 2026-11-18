// «Ощущения» сайта: тактильный отклик (вибрация) и звук. Без файлов и библиотек.
//
// Вибрация: Android/Chrome — Vibration API. В Safari его нет; на iOS 18+ системный хаптик даёт
//   нажатие на скрытый переключатель <input type="checkbox" switch> (работает только в ответ на касание).
// Звук: синтез через Web Audio API. По умолчанию выключен (браузеры запрещают звук без действия
//   человека), включается переключателем, выбор хранится в localStorage.

type Pattern = readonly number[];
export const PATTERNS = {
  press: [6],                     // нажатие кнопки
  tick: [8],                      // порог свайпа пройден
  step: [14],                     // смена слайда
  edge: [6, 40, 6],               // упор в первый/последний слайд
  unlock: [10, 40, 10, 40, 28],   // поворот ключа: вход в портфолио
  curtain: [18],                  // шторка контактов
  open: [10],                     // раскрытие панели
  error: [24, 60, 24],            // ошибка в форме
  success: [12, 40, 12, 40, 40],  // заявка отправлена
} satisfies Record<string, Pattern>;
export type Feel = keyof typeof PATTERNS;

const nav = typeof navigator !== 'undefined' ? navigator : undefined;
const canVibrate = !!nav && typeof nav.vibrate === 'function';
const isIOS = !!nav && (/iP(hone|ad|od)/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let iosLabel: HTMLLabelElement | null = null;
let iosInput: HTMLInputElement | null = null;
function iosHaptic() {
  if (!iosLabel) {
    const hide = 'position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.id = 'ks-haptic'; input.setAttribute('switch', ''); input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true'); input.style.cssText = hide;
    const label = document.createElement('label');
    label.htmlFor = 'ks-haptic'; label.setAttribute('aria-hidden', 'true'); label.style.cssText = hide;
    // Safari ставит фокус на переключатель после нажатия на label — сайт считал, что человек печатает, и блокировал свайп.
    input.addEventListener('focus', () => input.blur());
    document.body.append(input, label); iosLabel = label; iosInput = input;
  }
  iosLabel.click();
  if (document.activeElement === iosInput) iosInput!.blur();
}

export function haptic(name: Feel) {
  const p = PATTERNS[name];
  if (canVibrate) { const ua = (nav as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation; if (ua && !ua.hasBeenActive) return; try { nav!.vibrate([...p]); } catch {} return; }
  if (isIOS) { iosHaptic(); if (p.length > 2) setTimeout(iosHaptic, p[0] + p[1]); }
}

/* ---------------- звук ---------------- */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let soundOn = false;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.32;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

type ToneOpt = { type?: OscillatorType; gain?: number; slideTo?: number; delay?: number; attack?: number };
function tone(freq: number, dur: number, o: ToneOpt = {}) {
  const c = audio(), t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type ?? 'sine'; osc.frequency.setValueAtTime(freq, t);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.15, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(master!); osc.start(t); osc.stop(t + dur + 0.05);
}
type NoiseOpt = { gain?: number; from?: number; to?: number; filter?: BiquadFilterType; delay?: number; attack?: number; q?: number };
function noise(dur: number, o: NoiseOpt = {}) {
  const c = audio(), t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; f.type = o.filter ?? 'bandpass'; f.Q.value = o.q ?? 0.8;
  f.frequency.setValueAtTime(o.from ?? 1200, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.1, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master!); src.start(t); src.stop(t + dur + 0.05);
}

const SOUNDS: Record<Feel | 'toggle', (dir?: number) => void> = {
  press: () => tone(1900, 0.035, { type: 'triangle', gain: 0.08 }),
  tick: () => tone(2600, 0.025, { type: 'square', gain: 0.03 }),
  step: (dir = 1) => { tone(dir > 0 ? 420 : 520, 0.16, { gain: 0.14, slideTo: dir > 0 ? 640 : 330 }); noise(0.12, { gain: 0.04, from: 3000, to: 900 }); },
  edge: () => tone(130, 0.18, { gain: 0.16, slideTo: 95 }),
  unlock: () => {                         // два металлических щелчка, глухой удар, нарастающий воздух
    tone(2300, 0.03, { type: 'square', gain: 0.05 });
    tone(1500, 0.045, { type: 'square', gain: 0.06, delay: 0.1 });
    tone(95, 0.45, { gain: 0.3, slideTo: 42, delay: 0.14 });
    noise(1.15, { gain: 0.1, from: 300, to: 5200, delay: 0.16, attack: 0.55 });
  },
  curtain: () => noise(0.55, { gain: 0.08, from: 5200, to: 700, filter: 'lowpass', attack: 0.08 }),
  open: () => { tone(620, 0.2, { gain: 0.08 }); tone(930, 0.24, { gain: 0.05, delay: 0.05 }); },
  error: () => { tone(230, 0.12, { type: 'sawtooth', gain: 0.04 }); tone(185, 0.18, { type: 'sawtooth', gain: 0.04, delay: 0.13 }); },
  success: () => [523, 659, 784, 1046].forEach((f, k) => tone(f, 0.3, { gain: 0.08, delay: k * 0.07 })),
  toggle: () => { tone(880, 0.07, { gain: 0.08 }); tone(1320, 0.1, { gain: 0.06, delay: 0.06 }); },
};

// Звук включён по умолчанию (решение владельца 16.10); выключенный человеком — запоминается ('0').
export function soundPreference() { try { return localStorage.getItem('ks_sound') !== '0'; } catch { return true; } }
export function isSoundOn() { return soundOn; }
export function setSound(v: boolean) {
  soundOn = v;
  try { localStorage.setItem('ks_sound', v ? '1' : '0'); } catch {}
  if (master) master.gain.value = v ? 0.32 : 0;          // выключение глушит и уже запущенную партитуру
  if (v) { audio(); SOUNDS.toggle(); }
}
// Сохранённое «включено» оживает только после первого действия человека (политика автозапуска).
// Браузеры не дают сайту звучать до первого действия человека. Поэтому звук оживает от первого касания, клика или клавиши —
// без отдельного вопроса.
// onReady вызывается один раз, когда звук реально заработал.
let unlocked = false;
export function soundUnlocked() { return unlocked; }
export function armSoundFromPreference(onReady?: () => void) {
  if (!soundPreference()) return;
  soundOn = true;
  const ready = () => { if (unlocked) return; unlocked = true; onReady?.(); };
  // AudioContext создаём только по первому жесту: создание при загрузке стоило ~150 мс на слабом телефоне (Lighthouse TBT).
  const arm = () => {
    try { audio().resume().then(() => { if (ctx!.state === 'running') ready(); }); } catch {}
    ['pointerdown', 'keydown', 'touchend'].forEach((t) => removeEventListener(t, arm, true));
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((t) => addEventListener(t, arm, { capture: true }));
}

/** Партитура трейлера (синтез, без файлов). elapsed — сколько секунд трейлер уже идёт: звук включили посреди.
 *  Тайминги совпадают с index.astro/global.css: слова склейки 0,3 + 0,6·k; клиенты 3,7; ключ 5,3; «КЛЮЧ» 5,6. */
export function playTrailerScore(elapsed: number) {
  // Трейлер v2 «Поворот ключа»: те же секунды, что в global.css (раздел ТРЕЙЛЕР). Пропущенные моменты не догоняем.
  audio();
  const at = (t: number) => t - elapsed;
  const ok = (t: number) => at(t) >= -0.02;
  const d = (t: number) => Math.max(0, at(t));
  if (elapsed < 6.5) tone(55, Math.max(0.6, 7 - elapsed), { gain: 0.07, attack: 0.5, slideTo: 46 });          // гул под всем трейлером
  if (ok(0.2)) tone(1760, 0.5, { gain: 0.03, attack: 0.05, delay: d(0.2) });                                     // пылинка
  if (ok(0.65)) noise(0.45, { gain: 0.08, from: 900, to: 4200, attack: 0.05, delay: d(0.65) });                 // ключ входит в замок
  [0, 1, 2, 3, 4].forEach((k) => { const t = 1.05 + k * 0.17; if (!ok(t)) return;                               // пять штифтов — щелчки
    tone(2400 - k * 120, 0.03, { type: 'square', gain: 0.05, delay: d(t) }); noise(0.04, { gain: 0.05, from: 6000, to: 3000, delay: d(t) }); });
  [0, 1, 2, 3].forEach((k) => { const t = 2.35 + k * 0.25; if (!ok(t)) return;                                  // боли зачёркиваются
    noise(0.16, { gain: 0.07, from: 5200, to: 900, delay: d(t) }); tone(120, 0.18, { gain: 0.18, slideTo: 50, delay: d(t) }); });
  if (ok(3.45)) { tone(2300, 0.03, { type: 'square', gain: 0.06, delay: d(3.45) });                            // поворот: щелчок механизма
    tone(1500, 0.05, { type: 'square', gain: 0.06, delay: d(3.45) + 0.1 }); }
  if (ok(3.78)) { tone(70, 1.4, { gain: 0.34, slideTo: 32, delay: d(3.78) });                                   // «клац» и хвост
    noise(1.2, { gain: 0.07, from: 2600, to: 300, filter: 'lowpass', delay: d(3.78) }); }
  [0, 1, 2, 3].forEach((k) => { const t = 4.55 + k * 0.14; if (!ok(t)) return; tone(92, 0.12, { gain: 0.16, slideTo: 60, delay: d(t) }); }); // тоннель — пульс
  if (ok(4.5)) noise(0.6, { gain: 0.06, from: 400, to: 6000, attack: 0.4, delay: d(4.5) });
  if (ok(5.02)) [392, 523].forEach((f, k) => tone(f, 0.9, { gain: 0.035, attack: 0.2, delay: d(5.02) + k * 0.1 }));
  if (ok(5.95)) { tone(70, 1.3, { gain: 0.3, slideTo: 33, delay: d(5.95) });                                    // знак: удар и аккорд
    [523, 784, 1046].forEach((f, k) => tone(f, 1.6, { gain: 0.03, attack: 0.04, delay: d(5.97) + k * 0.05 })); }
  if (ok(7)) noise(1.1, { gain: 0.07, from: 6000, to: 500, filter: 'lowpass', attack: 0.1, delay: d(7) });      // растворение в скважину
}

/** Отклик целиком: вибрация + звук (если включён). dir — направление для звука смены слайда. */
export function feel(name: Feel, dir?: number) {
  if (!reduced) haptic(name);
  if (soundOn && ctx) { try { SOUNDS[name](dir); } catch {} }
}
