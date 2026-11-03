import type {ChoiceKey, ResultType, StepKey, TeamId} from '../content/types';

export type ProfileId = '120' | '80';

/** 수업 단계. 순서는 actions.ts의 PHASE_ORDER가 정한다(docs/12 §3.2). */
export type Phase =
  | 'SETUP' | 'INTRO' | 'VIDEO' | 'HERITAGE_PICK' | 'EXPERT_STUDY' | 'TEAM_SETUP'
  | 'CASE' | 'BREAK'
  | 'JOURNAL' | 'ALGORITHM'
  | 'REQUEST' | 'BUILD' | 'TEST' | 'DEBUG'
  | 'AI_CHECK' | 'REFLECT' | 'WRAPUP';

export type PredictionValue = string | string[] | number;
export interface Vote {choice: ChoiceKey; reasons: string[]}
export interface VoteRecord extends Vote {result: ResultType; delta: number; at: number}
export interface Team {
  id: TeamId;
  name: string;
  health: Record<string, number>;
  votes: Record<string, VoteRecord[]>;
  /** 교사 패널·기록용. 학생 화면에는 원칙 이름을 보여 주지 않는다. */
  badges: string[];
  evidencePoints: number;
  /** S05에서 고른 '우리 팀 의뢰 후보' 유산 이름 */
  heritage: string;
}
export interface Path {
  caseId: string; nodeId: string; attempt: 1 | 2; choice: ChoiceKey; result: ResultType;
  decidedBy: 'majority' | 'teacher'; step: StepKey; tally: Record<string, number>; at: number;
}
export interface Stage {
  kind: 'brief' | 'experts' | 'predict' | 'lab' | 'decision' | 'historyJoin' | 'history' | 'wrap';
  line: number; nodeId: string; attempt: 1 | 2; sub: 'vote' | 'outcome' | 'delayed' | 'retryOffer'; part: string;
}

/** 연구 일지에 들어온 행동 카드. classResult는 반이 그 결정에서 고른 길의 결과(건너뛰었으면 null). */
export interface JournalEntry {cardId: string; caseId: string; decisionId: string; classResult: ResultType | null}

/** 우리 반 알고리즘의 한 단계 = 학생이 만든 행동 카드 묶음(docs/12 §6.1 ClassAlgorithmStep). 배열 순서가 단계 순서다. */
export interface Cluster {id: string; name: string; cardIds: string[]}

export interface ProgramChoice {key: ChoiceKey; label: string; result: ResultType | ''; why: string; stepId: string}
export interface ProgramDecision {id: string; owner: TeamId; situation: string; choices: ProgramChoice[]}
export interface Program {
  heritage: {name: string; material: string; risk: string};
  decisions: ProgramDecision[];
  version: number;
}
export interface TestRun {decisionId: string; testerTeam: TeamId; choice: ChoiceKey; note: string; version: number; resolved: boolean}

export type TrustValue = 'trust' | 'unsure' | 'distrust';
export type StepCheck = 'kept' | 'missed' | 'unknown';

export interface AppState {
  schemaVersion: 2;
  sessionId: string;
  startedAt: number;
  profile: ProfileId;
  phase: Phase;
  phaseStartedAt: number;
  subScreen: number;
  caseIndex: number;
  caseCursor: number;
  stage: Stage | null;
  teams: Record<TeamId, Team>;
  classPath: Path[];
  draft: Partial<Record<TeamId, Vote>>;
  selectedTeam: TeamId;
  currentChoice: string;
  predictions: Record<string, Partial<Record<TeamId, PredictionValue>>>;
  predictionLocked: Record<string, boolean>;
  labResults: Record<string, Record<string, number | string>>;
  labSkipped: Record<string, boolean>;
  labWork: Record<string, unknown>;
  retryUsed: Record<string, boolean>;
  skippedDecisions: string[];
  // 하루 서사와 귀납(docs/12 §3~§5)
  morningNotes: string[];
  heritageTally: Record<string, number>;
  customHeritage: string[];
  practice: Partial<Record<TeamId, ChoiceKey>>;
  journal: JournalEntry[];
  clusters: Cluster[];
  // 저녁 의뢰와 프로그램(docs/12 §6)
  program: Program;
  testRuns: TestRun[];
  testCursor: number;
  // AI 점검(docs/12 §7)
  aiCheck: {
    answerIndex: number;
    pastedAnswer: {model: string; date: string; text: string};
    stepChecks: Record<string, StepCheck>;
    trust: Partial<Record<TeamId, {before?: TrustValue; after?: TrustValue}>>;
  };
  settings: {
    quickLabs: boolean; skipOptional: boolean; showTeacherPanel: boolean; manualBaseUrl: string; videoUrl: string;
    showRanking: boolean; timerOffsetSec: number; paused: boolean; pausedAt: number; pausedMs: number;
  };
  teamSetupChecked: Record<string, boolean>;
  expertPassed: Record<string, boolean>;
}
export interface LogEvent {
  t: string; elapsed_s: number; phase: string; case_id: string; node_id: string; event: string; team: number | string;
  value: string; reasons: string; result: string; health_after: number | string; step: string;
  planned_s: number | string; actual_s: number | string; note: string;
}
export interface Session {schemaVersion: 2; state: AppState; log: LogEvent[]}
