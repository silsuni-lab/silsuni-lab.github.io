import { describe, expect, it } from 'vitest';
import {
  BACK_RATIO_DEFAULT,
  BACK_RATIO_MAX,
  BACK_RATIO_MIN,
  lidHeightMaxMm,
  roundPatternFileName,
  roundPatternTitle,
  validateRoundDimensions,
} from '../src/core/round/dimensions';

const ok = { diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 };

describe('lidHeightMaxMm — 뚜껑 상한은 두 겹이다', () => {
  it('낮은 파우치는 몸통 최소 20이 상한을 정한다', () => {
    // 옆면/2만 걸면 옆면 40에 뚜껑 20이 통과하고 몸통이 10만 남는다.
    expect(lidHeightMaxMm(40)).toBe(10);
  });

  it('큰 파우치는 옆면의 절반이 상한을 정한다', () => {
    // 몸통 조건만 걸면 뚜껑이 몸통보다 긴 조합이 통과한다.
    expect(lidHeightMaxMm(130)).toBe(65);
    expect(lidHeightMaxMm(300)).toBe(150);
  });
});

describe('validateRoundDimensions', () => {
  it('올바른 값을 통과시킨다', () => {
    const result = validateRoundDimensions(ok);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(ok);
  });

  it('범위를 벗어난 지름을 잡는다', () => {
    // 지름 80보다 작으면 원 시접의 곡률이 심해 접히지 않는다.
    const result = validateRoundDimensions({ ...ok, diameterMm: 70 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.field).toBe('diameterMm');
  });

  it('뚜껑이 상한을 넘으면 잡는다', () => {
    const result = validateRoundDimensions({ diameterMm: 130, sideHeightMm: 40, lidHeightMm: 20 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === 'lidHeightMm')).toBe(true);
  });

  it('빈 칸과 숫자가 아닌 값을 잡는다', () => {
    expect(validateRoundDimensions({ ...ok, diameterMm: '' }).ok).toBe(false);
    expect(validateRoundDimensions({ ...ok, diameterMm: '어제' }).ok).toBe(false);
  });

  it('뒷면 비율이 범위를 벗어나면 잡는다', () => {
    // 0.5면 지퍼가 반원보다 짧아져 뚜껑이 물리적으로 안 젖혀진다.
    expect(validateRoundDimensions(ok, 0.5).ok).toBe(false);
    expect(validateRoundDimensions(ok, BACK_RATIO_MIN).ok).toBe(true);
    expect(validateRoundDimensions(ok, BACK_RATIO_MAX).ok).toBe(true);
    expect(validateRoundDimensions(ok, BACK_RATIO_DEFAULT).ok).toBe(true);
  });
});

describe('이름과 파일명', () => {
  it('도안 이름에 세 치수를 붙인다', () => {
    expect(roundPatternTitle(ok, 10)).toBe('동글동글 원통 파우치 130*130*30');
  });

  it('시접 없이 뽑았으면 못 박는다', () => {
    // 종이만 돌아다니면 화면을 볼 수 없고, 모르고 재단하면 원단을 버린다.
    expect(roundPatternTitle(ok, 0)).toBe('동글동글 원통 파우치 130*130*30 시접없음');
  });

  it('파일명이 사각 파우치와 겹치지 않는다', () => {
    expect(roundPatternFileName(ok, 'a4', 10)).toBe('round-pouch-130x130x30-a4.pdf');
    expect(roundPatternFileName(ok, 'a3', 0)).toBe('round-pouch-130x130x30-a3-noseam.pdf');
  });
});
