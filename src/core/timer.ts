import {scenario} from '../content/loadContent';
import type {AppState, Phase} from './types';

/** 수업 단계 → data/scenario.json의 profiles[].phases[].id, story.clock 키 */
export const PHASE_IDS: Partial<Record<Phase, string>> = {
  INTRO: 'intro', VIDEO: 'video', HERITAGE_PICK: 'heritagePick', EXPERT_STUDY: 'expertStudy', TEAM_SETUP: 'teamSetup',
  BREAK: 'break', JOURNAL: 'journal', ALGORITHM: 'algorithm', REQUEST: 'request', BUILD: 'build', TEST: 'test',
  DEBUG: 'debug', AI_CHECK: 'aiCheck', REFLECT: 'reflect', WRAPUP: 'wrapup',
};
export const phaseId = (s: AppState) => (s.phase === 'CASE' ? scenario.cases[s.caseIndex]?.id : PHASE_IDS[s.phase]) ?? '';
export function planned(s: AppState) {
  const id = phaseId(s);
  return (scenario.profiles[s.profile].phases.find(p => p.id === id)?.minutes ?? 0) * 60;
}
export function remaining(s: AppState, now = Date.now()) {
  const until = s.settings.paused ? s.settings.pausedAt : now;
  return planned(s) + s.settings.timerOffsetSec - Math.floor((until - s.phaseStartedAt - s.settings.pausedMs) / 1000);
}
/** 이야기 속 시계(docs/12 §3.2). 단계마다 data/story.clock에서 읽는다. */
export const storyClock = (s: AppState) => (scenario.story.clock as Record<string, string>)[phaseId(s)] ?? '';
