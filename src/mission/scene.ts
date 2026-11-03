import * as THREE from 'three';

// 사건마다 블록으로 새로 그린 무대. 실제 장소·유물을 재현한 도면이 아니다.
// 네 자리(main·detail·archive·lab)에 사건별 모형을 세우고, 연구원은 조이스틱·방향키로 걷거나 장소를 고르면 걸어간다.

export type Slot = 'main' | 'detail' | 'archive' | 'lab';
export interface ScenePlace {id: string; slot: Slot; name: string; color?: string}
export interface MarkerState {left: number; done: boolean; active: boolean; locked: boolean}
export interface SceneHandle {
  ok: boolean;
  goTo(placeId: string | null): void;
  mark(placeId: string, state: MarkerState): void;
  /** 조이스틱·방향키 입력(-1~1). 위 = 화면 안쪽 */
  setInput(x: number, y: number): void;
  /** 패널이 가리는 쪽에 맞춰 장면 중심을 옮긴다(화면 비율) */
  setShift(x: number, y: number): void;
  /** 역할 변신: 연구원 옷 색을 바꾸고 한 바퀴 돈다 */
  setOutfit(color: string, spin?: boolean): void;
  dispose(): void;
}
type V3 = [number, number, number];

const SLOT: Record<Slot, {at: V3; stand: [number, number]; look: V3; cam: V3; block: number}> = {
  main: {at: [0, 0, -3], stand: [-2.4, 3.4], look: [0, 4, -3], cam: [-7, 8, 15], block: 3.7},
  detail: {at: [7.5, 0, -2], stand: [6.2, 2.6], look: [7.5, 2.2, -2], cam: [3, 6, 10], block: 2.5},
  archive: {at: [-9.5, 0, 3], stand: [-7.6, 6.2], look: [-9.5, 1.8, 3], cam: [-4, 6.5, 13.5], block: 2.9},
  lab: {at: [8.5, 0, 6.5], stand: [6.4, 9.2], look: [8.5, 1.2, 6.5], cam: [3.5, 6.5, 16], block: 2.4},
};
const START: [number, number] = [0, 11];
const FOLLOW: V3 = [0, 15, 19];   // 지도에서 연구원을 따라가는 카메라 거리
const NEAR = 1.8;   // 건물 둘레에서 이만큼 안이면 '조사하기'를 띄운다

const C = {
  water: 0x4f9fbf, sand: 0xe6d3a3, grass: 0x8cc084, path: 0xf0e2bb, stone: 0xd9ccb0, stoneDark: 0xb9ab8c,
  patina: 0x63b39b, patinaDark: 0x4a957f, iron: 0x7a4a33, rust: 0xc0622d, gold: 0xffc94a,
  wall: 0xf3e8d2, roof: 0xa65a43, wood: 0x8a6142, tent: 0xf7f5ee, tentRoof: 0x3e7fa6, glass: 0x9fe0e6,
  tree: 0x3f7f5f, trunk: 0x77583f, suit: 0x2f7d6d, skin: 0xe2b48e, hair: 0x3a2b22, cloth: 0xf2ece0,
  vase: 0x1f3557, white: 0xf4f1ea, mask: 0xe0b13a, lapis: 0x2b4f8e, red: 0xa8322d, tile: 0x4a4f55,
  green: 0x2f8f6f, blue: 0x2b6cb0, granite: 0xb8b2a6, concrete: 0x8d9093,
};

interface SetSpec {
  sky: number; ground: 'island' | 'hall' | 'plaza' | 'field';
  mainLook: number; markers: Partial<Record<Slot, number>>;
  build: (b: Builder, places: ScenePlace[]) => void;
}

