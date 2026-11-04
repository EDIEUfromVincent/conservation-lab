import {el, button} from '../ui/dom';
import {svg} from '../ui/art';
import {PL} from './labels';
import {openDialog} from './dialog';
import {rpg, award, finishTalk, loadHero, saveHero, equip, itemOf, level, levelProgress, stat, statLevel, equipBonus, ROLES, type Gain, type Hero} from './hero';
import type {SceneHandle, SceneNpc} from '../mission/scene';
import {roleOf} from '../roles/engine';
import {roleIcon} from '../roles/webtoon';
import './style.css';

// 화면 모드와 RPG를 잇는 도우미: 무대별 등장인물, 대화 + 클로즈업, 얻은 것 알림, 가방.

/** 무대마다 동물이 사는 곳(길가). 스승님은 갈래길 갈림목 옆에 서 있다. */
const HOMES: Record<string, [number, number][]> = {
  roles: [[-4.2, 9.2], [4.2, 9.6], [-6.8, 6.8]],
  case1: [[-4.5, 9.5], [4.5, 10]], case2: [[-3.8, 8.5]], case3: [[3.8, 8.5]],
  case4: [[-4.5, 9.5], [4.5, 9.5]], case5: [[-4.5, 9.5], [3.8, 10]],
};
export const MENTOR_ID = 'mentor';

export function npcsFor(setId: string): SceneNpc[] {
  const homes = HOMES[setId] ?? [];
  const animals = rpg.animals.filter(a => a.sets.includes(setId)).slice(0, homes.length)
    .map((a, i) => ({id: a.id, kind: a.kind as SceneNpc['kind'], color: a.color, home: homes[i], wander: true}));
  return setId === 'roles' ? [{id: MENTOR_ID, kind: 'mentor', home: [-2.6, 6.8], wander: false}, ...animals] : animals;
}
export const npcName = (id: string) => (id === MENTOR_ID ? rpg.mentor.name : rpg.animals.find(a => a.id === id)?.name ?? '');

/** 대화: 클로즈업 → 대화창 → 원래 시점, 그리고 경험치·도구. 끝나면 얻은 것을 알린다. */
export async function talkTo(stage: HTMLElement, scene: SceneHandle, id: string) {
  // 아래 대화창이 가리는 만큼 장면을 위로 올리고, 패널 없이 두 인물만 크게
  scene.setShift(0, 0.12);
  scene.closeUp(id);
  if (id === MENTOR_ID) {
    await openDialog(stage, {speaker: rpg.mentor.name, nodes: rpg.mentor.nodes, start: rpg.mentor.start, color: '#2f7d6d'});
    scene.closeUp(null);
    const h = loadHero();
    if (!h.mentorDone) saveHero({...h, mentorDone: true});
    return;
  }
  const animal = rpg.animals.find(a => a.id === id)!;
  await openDialog(stage, {speaker: animal.name, nodes: animal.nodes, start: animal.start, color: roleOf(animal.role)!.color});
  scene.closeUp(null);
  showGains(stage, award(h => finishTalk(h, animal, Math.random())));
}

