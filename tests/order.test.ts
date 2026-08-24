import { describe, expect, it } from 'vitest';
import { BOX_FIELDS, DIMENSION_ORDER, PRESETS } from '../src/core/constants';
import { LOCALES } from '../src/core/i18n/locales';
import { t } from '../src/core/i18n/messages';
import { validateDimensions } from '../src/core/dimensions';
import { formatPresetLabel } from '../src/ui/form';

describe('DIMENSION_ORDER', () => {
  it('가로 → 높이 → 바닥폭 순이다', () => {
    expect(DIMENSION_ORDER).toEqual(['widthMm', 'heightMm', 'depthMm']);
  });

  it('세 치수를 빠짐없이 한 번씩 담는다', () => {
    expect([...DIMENSION_ORDER].sort()).toEqual(['depthMm', 'heightMm', 'widthMm']);
  });

  it('모든 치수에 모든 언어의 이름이 있다', () => {
    for (const field of DIMENSION_ORDER) {
      for (const locale of LOCALES) {
        expect(t(locale, `field.${field}`)).toBeTruthy();
      }
    }
  });

  it('화면에 보이는 순서대로 가로·높이·바닥폭이라 부른다', () => {
    expect(DIMENSION_ORDER.map((field) => t('ko', `field.${field}`))).toEqual([
      '가로',
      '높이',
      '바닥폭',
    ]);
    expect(DIMENSION_ORDER.map((field) => t('en', `field.${field}`))).toEqual([
      'Width',
      'Height',
      'Depth',
    ]);
  });

  it('높이와 헷갈리는 "세로"라는 이름을 쓰지 않는다', () => {
    for (const field of DIMENSION_ORDER) {
      expect(t('ko', `field.${field}`)).not.toContain('세로');
    }
  });
});

describe('formatPresetLabel', () => {
  it('확정한 순서대로 치수를 적는다', () => {
    expect(formatPresetLabel(BOX_FIELDS, PRESETS[0]!, 'ko')).toBe('필통 200*50*50');
    expect(formatPresetLabel(BOX_FIELDS, PRESETS[1]!, 'ko')).toBe('생리대 파우치 120*70*40');
    expect(formatPresetLabel(BOX_FIELDS, PRESETS[2]!, 'ko')).toBe('화장품 파우치 150*90*50');
    expect(formatPresetLabel(BOX_FIELDS, PRESETS[0]!, 'en')).toBe('Pencil case 200*50*50');
  });

  it('DIMENSION_ORDER를 따른다', () => {
    const preset = PRESETS[0]!;
    const expected = DIMENSION_ORDER.map((field) => preset[field]).join('*');
    expect(formatPresetLabel(BOX_FIELDS, preset, 'ko')).toBe(`필통 ${expected}`);
  });

  it('프리셋은 mm 원본을 그대로 쓴다 — 표시용 가공을 하지 않는다', () => {
    // formatPresetLabel은 표시 문자열만 만들 뿐 프리셋의 원본 치수는 mm 그대로다.
    expect(PRESETS[0]!.widthMm).toBe(200);
    expect(PRESETS[0]!.heightMm).toBe(50);
    expect(PRESETS[0]!.depthMm).toBe(50);
  });

  it('프리셋이 표시용 문자열을 들지 않는다', () => {
    for (const preset of PRESETS) {
      expect(preset).not.toHaveProperty('label');
    }
  });
});

describe('validateDimensions — 오류 순서', () => {
  it('오류를 DIMENSION_ORDER 순으로 돌려준다', () => {
    const result = validateDimensions({ widthMm: 1, heightMm: 1, depthMm: 1 });
    if (result.ok) throw new Error('거부되어야 한다');
    expect(result.errors.map((e) => e.field)).toEqual([...DIMENSION_ORDER]);
  });
});