export function mountScene(host: HTMLElement, caseId: string, places: ScenePlace[], onNear: (placeId: string | null) => void): SceneHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    if (!renderer.getContext()) throw new Error('no context');
  } catch {
    return {ok: false, goTo: () => {}, mark: () => {}, setInput: () => {}, setShift: () => {}, setOutfit: () => {}, dispose: () => {}};
  }
  const spec = SETS[caseId] ?? SETS.case1;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(spec.sky);
  scene.fog = new THREE.Fog(spec.sky, 45, 95);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xf4fbff, 0x6b8f6b, spec.ground === 'hall' ? 2.6 : 2.2));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
  sun.position.set(-14, 26, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70});
  scene.add(sun);

  const b = new Builder(scene);
  buildGround(b, spec.ground);
  spec.build(b, places);

  // ── 연구원 ──
  const avatar = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  // 옷은 따로 만든 재질이라 변신할 때 색만 바꾼다
  const suit = b.mat(C.suit, {roughness: 0.84});
  const suitParts = [b.box(avatar, [0, 1.05, 0], [0.7, 0.9, 0.42], C.suit)];
  b.box(avatar, [0, 1.8, 0], [0.56, 0.56, 0.5], C.skin);
  b.box(avatar, [0, 2.12, -0.03], [0.6, 0.18, 0.56], C.hair);
  b.box(avatar, [0, 1.12, 0.22], [0.5, 0.5, 0.04], 0xf7f3e8);
  for (const x of [-0.18, 0.18]) legs.push(b.box(avatar, [x, 0.33, 0], [0.24, 0.66, 0.26], 0x2d3a3a));
  for (const x of [-0.5, 0.5]) suitParts.push(b.box(avatar, [x, 1.1, 0], [0.2, 0.75, 0.25], C.suit));
  for (const part of suitParts) part.material = suit;
  let spinUntil = 0;
  avatar.position.set(START[0], 0, START[1]);
  scene.add(avatar);

  // ── 장소 표지 ──
  const markers = new Map<string, {sprite: THREE.Sprite; canvas: HTMLCanvasElement; base: number}>();
  for (const p of places) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, depthTest: false, transparent: true}));
    const [x, , z] = SLOT[p.slot].at;
    const base = spec.markers[p.slot] ?? 5.2;
    sprite.position.set(x, base, z);
    sprite.scale.set(5, 2.5, 1);
    sprite.renderOrder = 10;
    scene.add(sprite);
    markers.set(p.id, {sprite, canvas, base});
    drawMarker(canvas, p.name, {left: 1, done: false, active: false, locked: false});
    texture.needsUpdate = true;
  }

  // ── 움직임 ──
  const slotOf = new Map(places.map(p => [p.id, p.slot]));
  const round = spec.ground === 'island' ? 15 : 0;
  let target: THREE.Vector3 | null = null;     // 자동 걷기 목표
  let follow = true;                           // 지도: 연구원을 따라가는 카메라
  const input = new THREE.Vector2();
  let shift = {x: 0, y: 0};
  const camPos = new THREE.Vector3(START[0] + FOLLOW[0], FOLLOW[1], START[1] + FOLLOW[2]);
  const camLook = new THREE.Vector3(START[0], 1.5, START[1] - 6);
  let wantPos = camPos.clone();
  let wantLook = camLook.clone();
  let near: string | null = null;
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  function resize() {
    const w = host.clientWidth || 1920, h = host.clientHeight || 1080;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.setViewOffset(w, h, w * shift.x, h * shift.y, w, h);
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  /** 건물 둘레와 무대 가장자리 밖으로 나가지 않게 */
  function collide(pos: THREE.Vector3) {
    for (const p of places) {
      const s = SLOT[p.slot];
      const dx = pos.x - s.at[0], dz = pos.z - s.at[2];
      const d = Math.hypot(dx, dz);
      if (d < s.block && d > 0.001) { pos.x = s.at[0] + (dx / d) * s.block; pos.z = s.at[2] + (dz / d) * s.block; }
    }
    if (round) {
      const d = Math.hypot(pos.x, pos.z);
      if (d > round) { pos.x *= round / d; pos.z *= round / d; }
    } else {
      pos.x = Math.max(-14.5, Math.min(14.5, pos.x));
      pos.z = Math.max(-11.5, Math.min(14, pos.z));
    }
  }

  const clock = new THREE.Clock();
  let frameId = 0, walkPhase = 0;
  function tick() {
    frameId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    let moving = false;
    if (input.lengthSq() > 0.01) {
      // 손으로 걷기: 자동 걷기를 멈추고 따라가는 카메라로
      target = null;
      follow = true;
      avatar.position.add(new THREE.Vector3(input.x, 0, -input.y).multiplyScalar(7 * dt));
      collide(avatar.position);
      avatar.rotation.y = Math.atan2(input.x, -input.y);
      moving = true;
    } else if (target) {
      const to = target.clone().sub(avatar.position);
      to.y = 0;
      const dist = to.length();
      if (dist > 0.05) {
        avatar.position.addScaledVector(to.normalize(), Math.min(dist, 8 * dt));
        avatar.rotation.y = Math.atan2(to.x, to.z);
        moving = true;
      }
    }
    if (moving) {
      walkPhase += dt * 12;
      legs[0].rotation.x = Math.sin(walkPhase) * 0.6;
      legs[1].rotation.x = -Math.sin(walkPhase) * 0.6;
      avatar.position.y = Math.abs(Math.sin(walkPhase)) * 0.08;
    } else {
      legs.forEach(l => { l.rotation.x *= 0.8; });
      avatar.position.y = 0;
    }
    if (follow) {
      wantPos.set(avatar.position.x + FOLLOW[0], FOLLOW[1], avatar.position.z + FOLLOW[2]);
      wantLook.set(avatar.position.x, 1.5, avatar.position.z - 6);
      // 가까운 장소 알리기: 건물 둘레 어디에 서 있어도 된다
      let found: string | null = null, best = Infinity;
      for (const p of places) {
        const s = SLOT[p.slot];
        const d = Math.hypot(avatar.position.x - s.at[0], avatar.position.z - s.at[2]) - s.block;
        if (d < NEAR && d < best) { best = d; found = p.id; }
      }
      if (found !== near) { near = found; onNear(near); }
    }
    camPos.lerp(wantPos, 1 - Math.pow(0.03, dt));
    camLook.lerp(wantLook, 1 - Math.pow(0.03, dt));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    b.animate(t);
    if (t < spinUntil) {
      const k = 1 - (spinUntil - t);   // 0 → 1
      avatar.rotation.y += dt * 9;
      avatar.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.35);
    } else avatar.scale.setScalar(1);
    for (const m of markers.values()) m.sprite.position.y = m.base + Math.sin(t * 2) * 0.15;
    renderer.render(scene, camera);
  }
  tick();

  return {
    ok: true,
    goTo(placeId) {
      const slot = placeId ? slotOf.get(placeId) : undefined;
      if (!slot) { target = null; follow = true; return; }
      const s = SLOT[slot];
      follow = false;
      if (near) { near = null; onNear(null); }
      target = new THREE.Vector3(s.stand[0], 0, s.stand[1]);
      wantPos = new THREE.Vector3(...s.cam);
      wantLook = new THREE.Vector3(...s.look);
      if (slot === 'main') { wantLook.y = spec.mainLook; wantPos.y = spec.mainLook + 4; }
    },
    mark(placeId, state) {
      const m = markers.get(placeId);
      const p = places.find(x => x.id === placeId);
      if (!m || !p) return;
      drawMarker(m.canvas, p.name, state);
      (m.sprite.material.map as THREE.Texture).needsUpdate = true;
    },
    setInput(x, y) { input.set(x, y); },
    setOutfit(color, spin = false) {
      suit.color.set(color);
      if (spin) spinUntil = clock.elapsedTime + 1;
    },
    setShift(x, y) {
      if (x === shift.x && y === shift.y) return;
      shift = {x, y};
      resize();
    },
    dispose() {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// ── 모형 만들기 도구 ──
class Builder {
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private animations: ((t: number) => void)[] = [];
  constructor(readonly scene: THREE.Scene) {}
  mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}) {
    if (Object.keys(extra).length) return new THREE.MeshStandardMaterial({color, roughness: 0.85, flatShading: true, ...extra});
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({color, roughness: 0.85, flatShading: true}));
    return this.materials.get(color)!;
  }
  box(parent: THREE.Object3D, [x, y, z]: number[], [w, h, d]: number[], color: number, extra?: THREE.MeshStandardMaterialParameters) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, extra));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  cyl(parent: THREE.Object3D, [x, y, z]: number[], r: number, h: number, color: number, extra?: THREE.MeshStandardMaterialParameters, top = r) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, r, h, 12), this.mat(color, extra));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  group(slot: Slot) {
    const g = new THREE.Group();
    g.position.set(...SLOT[slot].at);
    this.scene.add(g);
    return g;
  }
  tree(x: number, z: number, scale = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    this.box(tree, [0, 0.9, 0], [0.5, 1.8, 0.5], C.trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), this.mat(C.tree));
    crown.position.y = 2.6;
    crown.castShadow = true;
    tree.add(crown);
    this.scene.add(tree);
  }
  animate(t: number) { for (const f of this.animations) f(t); }
  onFrame(f: (t: number) => void) { this.animations.push(f); }
}

