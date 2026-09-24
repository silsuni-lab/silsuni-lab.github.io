import { describe, expect, it } from 'vitest';
import { SQUARE_PRESETS } from '../src/core/constants';
import {
  squareCornerChoices,
  squareCornerFallback,
  squarePerimeterMm,
  squareBackLengthMm,
  squareBackRatioAllowed,
  squareBackRatioChoices,
  squareBackRatioFallback,
  squarePatternFileName,
  squarePatternTitle,
  validateSquareDimensions,
} from '../src/core/square/dimensions';

const ok = { widthMm: 220, depthMm: 140, sideHeightMm: 150, lidHeightMm: 30 };

describe('validateSquareDimensions', () => {
  it('프리셋 셋이 모두 통과하고, 다섯 비율을 모두 고를 수 있다', () => {
    for (const preset of SQUARE_PRESETS) {
      for (const ratio of [0.1, 0.15, 0.2, 0.25, 0.3]) {
        expect(validateSquareDimensions(preset, ratio).ok).toBe(true);
      }
    }
  });

  it('올바른 값을 그대로 돌려준다', () => {
    const result = validateSquareDimensions(ok);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(ok);
  });

  it('가로 범위를 벗어나면 가로 칸에 오류를 단다', () => {
    for (const widthMm of [99, 301]) {
      const result = validateSquareDimensions({ ...ok, widthMm });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.map((e) => e.field)).toContain('widthMm');
    }
  });

  it('폭이 가로보다 크면 거부한다 — 돌려 놓으면 같은 파우치다', () => {
    const result = validateSquareDimensions({ ...ok, widthMm: 150, depthMm: 160 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.field).toBe('depthMm');
    expect(validateSquareDimensions({ ...ok, widthMm: 150, depthMm: 150 }, 0.2).ok).toBe(true);
  });

  it('뚜껑 상한은 원통과 같은 두 겹이다', () => {
    // 옆면 40이면 몸통 최소 20 + 지퍼 10을 빼고 뚜껑 10까지다.
    expect(validateSquareDimensions({ ...ok, sideHeightMm: 40, lidHeightMm: 11 }).ok).toBe(false);
    expect(validateSquareDimensions({ ...ok, sideHeightMm: 40, lidHeightMm: 10 }).ok).toBe(true);
  });

  it('뒷면이 가로보다 길어지는 비율은 거부한다', () => {
    // 220·200 → 둘레 840. 30%는 252 > 220, 25%는 210 ≤ 220.
    const wide = { ...ok, depthMm: 200 };
    const bad = validateSquareDimensions(wide, 0.3);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]!.field).toBe('backRatio');
    expect(validateSquareDimensions(wide, 0.25).ok).toBe(true);
  });

  it('숫자가 아니거나 정수가 아니면 잡는다', () => {
    expect(validateSquareDimensions({ ...ok, widthMm: '' }).ok).toBe(false);
    expect(validateSquareDimensions({ ...ok, widthMm: 200.5 }).ok).toBe(false);
  });
});

describe('뒷면 비율', () => {
  it('뒷면 길이는 둘레 × 비율이다', () => {
    expect(squareBackLengthMm(ok, 0.2)).toBeCloseTo(144);
  });

  it('가로 ≥ 폭이면 25%까지는 언제나 된다 — 잠길 수 있는 건 30%뿐이다', () => {
    const square = { ...ok, widthMm: 200, depthMm: 200 };
    expect(squareBackRatioAllowed(square, 0.25)).toBe(true);
    expect(squareBackRatioAllowed(square, 0.3)).toBe(false);
  });

  it('선택지는 다섯이고, 안 되는 것만 disabled다', () => {
    const choices = squareBackRatioChoices('ko', { ...ok, depthMm: 200 });
    expect(choices.map((c) => c.value)).toEqual([0.1, 0.15, 0.2, 0.25, 0.3]);
    expect(choices.map((c) => c.disabled)).toEqual([false, false, false, false, true]);
  });

  it('고른 비율이 안 되면 되는 것 중 가장 큰 값으로 내린다', () => {
    expect(squareBackRatioFallback({ ...ok, depthMm: 200 }, 0.3)).toBe(0.25);
    expect(squareBackRatioFallback(ok, 0.3)).toBe(0.3);
  });
});

