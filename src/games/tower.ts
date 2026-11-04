import type {Power, StageNo, TowerGame} from './data';
import type {GameMount} from './env';
import {hearts, medalByMistakes, seeded, shuffle} from './env';
import {el, button, add} from '../ui/dom';
import {GL} from './labels';

// 증거가 있는 층까지만: 층마다 옛 기록 카드가 있다. 어떤 기록에는 나중에 짐작으로 덧쓴 줄이 섞여 있고, 그 줄은 글씨 색이 아주 조금 다르다.
// 모든 줄의 색이 같으면 쌓고, 색이 다른 줄이 있으면 비워 둔다. 문장 내용으로는 알 수 없고 글씨 색으로만 가려낸다.
// 단계가 오를수록 색 차이가 줄어든다. 3단계는 맨눈으로 거의 볼 수 없고, 돋보기(×8)·현미경(×12)이 차이를 키워 보여 준다.
// 3단계를 도구 없이 찍어서 깰 확률은 0.3%쯤(12장 중 1장까지만 틀려야 한다).

export interface TowerCfg {n: number; lives: number; diff: number}   // diff: 덧쓴 글씨와 원래 글씨의 색 차이(RGB 거리 비슷한 값)
export const STAGES: Record<StageNo, TowerCfg> = {
  1: {n: 6, lives: 3, diff: 46},
  2: {n: 9, lives: 3, diff: 24},
  3: {n: 12, lives: 2, diff: 4},
};
export const INK: [number, number, number] = [43, 38, 34];
const DIR: [number, number, number] = [1, 0.5, 0.1];        // 덧쓴 글씨는 살짝 갈색 쪽
export const magnify = (p: Power) => (p.has('microscope') ? 12 : p.has('loupe') ? 8 : 1);
export const canRead = (p: Power) => magnify(p) > 1;
const hex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** 덧쓴 글씨 색: 원래 색에서 diff × 배율만큼 갈색 쪽으로 */
export const inkOf = (altered: boolean, diff: number, mag = 1) => hex(INK.map((v, i) => v + (altered ? diff * mag * DIR[i] : 0)));

/** 층 기록: 줄 셋, 덧쓴 줄 번호(없으면 −1). 단계마다 늘 같다 */
export function cards(stage: StageNo, lines: string[]) {
  const c = STAGES[stage];
  const r = seeded(400 + stage);
  return Array.from({length: c.n}, () => {
    const pick = shuffle(lines, r).slice(0, 3);
    const real = r() < 0.5;
    return {real, lines: pick, altered: real ? -1 : Math.floor(r() * 3)};
  });
}
/** 쌓기(true)·빼기(false)가 맞는지 */
export const judge = (real: boolean, build: boolean) => (real === build ? 'right' : build ? 'wrongBuild' : 'wrongSkip');

export const mountTower: GameMount = env => {
  const game = env.game as unknown as TowerGame;
  const c = STAGES[env.stage];
  const deck = cards(env.stage, game.lines);
  const mag = magnify(env.power);
  let i = 0, mistakes = 0;
  const tower = el('div', {class: 'tw-tower'});
  const card = el('div', {class: 'tw-card', 'data-testid': 'tower-card'});
  const build = button(`A · ${game.build}`, () => choose(true), {class: 'ms-btn primary', 'data-testid': 'tower-build'});
  const skip = button(`B · ${game.skip}`, () => choose(false), {class: 'ms-btn', 'data-testid': 'tower-skip'});
  env.area.append(tower, el('div', {class: 'tw-right'}, card, el('div', {class: 'ms-actions'}, build, skip)));
  const left = el('strong', {}, hearts(c.lives, c.lives));
  const prog = el('strong', {}, `0 / ${c.n}`);
  const msg = el('p', {class: 'gm-flash'});
  env.side.append(el('p', {class: 'gm-count'}, `${GL.progress} `, prog), el('p', {class: 'gm-count'}, `${GL.left} `, left), msg);

  const show = () => {
    const d = deck[i];
    card.replaceChildren();
    add(card,
      el('p', {class: 'tw-floor'}, `${game.recordTitle} · ${i + 1}${GL.floor}`),
      ...d.lines.map((t, k) => el('p', {class: 'tw-line', style: `color:${inkOf(k === d.altered, c.diff, mag)}`}, t)),
      mag > 1 ? el('p', {class: 'tw-note'}, `🔍 ${game.lens}`) : null);
    env.stageEl.dataset.card = String(i);
  };
  const choose = (b: boolean) => {
    if (i >= deck.length) return;
    const d = deck[i];
    const r = judge(d.real, b);
    tower.append(el('span', {class: 'tw-layer' + (b ? ' built' : ' skipped') + (r === 'right' ? '' : ' wrong')}, b ? '' : '✕'));
    if (r === 'right') { msg.className = 'gm-flash found'; msg.textContent = game.right; }
    else { mistakes += 1; msg.className = 'gm-flash'; msg.textContent = game[r]; left.textContent = hearts(c.lives - mistakes, c.lives); }
    i += 1;
    prog.textContent = `${i} / ${c.n}`;
    if (mistakes >= c.lives) { env.end(null); return; }
    if (i >= deck.length) { env.end(medalByMistakes(mistakes, 0, 1)); return; }
    show();
  };
  env.onKey(e => {
    const k = e.key.toLowerCase();
    if (e.repeat) return;
    if (k === 'a' || k === 'arrowleft') choose(true);
    if (k === 'b' || k === 'arrowright') choose(false);
  });
  show();
  return () => {};
};
