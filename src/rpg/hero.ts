import raw from '../../data/rpg.json' with {type: 'json'};
import {safeGet, safeSet} from '../core/persistence';
import type {RoleId} from '../roles/engine';

// 연구원 성장: 역할 네 능력치의 경험치·레벨, 도구(아이템) 모으기와 장착, 동물 대화에서 도구를 찾을 확률.
// 상태 전이는 순수 함수로 두고(단위 테스트), 저장은 load/save만 한다.

export const ROLES: RoleId[] = ['record', 'analyze', 'material', 'undo'];
export interface Item {id: string; name: string; role: RoleId; bonus: number; about: string}
export interface DialogNode {say?: string; ask?: string; next?: string; choices?: {label: string; next: string}[]}
export interface Animal {id: string; kind: string; color?: string; name: string; sets: string[]; role: RoleId; drop: string; chance: number; perStat: number; start: string; nodes: Record<string, DialogNode>}
export const rpg = raw as unknown as {
  stats: Record<RoleId, {name: string; short: string}>;
  xp: {clue: number; decisionSolved: number; roleChange: number; talk: number; medal: Record<string, number>; perStatLevel: number; perLevel: number};
  items: Item[];
  gifts: {roleChange: Record<RoleId, string>; caseComplete: Record<string, string>; gold: Record<string, string>};
  ui: Record<string, string>;
  reset: {button: string; title: string; activity: string; all: string; cancel: string; allNote: string; allWarn: string; allYes: string; allNo: string; scopes: Record<string, string>};
  mentor: {name: string; start: string; nodes: Record<string, DialogNode>};
  animals: Animal[];
};
export const itemOf = (id: string) => rpg.items.find(i => i.id === id);

export interface Hero {
  version: 1;
  xp: Record<RoleId, number>;
  items: string[];
  equipped: Partial<Record<RoleId, string>>;
  talked: string[];          // 이야기한 동물(경험치는 처음 한 번만, 도구 확률은 얻을 때까지 매번)
  mentorDone: boolean;
}
/** 화면에 보여 줄 변화: 경험치, 레벨 업, 새 도구, 도구 찾기 확률 결과 */
export type Gain =
  | {kind: 'xp'; role: RoleId; amount: number}
  | {kind: 'statUp'; role: RoleId; level: number}
  | {kind: 'levelUp'; level: number}
  | {kind: 'item'; id: string}
  | {kind: 'roll'; chance: number; found: boolean};

export const newHero = (): Hero => ({version: 1, xp: {record: 0, analyze: 0, material: 0, undo: 0}, items: [], equipped: {}, talked: [], mentorDone: false});
const total = (h: Hero) => ROLES.reduce((n, r) => n + h.xp[r], 0);
export const statLevel = (h: Hero, role: RoleId) => 1 + Math.floor(h.xp[role] / rpg.xp.perStatLevel);
export const equipBonus = (h: Hero, role: RoleId) => itemOf(h.equipped[role] ?? '')?.bonus ?? 0;
export const stat = (h: Hero, role: RoleId) => statLevel(h, role) + equipBonus(h, role);
export const level = (h: Hero) => 1 + Math.floor(total(h) / rpg.xp.perLevel);
/** 다음 레벨까지 진행(0~1) */
export const levelProgress = (h: Hero) => (total(h) % rpg.xp.perLevel) / rpg.xp.perLevel;

export function gainXp(prev: Hero, role: RoleId, amount: number): {hero: Hero; gains: Gain[]} {
  const h = structuredClone(prev);
  const beforeStat = statLevel(h, role), beforeLevel = level(h);
  h.xp[role] += amount;
  const gains: Gain[] = [{kind: 'xp', role, amount}];
  if (statLevel(h, role) > beforeStat) gains.push({kind: 'statUp', role, level: statLevel(h, role)});
  if (level(h) > beforeLevel) gains.push({kind: 'levelUp', level: level(h)});
  return {hero: h, gains};
}

/** 도구 받기: 처음이면 가방에 넣고, 그 역할 칸이 비었거나 더 좋으면 바로 장착한다 */
export function giveItem(prev: Hero, id: string): {hero: Hero; gains: Gain[]} {
  const item = itemOf(id);
  if (!item || prev.items.includes(id)) return {hero: prev, gains: []};
  const h = structuredClone(prev);
  h.items.push(id);
  if (equipBonus(h, item.role) < item.bonus) h.equipped[item.role] = id;
  return {hero: h, gains: [{kind: 'item', id}]};
}

export function equip(prev: Hero, id: string): Hero {
  const item = itemOf(id);
  if (!item || !prev.items.includes(id)) return prev;
  return {...structuredClone(prev), equipped: {...prev.equipped, [item.role]: id}};
}

/** 동물에게서 도구를 찾을 확률: 기본 확률 + 그 역할 능력치 × perStat (최대 90%) */
export const dropChance = (h: Hero, a: Animal) => Math.min(0.9, a.chance + stat(h, a.role) * a.perStat);

/** 동물과 이야기를 마쳤을 때: 처음이면 경험치, 그 도구가 아직 없으면 이야기할 때마다 확률로 도구. rand는 0~1(테스트에서 고정한다) */
export function finishTalk(prev: Hero, a: Animal, rand: number): {hero: Hero; gains: Gain[]} {
  const first = !prev.talked.includes(a.id);
  if (!first && prev.items.includes(a.drop)) return {hero: prev, gains: []};
  let {hero, gains} = first ? gainXp(prev, a.role, rpg.xp.talk) : {hero: structuredClone(prev), gains: [] as Gain[]};
  if (first) hero.talked.push(a.id);
  if (hero.items.includes(a.drop)) return {hero, gains};
  const chance = dropChance(hero, a);
  const found = rand < chance;
  gains = [...gains, {kind: 'roll', chance, found}];
  if (found) {
    const r = giveItem(hero, a.drop);
    hero = r.hero;
    gains = [...gains, ...r.gains];
  }
  return {hero, gains};
}

export function validHero(v: unknown): Hero | null {
  if (!v || typeof v !== 'object') return null;
  const h = v as Hero;
  if (h.version !== 1 || !h.xp || !ROLES.every(r => Number.isFinite(h.xp[r]) && h.xp[r] >= 0)) return null;
  if (!Array.isArray(h.items) || !h.items.every(id => itemOf(id))) return null;
  if (!h.equipped || typeof h.equipped !== 'object' || !Object.entries(h.equipped).every(([r, id]) => ROLES.includes(r as RoleId) && h.items.includes(id!) && itemOf(id!)!.role === r)) return null;
  if (!Array.isArray(h.talked) || !h.talked.every(id => typeof id === 'string') || typeof h.mentorDone !== 'boolean') return null;
  return h;
}

const KEY = 'cons-lab:hero';
export function loadHero(): Hero {
  try {
    return validHero(JSON.parse(safeGet(KEY) ?? 'null')) ?? newHero();
  } catch {
    return newHero();
  }
}
export const saveHero = (h: Hero) => safeSet(KEY, JSON.stringify(h));

/** 화면 모드에서 쓰는 한 줄 도우미: 지금 저장된 연구원에 변화를 더하고 저장, 변화 목록을 돌려준다 */
export function award(change: (h: Hero) => {hero: Hero; gains: Gain[]}): Gain[] {
  const {hero, gains} = change(loadHero());
  saveHero(hero);
  return gains;
}
