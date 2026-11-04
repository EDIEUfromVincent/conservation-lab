import raw from '../../data/games.json' with {type: 'json'};
import {safeGet, safeSet} from '../core/persistence';

// 훈련장 미니게임 공용: 데이터, 메달 저장(가장 좋은 메달만 남긴다)

export type Medal = 'gold' | 'silver' | 'bronze';
export interface Pack {label: string; shake: number; say: string; best?: boolean}
export interface GameBase {id: string; name: string; role: string; caseId: string; intro: string; howto: string; win: string; tip: string}
export interface TransportGame extends GameBase {packQ: string; packs: Pack[]; start: string; goal: string; bump: string; wall: string; lose: string}
export interface RustGame extends GameBase {found: string; green: string; miss: string}
export const gamesData = raw as {title: string; sub: string; medals: Record<Medal | 'none', string>; games: (TransportGame | RustGame)[]};
export const gameOf = (id: string) => gamesData.games.find(g => g.id === id);

const KEY = 'cons-lab:games';
const ORDER: Medal[] = ['bronze', 'silver', 'gold'];

export function medals(): Record<string, Medal> {
  try {
    const v = JSON.parse(safeGet(KEY) ?? '{}');
    if (!v || typeof v !== 'object') return {};
    return Object.fromEntries(Object.entries(v).filter(([id, m]) => gameOf(id) && ORDER.includes(m as Medal))) as Record<string, Medal>;
  } catch {
    return {};
  }
}
/** 새 메달이 이전보다 좋을 때만 바꾼다. 더 좋아졌으면 true */
export function saveMedal(id: string, medal: Medal) {
  const all = medals();
  const better = !all[id] || ORDER.indexOf(medal) > ORDER.indexOf(all[id]);
  if (better) safeSet(KEY, JSON.stringify({...all, [id]: medal}));
  return better;
}
