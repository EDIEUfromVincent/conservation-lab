import type {scenario as source, manuals as manualSource, labs as labSource} from './loadContent';
import type {Decision} from './types';

const STEPS = ['investigate', 'rootCause', 'reversible', 'minimal', 'evidence'];
const EXPERTS = ['metal', 'glass', 'paint', 'adhesive'];
const PRINCIPLES = ['P1', 'P2', 'P3', 'P4', 'P5'];
const FLOW_KEYWORDS = ['brief', 'experts', 'predict', 'lab', 'lab:A', 'lab:B', 'history', 'wrap'];
const PHASE_IDS = ['intro', 'video', 'heritagePick', 'expertStudy', 'teamSetup', 'journal', 'algorithm',
  'request', 'build', 'test', 'debug', 'aiCheck', 'reflect', 'wrapup'];
/** 학생 화면에 나오지 않는 키. 이 키 아래는 원칙 노출·금지어 검사에서 뺀다. */
const HIDDEN_KEYS = new Set(['teacher', 'meta', '_note', 'sources', 'captureInstructions', 'note', 'colorToken',
  'illustration', 'principles', 'principle', 'hiddenPrinciple', 'checklist', 'compareLabel', 'promptTemplate', 'promptToAsk', 'commonPrinciples']);

const length = (text: string) => [...text].length;

