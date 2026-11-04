import * as THREE from 'three';

// 스승님과 길가 동물: 상자만으로 새로 그린 블록 모형. 앞이 +z를 본다.

export const SCENE_KINDS = ['mentor', 'tortoise', 'bird', 'cat', 'squirrel', 'frog'] as const;
export type NpcKind = typeof SCENE_KINDS[number];
type Box = (parent: THREE.Object3D, pos: number[], size: number[], color: number) => THREE.Mesh;

/** 모형과 걷기 흔들림에 쓸 다리(있으면) */
export function buildNpc(kind: NpcKind, box: Box, color?: string): {group: THREE.Group; legs: THREE.Mesh[]; height: number} {
  const g = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  const c = color ? new THREE.Color(color).getHex() : 0;
  if (kind === 'mentor') {
    // 흰 가운, 회색 머리·수염, 안경
    for (const x of [-0.18, 0.18]) legs.push(box(g, [x, 0.33, 0], [0.24, 0.66, 0.26], 0x3a3e44));
    box(g, [0, 1.05, 0], [0.74, 0.95, 0.46], 0xf2efe6);
    box(g, [0, 1.1, 0.24], [0.2, 0.7, 0.03], 0x2f7d6d);
    for (const x of [-0.52, 0.52]) box(g, [x, 1.1, 0], [0.2, 0.78, 0.26], 0xf2efe6);
    box(g, [0, 1.82, 0], [0.58, 0.58, 0.52], 0xe2b48e);
    box(g, [0, 2.16, -0.03], [0.62, 0.16, 0.58], 0xb9bcc0);
    box(g, [0, 1.62, 0.25], [0.44, 0.2, 0.06], 0xd9dcdf);
    for (const x of [-0.13, 0.13]) box(g, [x, 1.86, 0.27], [0.18, 0.12, 0.03], 0x1d2a2a);
    box(g, [0.55, 0.8, 0.15], [0.08, 1.4, 0.08], 0x8a6142);
    return {group: g, legs, height: 2.4};
  }
  if (kind === 'tortoise') {
    box(g, [0, 0.42, 0], [0.9, 0.42, 1.1], 0x6d8f4a);
    box(g, [0, 0.7, 0], [0.6, 0.2, 0.76], 0x587a3c);
    box(g, [0, 0.36, 0.68], [0.32, 0.3, 0.34], 0xa8b46a);
    for (const x of [-0.1, 0.1]) box(g, [x, 0.44, 0.86], [0.06, 0.06, 0.02], 0x1d2a2a);
    for (const [x, z] of [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4]]) legs.push(box(g, [x, 0.15, z], [0.2, 0.3, 0.2], 0xa8b46a));
    return {group: g, legs, height: 1.0};
  }
  if (kind === 'bird') {
    const body = c || 0x8d96a3;
    box(g, [0, 0.42, 0], [0.42, 0.4, 0.62], body);
    box(g, [0, 0.74, 0.22], [0.32, 0.3, 0.3], body);
    box(g, [0, 0.72, 0.43], [0.12, 0.08, 0.14], 0xf2b632);
    for (const x of [-0.08, 0.08]) box(g, [x, 0.8, 0.38], [0.05, 0.05, 0.02], 0x1d2a2a);
    for (const x of [-0.24, 0.24]) box(g, [x, 0.46, -0.04], [0.06, 0.28, 0.46], body === 0xf4f1ea ? 0xb9bcc0 : 0x2d3a3a);
    box(g, [0, 0.46, -0.38], [0.24, 0.08, 0.2], body);
    for (const x of [-0.1, 0.1]) legs.push(box(g, [x, 0.11, 0.04], [0.06, 0.22, 0.06], 0xe08a3c));
    return {group: g, legs, height: 1.0};
  }
  if (kind === 'cat') {
    box(g, [0, 0.42, 0], [0.42, 0.36, 0.86], 0xd98a3c);
    box(g, [0, 0.66, 0.5], [0.44, 0.38, 0.38], 0xd98a3c);
    for (const x of [-0.14, 0.14]) box(g, [x, 0.9, 0.5], [0.12, 0.14, 0.08], 0xd98a3c);
    box(g, [0, 0.6, 0.7], [0.26, 0.14, 0.02], 0xf4f1ea);
    for (const x of [-0.1, 0.1]) box(g, [x, 0.72, 0.7], [0.06, 0.08, 0.02], 0x1d2a2a);
    const tail = box(g, [0, 0.66, -0.56], [0.1, 0.5, 0.1], 0xd98a3c);
    tail.rotation.x = -0.5;
    for (const [x, z] of [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.32], [0.14, -0.32]]) legs.push(box(g, [x, 0.13, z], [0.12, 0.26, 0.12], 0xf4f1ea));
    return {group: g, legs, height: 1.1};
  }
  if (kind === 'squirrel') {
    box(g, [0, 0.36, 0], [0.32, 0.38, 0.42], 0xa0633a);
    box(g, [0, 0.66, 0.16], [0.3, 0.28, 0.28], 0xa0633a);
    for (const x of [-0.1, 0.1]) box(g, [x, 0.84, 0.14], [0.08, 0.12, 0.06], 0xa0633a);
    for (const x of [-0.07, 0.07]) box(g, [x, 0.7, 0.31], [0.05, 0.05, 0.02], 0x1d2a2a);
    box(g, [0, 0.62, -0.32], [0.26, 0.6, 0.2], 0xc27d47);
    box(g, [0, 0.98, -0.26], [0.26, 0.2, 0.26], 0xc27d47);
    for (const x of [-0.1, 0.1]) legs.push(box(g, [x, 0.09, 0.08], [0.1, 0.18, 0.12], 0x7e4a2a));
    return {group: g, legs, height: 1.2};
  }
  // frog
  box(g, [0, 0.24, 0], [0.62, 0.32, 0.6], 0x4f9a4a);
  for (const x of [-0.18, 0.18]) {
    box(g, [x, 0.48, 0.18], [0.18, 0.18, 0.18], 0x4f9a4a);
    box(g, [x, 0.5, 0.27], [0.08, 0.08, 0.02], 0x1d2a2a);
  }
  box(g, [0, 0.2, 0.31], [0.36, 0.06, 0.02], 0x2f6a2c);
  for (const [x, z] of [[-0.34, -0.12], [0.34, -0.12]]) legs.push(box(g, [x, 0.12, z], [0.18, 0.18, 0.34], 0x3f8a3a));
  return {group: g, legs, height: 0.8};
}