function buildGround(b: Builder, kind: SetSpec['ground']) {
  const s = b.scene;
  const disk = (r1: number, r2: number, y: number, color: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 1, 40), b.mat(color));
    m.position.y = y;
    m.receiveShadow = true;
    s.add(m);
  };
  const plane = (w: number, d: number, color: number) => { b.box(s, [0, -0.5, 1], [w, 1, d], color).castShadow = false; };
  if (kind === 'island') {
    const water = new THREE.Mesh(new THREE.CircleGeometry(90, 48), b.mat(C.water, {roughness: 0.35, metalness: 0.1}));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.6;
    s.add(water);
    disk(17.5, 18.5, -0.5, C.sand);
    disk(16, 16.5, -0.38, C.grass);
    for (const [x, z, w, d] of [[0, 7, 2.4, 12], [-4.5, 4.5, 9, 2], [4.5, 4.5, 9, 2], [7.5, 6, 2, 3.5], [-9.5, 5.5, 2, 2], [7.5, 1.5, 2, 4]])
      b.box(s, [x, 0.13, z], [w, 0.06, d], C.path);
    b.box(s, [0, -0.05, 15.5], [3, 0.25, 6], C.wood);
    for (const [x, z] of [[-13, -4], [-12, 8], [12.5, -6], [13, 1.5], [-5, -10], [5.5, -10.5], [-13.5, 2], [11.5, 11]]) b.tree(x, z);
  }
  if (kind === 'hall') {
    // 박물관 전시실: 바닥 타일, 뒤·옆 벽, 기둥, 그림 액자
    plane(32, 28, 0xd9cfbd);
    for (let x = -15; x <= 15; x += 3) b.box(s, [x, 0.01, 1], [0.06, 0.02, 28], 0xc9bea8);
    b.box(s, [0, 3.5, -13], [32, 7, 0.6], 0xe9e1cf);
    for (const x of [-16, 16]) b.box(s, [x, 2.5, 1], [0.6, 5, 28], 0xe2d9c4);
    for (const x of [-12, -6, 6, 12]) { b.box(s, [x, 3.5, -12.3], [1.1, 7, 1.1], 0xf2ecdf); b.box(s, [x, 6.8, -12.3], [1.5, 0.4, 1.5], 0xd8ceb8); }
    for (const [x, c] of [[-9, 0x8a5a3c], [0, 0x3f5f7a], [9, 0x6d7d4f]]) b.box(s, [x, 4.2, -12.65], [3.2, 2.2, 0.1], c);
    b.box(s, [0, 0.02, 7], [3, 0.03, 12], 0x9c3f36);
  }
  if (kind === 'plaza') {
    plane(36, 30, 0xcfc7b8);
    for (let x = -16; x <= 16; x += 4) b.box(s, [x, 0.01, 1], [0.05, 0.02, 30], 0xbdb5a6);
    for (let z = -13; z <= 15; z += 4) b.box(s, [0, 0.01, z], [36, 0.02, 0.05], 0xbdb5a6);
    for (const [x, z, w, h] of [[-14, -17, 6, 9], [-6, -19, 5, 13], [8, -18, 7, 11], [15, -16, 4, 7]]) b.box(s, [x, h / 2, z], [w, h, 4], 0xb7c0c9);
    for (const [x, z] of [[-14, -8], [14, -9], [-14, 9], [13.5, 12]]) b.tree(x, z, 0.9);
  }
  if (kind === 'field') {
    disk(40, 40, -0.5, C.grass);
    for (const [x, z, w, d] of [[0, 6, 2.4, 12], [-4.5, 4.5, 9, 2], [4.5, 5.5, 8, 2], [-9.5, 5.5, 2, 2]]) b.box(s, [x, 0.13, z], [w, 0.06, d], 0xd9c79b);
    for (const [x, z, r] of [[-26, -30, 14], [4, -36, 18], [30, -28, 13]]) {
      const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), b.mat(0x6f9e6a));
      hill.position.set(x, -r * 0.55, z);
      s.add(hill);
    }
    for (const [x, z] of [[-13, -6], [12.5, -7], [-13.5, 9], [13, 11], [-6, -10], [6, -11]]) b.tree(x, z);
  }
}

