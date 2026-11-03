// 4D 프레임 참조 뷰어: 4d-frame-spec.json을 그대로 읽어 CSS 3D로 그린다(외부 의존성 없음, 오프라인 가능).
// 게이트 계약: data-4d-viewer, data-4d-build, data-4d-edges, data-4d-step, data-4d-next-step, data-4d-kit.
// 사용: import { mountFrameViewer, loadSpec } from "./frame-viewer.js";
//       mountFrameViewer(document.querySelector("#frame"), await loadSpec(), { buildId: "tower" });

const COLORS = { 빨강: "#ef4444", 주황: "#f97316", 노랑: "#eab308", 초록: "#22c55e", 파랑: "#3b82f6", 남색: "#4f46e5", 보라: "#a855f7", 분홍: "#ec4899", 흰색: "#e5e7eb", 검정: "#374151" };
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const scale = (a, s) => a.map((v) => v * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => scale(a, 1 / len(a));

export async function loadSpec(url = "./4d-frame-spec.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`4d-frame-spec.json을 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text; // 사용자·명세 문자열은 항상 텍스트로만 넣는다.
  return node;
};

export function mountFrameViewer(root, spec, { buildId, size = 360, rodPx = 7 } = {}) {
  const build = spec.builds.find((b) => b.id === (buildId ?? spec.builds[0].id));
  const rods = new Map(spec.kit.rods.map((r) => [r.id, r]));
  const V = new Map(build.vertices.map((v) => [v.id, v]));
  const steps = build.steps;
  const edgesAfter = steps.map((s, i) => s.edgesAfter ?? Math.round(((i + 1) / steps.length) * build.edges.length));
  let step = 0, rx = -22, ry = 32;

  root.replaceChildren();
  root.classList.add("fv");
  root.dataset["4dViewer"] = "";
  root.dataset["4dBuild"] = build.id;
  const stage = el("div", "fv-stage");
  stage.tabIndex = 0;
  stage.setAttribute("role", "img");
  stage.setAttribute("aria-label", `${build.name} 3D 모형. 끌거나 화살표 키로 돌려 볼 수 있습니다.`);
  const world = el("div", "fv-world");
  stage.append(world);

  // 좌표(cm, y 위쪽) → 화면(px, y 아래쪽), 가운데 정렬
  const pts = build.vertices.map((v) => v.pos);
  const c = scale(pts.reduce((s, p) => s.map((x, i) => x + p[i]), [0, 0, 0]), 1 / pts.length);
  const radius = Math.max(...pts.map((p) => len(sub(p, c)))) || 1;
  const k = (size * 0.42) / radius;
  const toScreen = (p) => { const q = sub(p, c); return [q[0] * k, -q[1] * k, q[2] * k]; };

  const rodEls = build.edges.map((e) => {
    const a = toScreen(V.get(e.a).pos), b = toScreen(V.get(e.b).pos);
    const d = sub(b, a), L = len(d), u = unit(d);
    const v = unit(cross(u, Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const w = cross(u, v);
    const color = COLORS[rods.get(e.rod)?.color] ?? "#3b82f6";
    const group = el("div", "fv-rod");
    for (const [y, z] of [[v, w], [w, scale(v, -1)]]) {
      const ribbon = el("i");
      const t = sub(a, scale(y, rodPx / 2));
      ribbon.style.cssText = `width:${L}px;height:${rodPx}px;background:${color};transform:matrix3d(${[...u, 0, ...y, 0, ...z, 0, ...t, 1].map((n) => +n.toFixed(4)).join(",")})`;
      group.append(ribbon);
    }
    world.append(group);
    return group;
  });
  const nodeEls = build.vertices.map((vtx) => {
    const n = el("b", "fv-node");
    n.dataset.pos = toScreen(vtx.pos).join(",");
    n.title = `${vtx.id} · ${spec.kit.connectors.find((x) => x.id === vtx.connector)?.name ?? ""}`;
    world.append(n);
    return n;
  });

  const render = () => {
    world.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    for (const n of nodeEls) n.style.transform = `translate3d(${n.dataset.pos.split(",").map((x) => `${x}px`).join(",")}) rotateY(${-ry}deg) rotateX(${-rx}deg)`;
    const built = edgesAfter[step];
    rodEls.forEach((r, i) => r.classList.toggle("pending", i >= built));
    root.dataset["4dEdges"] = String(built);
    stepList.querySelectorAll("[data-4d-step]").forEach((b, i) => b.setAttribute("aria-current", i === step ? "step" : "false"));
    stepText.replaceChildren(el("strong", "", `${step + 1}단계`), el("p", "", steps[step].instruction), el("p", "fv-check", `확인: ${steps[step].check}`));
    counter.textContent = `조립한 봉 ${built} / ${build.edges.length}`;
    prev.disabled = step === 0;
    next.disabled = step === steps.length - 1;
  };

  // 드래그·키보드 회전
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, rx, ry }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => { if (!drag) return; ry = drag.ry + (e.clientX - drag.x) * 0.5; rx = Math.max(-89, Math.min(89, drag.rx - (e.clientY - drag.y) * 0.5)); render(); });
  stage.addEventListener("pointerup", () => (drag = null));
  stage.addEventListener("pointercancel", () => (drag = null));
  stage.addEventListener("lostpointercapture", () => (drag = null));
  stage.addEventListener("keydown", (e) => {
    const m = { ArrowLeft: [0, -8], ArrowRight: [0, 8], ArrowUp: [8, 0], ArrowDown: [-8, 0] }[e.key];
    if (!m) return; e.preventDefault(); rx = Math.max(-89, Math.min(89, rx + m[0])); ry += m[1]; render();
  });

  // 조립 단계
  const panel = el("div", "fv-panel");
  const counter = el("p", "fv-counter");
  const stepList = el("ol", "fv-steps");
  steps.forEach((s, i) => {
    const li = el("li"); const b = el("button", "", `${i + 1}`);
    b.type = "button"; b.dataset["4dStep"] = String(i); b.setAttribute("aria-label", `${i + 1}단계: ${s.instruction}`);
    b.addEventListener("click", () => { step = i; render(); });
    li.append(b); stepList.append(li);
  });
  const stepText = el("div", "fv-step-text");
  const nav = el("div", "fv-nav");
  const prev = el("button", "", "← 이전 단계"); prev.type = "button";
  const next = el("button", "", "다음 단계 →"); next.type = "button"; next.dataset["4dNextStep"] = "";
  prev.addEventListener("click", () => { step = Math.max(0, step - 1); render(); });
  next.addEventListener("click", () => { step = Math.min(steps.length - 1, step + 1); render(); });
  nav.append(prev, next);

  // 부품표(모둠 1개 기준)
  const kit = el("table", "fv-kit"); kit.dataset["4dKit"] = "";
  kit.append(el("caption", "", "모둠 부품표"));
  const row = (...cells) => { const tr = el("tr"); cells.forEach((x) => tr.append(el("td", "", x))); kit.append(tr); };
  spec.kit.rods.forEach((r) => row(`${r.lengthCm}cm 봉`, r.color ?? "", `${r.count}개`));
  spec.kit.connectors.forEach((x) => row(x.name, `${x.legs}가지${x.angleDeg ? ` · ${x.angleDeg}°` : ""}`, `${x.count}개`));
  (spec.kit.extras ?? []).forEach((x) => row(x.name, "", `${x.count}개`));

  panel.append(counter, stepList, stepText, nav, kit);
  root.append(stage, panel);
  render();
  return { setStep: (i) => { step = Math.max(0, Math.min(steps.length - 1, i)); render(); }, build };
}
