import type {ClimateGame, Medal, StageNo} from './data';
import type {GameMount} from './env';
import {seeded} from './env';
import {el} from '../ui/dom';
import {GL} from './labels';

// 전시실 습도 지키기: 습도·온도 두 바늘이 날씨 때문에 자꾸 움직인다. 기계(제습기·가습기·냉방·난방)를 켜서 초록 칸 안에 지킨다.
// 기계는 알맞은 값(가운데)까지만 움직인다. 기계의 힘은 재료 감각 레벨에 따라 세진다: 5 + 3.5 × (레벨 − 1).
// 3단계는 날씨가 바꾸는 힘(9.5)이 레벨 2의 기계 힘(8.5)보다 세서, 재료 감각 레벨 3이 안 되면 반드시 실패한다.
// 값은 0~100(가운데 50)으로 다룬다. 화면에 숫자는 보여 주지 않는다(설명용 근사 모델).

export interface ClimateCfg {time: number; drift: number; len: [number, number]; gap: [number, number]; both: boolean; out: number}
export const STAGES: Record<StageNo, ClimateCfg> = {
  1: {time: 30, drift: 2.5, len: [4, 6], gap: [2, 3], both: false, out: 6},
  2: {time: 45, drift: 4, len: [3, 5], gap: [1, 2], both: false, out: 6},
  3: {time: 60, drift: 9.5, len: [6, 8], gap: [0, 0], both: true, out: 6},
};
export const HALF = 9;                   // 초록 칸: 50 ± 9
export const power = (lv: number) => 5 + 3.5 * (lv - 1);

/** 날씨 일정: v(0 습도, 1 온도), dir(+1 오름, −1 내림). 단계마다 늘 같다 */
export interface Weather {at: number; len: number; v: 0 | 1; dir: 1 | -1}
export function schedule(stage: StageNo): Weather[] {
  const c = STAGES[stage];
  const r = seeded(300 + stage);
  const out: Weather[] = [];
  for (const lane of c.both ? [0, 1] as const : [null]) {
    let t = 1.5;
    while (t < c.time) {
      const len = c.len[0] + r() * (c.len[1] - c.len[0]);
      const v = lane ?? (r() < 0.5 ? 0 : 1);
      const dir = r() < 0.5 ? -1 : 1;
      out.push({at: t, len, v, dir});
      t += len + c.gap[0] + r() * (c.gap[1] - c.gap[0]);
    }
  }
  return out;
}
/** 날씨 문구 번호: 비(습도↑) · 관람객(온도↑) · 창문(습도↓) · 밤(온도↓) */
export const eventText = (w: Weather) => (w.dir > 0 ? (w.v === 0 ? 0 : 1) : (w.v === 0 ? 2 : 3));

export interface ClimateState {x: [number, number]; t: number; out: number; done: 'win' | 'lose' | null}
export const newClimate = (): ClimateState => ({x: [50, 50], t: 0, out: 0, done: null});
/** 기계 입력: 값마다 −1(낮추기)·0·+1(높이기) */
export function tick(prev: ClimateState, input: [number, number], dt: number, stage: StageNo, lv: number, plan = schedule(stage)): ClimateState {
  const c = STAGES[stage];
  if (prev.done) return prev;
  const s: ClimateState = {...prev, x: [...prev.x] as [number, number]};
  const p = power(lv);
  for (const i of [0, 1] as const) {
    const d = plan.filter(w => w.v === i && s.t >= w.at && s.t < w.at + w.len).reduce((n, w) => n + w.dir * c.drift, 0);
    let x = s.x[i] + d * dt;
    if (input[i] < 0 && x > 50) x = Math.max(50, x - p * dt);
    if (input[i] > 0 && x < 50) x = Math.min(50, x + p * dt);
    s.x[i] = Math.max(0, Math.min(100, x));
  }
  s.t += dt;
  if (s.x.some(v => Math.abs(v - 50) > HALF)) s.out += dt;
  if (s.out > c.out) s.done = 'lose';
  else if (s.t >= c.time) s.done = 'win';
  return s;
}
export const medalFor = (out: number): Medal => (out <= 1 ? 'gold' : out <= 3 ? 'silver' : 'bronze');