describe('이름', () => {
  it('파일 이름은 네 치수와 용지를 담고, 시접 없으면 -noseam을 단다', () => {
    expect(squarePatternFileName(ok, 'a4')).toBe('silsuni-square-pouch-220x140x150x30-a4.pdf');
    expect(squarePatternFileName(ok, 'a3', 0)).toBe('silsuni-square-pouch-220x140x150x30-a3-noseam.pdf');
  });

  it('시접 없이 뽑으면 도안 이름에 못 박는다', () => {
    expect(squarePatternTitle()).toBe('네모네모 손잡이 파우치');
    expect(squarePatternTitle(0)).toBe('네모네모 손잡이 파우치 시접없음');
  });
});

describe('모서리 라운드', () => {
  it('둥글리면 모서리마다 (2 − π/2)R씩 둘레가 준다', () => {
    expect(squarePerimeterMm(ok, 0)).toBe(720);
    expect(squarePerimeterMm(ok, 20)).toBeCloseTo(720 - (8 - 2 * Math.PI) * 20);
  });

  it('반지름은 폭의 1/4까지 — 폭 50은 10, 80부터 20, 120부터 30', () => {
    const disabled = (depthMm: number) => squareCornerChoices('ko', { depthMm }).map((c) => c.disabled);
    expect(disabled(50)).toEqual([false, false, true, true]);
    expect(disabled(80)).toEqual([false, false, false, true]);
    expect(disabled(120)).toEqual([false, false, false, false]);
    expect(squareCornerChoices('ko').map((c) => c.label)).toEqual(['각지게', '둥글게 10mm', '둥글게 20mm', '둥글게 30mm']);
  });

  it('폭이 줄어 반지름이 안 되면 되는 것 중 가장 큰 값으로 내린다', () => {
    expect(squareCornerFallback({ depthMm: 90 }, 30)).toBe(20);
    expect(squareCornerFallback({ depthMm: 140 }, 30)).toBe(30);
  });

  it('반지름이 폭에 너무 크면 거부한다', () => {
    const result = validateSquareDimensions({ ...ok, depthMm: 90 }, 0.2, 'ko', 30);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.field).toBe('cornerRadius');
  });

  it('경첩은 뒷변의 곧은 부분(W − 2R) 안에만 — 둥글리면 25%도 잠길 수 있다', () => {
    // 200·200, R 20 → 둘레 765.7, 25%는 191.4 > 곧은 부분 160
    const sq = { ...ok, widthMm: 200, depthMm: 200 };
    expect(squareBackRatioChoices('ko', sq, 20).map((c) => c.disabled)).toEqual([false, false, false, true, true]);
    const bad = validateSquareDimensions(sq, 0.25, 'ko', 20);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]!.message).toContain('160mm');
    expect(squareBackRatioFallback(sq, 0.3, 20)).toBe(0.2);
  });

  it('프리셋 셋은 반지름 넷 모두에서 20%를 쓸 수 있다', () => {
    for (const preset of SQUARE_PRESETS) {
      for (const r of [0, 10, 20, 30]) {
        if (r > preset.depthMm / 4) continue;
        expect(validateSquareDimensions(preset, 0.2, 'ko', r).ok, `${preset.id} R${r}`).toBe(true);
      }
    }
  });

  it('파일 이름에 반지름을 붙인다', () => {
    expect(squarePatternFileName(ok, 'a4', 10, 20)).toBe('silsuni-square-pouch-220x140x150x30-r20-a4.pdf');
  });
});
