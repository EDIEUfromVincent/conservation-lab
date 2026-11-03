import {describe, it, expect} from 'vitest';
import {scenario, manuals, labs} from '../../src/content/loadContent';
import {validateContent} from '../../src/content/rules';
import type {Decision} from '../../src/content/types';

describe('콘텐츠 규칙', () => {
  it('원본은 AI 캡처 없음 경고 하나만', () => {
    const r = validateContent(scenario, manuals, labs);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it.each(['V01', 'V04', 'V05', 'V09', 'V11', 'V14', 'V15', 'J01', 'N01', 'HERITAGE', 'PROFILE'])('%s 위반을 잡는다', code => {
    const s = structuredClone(scenario);
    const c = s.cases[0];
    const d = c.nodes.find((n): n is Decision => n.type === 'decision')!;
    if (code === 'V01') c.nodes.push(c.nodes[0]);
    if (code === 'V04') d.choices[0].outcome = 'missing';
    if (code === 'V05') c.nodes.forEach(n => { if (n.type === 'outcome') n.result = 'worse'; });
    if (code === 'V09') { const n = c.nodes.find(n => n.type === 'outcome')!; if (n.type === 'outcome') { n.retry = true; delete n.delayed; } }
    if (code === 'V11') c.flow = c.flow.filter(x => x !== 'predict');
    if (code === 'V14') s.cases.forEach(c => c.nodes.forEach(n => { if (n.type === 'decision') n.step = 'investigate'; }));
    if (code === 'V15') c.nodes.forEach(n => { if (n.type === 'decision') n.optional = true; });
    if (code === 'J01') delete (d as Partial<Decision>).journal;
    // 학생 화면에 원칙 이름이 새면 안 된다(docs/12 §5)
    if (code === 'N01') d.choices[0].label = 'P3 되돌릴 수 있게 한다';
    if (code === 'HERITAGE') s.heritagePick.examples[0].experts = ['stone' as never];
    if (code === 'PROFILE') s.profiles['120'].phases[0].minutes += 1;
    expect(validateContent(s, manuals, labs).errors.some(e => e.startsWith(`[${code}]`))).toBe(true);
  });
});