export const mountClimate: GameMount = env => {
  const game = env.game as unknown as ClimateGame;
  const plan = schedule(env.stage);
  const lv = env.power.lv('material');
  const banner = el('p', {class: 'cl-banner'});
  // 화면 버튼: 누르고 있는 동안 켜진다
  const pressed = new Set<string>();
  const hold = (key: string, label: string, sign: string) => {
    const b = el('button', {type: 'button', class: 'ms-btn cl-btn', 'data-key': key}, el('span', {class: 'cl-sign'}, sign), label);
    const on = (e: Event) => { e.preventDefault(); pressed.add(key); b.classList.add('on'); };
    const off = () => { pressed.delete(key); b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    return b;
  };
  const gauge = (name: string, low: HTMLElement, high: HTMLElement) => {
    const needle = el('span', {class: 'cl-needle'});
    const arrow = el('span', {class: 'cl-arrow'});
    const box = el('div', {class: 'cl-gauge'},
      el('strong', {class: 'cl-name'}, name),
      el('div', {class: 'cl-bar'}, el('span', {class: 'cl-band', style: `bottom:${50 - HALF}%;height:${HALF * 2}%`}), needle, arrow),
      el('div', {class: 'cl-btns'}, high, low));
    return {box, needle, arrow};
  };
  const hum = gauge(game.humidity, hold('s', game.dry, '▼'), hold('w', game.wet, '▲'));
  const tem = gauge(game.temperature, hold('a', game.cool, '▼'), hold('d', game.warm, '▲'));
  env.area.append(banner, el('div', {class: 'cl-gauges'}, hum.box, tem.box));
  const clock = el('strong', {});
  const meter = el('div', {class: 'gm-meter'}, el('span', {}));
  const msg = el('p', {class: 'gm-flash'});
  env.side.append(el('p', {class: 'gm-count'}, `${GL.time} `, clock), el('p', {class: 'ms-label'}, GL.outTime), meter, msg);
  let s = newClimate();
  let last = performance.now();
  let frame = 0;
  const on = (...keys: string[]) => keys.some(k => env.held.has(k) || pressed.has(k));
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const input: [number, number] = [(on('w', 'arrowup') ? 1 : 0) - (on('s', 'arrowdown') ? 1 : 0), (on('d', 'arrowright') ? 1 : 0) - (on('a', 'arrowleft') ? 1 : 0)];
    s = tick(s, input, dt, env.stage, lv, plan);
    const now2 = plan.filter(w => s.t >= w.at && s.t < w.at + w.len);
    banner.textContent = now2.map(w => game.events[eventText(w)]).join(' ');
    for (const [i, g] of [hum, tem].entries()) {
      g.needle.style.bottom = `${s.x[i]}%`;
      g.needle.classList.toggle('bad', Math.abs(s.x[i] - 50) > HALF);
      const d = now2.filter(w => w.v === i).reduce((n, w) => n + w.dir, 0);
      g.arrow.textContent = d > 0 ? '⬆' : d < 0 ? '⬇' : '';
    }
    const bad = s.x.some(v => Math.abs(v - 50) > HALF);
    msg.textContent = bad ? game.danger : '';
    (meter.firstChild as HTMLElement).style.width = `${(s.out / STAGES[env.stage].out) * 100}%`;
    meter.className = 'gm-meter' + (s.out > 4 ? ' high' : s.out > 2 ? ' mid' : '');
    clock.textContent = `${Math.ceil(Math.max(0, STAGES[env.stage].time - s.t))}`;
    env.stageEl.dataset.climate = `${Math.round(s.x[0])},${Math.round(s.x[1])}`;
    env.stageEl.dataset.out = s.out.toFixed(1);
    if (s.done) { env.end(s.done === 'win' ? medalFor(s.out) : null); return; }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(frame);
};
