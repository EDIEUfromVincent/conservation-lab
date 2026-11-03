import {el} from '../ui/dom';
import {svg} from '../ui/art';

// 역할 웹툰 4컷. 그림은 블록 연구원 + 소품으로 직접 그린다(외부 이미지 없음). 대사·설명은 data/roles.json.

export interface Panel {scene: string; say: string; caption: string}
type Draw = (g: SVGGElement, color: string) => void;

const INK = '#1d2a2a', SKIN = '#e2b48e', HAIR = '#3a2b22', WOOD = '#9a6b45', PAPER = '#fffdf7';
const line = {stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'};
const put = (g: SVGGElement, ...nodes: SVGElement[]) => { g.append(...nodes); };
const rect = (x: number, y: number, w: number, h: number, fill: string, extra: Record<string, string | number> = {}) =>
  svg('rect', {x, y, width: w, height: h, fill, ...line, ...extra});
const path = (d: string, fill = 'none', extra: Record<string, string | number> = {}) => svg('path', {d, fill, ...line, ...extra});
const circle = (cx: number, cy: number, r: number, fill: string) => svg('circle', {cx, cy, r, fill, ...line});
const label = (x: number, y: number, text: string, size = 22, fill = INK) => {
  const t = svg('text', {x, y, 'font-size': size, 'font-weight': 900, fill, 'text-anchor': 'middle', 'font-family': 'sans-serif'});
  t.textContent = text;
  return t;
};

/** 블록 연구원. pose: 기본 · 팔 들기 · 앞으로 내밀기 */
function person(g: SVGGElement, x: number, color: string, pose: 'stand' | 'up' | 'hold' = 'stand') {
  const arm = (side: -1 | 1) => {
    if (pose === 'up') return rect(x + side * 38 - 9, 118, 18, 50, color, {transform: `rotate(${side * -35} ${x + side * 38} 168)`});
    if (pose === 'hold' && side === 1) return rect(x + 30, 150, 52, 18, color);
    return rect(x + side * 38 - 9, 150, 18, 56, color);
  };
  put(g,
    rect(x - 22, 228, 18, 36, '#2d3a3a'), rect(x + 4, 228, 18, 36, '#2d3a3a'),
    arm(-1), arm(1),
    rect(x - 30, 146, 60, 86, color), rect(x - 16, 156, 32, 40, PAPER, {'stroke-width': 3}),
    rect(x - 26, 92, 52, 54, SKIN), rect(x - 28, 86, 56, 16, HAIR),
    rect(x - 13, 112, 7, 9, INK, {'stroke-width': 0}), rect(x + 6, 112, 7, 9, INK, {'stroke-width': 0}));
}

const SCENES: Record<string, Draw> = {
  // 기록
  arrive: (g, c) => {
    person(g, 110, c, 'up');
    put(g, rect(200, 170, 140, 90, WOOD), path('M200 200 H340 M200 230 H340'), label(270, 160, '?', 44), label(80, 80, '!', 40), label(140, 72, '!', 34));
  },
  camera: (g, c) => {
    person(g, 100, c, 'hold');
    put(g, rect(170, 132, 56, 40, '#5c6670'), circle(198, 152, 13, '#9fe0e6'), rect(178, 124, 16, 10, '#5c6670'),
      path('M240 120 L262 104 M244 152 H272 M240 184 L262 200', 'none', {stroke: '#f2b632', 'stroke-width': 6}),
      path('M300 250 C286 222 290 186 316 176 L322 160 H346 L352 176 C378 186 382 222 368 250 Z', '#1f3557'), path('M296 214 H372', 'none', {stroke: PAPER, 'stroke-width': 7}));
  },
  number: (g, c) => {
    person(g, 90, c, 'hold');
    put(g, rect(160, 214, 230, 18, WOOD));
    [[190, 1], [250, 2], [312, 3]].forEach(([x, n]) => put(g,
      path(`M${x - 22} 212 L${x} 178 L${x + 24} 212 Z`, '#1f3557'),
      rect(x - 14, 238, 28, 22, PAPER, {'stroke-width': 3}), label(x, 256, String(n), 18)));
  },
  notebook: (g, c) => {
    person(g, 90, c, 'hold');
    put(g, rect(170, 120, 210, 130, PAPER), path('M275 120 V250'),
      ...[146, 172, 198, 224].flatMap(y => [path(`M186 ${y} H262`, 'none', {'stroke-width': 3}), path(`M290 ${y} H364`, 'none', {'stroke-width': 3, 'stroke-dasharray': '6 6'})]),
      path('M150 160 L176 128', 'none', {stroke: '#f2b632', 'stroke-width': 9}));
  },
  // 분석
  magnifier: (g, c) => {
    person(g, 90, c, 'hold');
    put(g, rect(220, 170, 150, 86, '#7a4a33'), circle(300, 206, 14, '#c0622d'), circle(292, 196, 44, 'rgba(159,224,230,.45)'), path('M260 226 L222 262', 'none', {'stroke-width': 10}));
  },
  compare: (g, c) => {
    person(g, 80, c, 'stand');
    put(g, rect(160, 110, 140, 140, PAPER), ...[140, 176, 212].map(y => path(`M172 ${y} H288`, 'none', {'stroke-width': 3})),
      rect(172, 168, 116, 18, 'rgba(242,182,50,.55)', {'stroke-width': 0}),
      circle(350, 176, 24, '#c0622d'), path('M322 176 H300 M308 168 L300 176 L308 184'));
  },
  sample: (g, c) => {
    person(g, 80, c, 'stand');
    put(g, rect(220, 236, 120, 20, '#5c6670'), rect(270, 120, 22, 116, '#5c6670'), rect(250, 104, 30, 46, '#5c6670', {transform: 'rotate(-20 265 127)'}),
      rect(236, 196, 90, 14, PAPER), path('M276 196 l6 -8 l7 8 Z', '#2f8f6f'), circle(176, 140, 6, '#2f8f6f'), path('M184 144 L262 190', 'none', {'stroke-dasharray': '6 6', 'stroke-width': 3}));
  },
  test: (g, c) => {
    person(g, 80, c, 'stand');
    [190, 260, 330].forEach((x, i) => put(g, path(`M${x - 26} 170 L${x - 20} 252 H${x + 20} L${x + 26} 170`, '#d9eef0'), rect(x - 4, 182, 8, 52, i === 1 ? '#c0622d' : '#8f9592', {'stroke-width': 2})));
  },
  // 재료
  shelf: (g, c) => {
    person(g, 80, c, 'stand');
    put(g, rect(170, 150, 220, 12, WOOD), rect(170, 244, 220, 12, WOOD));
    [[200, '#e8f4f6'], [262, '#e8f4f6'], [324, '#ead68a']].forEach(([x, f]) => put(g, rect(Number(x) - 20, 186, 40, 58, String(f)), rect(Number(x) - 22, 176, 44, 12, '#5c6670')));
    put(g, circle(350, 104, 26, PAPER), path('M350 88 V104 L362 112'));
  },
  tools: (g, c) => {
    person(g, 80, c, 'stand');
    put(g, rect(170, 160, 90, 14, '#9aa0a4'), rect(250, 156, 30, 22, '#3a3e44'), path('M178 128 L252 204 M252 128 L178 204', 'none', {stroke: '#b3372f', 'stroke-width': 9}),
      rect(290, 168, 96, 14, WOOD), circle(338, 175, 40, 'none'));
    g.lastElementChild!.setAttribute('stroke', '#1f7a4d');
    g.lastElementChild!.setAttribute('stroke-width', '8');
  },
  ad: (g, c) => {
    person(g, 80, c, 'stand');
    put(g, rect(170, 96, 200, 150, '#fff1c2'), label(270, 150, '!!!', 46, '#b3372f'), rect(214, 176, 112, 40, '#f2b632'),
      path('M184 108 L356 234 M356 108 L184 234', 'none', {stroke: '#b3372f', 'stroke-width': 8, opacity: 0.85}));
  },
  match: (g, c) => {
    person(g, 80, c, 'stand');
    put(g, rect(180, 170, 80, 80, '#b77541'), rect(282, 170, 80, 80, '#7a4a33'), rect(262, 160, 18, 100, PAPER), path('M268 150 V128 M262 136 L268 128 L274 136'));
  },
  // 되돌리기
  question: (g, c) => {
    person(g, 100, c, 'stand');
    put(g, circle(220, 92, 46, PAPER), circle(166, 140, 8, PAPER), circle(184, 120, 12, PAPER), label(220, 108, '?', 46),
      rect(280, 196, 100, 60, '#c7a26b'), rect(310, 186, 40, 14, '#f1e7b8'));
  },
  support: (g, c) => {
    person(g, 80, c, 'stand');
    [0, 1, 2, 3].forEach(i => put(g, rect(250 + i * 4, 210 - i * 36, 90 - i * 10, 34, '#c5bdae')));
    put(g, path('M372 252 L330 130', 'none', {stroke: WOOD, 'stroke-width': 12}), path('M210 252 L254 140', 'none', {stroke: WOOD, 'stroke-width': 12}));
  },
  peel: (g, c) => {
    person(g, 80, c, 'hold');
    put(g, rect(190, 214, 190, 40, '#e0b13a'), path('M260 214 C268 196 292 196 300 214', '#f1e7b8'),
      path('M150 158 L262 202', 'none', {stroke: WOOD, 'stroke-width': 9}),
      ...[0, 1, 2].map(i => path(`M${300 + i * 22} 186 c-8 -12 8 -22 0 -34`, 'none', {stroke: '#e0533d', 'stroke-width': 4})));
  },
  keep: (g, c) => {
    person(g, 90, c, 'hold');
    put(g, rect(220, 196, 150, 60, '#c7a26b'), path('M220 196 L240 176 H390 L370 196'),
      ...[[250, 222], [282, 230], [316, 220], [344, 232]].map(([x, y]) => path(`M${x} ${y} l8 -10 l8 10 Z`, '#1f3557', {'stroke-width': 2})),
      path(`M176 154 l10 -12 l10 12 Z`, '#1f3557', {'stroke-width': 2}));
  },
};

/** 역할 하나의 웹툰 4컷 */
export function webtoon(panels: Panel[], color: string) {
  return el('div', {class: 'webtoon'}, ...panels.map((p, i) => {
    const art = svg('svg', {viewBox: '0 0 400 280', role: 'img', 'aria-hidden': 'true'});
    art.append(svg('rect', {x: 0, y: 0, width: 400, height: 280, fill: color, opacity: 0.12}), svg('path', {d: 'M0 262 H400', stroke: INK, 'stroke-width': 4}));
    const g = svg('g', {}) as SVGGElement;
    (SCENES[p.scene] ?? SCENES.question)(g, color);
    art.append(g);
    return el('figure', {class: 'wt-panel', 'data-scene': p.scene},
      el('span', {class: 'wt-no'}, i + 1), art,
      el('p', {class: 'wt-bubble'}, p.say),
      el('figcaption', {}, p.caption));
  }));
}

export const SCENE_NAMES = Object.keys(SCENES);

/** 역할 아이콘: 기록 사진기 · 분석 돋보기 · 재료 병 · 되돌리기 화살표 */
export function roleIcon(id: string, color: string) {
  const s = svg('svg', {viewBox: '0 0 48 48', 'aria-hidden': 'true'});
  const ring = svg('circle', {cx: 24, cy: 24, r: 22, fill: color, stroke: INK, 'stroke-width': 3});
  const w = {stroke: '#fff', 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'};
  const parts: Record<string, SVGElement[]> = {
    record: [svg('rect', {x: 12, y: 17, width: 24, height: 17, rx: 3, ...w}), svg('circle', {cx: 24, cy: 25.5, r: 5, ...w}), svg('path', {d: 'M18 17 L20 13 H28 L30 17', ...w})],
    analyze: [svg('circle', {cx: 21, cy: 21, r: 8, ...w}), svg('path', {d: 'M27 27 L35 35', ...w})],
    material: [svg('path', {d: 'M19 12 H29 M20 12 V18 L15 34 H33 L28 18 V12', ...w}), svg('path', {d: 'M17 28 H31', ...w})],
    undo: [svg('path', {d: 'M16 20 H29 a7 7 0 0 1 0 14 H20', ...w}), svg('path', {d: 'M20 15 L15 20 L20 25', ...w})],
  };
  s.append(ring, ...(parts[id] ?? []));
  return s;
}
