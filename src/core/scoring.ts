import {scenario} from '../content/loadContent';
import type {Outcome} from '../content/types';
import type {Vote} from './types';

export const clampHealth = (h: number) => Math.max(0, h);
/** 근거 배지: 증거 출처 태그를 하나라도 달면 +1(docs/12 §5.1). 원칙 카드는 교사 기록용이다. */
export function applyVote(v: Vote, o: Outcome) {
  return {
    delta: o.healthDelta ?? scenario.outcomeTypes[o.result].healthDelta,
    badge: o.result === 'solved' ? o.principle : null,
    evidencePoint: v.reasons.length ? 1 : 0,
  };
}