export function validateContent(s: typeof source, m: typeof manualSource, l: typeof labSource) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const E = (id: string, msg: string) => errors.push(`[${id}] ${msg}`);
  const W = (id: string, msg: string) => warnings.push(`[${id}] ${msg}`);
  const seenNodes = new Set<string>();
  const seenCards = new Set<string>();
  const usedSteps = new Set<string>();
  const leads = new Set<string>();

  for (const c of s.cases) {
    const nodes = new Map(c.nodes.map(n => [n.id, n]));
    const referenced = new Set<string>();
    for (const n of c.nodes) {
      if (seenNodes.has(n.id)) E('V01', n.id);
      seenNodes.add(n.id);
    }
    if (!EXPERTS.includes(c.lead) || c.support.includes(c.lead) || c.support.some(x => !EXPERTS.includes(x))) E('V13', c.id);
    leads.add(c.lead);
    for (const item of c.flow) {
      if (!FLOW_KEYWORDS.includes(item) && (!nodes.has(item) || nodes.get(item)?.type === 'outcome')) E('V02', `${c.id}/${item}`);
    }
    const predictAt = c.flow.indexOf('predict');
    const labAt = c.flow.findIndex(x => x.startsWith('lab'));
    if (predictAt >= 0 || labAt >= 0) {
      if (!c.lab || !(c.lab.id in l)) E('V10', c.id);
      if (predictAt < 0 || labAt < 0 || predictAt > labAt) E('V11', c.id);
    }
    const decisions = c.nodes.filter((n): n is Decision => n.type === 'decision');
    if (!decisions.some(n => !n.optional)) E('V15', c.id);
    for (const d of decisions) {
      if (!STEPS.includes(d.step)) E('V06', d.id);
      else usedSteps.add(d.step);
      const keys = d.choices.map(x => x.key);
      if (keys.length < 2 || keys.length > 3 || new Set(keys).size !== keys.length || keys.some(k => !['A', 'B', 'C'].includes(k))) E('V03', d.id);
      let solved = 0;
      for (const ch of d.choices) {
        const o = nodes.get(ch.outcome);
        referenced.add(ch.outcome);
        if (o?.type !== 'outcome') E('V04', d.id);
        else if (o.result === 'solved') solved++;
        if (length(ch.label) > 45) W('V17', d.id);
      }
      if (!solved) E('V05', d.id);
      if (length(d.prompt) > 35) W('V17', d.id);
      // 행동 카드(docs/12 §5.2)
      if (!d.journal?.id?.startsWith('j-') || !d.journal.text || !PRINCIPLES.includes(d.journal.hiddenPrinciple)) E('J01', d.id);
      else {
        if (seenCards.has(d.journal.id)) E('J02', d.journal.id);
        seenCards.add(d.journal.id);
        if (length(d.journal.text) > 45) W('V17', d.journal.id);
      }
    }
    for (const n of c.nodes) {
      if (n.type !== 'outcome') continue;
      if (!PRINCIPLES.includes(n.principle)) E('V07', n.id);
      if (n.delayed && (!n.delayed.label || !n.delayed.text || !Number.isFinite(n.delayed.extraDelta) || n.delayed.extraDelta > 0)) E('V08', n.id);
      if (n.retry && (!n.delayed || n.result === 'solved')) E('V09', n.id);
      if (!referenced.has(n.id)) W('V19', n.id);
      if (length(n.text) > 90) W('V17', n.id);
    }
    if (!c.history?.sources.length || c.history.sources.some(x => !/^https?:\/\//.test(x.url))) E('V12', c.id);
    for (const line of c.brief.lines) if (length(line) > 45) W('V17', c.id);
    if (!s.story.bridges[c.id as keyof typeof s.story.bridges]) E('STORY', `bridge ${c.id}`);
  }
  for (const step of STEPS) if (!usedSteps.has(step) || !s.aiCheck.checklist.some(x => x.step === step)) E('V14', step);
  for (const ex of EXPERTS) if (!leads.has(ex)) W('V16', ex);
  if (!s.aiCheck.capturedAnswers.length) W('AI', 'aiCheck.capturedAnswers is empty');
  if (!s.aiCheck.real.sources.length) E('V12', 'aiCheck');

  // 시간표: 합계, 알려진 단계, 사건 5개
  for (const [id, p] of Object.entries(s.profiles)) {
    if (Math.abs(p.phases.reduce((a, b) => a + b.minutes, 0) - Number(id)) > 0.01) E('PROFILE', `${id} minutes`);
    for (const ph of p.phases) {
      const isCase = s.cases.some(c => c.id === ph.id);
      if (!isCase && !PHASE_IDS.includes(ph.id)) E('PROFILE', `${id}/${ph.id}`);
    }
    if (p.breakAfterCase && !s.cases.some(c => c.id === p.breakAfterCase)) E('PROFILE', `${id} break`);
  }
  for (const id of [...PHASE_IDS, ...s.cases.map(c => c.id)]) {
    if (!(id in s.story.clock)) E('STORY', `clock ${id}`);
  }

  // 의뢰 후보 유산
  for (const ex of s.heritagePick.examples) {
    if (!ex.material || !ex.experts.length || ex.experts.some(x => !EXPERTS.includes(x))) E('HERITAGE', ex.name);
  }

  // 프로그램 편집기
  const pg = s.program;
  if (pg.maxDecisions < 1 || pg.maxDecisions > 4) E('PROGRAM', 'maxDecisions');
  if (pg.choiceRange[0] < 2 || pg.choiceRange[1] > 3 || pg.choiceRange[0] > pg.choiceRange[1]) E('PROGRAM', 'choiceRange');

  // 매뉴얼
  if (m.manuals.length !== 4 || new Set(m.manuals.map(x => x.id)).size !== 4) E('MANUAL', 'count');
  for (const doc of m.manuals) {
    if (!EXPERTS.includes(doc.id) || doc.quiz.length !== 3 || doc.quiz.some(q => !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)) E('MANUAL', doc.id);
    for (const c of s.cases) {
      const role = c.lead === doc.id ? 'lead' : c.support.includes(doc.id as never) ? 'support' : null;
      if (role && (!doc.calledIn.some(x => x.caseId === c.id && x.role === role) || !(c.id in doc.callouts))) W('MANUAL', `${doc.id}/${c.id}`);
    }
  }

  // 실습 모델
  for (const id of ['lab1', 'lab2', 'lab3', 'lab4', 'lab5']) if (!(id in l)) E('LAB', id);
  if (!(l.lab1.tauDays > 0) || l.lab1.conditions.some(x => !(x.k > 0 && x.k <= 1))) E('LAB', 'lab1');
  if (l.lab2.pieces < 2 || l.lab2.snapTolerancePx <= 0) E('LAB', 'lab2');
  if (l.lab3.adhesives.some(x => !(x.reversibility > 0 && x.reversibility <= 1)) || l.lab3.tools.some(x => x.hardness < 0 || x.hardness > 1) || l.lab3.maxStrokes < 1) E('LAB', 'lab3');
  if (l.lab4.base < 0 || Object.values(l.lab4.weights).some(x => x < 0)) E('LAB', 'lab4');
  if (l.lab5.partA.reinforcements.some(x => x.removeSteps < 1 || x.damageAtSteps.some(n => n < 1 || n > x.removeSteps))) E('LAB', 'lab5');

  // 학생 화면 문구: 금지어(V18)와 원칙 노출(N01, docs/12 §5 — 원칙은 S21 비교 전까지 숨긴다)
  function walk(x: unknown, path: string) {
    if (typeof x === 'string') {
      if ((x.includes('문화재') && !x.includes('국가유산')) || /정답|오답|틀렸/.test(x)) W('V18', path);
      if (/\bP[1-5]\b|원칙/.test(x)) E('N01', path);
    } else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) if (!HIDDEN_KEYS.has(k)) walk(v, `${path}.${k}`);
    }
  }
  walk(s, 'scenario');
  walk(m, 'manuals');
  return {errors, warnings};
}

