import raw from '../../data/ranks.json' with {type: 'json'};
import {safeGet, safeSet, safeRemove} from '../core/persistence';
import {el} from '../ui/dom';
import {svg} from '../ui/art';
import {missions, validMission, type MissionState} from './engine';

// RPG 등급: 3D 미션 사건 파일을 마칠 때마다 별 하나(최대 5). 별은 각 미션의 저장 기록에서 센다.

export const ranksData = raw as {before: string; ranks: {stars: number; name: string; say: string}[]};
const SEEN_KEY = 'cons-lab:stars-seen';
export const missionKey = (caseId: string) => 'cons-lab:mission:' + caseId;

export function loadMission(caseId: string): MissionState | null {
  try {
    return validMission(JSON.parse(safeGet(missionKey(caseId)) ?? 'null'));
  } catch {
    return null;
  }
}

/** 별을 받은(완료한) 사건들 */
export const starredCases = () => missions.map(m => m.caseId).filter(id => loadMission(id)?.screen === 'complete');
export const rankName = (stars: number) => (stars <= 0 ? ranksData.before : ranksData.ranks[Math.min(stars, 5) - 1].name);
export const rankOf = (stars: number) => (stars <= 0 ? null : ranksData.ranks[Math.min(stars, 5) - 1]);

/** 별 의식을 이미 본 사건(한 사건에 한 번만 화려하게 보여 준다) */
export function seenStars(): string[] {
  try {
    const v = JSON.parse(safeGet(SEEN_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function markSeen(caseId: string) {
  const seen = seenStars();
  if (!seen.includes(caseId)) safeSet(SEEN_KEY, JSON.stringify([...seen, caseId]));
}

/** 다시하기: 이 사건(없으면 모든 사건)의 기록과 별 의식 기록을 지운다 */
export function clearMissions(caseIds: string[]) {
  for (const id of caseIds) safeRemove(missionKey(id));
  const left = seenStars().filter(id => !caseIds.includes(id));
  safeSet(SEEN_KEY, JSON.stringify(left));
}

export function starIcon(filled: boolean) {
  const s = svg('svg', {viewBox: '0 0 48 48', 'aria-hidden': 'true', class: filled ? 'star on' : 'star'});
  s.append(svg('path', {d: 'M24 3 L30 17 L45 18 L33.5 28 L37 43 L24 35 L11 43 L14.5 28 L3 18 L18 17 Z', 'stroke-linejoin': 'round'}));
  return s;
}

/** 등급 배지: 별 다섯 칸 + 등급 이름 */
export function rankBadge(stars: number, opts: {big?: boolean} = {}) {
  return el('div', {class: 'rank-badge' + (opts.big ? ' big' : ''), 'data-testid': 'rank', 'data-stars': stars},
    el('span', {class: 'rank-stars'}, ...[1, 2, 3, 4, 5].map(n => starIcon(n <= stars))),
    el('strong', {class: 'rank-name'}, rankName(stars)));
}

/** 짧은 축하 소리(인터넷 없이 브라우저가 직접 만든다). 막혀 있으면 조용히 넘어간다. */
export function chime(rankUp = false) {
  try {
    const AC = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = rankUp ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.5);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // 소리가 안 나도 수업은 계속된다
  }
}
