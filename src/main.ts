import {mountTeacher} from './modes/teacher';
import {mountManual} from './modes/manual';
import {mountPrint} from './modes/print';
import {L} from './ui/labels';
import {el} from './ui/dom';
import './ui/theme.css';
import './ui/layout.css';

declare const __EXTRAS__: boolean;

const root = document.querySelector<HTMLElement>('#app')!;
const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'teacher';

// 탐험(expedition)과 4D 프레임(frame)은 2시간 수업과 분리된 심화 자료다(docs/12 §9).
// 기본 빌드에서는 __EXTRAS__가 false라 아래 동적 import가 번들에서 빠진다.
async function mountExtra(name: string): Promise<boolean> {
  if (!__EXTRAS__) return false;
  if (name === 'expedition') {
    (await import('./modes/expedition')).mountExpedition(root);
    return true;
  }
  if (name === 'frame') {
    (await import('./modes/frame')).mountFrame(root);
    return true;
  }
  return false;
}

if (mode === 'teacher') mountTeacher(root);
else if (mode === 'mission') void import('./modes/mission').then(m => m.mountMission(root, params));
else if (mode === 'manual') mountManual(root, params);
else if (mode === 'print') mountPrint(root);
else {
  void mountExtra(mode).then(mounted => {
    if (!mounted) root.append(el('p', {}, L.unsupported), el('a', {href: '?mode=teacher'}, L.start));
  });
}
