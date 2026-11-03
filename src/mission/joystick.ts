import {el} from '../ui/dom';

/** 화면 위 조이스틱. 끌면 -1~1 벡터(위가 +y)를 알린다. */
export function joystick(label: string, onMove: (v: {x: number; y: number}) => void) {
  const knob = el('span', {class: 'ms-joy-knob'});
  const base = el('div', {class: 'ms-joy', role: 'application', 'aria-label': label, 'data-testid': 'joystick'}, knob);
  const R = 90;
  let id: number | null = null;
  const set = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove({x: dx / R, y: -dy / R});
  };
  const release = () => { id = null; knob.style.transform = ''; onMove({x: 0, y: 0}); };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const r = base.getBoundingClientRect();
    const scale = r.width / base.offsetWidth || 1;   // 무대가 줄어든 만큼 되돌린다
    set((e.clientX - (r.left + r.width / 2)) / scale, (e.clientY - (r.top + r.height / 2)) / scale);
  };
  base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(e.pointerId); move(e); });
  base.addEventListener('pointermove', move);
  base.addEventListener('pointerup', release);
  base.addEventListener('pointercancel', release);
  return {el: base, release};
}
