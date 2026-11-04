import {describe, it, expect} from 'vitest';
import {newHero, gainXp, giveItem, equip, stat, statLevel, level, dropChance, finishTalk, validHero, rpg, itemOf, ROLES, type DialogNode} from '../../src/rpg/hero';
import {SCENE_KINDS} from '../../src/rpg/models';

describe('연구원 성장', () => {
  it('경험치가 쌓이면 능력치 레벨과 전체 레벨이 오른다', () => {
    let h = newHero();
    expect(statLevel(h, 'analyze')).toBe(1);
    const r = gainXp(h, 'analyze', rpg.xp.perStatLevel);
    h = r.hero;
    expect(statLevel(h, 'analyze')).toBe(2);
    expect(r.gains).toContainEqual({kind: 'statUp', role: 'analyze', level: 2});
    const r2 = gainXp(h, 'record', rpg.xp.perLevel);
    expect(r2.gains.some(g => g.kind === 'levelUp')).toBe(true);
    expect(level(r2.hero)).toBe(2);
  });

  it('도구를 받으면 그 역할 칸에 장착되고, 더 좋은 도구가 오면 바꿔 낀다', () => {
    let h = giveItem(newHero(), 'tags').hero;
    expect(h.equipped.record).toBe('tags');
    expect(stat(h, 'record')).toBe(1 + itemOf('tags')!.bonus);
    h = giveItem(h, 'camera').hero;
    expect(h.equipped.record).toBe('camera');
    h = equip(h, 'tags');
    expect(h.equipped.record).toBe('tags');
    expect(giveItem(h, 'camera').gains).toEqual([]);   // 이미 있는 도구는 다시 받지 않는다
  });

  it('도구 찾기 확률은 능력치가 높을수록 오르고, 동물과는 처음 한 번만 받는다', () => {
    const turtle = rpg.animals.find(a => a.id === 'tortoise')!;
    const low = dropChance(newHero(), turtle);
    const strong = giveItem(gainXp(newHero(), 'analyze', 200).hero, 'microscope').hero;
    expect(dropChance(strong, turtle)).toBeGreaterThan(low);
    const lucky = finishTalk(newHero(), turtle, 0);
    expect(lucky.gains).toContainEqual({kind: 'item', id: turtle.drop});
    const unlucky = finishTalk(newHero(), turtle, 0.99);
    expect(unlucky.gains.find(g => g.kind === 'roll')).toMatchObject({found: false});
    expect(finishTalk(lucky.hero, turtle, 0).gains).toEqual([]);
    // 못 찾았으면 다시 이야기할 때 또 확률을 굴린다(경험치는 처음 한 번만)
    const again = finishTalk(unlucky.hero, turtle, 0);
    expect(again.gains.some(g => g.kind === 'xp')).toBe(false);
    expect(again.gains).toContainEqual({kind: 'item', id: turtle.drop});
  });

  it('어긋난 저장 기록은 버린다', () => {
    const h = giveItem(newHero(), 'loupe').hero;
    expect(validHero(JSON.parse(JSON.stringify(h)))).toEqual(h);
    expect(validHero({...h, items: ['sword']})).toBeNull();
    expect(validHero({...h, equipped: {record: 'loupe'}})).toBeNull();
    expect(validHero(null)).toBeNull();
  });
});

describe('RPG 데이터', () => {
  const walk = (nodes: Record<string, DialogNode>, start: string) => {
    // 모든 노드가 시작에서 닿고, next가 모두 있는 노드를 가리킨다
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      const n = nodes[id];
      expect(n, id).toBeDefined();
      expect(!!n.say !== !!n.ask, id).toBe(true);
      seen.add(id);
      if (n.next) stack.push(n.next);
      for (const c of n.choices ?? []) stack.push(c.next);
      if (n.ask) expect(n.choices!.length).toBeGreaterThanOrEqual(2);
    }
    expect([...seen].sort()).toEqual(Object.keys(nodes).sort());
  };
  it('스승님·동물 대화는 끊긴 곳 없이 이어진다', () => {
    walk(rpg.mentor.nodes, rpg.mentor.start);
    for (const a of rpg.animals) walk(a.nodes, a.start);
  });
  it('도구·선물·동물이 실제 도구와 역할을 가리킨다', () => {
    for (const a of rpg.animals) {
      expect(itemOf(a.drop), a.id).toBeDefined();
      expect(ROLES).toContain(a.role);
      expect(SCENE_KINDS).toContain(a.kind);
    }
    for (const id of [...Object.values(rpg.gifts.roleChange), ...Object.values(rpg.gifts.caseComplete), ...Object.values(rpg.gifts.gold)]) expect(itemOf(id), id).toBeDefined();
    for (const r of ROLES) expect(itemOf(rpg.gifts.roleChange[r])!.role).toBe(r);
  });
  it('학생 화면 금지어가 없다', () => {
    expect(JSON.stringify(rpg)).not.toMatch(/문화재|정답|오답|틀렸|원칙|\bP[1-5]\b/);
  });
});
