import {el} from '../ui/dom';
import type {DialogNode} from './hero';

// RPG 대화창: 아래쪽 둥근 상자 + 이름표 + 한 글자씩 나오는 말, 물음에는 오른쪽 선택 상자(▶ 커서).
// 열려 있는 동안에는 키를 먼저 가로채 뒤 화면이 움직이지 않게 한다.

export interface DialogScript {speaker: string; nodes: Record<string, DialogNode>; start: string; color?: string}

export function openDialog(stage: HTMLElement, script: DialogScript): Promise<{path: string[]; choices: string[]}> {
  return new Promise(resolve => {
    const path: string[] = [], choices: string[] = [];
    const text = el('p', {class: 'rpg-text', 'data-testid': 'dialog-text'});
    const more = el('span', {class: 'rpg-more', 'aria-hidden': 'true'}, '▼');
    const box = el('section', {class: 'rpg-dialog pop', role: 'dialog', 'aria-label': script.speaker, style: script.color ? `--sp:${script.color}` : ''},
      el('span', {class: 'rpg-name'}, script.speaker), text, more);
    const menu = el('div', {class: 'rpg-choices', role: 'listbox'});
    stage.append(box, menu);
    let id = script.start, typing = 0, full = '', cursor = 0;

    const node = () => script.nodes[id];
    function show(next: string) {
      id = next;
      path.push(id);
      stage.dataset.dialog = id;
      const n = node();
      full = n.say ?? n.ask ?? '';
      text.textContent = '';
      more.hidden = true;
      menu.replaceChildren();
      menu.hidden = true;
      clearInterval(typing);
      let i = 0;
      typing = window.setInterval(() => {
        i += 1;
        text.textContent = full.slice(0, i);
        if (i >= full.length) finishTyping();
      }, 28);
    }
    function finishTyping() {
      clearInterval(typing);
      typing = 0;
      text.textContent = full;
      const n = node();
      if (n.ask) {
        cursor = 0;
        menu.hidden = false;
        drawMenu();
      } else more.hidden = false;
    }
    function drawMenu() {
      const n = node();
      menu.replaceChildren(...n.choices!.map((c, i) => el('button', {
        type: 'button', class: 'rpg-choice' + (i === cursor ? ' on' : ''), role: 'option', 'aria-selected': i === cursor, 'data-choice': i + 1,
        onclick: () => pick(i),
      }, el('span', {class: 'rpg-cursor', 'aria-hidden': 'true'}, i === cursor ? '▶' : ''), `${i + 1}. ${c.label}`)));
    }
    function pick(i: number) {
      const c = node().choices?.[i];
      if (!c) return;
      choices.push(c.label);
      show(c.next);
    }
    function advance() {
      if (typing) { finishTyping(); return; }
      const n = node();
      if (n.ask) { pick(cursor); return; }
      if (n.next) show(n.next);
      else end();
    }
    function end() {
      clearInterval(typing);
      window.removeEventListener('keydown', onKey, true);
      box.remove();
      menu.remove();
      delete stage.dataset.dialog;
      resolve({path, choices});
    }
    function onKey(e: KeyboardEvent) {
      e.stopImmediatePropagation();
      const k = e.key;
      const n = node();
      if ([' ', 'Enter', 'PageDown', 'e', 'E', 'ArrowRight'].includes(k)) { e.preventDefault(); advance(); return; }
      if (n.ask && !typing) {
        if (['ArrowUp', 'w', 'W'].includes(k)) { cursor = Math.max(0, cursor - 1); drawMenu(); }
        if (['ArrowDown', 's', 'S'].includes(k)) { cursor = Math.min(n.choices!.length - 1, cursor + 1); drawMenu(); }
        const num = Number(k);
        if (Number.isInteger(num) && num >= 1 && num <= n.choices!.length) pick(num - 1);
      }
    }
    box.addEventListener('click', advance);
    window.addEventListener('keydown', onKey, true);
    show(script.start);
  });
}
