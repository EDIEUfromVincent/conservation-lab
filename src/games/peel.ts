import type {PeelGame, Power, StageNo} from './data';
import type {GameMount} from './env';
import {hearts, medalByMistakes} from './env';
import {el} from '../ui/dom';
import {GL} from './labels';

// 살살 떼기: 접착제 덩어리마다 ① 데우기(스페이스를 누르고 있다가 초록 칸에서 떼기) ② 떼기(움직이는 바늘이 초록 칸에 올 때 누르기).
// 3단계는 칸이 아주 좁고 바늘이 빨라 도구 없이는 거의 맞출 수 없다.
// 따뜻한 바람 기계: 천천히 데워지고 데우기 칸이 넓어진다(데운 접착제는 떼기도 쉬워진다). 나무 주걱: 떼기 칸이 넓고 바늘이 느려진다.

export interface PeelCfg {blobs: number; lives: number; heatZone: number; heatRate: number; pressZone: number; speed: number}
export const STAGES: Record<StageNo, PeelCfg> = {
  1: {blobs: 2, lives: 5, heatZone: 25, heatRate: 35, pressZone: 24, speed: 80},
  2: {blobs: 3, lives: 4, heatZone: 16, heatRate: 45, pressZone: 16, speed: 110},
  3: {blobs: 4, lives: 3, heatZone: 7, heatRate: 60, pressZone: 6, speed: 220},
};
/** 장착 도구·되돌리기 솜씨에 따라 칸 너비(%)와 빠르기(%/초)를 정한다 */
export function cfgFor(stage: StageNo, p: Power): PeelCfg {
  const c = {...STAGES[stage]};
  if (p.has('warmer')) { c.heatZone *= 2.5; c.heatRate *= 0.5; c.pressZone *= 2.5; c.speed *= 0.6; }
  if (p.has('spatula')) { c.heatZone *= 1.8; c.heatRate *= 0.7; c.pressZone *= 3; c.speed *= 0.5; }
  const skill = 1 + Math.min(0.3, 0.06 * (p.lv('undo') - 1));
  c.heatZone = Math.min(40, c.heatZone * skill);
  c.pressZone = Math.min(40, c.pressZone * skill);
  return c;
}
/** 칸은 막대의 이 자리에 놓인다(가운데보다 조금 오른쪽) */
export const zoneOf = (width: number): [number, number] => [62 - width / 2, 62 + width / 2];

/** 데우기를 멈춘 온도로 판정 */
export function judgeHeat(heat: number, c: PeelCfg): 'ok' | 'tooHot' | 'tooCold' {
  const [lo, hi] = zoneOf(c.heatZone);
  return heat > hi ? 'tooHot' : heat < lo ? 'tooCold' : 'ok';
}
/** 바늘 자리로 판정 */
export function judgePress(pos: number, c: PeelCfg): 'good' | 'tooHard' | 'tooSoft' {
  const [lo, hi] = zoneOf(c.pressZone);
  return pos > hi ? 'tooHard' : pos < lo ? 'tooSoft' : 'good';
}
/** 바늘: 0→100→0 왕복 */
export const needleAt = (t: number, speed: number) => { const p = (t * speed) % 200; return p < 100 ? p : 200 - p; };

