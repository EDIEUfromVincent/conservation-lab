import raw from '../../data/games.json' with {type: 'json'};
import {safeGet, safeSet} from '../core/persistence';
import {rpg, stat, itemOf, type Hero} from '../rpg/hero';
import type {RoleId} from '../roles/engine';
import {GL} from './labels';

// 훈련장 미니게임 공용: 데이터, 단계별 메달(가장 좋은 것만), 단계 열기, 장착 도구·능력치의 힘, 얻을 곳 안내.

export type Medal = 'gold' | 'silver' | 'bronze';
export type StageNo = 1 | 2 | 3;
export interface Need {items?: string[]; stat?: {role: RoleId; level: number}}
export interface StageInfo {name: string; sub: string; need?: Need}
export interface Pack {label: string; shake: number; say: string; best?: boolean}
export interface GameBase {id: string; name: string; role: RoleId; caseId: string; intro: string; howto: string; win: string; lose?: string; tip: string; stages: StageInfo[]}
export interface TransportGame extends GameBase {packQ: string; packs: Pack[]; start: string; goal: string; bump: string; wall: string; lose: string}
export interface RustGame extends GameBase {found: string; green: string; miss: string; timeUp: string}
export interface PhotoGame extends GameBase {memorize: string; place: string; peek: string; right: string; wrong: string; lose: string}
export interface ClimateGame extends GameBase {humidity: string; temperature: string; dry: string; wet: string; cool: string; warm: string; events: string[]; danger: string; lose: string}
export interface PeelGame extends GameBase {heat: string; press: string; tooHot: string; tooCold: string; tooHard: string; tooSoft: string; good: string; lose: string}
export interface TowerGame extends GameBase {build: string; skip: string; blurry: string; evidence: string[]; imagined: string[]; right: string; wrongBuild: string; wrongSkip: string; lose: string}
export interface PigmentGame extends GameBase {sample: string; shapes: Record<string, string>; noShape: string; right: string; wrong: string; lose: string}
export type AnyGame = GameBase & Record<string, unknown>;
export const gamesData = raw as unknown as {title: string; sub: string; medals: Record<Medal | 'none', string>; games: AnyGame[]};
export const gameOf = (id: string) => gamesData.games.find(g => g.id === id);

// ── 메달: {게임: {단계: 메달}} ──
const KEY = 'cons-lab:games';
const ORDER: Medal[] = ['bronze', 'silver', 'gold'];
export type MedalBook = Record<string, Partial<Record<StageNo, Medal>>>;
export function medals(): MedalBook {
  try {
    const v = JSON.parse(safeGet(KEY) ?? '{}');
    if (!v || typeof v !== 'object') return {};
    const out: MedalBook = {};
    for (const [id, m] of Object.entries(v)) {
      if (!gameOf(id)) continue;
      // 예전 기록({게임: 메달})은 1단계 메달로 읽는다
      if (typeof m === 'string') { if (ORDER.includes(m as Medal)) out[id] = {1: m as Medal}; continue; }
      if (m && typeof m === 'object') out[id] = Object.fromEntries(Object.entries(m).filter(([s, x]) => ['1', '2', '3'].includes(s) && ORDER.includes(x as Medal))) as Partial<Record<StageNo, Medal>>;
    }
    return out;
  } catch {
    return {};
  }
}
/** 새 메달이 그 단계의 이전 메달보다 좋을 때만 바꾼다. 더 좋아졌으면 true */
export function saveMedal(id: string, stage: StageNo, medal: Medal) {
  const all = medals();
  const prev = all[id]?.[stage];
  const better = !prev || ORDER.indexOf(medal) > ORDER.indexOf(prev);
  if (better) safeSet(KEY, JSON.stringify({...all, [id]: {...all[id], [stage]: medal}}));
  return better;
}
export const bestMedal = (book: MedalBook, id: string): Medal | undefined =>
  ([3, 2, 1] as StageNo[]).map(s => book[id]?.[s]).find(Boolean);
/** 1단계는 늘 열려 있고, 앞 단계 메달이 있으면 다음 단계가 열린다 */
export const stageOpen = (book: MedalBook, id: string, stage: StageNo) => stage === 1 || !!book[id]?.[(stage - 1) as StageNo];

// ── 힘: 장착한 도구와 능력치 ──
export interface Power {has: (item: string) => boolean; lv: (role: RoleId) => number}
export const powerOf = (h: Hero): Power => ({
  has: item => Object.values(h.equipped).includes(item),
  lv: role => stat(h, role),
});
export function needMet(need: Need | undefined, p: Power) {
  if (!need) return true;
  if (need.items && !need.items.some(p.has)) return false;
  if (need.stat && p.lv(need.stat.role) < need.stat.level) return false;
  return true;
}

/** 도구를 얻을 수 있는 곳(동물·역할 변신·사건 보상·금메달) */
export function sourcesOf(itemId: string): string[] {
  const out: string[] = [];
  const where = (set: string) => (set === 'roles' ? GL.atRoles : `${GL.caseNo} ${set.replace('case', '')} ${GL.atCase}`);
  for (const a of rpg.animals) if (a.drop === itemId) out.push(`${a.name}(${a.sets.map(where).join(' · ')})`);
  for (const [role, id] of Object.entries(rpg.gifts.roleChange)) if (id === itemId) out.push(`${rpg.stats[role as RoleId].short} ${GL.roleChange}`);
  for (const [caseId, id] of Object.entries(rpg.gifts.caseComplete)) if (id === itemId) out.push(`${GL.caseNo} ${caseId.replace('case', '')} ${GL.caseReward}`);
  for (const [gameId, id] of Object.entries(rpg.gifts.gold)) if (id === itemId) out.push(`${gameOf(gameId)?.name ?? gameId} ${GL.goldReward}`);
  return out;
}

/** 단계에 필요한 것이 없을 때 알려 줄 말: 무엇이 필요하고 어디서 얻는지 */
export function needHint(need: Need): {what: string; where: string} {
  if (need.items) {
    const names = need.items.map(id => itemOf(id)?.name ?? id);
    return {what: `${GL.needTool} ${names.join(` ${GL.or} `)}${names.length > 1 ? ` ${GL.oneIsEnough}` : ''}`, where: need.items.flatMap(sourcesOf).join(', ')};
  }
  const s = need.stat!;
  return {what: `${rpg.stats[s.role].name} ${GL.level} ${s.level} ${GL.needStat}`, where: GL.statWhere};
}
