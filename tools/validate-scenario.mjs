#!/usr/bin/env node
// 설계 검증용 참조 스크립트 (의존성 없음). docs/05 §7의 V01~V19 규칙을 검사한다.
// 사용: node tools/validate-scenario.mjs
// 구현 단계(Phase 1)에서 TypeScript로 옮기고 Ajv 스키마 검증을 앞에 붙인다.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const s = load("data/scenario.json");
const labs = load("data/labs.config.json");
const manualsDoc = load("data/manuals.json");

const errors = [];
const warns = [];
const E = (id, msg) => errors.push(`[${id}] ${msg}`);
const W = (id, msg) => warns.push(`[${id}] ${msg}`);

const STEPS = ["investigate", "rootCause", "reversible", "minimal", "evidence"];
const PRINCIPLES = ["P1", "P2", "P3", "P4", "P5"];
const EXPERTS = ["metal", "glass", "paint", "adhesive"];
const KEYS = ["A", "B", "C"];
const FLOW_KEYWORDS = new Set(["brief", "experts", "predict", "lab", "lab:A", "lab:B", "history", "wrap"]);
const LIMITS = { brief: 45, prompt: 35, choice: 45, outcome: 90 };
const len = (str) => [...(str ?? "")].length;

const allCases = [s.tutorial, ...s.cases];
const seenIds = new Map();
const stepCount = Object.fromEntries(STEPS.map((k) => [k, 0]));
const leadCount = Object.fromEntries(EXPERTS.map((k) => [k, 0]));
const matrix = [];