// ── 여러 사건에서 쓰는 자리 모형 ──
function archiveHouse(b: Builder) {
  const g = b.group('archive');
  b.box(g, [0, 1.4, 0], [4.4, 2.8, 3.6], C.wall);
  for (const [x, rot] of [[-1.15, 0.5], [1.15, -0.5]] as const) b.box(g, [x, 3.3, 0], [2.6, 0.25, 4.0], C.roof).rotation.z = rot;
  b.box(g, [0, 1.0, 1.81], [1.1, 2.0, 0.05], C.wood);
  for (const x of [-1.4, 1.4]) b.box(g, [x, 1.7, 1.81], [0.9, 0.8, 0.05], C.glass, {emissive: 0x2a5560, emissiveIntensity: 0.3});
  for (const [x, z, h] of [[2.8, 2.4, 0], [3.4, 2.0, 0], [3.0, 2.2, 0.62]]) b.box(g, [x, 0.31 + h, z], [0.6, 0.6, 0.6], 0xc7a26b);
}
function archiveShelf(b: Builder) {
  // 실내 기록 보관실: 책장 + 상자
  const g = b.group('archive');
  b.box(g, [0, 1.6, -0.6], [3.6, 3.2, 0.6], C.wood);
  for (const y of [0.6, 1.4, 2.2]) for (let i = 0; i < 6; i++) b.box(g, [-1.4 + i * 0.56, y + 0.25, -0.35], [0.4, 0.5, 0.2], [0xc7a26b, 0x9c5b45, 0x5c7a8a][(i + Math.round(y)) % 3]);
  b.box(g, [0.9, 0.85, 0.6], [1.6, 0.12, 0.9], C.wood);
  b.box(g, [0.9, 0.95, 0.6], [0.7, 0.04, 0.5], 0xf4f1ea);
}
function labTent(b: Builder, nail = true) {
  const g = b.group('lab');
  b.box(g, [0, 1.2, -0.6], [4.0, 2.4, 0.15], C.tent);
  for (const x of [-1.95, 1.95]) b.box(g, [x, 1.2, 0.4], [0.15, 2.4, 2.1], C.tent);
  b.box(g, [0, 2.65, 0.4], [4.4, 0.25, 2.6], C.tentRoof).rotation.x = 0.15;
  labTable(b, g, nail);
}
function labBench(b: Builder) {
  // 실내 분석실: 흰 칸막이 + 등
  const g = b.group('lab');
  b.box(g, [0, 1.5, -0.7], [4.2, 3.0, 0.15], C.tent);
  b.box(g, [0, 2.6, -0.2], [2.6, 0.12, 0.5], 0x2d3a3a);
  b.box(g, [0, 2.48, -0.2], [2.2, 0.06, 0.3], 0xfff4c2, {emissive: 0xffe9a0, emissiveIntensity: 0.8});
  labTable(b, g, false);
}
function labTable(b: Builder, g: THREE.Object3D, nail: boolean) {
  b.box(g, [0, 0.8, 0.2], [2.8, 0.15, 1.1], C.wood);
  for (const x of [-1.2, 1.2]) b.box(g, [x, 0.38, 0.2], [0.15, 0.75, 0.9], C.wood);
  for (const [i, x] of [-0.8, 0, 0.8].entries()) {
    b.cyl(g, [x, 1.15, 0.2], 0.22, 0.55, C.glass, {transparent: true, opacity: 0.6});
    if (nail) b.box(g, [x, 1.2, 0.2], [0.06, 0.45, 0.06], i === 1 ? C.rust : 0x8f9592);
  }
}
function showcase(b: Builder, g: THREE.Object3D, h = 1.2) {
  b.box(g, [0, h / 2, 0], [2.6, h, 2.0], 0x3a3530);
  b.box(g, [0, h + 1.1, 0], [2.4, 2.2, 1.8], C.glass, {transparent: true, opacity: 0.22, roughness: 0.1}).castShadow = false;
  b.box(g, [0, h + 2.25, 0], [2.6, 0.12, 2.0], 0x3a3530);
}
function workTable(b: Builder, g: THREE.Object3D, w: number, d: number) {
  b.box(g, [0, 0.85, 0], [w, 0.15, d], C.wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(g, [sx * (w / 2 - 0.2), 0.4, sz * (d / 2 - 0.2)], [0.15, 0.8, 0.15], C.wood);
  b.box(g, [0, 0.95, 0], [w - 0.4, 0.03, d - 0.3], C.cloth);
}

// ── 사건별 무대 ──
const SETS: Record<string, SetSpec> = {
  roles: {
    sky: 0xcfe6ee, ground: 'field', mainLook: 2.6, markers: {main: 6.4, detail: 6.4, archive: 6.4, lab: 6.4},
    build(b, places) {
      // 네 갈래길 끝마다 역할 문: 기둥 두 개 + 역할 색 깃발
      for (const p of places) {
        const g = b.group(p.slot);
        const color = new THREE.Color(p.color ?? '#888888').getHex();
        for (const x of [-1.6, 1.6]) b.box(g, [x, 1.6, 0], [0.5, 3.2, 0.5], 0xe9e1cf);
        b.box(g, [0, 3.4, 0], [4.0, 0.5, 0.7], color);
        b.box(g, [0, 2.6, 0.05], [2.4, 0.9, 0.12], color, {emissive: color, emissiveIntensity: 0.25});
        b.box(g, [0, 0.05, 1.2], [2.4, 0.1, 2.0], 0xd9c79b);
      }
      for (const [x, z, w, d, r] of [[0, 4, 2.2, 14, 0], [-4.8, 4.2, 2.2, 10, -0.9], [4.2, 2.2, 2.2, 9.5, 0.9], [4.5, 8.2, 2.2, 8.6, 1.25]])
        b.box(b.scene, [x, 0.13, z], [w, 0.06, d], 0xe3d1a2).rotation.y = r;
    },
  },
  case1: {
    sky: 0xbfe3ef, ground: 'island', mainLook: 6.5, markers: {main: 12.8, archive: 5.6},
    build(b) {
      // 여신상(받침대 + 블록 조각상)
      const g = b.group('main');
      b.box(g, [0, 0.4, 0], [6.2, 0.8, 6.2], C.stoneDark);
      b.box(g, [0, 2.2, 0], [4.6, 2.8, 4.6], C.stone);
      b.box(g, [0, 3.8, 0], [5.0, 0.4, 5.0], C.stoneDark);
      b.box(g, [0, 5.0, 0], [3.4, 2.0, 3.4], C.stone);
      b.box(g, [0, 2.0, 2.31], [1.2, 1.8, 0.05], 0x5a4b3c);
      const body = new THREE.Group();
      body.position.y = 6;
      g.add(body);
      b.box(body, [0, 1.4, 0], [2.0, 2.8, 1.6], C.patina);
      b.box(body, [0, 3.4, 0], [1.6, 1.4, 1.2], C.patina);
      b.box(body, [0, 4.55, 0], [0.9, 0.95, 0.9], C.patinaDark);
      b.box(body, [0, 5.1, 0], [1.1, 0.22, 1.1], C.patina);
      for (let i = 0; i < 7; i++) {
        const a = (i - 3) * 0.42;
        b.box(body, [Math.sin(a) * 0.55, 5.45, Math.cos(a) * 0.1 - 0.1], [0.12, 0.8, 0.12], C.patina).rotation.z = -a * 0.9;
      }
      b.box(body, [0.95, 4.6, 0], [0.42, 2.4, 0.42], C.patina).rotation.z = -0.12;
      b.box(body, [1.12, 5.95, 0], [0.5, 0.4, 0.5], C.gold, {metalness: 0.3});
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 6), b.mat(C.gold, {emissive: 0xffa21a, emissiveIntensity: 1.2}));
      flame.position.set(1.12, 6.5, 0);
      body.add(flame);
      b.onFrame(t => flame.scale.setScalar(1 + Math.sin(t * 9) * 0.08));
      b.box(body, [-1.05, 3.0, 0.4], [0.35, 1.6, 0.4], C.patina);
      b.box(body, [-1.15, 3.3, 0.75], [0.6, 1.0, 0.18], C.patinaDark);
      // 몸속 뼈대 단면 모형
      const f = b.group('detail');
      b.box(f, [0, 0.2, 0], [4.2, 0.4, 3.2], C.stoneDark);
      b.box(f, [0, 2.4, -1.25], [3.4, 4.0, 0.25], C.patina);
      b.box(f, [-1.6, 2.4, -0.2], [0.25, 4.0, 2.2], C.patina);
      for (const x of [-0.9, 0, 0.9]) b.box(f, [x, 2.4, -0.9], [0.18, 4.0, 0.18], C.iron);
      for (const y of [1.0, 2.2, 3.4]) b.box(f, [0, y, -0.9], [2.2, 0.16, 0.16], C.iron);
      for (const [x, y] of [[-0.9, 1.0], [0, 2.2], [0.9, 3.4], [0.9, 1.0], [-0.9, 3.4]]) b.box(f, [x, y, -1.05], [0.42, 0.42, 0.14], C.rust);
      for (let i = 0; i < 5; i++) b.box(f, [1.3, 0.55 + i * 0.35, 0.9 - i * 0.35], [0.9, 0.12, 0.35], C.wood);
      archiveHouse(b);
      labTent(b);
    },
  },
  case2: {
    sky: 0xd8cfbf, ground: 'hall', mainLook: 2.4, markers: {main: 5.8},
    build(b) {
      // 깨진 진열장과 꽃병
      const g = b.group('main');
      showcase(b, g);
      b.cyl(g, [0, 1.75, 0], 0.42, 1.0, C.vase, {}, 0.34);
      b.box(g, [0, 1.9, 0], [0.92, 0.18, 0.92], C.white);
      b.cyl(g, [0, 2.4, 0], 0.18, 0.3, C.vase);
      for (const [x, z, r] of [[-0.7, 0.4, 0.4], [0.6, -0.3, 1.1], [0.5, 0.5, 2], [-0.4, -0.5, 2.6], [0.9, 0.1, 0.7]])
        b.box(g, [x, 1.25, z], [0.28, 0.06, 0.2], r > 2 ? C.white : C.vase).rotation.y = r;
      for (const [x, z] of [[-1.5, 1.2], [1.6, 1.4], [0.2, 1.6]]) b.box(g, [x, 0.03, z], [0.3, 0.04, 0.22], C.glass, {transparent: true, opacity: 0.7});
      // 조각 작업대: 번호표 붙인 조각
      const d = b.group('detail');
      workTable(b, d, 3.2, 1.8);
      for (let i = 0; i < 14; i++) {
        const x = -1.1 + (i % 7) * 0.36, z = -0.4 + Math.floor(i / 7) * 0.7;
        b.box(d, [x, 1.0, z], [0.24, 0.05, 0.18], i % 4 === 0 ? C.white : C.vase).rotation.y = i * 0.7;
        b.box(d, [x, 1.0, z + 0.25], [0.12, 0.02, 0.08], 0xffffff);
      }
      archiveShelf(b);
      labBench(b);
    },
  },
  case3: {
    sky: 0xe3d2ad, ground: 'hall', mainLook: 2.6, markers: {main: 6.2},
    build(b) {
      // 황금 가면 진열장(블록으로 새로 그린 모형)
      const g = b.group('main');
      showcase(b, g);
      b.box(g, [0, 1.35, 0], [1.0, 0.3, 0.8], 0x2d2a26);
      b.box(g, [0, 2.1, 0], [1.3, 1.2, 0.7], C.mask, {metalness: 0.5, roughness: 0.4});
      for (const x of [-0.72, 0.72]) for (let i = 0; i < 4; i++) b.box(g, [x, 1.6 + i * 0.28, 0.05], [0.16, 0.14, 0.6], i % 2 ? C.lapis : C.mask);
      b.box(g, [0, 2.15, 0.36], [0.62, 0.7, 0.05], 0xe8c35a, {metalness: 0.5, roughness: 0.4});
      for (const x of [-0.16, 0.16]) b.box(g, [x, 2.3, 0.4], [0.16, 0.07, 0.03], 0x1d2a2a);
      b.box(g, [0.75, 1.32, 0.55], [0.18, 0.5, 0.14], C.lapis).rotation.z = 1.3;
      // 수염 이음매 작업대
      const d = b.group('detail');
      workTable(b, d, 3.0, 1.6);
      for (let i = 0; i < 5; i++) b.box(d, [-0.4 + i * 0.16, 1.05, 0], [0.14, 0.12, 0.3], i % 2 ? C.mask : C.lapis);
      b.box(d, [0.45, 1.02, 0.05], [0.1, 0.05, 0.36], 0xf1e7b8);
      b.box(d, [0.9, 1.0, 0.35], [0.7, 0.03, 0.08], 0x9aa0a4).rotation.y = 0.4;
      labBench(b);
    },
  },
  case4: {
    sky: 0xc6dceb, ground: 'plaza', mainLook: 4.5, markers: {main: 9.4},
    build(b) {
      // 문루: 돌 축대 + 홍예문 + 이층 지붕, 처마 아래 단청 띠
      const g = b.group('main');
      for (const x of [-2.6, 2.6]) b.box(g, [x, 1.6, 0], [3.0, 3.2, 4.2], C.granite);
      b.box(g, [0, 2.75, 0], [2.4, 0.9, 4.2], C.granite);
      b.box(g, [0, 1.15, 2.09], [2.2, 2.3, 0.04], 0x3a2f28);
      const storey = (y: number, w: number, d: number) => {
        for (const x of [-w / 2 + 0.3, -w / 6, w / 6, w / 2 - 0.3]) for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) b.box(g, [x, y + 0.75, z], [0.28, 1.5, 0.28], C.red);
        b.box(g, [0, y + 1.6, 0], [w, 0.22, d], C.green);
        b.box(g, [0, y + 1.42, 0], [w + 0.05, 0.14, d + 0.05], C.blue);
        b.box(g, [0, y + 1.85, 0], [w + 1.6, 0.25, d + 1.6], C.tile);
        b.box(g, [0, y + 2.15, 0], [w + 0.6, 0.4, d + 0.6], C.tile);
        b.box(g, [0, y + 2.45, 0], [w - 1.2, 0.2, 0.3], 0x3a3e44);
      };
      storey(3.2, 7.6, 4.2);
      storey(5.75, 6.6, 3.4);
      // 벗겨진 처마 모형 + 비계
      const d = b.group('detail');
      b.box(d, [0, 2.4, 0], [3.4, 0.5, 1.4], C.green);
      b.box(d, [0, 2.1, 0], [3.4, 0.14, 1.4], C.blue);
      b.box(d, [0, 2.85, 0], [4.2, 0.3, 2.0], C.tile);
      for (const x of [-1.0, -0.4, 0.3, 1.1]) b.box(d, [x, 2.4, 0.71], [0.36, 0.22, 0.02], 0xd9c6a0);
      for (const x of [-1.8, 1.8]) for (const z of [-0.9, 0.9]) b.box(d, [x, 1.2, z], [0.08, 2.4, 0.08], 0x9aa0a4);
      b.box(d, [0, 1.2, 0.9], [3.7, 0.08, 0.08], 0x9aa0a4);
      b.box(d, [0, 1.0, 0], [3.6, 0.1, 1.9], C.wood);
      labTent(b, false);
      for (const [x, c] of [[-0.6, C.green], [0, C.blue], [0.6, C.red]]) b.cyl(b.scene, [SLOT.lab.at[0] + x, 1.15, SLOT.lab.at[2] + 0.2], 0.16, 0.3, c);
    },
  },
  case5: {
    sky: 0xcfe4ee, ground: 'field', mainLook: 3.8, markers: {main: 9.0, archive: 5.6},
    build(b) {
      // 돌탑: 줄어드는 몸돌 + 지붕돌. 한쪽 면에 덧붙인 회색 콘크리트, 버팀 나무
      const g = b.group('main');
      b.box(g, [0, 0.3, 0], [5.6, 0.6, 5.6], C.granite);
      let y = 0.6;
      for (let i = 0; i < 6; i++) {
        const w = 4.2 - i * 0.45, h = i === 0 ? 1.5 : 0.75;
        b.box(g, [0, y + h / 2, 0], [w, h, w], i % 2 ? 0xc5bdae : C.granite);
        b.box(g, [0, y + h + 0.12, 0], [w + 1.0, 0.24, w + 1.0], 0xa9a294);
        y += h + 0.24;
      }
      b.box(g, [-2.3, 1.6, 0], [0.9, 3.2, 4.4], C.concrete);
      b.box(g, [-1.8, 3.2, 0], [0.8, 1.2, 3.4], C.concrete);
      for (const [x, z] of [[2.6, 2.2], [3.2, 1.2], [-3.4, 2.6]]) b.box(g, [x, 0.25, z], [0.7, 0.5, 0.5], C.granite);
      for (const z of [-1.4, 1.4]) b.box(g, [3.1, 1.3, z], [0.2, 3.0, 0.2], C.wood).rotation.z = 0.35;
      archiveHouse(b);
      labTent(b, false);
      for (let i = 0; i < 3; i++) b.box(b.scene, [SLOT.lab.at[0] - 0.8 + i * 0.8, 1.1, SLOT.lab.at[2] + 0.2], [0.4, 0.4 - i * 0.08, 0.4], i === 1 ? C.concrete : C.granite);
    },
  },
};

