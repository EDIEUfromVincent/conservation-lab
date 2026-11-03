export type ChoiceKey = 'A' | 'B' | 'C';
export type TeamId = 1 | 2 | 3 | 4;
export type ExpertId = 'metal' | 'glass' | 'paint' | 'adhesive';
export type ResultType = 'solved' | 'worse' | 'irreversible';
export type StepKey = 'investigate' | 'rootCause' | 'reversible' | 'minimal' | 'evidence';
export type PrincipleId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

/** 행동 카드(연구 일지). hiddenPrinciple은 학생 화면에 나오지 않는다(docs/12 §5.2). */
export interface JournalCard {id: string; text: string; hiddenPrinciple: PrincipleId}

export interface Decision {
  id: string;
  type: 'decision';
  step: StepKey;
  optional: boolean;
  prompt: string;
  context?: string;
  debate?: boolean;
  choices: {key: ChoiceKey; label: string; outcome: string}[];
  journal: JournalCard;
}
export interface Outcome {
  id: string;
  type: 'outcome';
  result: ResultType;
  principle: string;
  text: string;
  healthDelta?: number;
  delayed?: {label: string; text: string; extraDelta: number};
  retry?: boolean;
}
export interface HistoryJoin {id: string; type: 'historyJoin'; text: string}
export type Node = Decision | Outcome | HistoryJoin;
export interface TeacherNotes {keyQuestions?: string[]; notes?: string[]; misconceptions?: string[]}
export interface History {lines: string[]; sources: {title: string; url: string}[]}
export interface Case {
  id: string;
  order: number;
  scored?: boolean;
  title: string;
  place: string;
  year: string;
  material: string;
  lead: ExpertId;
  support: ExpertId[];
  brief: {lines: string[]; illustration: string};
  flow: string[];
  nodes: Node[];
  lab?: {id: string; title: string; predict: {type: 'rank' | 'choice' | 'number'; prompt: string; options?: string[]}; fallbackEvidence: string};
  history?: History;
  wrap: {principles: string[]; question: string};
  teacher?: TeacherNotes;
}
export interface HeritageExample {name: string; place: string; material: string; experts: ExpertId[]}
