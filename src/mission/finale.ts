import {el, button} from '../ui/dom';
import {ranksData, rankBadge, starIcon} from './progress';
import {loadHero, level} from '../rpg/hero';
import {medals} from '../games/data';

// 마지막 축하: 다섯 사건을 모두 해결해 별 5개(수석 보존과학자)가 되면 한 번 크게 보여 준다. 사건 목록에서 다시 볼 수 있다.
// 임명장에는 이름을 넣지 않는다(개인정보를 받지 않는다).

export interface Finale {title: string; line: string; sub: string; cert: string; certNote: string; certBody: string[]; sign: string; level: string; items: string; medals: string; unit: string; toCases: string; toGames: string; again: string}
export const finaleText = (ranksData as unknown as {finale: Finale}).finale;

/** 빰빠밤: 짧은 팡파르(소리를 못 내도 조용히 넘어간다) */
function fanfare() {
  try {
    const AC = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42], [784, 0.62], [1047, 0.76], [1319, 0.9]].forEach(([f, at], i, all) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = ctx.currentTime + at, len = i === all.length - 1 ? 0.9 : 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  } catch {
    /* 소리는 없어도 된다 */
  }
}

export function showFinale(stage: HTMLElement, onClose?: () => void) {
  if (stage.querySelector('.finale')) return;
  const F = finaleText;
  const hero = loadHero();
  const medalCount = Object.values(medals()).reduce((n, m) => n + Object.keys(m).length, 0);
  fanfare();
  const close = () => { window.removeEventListener('keydown', onKey, true); overlay.remove(); onClose?.(); };
  const overlay = el('div', {class: 'finale', role: 'dialog', 'aria-label': F.line, 'data-testid': 'finale'},
    el('div', {class: 'sc-rays', 'aria-hidden': 'true'}),
    el('div', {class: 'fn-stars', 'aria-hidden': 'true'}, ...Array.from({length: 5}, (_, i) => {
      const s = el('span', {style: `--i:${i}`});
      s.append(starIcon(true));
      return s;
    })),
    el('div', {class: 'fn-body'},
      el('p', {class: 'fn-title'}, `🎉 ${F.title}`),
      el('h1', {class: 'fn-line'}, F.line),
      el('p', {class: 'fn-sub'}, F.sub),
      el('section', {class: 'fn-cert'},
        el('strong', {class: 'fn-cert-title'}, F.cert),
        el('span', {class: 'fn-cert-note'}, `(${F.certNote})`),
        rankBadge(5, {big: true}),
        ...F.certBody.map(t => el('p', {}, t)),
        el('p', {class: 'fn-sign'}, F.sign)),
      el('div', {class: 'fn-stats'},
        el('span', {}, `${F.level} `, el('strong', {}, level(hero))),
        el('span', {}, `${F.items} `, el('strong', {}, `${hero.items.length}${F.unit}`)),
        el('span', {}, `${F.medals} `, el('strong', {}, `${medalCount}${F.unit}`))),
      el('div', {class: 'ms-actions'},
        button(F.toCases, close, {class: 'ms-btn', 'data-testid': 'finale-close'}),
        el('a', {class: 'ms-btn primary', href: '?mode=games'}, `🏅 ${F.toGames}`))),
    ...Array.from({length: 46}, (_, i) => el('i', {class: 'sc-confetti', style: `--x:${(i * 41) % 100}vw; --c:${['#f2b632', '#e0533d', '#2f7d6d', '#3a6d93', '#7a5a92', '#fff3c4'][i % 6]}; --t:${(i % 9) * 0.15}s`})));
  function onKey(e: KeyboardEvent) {
    if (['PageDown', 'Enter', ' ', 'Escape'].includes(e.key)) { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  }
  window.addEventListener('keydown', onKey, true);
  stage.append(overlay);
}