export function itemIcon(id: string) {
  const s = svg('svg', {viewBox: '0 0 48 48', class: 'item-icon', 'aria-hidden': 'true'});
  const ink = {stroke: '#1d2a2a', 'stroke-width': 3, 'stroke-linejoin': 'round'};
  const parts: Record<string, SVGElement[]> = {
    tags: [svg('path', {d: 'M8 14 H30 L38 22 L30 30 H8 Z', fill: '#fff8e2', ...ink}), svg('circle', {cx: 30, cy: 22, r: 3, fill: '#1d2a2a'}), svg('path', {d: 'M12 36 H34', stroke: '#3a6d93', 'stroke-width': 4})],
    camera: [svg('rect', {x: 6, y: 14, width: 36, height: 24, rx: 4, fill: '#5c6670', ...ink}), svg('circle', {cx: 24, cy: 26, r: 8, fill: '#9fe0e6', ...ink}), svg('rect', {x: 14, y: 9, width: 10, height: 6, fill: '#5c6670', ...ink})],
    loupe: [svg('circle', {cx: 20, cy: 20, r: 12, fill: '#d9eef0', ...ink}), svg('path', {d: 'M29 29 L42 42', stroke: '#8a6142', 'stroke-width': 7, 'stroke-linecap': 'round'})],
    microscope: [svg('rect', {x: 10, y: 38, width: 28, height: 6, fill: '#5c6670', ...ink}), svg('rect', {x: 20, y: 8, width: 8, height: 22, fill: '#5c6670', ...ink, transform: 'rotate(-18 24 19)'}), svg('path', {d: 'M30 38 V26 H16', fill: 'none', ...ink})],
    brush: [svg('rect', {x: 21, y: 4, width: 6, height: 24, fill: '#8a6142', ...ink}), svg('path', {d: 'M18 28 H30 L32 44 H16 Z', fill: '#f1e7b8', ...ink})],
    cushion: [svg('rect', {x: 6, y: 12, width: 36, height: 26, rx: 10, fill: '#f6f0ff', ...ink}), svg('circle', {cx: 16, cy: 25, r: 3, fill: '#c9bce8'}), svg('circle', {cx: 26, cy: 22, r: 3, fill: '#c9bce8'}), svg('circle', {cx: 33, cy: 29, r: 3, fill: '#c9bce8'})],
    spatula: [svg('path', {d: 'M22 4 H26 V26 H22 Z', fill: '#8a6142', ...ink}), svg('path', {d: 'M16 26 H32 L30 44 H18 Z', fill: '#c49a6c', ...ink})],
    warmer: [svg('rect', {x: 6, y: 14, width: 26, height: 16, rx: 6, fill: '#e0533d', ...ink}), svg('rect', {x: 12, y: 28, width: 8, height: 14, fill: '#5c6670', ...ink}),
      svg('path', {d: 'M36 16 c4 3 -2 6 2 9 M42 14 c4 3 -2 6 2 9', fill: 'none', stroke: '#e0533d', 'stroke-width': 3})],
  };
  s.append(...(parts[id] ?? []));
  return s;
}

/** 얻은 것 알림: 경험치(작게), 능력치 레벨(반짝), 전체 레벨 업(가운데 크게), 새 도구, 도구 찾기 확률 */
export function showGains(stage: HTMLElement, gains: Gain[]) {
  if (!gains.length) return;
  let stack = stage.querySelector<HTMLElement>('.rpg-toasts');
  if (!stack) { stack = el('div', {class: 'rpg-toasts', 'aria-live': 'polite'}); stage.append(stack); }
  gains.forEach((g, i) => {
    let t: HTMLElement;
    if (g.kind === 'xp') t = el('div', {class: 'rpg-toast xp'}, `+${g.amount} XP · ${rpg.stats[g.role].name}`);
    else if (g.kind === 'statUp') t = el('div', {class: 'rpg-toast stat', style: `--rc:${roleOf(g.role)!.color}`}, roleIcon(g.role, roleOf(g.role)!.color), `${rpg.stats[g.role].name} ${PL.lv} ${g.level}!`);
    else if (g.kind === 'roll') t = el('div', {class: 'rpg-toast roll' + (g.found ? ' found' : ''), 'data-testid': 'roll'}, `🎲 ${rpg.ui.chance} ${Math.round(g.chance * 100)}% → ${g.found ? rpg.ui.found : rpg.ui.notFound}`);
    else if (g.kind === 'item') {
      const item = itemOf(g.id)!;
      t = el('div', {class: 'rpg-toast item', 'data-testid': 'got-item'}, itemIcon(item.id),
        el('span', {}, el('b', {}, rpg.ui.got), el('br', {}), `${item.name} (${rpg.stats[item.role].short} +${item.bonus})`));
    } else {
      // 전체 레벨 업: 가운데에 크게
      const big = el('div', {class: 'rpg-levelup', 'data-testid': 'level-up'}, el('span', {class: 'rpg-lu-ring', 'aria-hidden': 'true'}),
        el('strong', {}, rpg.ui.levelUp), el('span', {class: 'rpg-lu-lv'}, `${PL.lv} ${g.level}`));
      setTimeout(() => stage.append(big), i * 250);
      setTimeout(() => big.remove(), 2600 + i * 250);
      return;
    }
    t.style.animationDelay = `${i * 0.25}s`;
    stack!.append(t);
    setTimeout(() => t.remove(), 3600 + i * 250);
  });
  updateBagButtons(stage);
}

