import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canRetry, isStaleChunkError, keepState, parseState, RETRY_WINDOW_MS, takeState } from '../src/stale';

/*
 * 배포가 지나간 화면을 스스로 되살리는 부분. sessionStorage를 만지는 쪽은
 * 브라우저 것이라 여기서 못 본다. 알아보는 눈과 되돌리는 눈만 지킨다.
 */

describe('isStaleChunkError — 배포가 지나간 오류를 알아본다', () => {
  it('크롬 문구를 알아본다', () => {
    expect(isStaleChunkError(new Error(
      'Failed to fetch dynamically imported module: https://silsuni-lab.github.io/assets/pdf-BKfdVt8E.js',
    ))).toBe(true);
  });

  it('사파리 문구를 알아본다', () => {
    expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('파이어폭스 문구를 알아본다', () => {
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('Error가 아닌 것도 받는다', () => {
    // 던져지는 것이 Error라는 보장이 없다.
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('다른 오류는 건드리지 않는다', () => {
    // 이게 참이 되면 엉뚱한 오류에도 화면을 다시 불러 사람을 놀래킨다.
    expect(isStaleChunkError(new Error('폰트를 읽지 못했습니다'))).toBe(false);
    expect(isStaleChunkError(new Error('Out of memory'))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });
});

describe('parseState — 맡겨 둔 값을 되돌린다', () => {
  const good = {
    kind: 'box',
    values: { widthMm: '270', heightMm: '140', depthMm: '100' },
    paper: 'a3',
    addSeam: false,
    foldHalf: true,
  };

  it('맡긴 그대로 돌려준다', () => {
    expect(parseState(JSON.stringify(good))).toEqual(good);
  });

  it('치던 글자를 숫자로 바꾸지 않는다', () => {
    // 지우다 만 빈칸이 0이 되면 화면에 없던 값이 생긴다.
    const blank = { ...good, values: { ...good.values, widthMm: '' } };
    expect(parseState(JSON.stringify(blank))?.values['widthMm']).toBe('');
  });

  it('원통 상태도 그대로 돌려준다', () => {
    const round = {
      kind: 'round',
      values: { diameterMm: '130', sideHeightMm: '130', lidHeightMm: '30' },
      paper: 'a4',
      addSeam: true,
      backRatio: 0.25,
    };
    expect(parseState(JSON.stringify(round))).toEqual(round);
  });

  it('모양이 안 맞으면 버린다', () => {
    // 되살리려다 더 망가뜨리느니 첫 프리셋으로 시작하는 편이 낫다.
    expect(parseState('{')).toBeUndefined();
    expect(parseState('null')).toBeUndefined();
    expect(parseState('"a4"')).toBeUndefined();
    expect(parseState(JSON.stringify({ ...good, paper: 'a5' }))).toBeUndefined();
    expect(parseState(JSON.stringify({ ...good, addSeam: 'true' }))).toBeUndefined();
    expect(parseState(JSON.stringify({ ...good, kind: 'triangle' }))).toBeUndefined();
    // 치수는 글자여야 한다. 숫자로 들어오면 빈칸이 0이 되는 그 문제로 돌아간다.
    const numeric = { ...good, values: { ...good.values, widthMm: 270 } };
    expect(parseState(JSON.stringify(numeric))).toBeUndefined();
    const { values: _values, ...noValues } = good;
    expect(parseState(JSON.stringify(noValues))).toBeUndefined();
    const { kind: _kind, ...noKind } = good;
    expect(parseState(JSON.stringify(noKind))).toBeUndefined();
  });
});

describe('takeState — 다른 종류의 화면 것은 집어가지 않는다', () => {
  /*
   * 사각과 원통이 같은 탭에서 같은 sessionStorage를 쓴다. 표식 없이 두면
   * 원통이 맡긴 값을 사각 화면이 자기 것인 줄 알고 집어간다. 브라우저 것을
   * 여기서 못 보므로 같은 모양의 가짜를 세워 두고 본다.
   */
  const fakeStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
  };

  beforeEach(() => {
    (globalThis as Record<string, unknown>)['sessionStorage'] = fakeStorage();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['sessionStorage'];
  });

  const roundState = {
    kind: 'round',
    values: { diameterMm: '130', sideHeightMm: '130', lidHeightMm: '30' },
    paper: 'a4',
    addSeam: true,
    backRatio: 0.2,
  } as const;

  it('맡긴 화면이 도로 찾아간다', () => {
    expect(keepState(roundState)).toBe(true);
    expect(takeState('round')).toEqual(roundState);
  });

  it('사각 화면은 원통이 맡긴 것을 받지 않는다', () => {
    expect(keepState(roundState)).toBe(true);
    expect(takeState('box')).toBeUndefined();
  });

  it('한 번 꺼내면 지운다', () => {
    // 남겨 두면 다음에 이 사이트를 열었을 때 옛 치수가 들어차 있다.
    expect(keepState(roundState)).toBe(true);
    expect(takeState('round')).toEqual(roundState);
    expect(takeState('round')).toBeUndefined();
  });

  it('종류가 안 맞아 버릴 때도 지운다', () => {
    // 남겨 두면 다른 화면이 볼 때까지 계속 굴러다닌다.
    expect(keepState(roundState)).toBe(true);
    expect(takeState('box')).toBeUndefined();
    expect(takeState('round')).toBeUndefined();
  });

  /*
   * 예전 판이 맡긴 상태에는 지금 없는 값(자 선택 같은)이 섞여 있다. 그걸
   * 이유로 통째로 버리면 배포가 지나간 바로 그 순간 — 이 기능이 쓰이는
   * 유일한 순간이다 — 치던 치수를 잃는다.
   */
  it('모르는 열쇠가 섞여 있어도 아는 값은 살린다', () => {
    const boxState = {
      kind: 'box',
      values: { widthMm: '270', heightMm: '140', depthMm: '100' },
      paper: 'a3',
      addSeam: false,
      foldHalf: true,
    };
    const parsed = parseState(JSON.stringify({ ...boxState, unitSystem: 'imperial', 자: '옛값' }));
    expect(parsed).toBeDefined();
    expect(parsed?.values.widthMm).toBe('270');
    expect(parsed?.paper).toBe('a3');
    expect(parsed?.values.heightMm).toBe('140');
  });
});

describe('canRetry — 끝없이 다시 부르지 않는다', () => {
  const now = 1_700_000_000_000;

  it('처음이면 부른다', () => {
    expect(canRetry(null, now)).toBe(true);
  });

  it('방금 불렀으면 또 부르지 않는다', () => {
    /*
     * 이게 참이 되면 새로고침해도 낫지 않는 상황에서 화면이 끝없이 돈다.
     * 되살린 화면은 표식을 지우지 않으므로 자기가 처음인 줄 알면 안 된다.
     */
    expect(canRetry(String(now), now)).toBe(false);
    expect(canRetry(String(now - RETRY_WINDOW_MS + 1), now)).toBe(false);
  });

  it('충분히 지났으면 다시 부른다', () => {
    // 오래 열어 둔 창이 나중에 또 배포를 만나면 그때는 살아나야 한다.
    expect(canRetry(String(now - RETRY_WINDOW_MS), now)).toBe(true);
    expect(canRetry(String(now - 3_600_000), now)).toBe(true);
  });

  it('표식이 망가졌으면 처음인 것으로 본다', () => {
    expect(canRetry('어제', now)).toBe(true);
  });
});