export const mountPeel: GameMount = env => {
  const game = env.game as unknown as PeelGame;
  const c = cfgFor(env.stage, env.power);
  let blob = 0, mistakes = 0;
  let phase: 'heat' | 'press' = 'heat';
  let heat = 0, heating = false, t0 = performance.now();
  const mask = el('div', {class: 'pl-mask'});
  const blobs = Array.from({length: c.blobs}, (_, i) => el('span', {class: 'pl-blob', style: `left:${18 + (64 / Math.max(1, c.blobs - 1)) * i}%;top:${i % 2 ? 58 : 44}%`}));
  mask.append(...blobs);
  const bar = (label: string, zone: number) => {
    const [lo, hi] = zoneOf(zone);
    const fill = el('span', {class: 'pl-fill'});
    const needle = el('span', {class: 'pl-needle'});
    const box = el('div', {class: 'pl-row'}, el('strong', {}, label),
      el('div', {class: 'pl-bar'}, el('span', {class: 'pl-zone', style: `left:${lo}%;width:${hi - lo}%`}), fill, needle));
    return {box, fill, needle};
  };
  const hb = bar(game.heat, c.heatZone);
  const pb = bar(game.press, c.pressZone);
  const act = el('button', {type: 'button', class: 'ms-btn primary pl-act', 'data-testid': 'peel-act'});
  env.area.append(mask, hb.box, pb.box, act);
  const left = el('strong', {}, hearts(c.lives, c.lives));
  const prog = el('strong', {}, `0 / ${c.blobs}`);
  const msg = el('p', {class: 'gm-flash'});
  env.side.append(el('p', {class: 'gm-count'}, `${GL.progress} `, prog), el('p', {class: 'gm-count'}, `${GL.left} `, left), msg);

  const say = (text: string, good: boolean) => { msg.textContent = text; msg.className = 'gm-flash' + (good ? ' found' : ''); };
  const miss = (text: string) => {
    mistakes += 1;
    left.textContent = hearts(c.lives - mistakes, c.lives);
    say(text, false);
    if (mistakes >= c.lives) env.end(null);
  };
  const show = () => {
    act.textContent = phase === 'heat' ? `🔥 ${game.heat}` : `✋ ${game.press}`;
    hb.box.classList.toggle('on', phase === 'heat');
    pb.box.classList.toggle('on', phase === 'press');
    env.stageEl.dataset.phase = phase;
    env.stageEl.dataset.blob = String(blob);
    env.stageEl.dataset.heat = String(Math.round(heat));
  };
  const startHeat = () => { if (phase === 'heat') heating = true; };
  const stopHeat = () => {
    if (phase !== 'heat' || !heating) return;
    heating = false;
    const r = judgeHeat(heat, c);
    if (r === 'ok') { phase = 'press'; t0 = performance.now(); msg.textContent = ''; show(); return; }
    heat = 0;
    miss(game[r]);
  };
  const press = () => {
    if (phase !== 'press') return;
    const r = judgePress(needleAt((performance.now() - t0) / 1000, c.speed), c);
    if (r !== 'good') { miss(game[r]); return; }
    blobs[blob].classList.add('gone');
    blob += 1;
    prog.textContent = `${blob} / ${c.blobs}`;
    say(game.good, true);
    if (blob >= c.blobs) { env.end(medalByMistakes(mistakes, 0, 1)); return; }
    phase = 'heat';
    heat = 0;
    show();
  };
  act.addEventListener('pointerdown', e => { e.preventDefault(); phase === 'heat' ? startHeat() : press(); });
  act.addEventListener('pointerup', stopHeat);
  act.addEventListener('pointerleave', stopHeat);
  env.onKey(e => {
    if (e.key !== ' ' || e.repeat) return;
    e.preventDefault();
    phase === 'heat' ? startHeat() : press();
  }, e => { if (e.key === ' ') stopHeat(); });

  let last = performance.now();
  let frame = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (phase === 'heat') {
      if (heating) heat = Math.min(100, heat + c.heatRate * dt);
      else heat = Math.max(0, heat - 8 * dt);
      if (heat >= 100) { heating = false; heat = 0; miss(game.tooHot); }
    }
    hb.fill.style.width = `${heat}%`;
    const pos = phase === 'press' ? needleAt((now - t0) / 1000, c.speed) : 0;
    pb.needle.style.left = `${pos}%`;
    env.stageEl.dataset.needle = String(Math.round(pos));
    pb.needle.style.visibility = phase === 'press' ? 'visible' : 'hidden';
    blobs[Math.min(blob, c.blobs - 1)].style.setProperty('--soft', String(phase === 'press' ? 1 : heat / 100));
    env.stageEl.dataset.heat = String(Math.round(heat));
    frame = requestAnimationFrame(loop);
  };
  show();
  frame = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(frame);
};