/** 표지: 장소 이름 + 남은 단서('?' n) · ✓ · 자물쇠 */
function drawMarker(canvas: HTMLCanvasElement, name: string, s: MarkerState) {
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  const font = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  g.font = `800 40px ${font}`;
  const w = Math.min(500, g.measureText(name).width + 48);
  const x = (canvas.width - w) / 2;
  g.fillStyle = s.active ? '#1d2a2a' : '#fffdf7';
  g.strokeStyle = '#1d2a2a';
  g.lineWidth = 5;
  roundRect(g, x, 150, w, 70, 20);
  g.fill();
  g.stroke();
  g.fillStyle = s.active ? '#fffdf7' : '#1d2a2a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, canvas.width / 2, 187);
  g.beginPath();
  g.arc(canvas.width / 2, 72, 62, 0, Math.PI * 2);
  g.fillStyle = s.locked ? '#c9c3b5' : s.done ? '#1f7a4d' : '#f2b632';
  g.fill();
  g.lineWidth = 7;
  g.stroke();
  if (s.locked) {
    g.fillStyle = '#1d2a2a';
    g.fillRect(canvas.width / 2 - 24, 64, 48, 36);
    g.lineWidth = 9;
    g.beginPath();
    g.arc(canvas.width / 2, 64, 16, Math.PI, 0);
    g.stroke();
    return;
  }
  g.fillStyle = s.done ? '#ffffff' : '#1d2a2a';
  g.font = `900 ${s.done ? 70 : 64}px ${font}`;
  g.fillText(s.done ? '✓' : `?${s.left > 1 ? s.left : ''}`, canvas.width / 2, 76);
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