/** 3D 미션(data/missions.json) 검사. 단서마다 정답 카드가 보기 안에 있고, 장소·결정 조건이 모두 실제 id를 가리켜야 한다. */
export function validateMissions(
  ms: {caseId: string; places: {id: string; slot: string; clues: string[]; lab?: string; after?: string}[]; clues: {id: string; options: string[]; answer: string; source?: string; text?: string}[]; decisions: {id: string; needs: string[]}[]}[],
  s: typeof source, m: typeof manualSource,
) {
  const errors: string[] = [];
  const E = (id: string, msg: string) => errors.push(`[${id}] ${msg}`);
  // 힌트 카드: 매뉴얼 표의 줄(metal:0), 꼭 기억해요(metal:k1), 앞 사건의 연구 일지(journal:j-c2d1)
  const hintExists = (id: string, order: number) => {
    if (id === 'none') return true;
    const [source, key = ''] = id.split(':');
    if (source === 'journal') {
      const owner = s.cases.find(c => c.nodes.some(n => n.type === 'decision' && (n as Decision).journal.id === key));
      return !!owner && owner.order < order;
    }
    const doc = m.manuals.find(x => x.id === source);
    return key.startsWith('k') ? !!doc?.keyIdeas[Number(key.slice(1))] : !!doc?.clues[Number(key)];
  };
  for (const mission of ms) {
    const c = s.cases.find(x => x.id === mission.caseId);
    if (!c) { E('MISSION', `unknown case ${mission.caseId}`); continue; }
    const clueIds = mission.clues.map(x => x.id);
    if (new Set(clueIds).size !== clueIds.length) E('MISSION', `${c.id} duplicate clue`);
    for (const clue of mission.clues) {
      const inPlaces = mission.places.filter(p => p.clues.includes(clue.id)).length;
      if (inPlaces !== 1) E('MISSION', `${clue.id} must be in exactly one place`);
      if (!clue.options.includes(clue.answer)) E('MISSION', `${clue.id} answer not in options`);
      if (new Set(clue.options).size !== clue.options.length || clue.options.length < 3 || clue.options.length > 4) E('MISSION', `${clue.id} options`);
      for (const o of clue.options) if (!hintExists(o, c.order)) E('MISSION', `${clue.id} unknown hint ${o}`);
      const home = mission.places.find(p => p.clues.includes(clue.id));
      if (clue.source === 'lab' ? !c.lab || !home?.lab : !clue.text) E('MISSION', `${clue.id} text`);
    }
    const decisionIds = c.nodes.filter((n): n is Decision => n.type === 'decision').map(n => n.id);
    for (const p of mission.places) {
      for (const id of p.clues) if (!clueIds.includes(id)) E('MISSION', `${p.id} unknown clue ${id}`);
      if (!['main', 'detail', 'archive', 'lab'].includes(p.slot) || mission.places.filter(x => x.slot === p.slot).length > 1) E('MISSION', `${p.id} slot`);
      if (p.lab && (!c.lab || !['main', 'A', 'B'].includes(p.lab))) E('MISSION', `${p.id} lab`);
      if (p.after && !decisionIds.includes(p.after)) E('MISSION', `${p.id} after ${p.after}`);
    }
    for (const d of mission.decisions) {
      if (!decisionIds.includes(d.id)) E('MISSION', `${c.id} unknown decision ${d.id}`);
      for (const id of d.needs) {
        const clue = mission.clues.find(x => x.id === id);
        if (!clue || clue.answer === 'none') E('MISSION', `${d.id} needs ${id}`);
      }
    }
    // 단서가 하나라도 있어야 결정이 열리고, 사건의 필수 결정은 모두 미션에 있어야 한다
    for (const id of decisionIds) {
      const node = c.nodes.find(n => n.id === id) as Decision;
      if (!node.optional && !mission.decisions.some(d => d.id === id)) E('MISSION', `${c.id} missing decision ${id}`);
    }
  }
  // 학생 화면 문구 금지어·원칙 노출
  const text = JSON.stringify(ms);
  if (/문화재|정답|오답|틀렸/.test(text)) E('V18', 'missions');
  if (/\bP[1-5]\b|원칙/.test(text)) E('N01', 'missions');
  return errors;
}
