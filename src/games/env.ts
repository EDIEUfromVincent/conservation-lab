import type {AnyGame, Medal, Power, StageNo} from './data';

/** 미니게임 한 판에 넘겨주는 것: 단계, 힘(장착 도구·능력치), 그릴 곳, 키 처리, 끝났을 때 */
export interface GameEnv {
  game: AnyGame;
  stage: StageNo;
  power: Power;
  stageEl: HTMLElement;        // #stage(data- 속성으로 테스트가 상태를 읽는다)
  area: HTMLElement;           // 가운데 놀이판(1440×684)
  side: HTMLElement;           // 오른쪽 계기판
  held: Set<string>;           // 누르고 있는 키(소문자)
  onKey: (down: (e: KeyboardEvent) => void, up?: (e: KeyboardEvent) => void) => void;
  end: (medal: Medal | null, why?: string) => void;
  pack: number;                // 운반 게임: 고른 포장의 흔들림 배수
}
/** 한 판을 시작하고, 정리 함수를 돌려준다 */
export type GameMount = (env: GameEnv) => () => void;

/** 실수 수로 메달: 실수 0~a 금, ~b 은, 그 위는 동 */
export const medalByMistakes = (mistakes: number, a: number, b: number): Medal => (mistakes <= a ? 'gold' : mistakes <= b ? 'silver' : 'bronze');

/** 정해진 씨앗으로 늘 같은 순서의 난수(단계마다 같은 판) */
export function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}
/** 씨앗 난수로 섞기 */
export function shuffle<T>(list: T[], rnd: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** 남은 기회를 ♥ 모양으로(색만으로 구분하지 않게 빈 칸은 ♡) */
export const hearts = (left: number, total: number) => '♥'.repeat(Math.max(0, left)) + '♡'.repeat(Math.max(0, total - left));