/** 화면 위 '가방 Lv n' 버튼(누르거나 I 키) */
export function bagButton(stage: HTMLElement) {
  const b = button('', () => openBag(stage), {class: 'ms-pill rpg-bag-btn', 'data-testid': 'bag'});
  fillBagButton(b, loadHero());
  return b;
}
function fillBagButton(b: HTMLElement, h: Hero) {
  b.replaceChildren(el('span', {'aria-hidden': 'true'}, '🎒'), ` ${PL.bag} `, el('strong', {}, `${PL.lv} ${level(h)}`),
    el('span', {class: 'rpg-xpbar'}, el('i', {style: `width:${Math.round(levelProgress(h) * 100)}%`})));
}
function updateBagButtons(stage: HTMLElement) {
  const h = loadHero();
  stage.querySelectorAll<HTMLElement>('.rpg-bag-btn').forEach(b => fillBagButton(b, h));
}

export function openBag(stage: HTMLElement) {
  stage.querySelector('.rpg-bag')?.remove();
  const h = loadHero();
  const close = () => { panel.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e: KeyboardEvent) => {
    if (['Escape', 'i', 'I'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  };
  const panel = el('div', {class: 'rpg-bag', role: 'dialog', 'aria-label': PL.bag, 'data-testid': 'bag-panel'},
    el('section', {class: 'rpg-bag-card pop'},
      el('div', {class: 'rpg-bag-head'}, el('h2', {}, `🎒 ${PL.bag}`), el('strong', {class: 'rpg-bag-lv'}, `${PL.hero} ${PL.lv} ${level(h)}`),
        el('span', {class: 'rpg-xpbar big'}, el('i', {style: `width:${Math.round(levelProgress(h) * 100)}%`})), button(PL.close, close, {class: 'ms-btn'})),
      el('div', {class: 'rpg-bag-body'},
        el('div', {class: 'rpg-stats'}, el('p', {class: 'ms-label'}, PL.stats), ...ROLES.map(r => {
          const role = roleOf(r)!, base = statLevel(h, r), plus = equipBonus(h, r);
          const eq = h.equipped[r] ? itemOf(h.equipped[r]!) : null;
          return el('div', {class: 'rpg-stat', style: `--rc:${role.color}`, 'data-stat': r},
            roleIcon(r, role.color),
            el('span', {class: 'rpg-stat-name'}, rpg.stats[r].name),
            el('span', {class: 'rpg-stat-bar'}, el('i', {style: `width:${Math.min(100, base * 10)}%`}), el('b', {style: `width:${Math.min(100, plus * 10)}%`})),
            el('strong', {}, `${stat(h, r)}`),
            el('span', {class: 'rpg-stat-eq'}, eq ? `${PL.equipped}: ${eq.name} +${eq.bonus}` : ''));
        })),
        el('div', {class: 'rpg-items'}, el('p', {class: 'ms-label'}, PL.items), el('p', {class: 'rpg-hint'}, PL.bagHint),
          el('div', {class: 'rpg-grid'}, ...rpg.items.map(item => {
            const owned = h.items.includes(item.id), on = h.equipped[item.role] === item.id;
            if (!owned) return el('div', {class: 'rpg-slot empty', title: PL.unknown}, el('span', {class: 'rpg-q'}, '?'), el('small', {}, rpg.stats[item.role].short));
            return button('', () => { saveHero(equip(loadHero(), item.id)); close(); openBag(stage); updateBagButtons(stage); },
              {class: 'rpg-slot' + (on ? ' on' : ''), 'data-item': item.id, style: `--rc:${roleOf(item.role)!.color}`});
          }))))));
  // button()은 글만 받으므로 도구 칸 내용은 따로 붙인다
  panel.querySelectorAll<HTMLElement>('button.rpg-slot').forEach(b => {
    const item = itemOf(b.dataset.item!)!;
    b.append(itemIcon(item.id), el('strong', {}, item.name), el('small', {}, `${rpg.stats[item.role].short} +${item.bonus}${h.equipped[item.role] === item.id ? ` · ${PL.equipped}` : ''}`), el('span', {class: 'rpg-about'}, item.about));
  });
  window.addEventListener('keydown', onKey, true);
  stage.append(panel);
}