for (const c of allCases) {
  const scored = c.scored !== false;
  const nodes = new Map();
  for (const n of c.nodes) {
    if (seenIds.has(n.id)) E("V01", `노드 ID 중복: ${n.id} (${seenIds.get(n.id)}, ${c.id})`);
    seenIds.set(n.id, c.id);
    nodes.set(n.id, n);
  }

  // V13 전문가
  if (!EXPERTS.includes(c.lead)) E("V13", `${c.id}: lead가 잘못됨 (${c.lead})`);
  for (const sp of c.support ?? []) if (!EXPERTS.includes(sp)) E("V13", `${c.id}: support가 잘못됨 (${sp})`);
  if ((c.support ?? []).includes(c.lead)) E("V13", `${c.id}: lead가 support에도 있음`);
  if (scored && EXPERTS.includes(c.lead)) leadCount[c.lead]++;

  // V02, V10, V11 흐름
  let predictIdx = -1;
  let labIdx = -1;
  c.flow.forEach((item, i) => {
    if (FLOW_KEYWORDS.has(item)) {
      if (item === "predict" && predictIdx < 0) predictIdx = i;
      if (item.startsWith("lab") && labIdx < 0) labIdx = i;
      return;
    }
    const n = nodes.get(item);
    if (!n) E("V02", `${c.id}: flow 항목 '${item}'이 키워드도 노드 ID도 아님`);
    else if (n.type === "outcome") E("V02", `${c.id}: flow에 결과 노드 '${item}'를 직접 넣을 수 없음`);
  });
  if (predictIdx >= 0 || labIdx >= 0) {
    if (!c.lab) E("V10", `${c.id}: flow에 predict/lab이 있는데 case.lab이 없음`);
    else if (!labs[c.lab.id]) E("V10", `${c.id}: labs.config.json에 ${c.lab.id}가 없음`);
  }
  if (predictIdx >= 0 && (labIdx < 0 || predictIdx > labIdx)) E("V11", `${c.id}: predict가 lab보다 앞에 있어야 함`);

  // 결정 노드
  const referenced = new Set();
  let nonOptional = 0;
  const row = { case: c.id, cells: [] };
  for (const n of c.nodes.filter((x) => x.type === "decision")) {
    if (!c.flow.includes(n.id)) W("V02", `${c.id}: 결정 ${n.id}가 flow에 없음`);
    if (!n.optional) nonOptional++;
    if (!Array.isArray(n.choices) || n.choices.length < 2 || n.choices.length > 3) E("V03", `${n.id}: 선택지는 2~3개`);
    const keys = (n.choices ?? []).map((ch) => ch.key);
    if (new Set(keys).size !== keys.length || keys.some((k) => !KEYS.includes(k))) E("V03", `${n.id}: 선택지 key는 A/B/C 중 중복 없이`);
    if (!STEPS.includes(n.step)) E("V06", `${n.id}: step이 잘못됨 (${n.step})`);
    else if (scored) stepCount[n.step]++;
    if (len(n.prompt) > LIMITS.prompt) W("V17", `${n.id}: prompt ${len(n.prompt)}자 > ${LIMITS.prompt}`);
    let solved = 0;
    for (const ch of n.choices ?? []) {
      const o = nodes.get(ch.outcome);
      if (!o || o.type !== "outcome") E("V04", `${n.id}/${ch.key}: outcome '${ch.outcome}'이 같은 사건의 결과 노드가 아님`);
      else {
        referenced.add(o.id);
        if (o.result === "solved") solved++;
      }
      if (len(ch.label) > LIMITS.choice) W("V17", `${n.id}/${ch.key}: 선택지 ${len(ch.label)}자 > ${LIMITS.choice}`);
    }
    if (solved === 0) E("V05", `${n.id}: solved 결과가 하나도 없음`);
    row.cells.push(`${n.id}:${n.step}${n.optional ? "(선택)" : ""}`);
  }
  if (scored) matrix.push(row);

  // 결과 노드
  for (const n of c.nodes.filter((x) => x.type === "outcome")) {
    if (!PRINCIPLES.includes(n.principle)) E("V07", `${n.id}: principle이 잘못됨 (${n.principle})`);
    if (n.delayed) {
      const d = n.delayed;
      if (!d.label || !d.text || typeof d.extraDelta !== "number" || d.extraDelta > 0) E("V08", `${n.id}: delayed는 label·text·extraDelta(≤0) 필요`);
    }
    if (n.retry && (!n.delayed || n.result === "solved")) E("V09", `${n.id}: retry는 delayed가 있는 worse/irreversible에만`);
    if (len(n.text) > LIMITS.outcome) W("V17", `${n.id}: 결과 문구 ${len(n.text)}자 > ${LIMITS.outcome}`);
    if (!referenced.has(n.id)) W("V19", `${n.id}: 어떤 선택지도 이 결과를 가리키지 않음`);
  }

  if (scored && nonOptional === 0) E("V15", `${c.id}: optional이 아닌 결정이 없음`);

  // V12 출처
  if (scored) {
    if (!c.history?.sources?.length) E("V12", `${c.id}: history.sources 없음`);
    for (const src of c.history?.sources ?? []) if (!/^https?:\/\//.test(src.url ?? "")) E("V12", `${c.id}: 출처 url 형식 오류 (${src.title})`);
  }

  for (const line of c.brief?.lines ?? []) if (len(line) > LIMITS.brief) W("V17", `${c.id}: brief 줄 ${len(line)}자 > ${LIMITS.brief} — "${line}"`);
}

// V14 단계 분포
for (const k of STEPS) if (stepCount[k] < 1) E("V14", `단계 '${k}'를 시험하는 결정이 없음 — 알고리즘을 귀납할 수 없음`);
// V16 전문가 lead
for (const k of EXPERTS) if (leadCount[k] < 1) W("V16", `전문가 '${k}'가 주도하는 사건이 없음`);

// AI 점검
if (!s.aiCheck?.real?.sources?.length) E("V12", `aiCheck.real.sources 없음`);
const checklistSteps = new Set((s.aiCheck?.checklist ?? []).map((x) => x.step));
for (const k of STEPS) if (!checklistSteps.has(k)) E("V14", `aiCheck.checklist에 단계 '${k}'가 없음`);
if (!(s.aiCheck?.capturedAnswers ?? []).length) W("AI", `aiCheck.capturedAnswers가 비어 있음 — 수업 전 교사가 캡처해 넣을 것`);

// V18 금지어(학생 화면 문자열)
const SKIP_KEYS = new Set(["teacher", "meta", "_note", "sources", "captureInstructions", "note", "colorToken", "illustration"]);
const walk = (obj, path) => {
  if (typeof obj === "string") {
    if (obj.includes("문화재") && !obj.includes("국가유산")) W("V18", `${path}: '문화재' 대신 '국가유산/문화유산'`);
    for (const bad of ["정답", "오답", "틀렸"]) if (obj.includes(bad)) W("V18", `${path}: 금지어 '${bad}'`);
    return;
  }
  if (Array.isArray(obj)) return obj.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (!SKIP_KEYS.has(k)) walk(v, `${path}.${k}`);
};
walk(s, "scenario");
walk(manualsDoc, "manuals");

// 프로필
for (const [pid, p] of Object.entries(s.profiles)) {
  const total = p.phases.reduce((a, b) => a + b.minutes, 0);
  if (Math.abs(total - Number(pid)) > 0.01) W("PROFILE", `프로필 ${pid}: 단계 합계 ${total}분`);
  const caseIds = new Set(s.cases.map((c) => c.id));
  for (const ph of p.phases) if (ph.id.startsWith("case") && !caseIds.has(ph.id)) E("PROFILE", `프로필 ${pid}: 없는 사건 ${ph.id}`);
  if (p.breakAfterCase && !caseIds.has(p.breakAfterCase)) E("PROFILE", `프로필 ${pid}: breakAfterCase '${p.breakAfterCase}' 없음`);
}

// 실습 설정
for (const id of ["lab1", "lab2", "lab3", "lab4", "lab5"]) if (!labs[id]) E("LAB", `labs.config.json에 ${id} 없음`);

// 매뉴얼
const manuals = manualsDoc.manuals ?? [];
if (manuals.length !== 4) E("MANUAL", `매뉴얼은 4종이어야 함 (${manuals.length})`);
for (const m of manuals) {
  if (!EXPERTS.includes(m.id)) E("MANUAL", `알 수 없는 매뉴얼 ${m.id}`);
  if ((m.quiz ?? []).length !== 3) E("MANUAL", `${m.id}: 퀴즈는 3문항`);
  for (const [i, q] of (m.quiz ?? []).entries()) if (!(q.answer >= 0 && q.answer < q.options.length)) E("MANUAL", `${m.id}: 퀴즈 ${i + 1} answer 범위 오류`);
}
for (const c of s.cases) {
  const expect = [[c.lead, "lead"], ...(c.support ?? []).map((x) => [x, "support"])];
  for (const [eid, role] of expect) {
    const m = manuals.find((x) => x.id === eid);
    const hit = m?.calledIn?.find((x) => x.caseId === c.id && x.role === role);
    if (!hit) W("MANUAL", `${eid} 매뉴얼의 calledIn에 ${c.id}(${role})가 없음`);
    if (m && !m.callouts?.[c.id]) W("MANUAL", `${eid} 매뉴얼에 ${c.id} callout이 없음`);
  }
}

// 보고
console.log("── 알고리즘 매트릭스용 단계 분포 ──");
for (const r of matrix) console.log(`  ${r.case}: ${r.cells.join(", ")}`);
console.log("  단계별 결정 수:", JSON.stringify(stepCount));
console.log("  전문가별 주도 사건 수:", JSON.stringify(leadCount));
console.log(`\n오류 ${errors.length}건, 경고 ${warns.length}건`);
for (const e of errors) console.log("  ✕", e);
for (const w of warns) console.log("  △", w);
process.exit(errors.length ? 1 : 0);
