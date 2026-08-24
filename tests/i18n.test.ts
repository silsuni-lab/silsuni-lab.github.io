import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  localeFromLang,
  localeHref,
  type Locale,
} from '../src/core/i18n/locales';
import { CATALOGS, messageKeys, t } from '../src/core/i18n/messages';

describe('locales', () => {
  it('다섯 언어를 낸다', () => {
    expect(LOCALES).toEqual(['ko', 'en', 'zh-TW', 'zh-CN', 'ja']);
    expect(DEFAULT_LOCALE).toBe('ko');
  });

  it('html lang에서 로케일을 읽는다', () => {
    expect(localeFromLang('ko')).toBe('ko');
    expect(localeFromLang('en')).toBe('en');
    expect(localeFromLang('zh-TW')).toBe('zh-TW');
    expect(localeFromLang('ja')).toBe('ja');
  });

  it('모르는 값이면 기본 로케일로 떨어진다', () => {
    // 남이 포크해 lang을 바꿔 두어도 화면이 비지 않아야 한다.
    expect(localeFromLang('fr')).toBe(DEFAULT_LOCALE);
    expect(localeFromLang('')).toBe(DEFAULT_LOCALE);
    expect(localeFromLang(null)).toBe(DEFAULT_LOCALE);
  });

  it('지역 꼬리표가 붙어도 읽는다', () => {
    expect(localeFromLang('en-US')).toBe('en');
    expect(localeFromLang('ko-KR')).toBe('ko');
  });
});

describe('localeHref — 언어 전환', () => {
  it('뿌리 페이지는 아래로, 하위 페이지는 한 칸 위로 간다', () => {
    // ko는 /에, 나머지는 한 단계 아래(/en/, /zh-TW/ …)에 정적 페이지가 있고
    // base가 './'다. 어느 페이지에서 눌러도 목적지 경로로 수렴해야 한다.
    expect(localeHref('ko', 'en')).toBe('./en/');
    expect(localeHref('ko', 'ja')).toBe('./ja/');
    expect(localeHref('ko', 'ko')).toBe('./');
    expect(localeHref('en', 'ko')).toBe('../');
    expect(localeHref('en', 'zh-TW')).toBe('../zh-TW/');
    expect(localeHref('zh-TW', 'zh-CN')).toBe('../zh-CN/');
    expect(localeHref('zh-CN', 'zh-CN')).toBe('./');
  });

  it('기본 로케일을 벗어난 로케일은 자기와 무관하게 하위에서 출발한다', () => {
    expect(localeHref('ja', 'zh-TW')).toBe('../zh-TW/');
    expect(localeHref('en', 'en')).toBe('./');
  });
});

describe('카탈로그', () => {
  it('모든 로케일이 같은 키를 갖는다', () => {
    // 타입이 먼저 잡지만, 타입을 우회해 손댄 경우까지 여기서 막는다.
    const keys = messageKeys();
    for (const locale of LOCALES) {
      expect(Object.keys(CATALOGS[locale]).sort()).toEqual([...keys].sort());
    }
  });

  it('빈 값이 없다', () => {
    for (const locale of LOCALES) {
      for (const key of messageKeys()) {
        const value = CATALOGS[locale][key];
        if (typeof value === 'string') expect(value.trim()).not.toBe('');
        else expect(typeof value).toBe('function');
      }
    }
  });

  /*
   * 타입은 인자가 적은 쪽을 걸러내지 못한다. TypeScript에서 (a) => string은
   * (a, b) => string에 그대로 할당된다. 그러면 en이 둘째 인자를 조용히
   * 버리고 "100–400" 대신 "from 100"을 낸다. 오류도 안 난다.
   */
  it('함수 메시지는 로케일끼리 인자 개수가 같다', () => {
    for (const key of messageKeys()) {
      const base = CATALOGS.ko[key];
      if (typeof base !== 'function') continue;
      for (const locale of LOCALES) {
        const value = CATALOGS[locale][key];
        expect(typeof value, `${locale}.${key}`).toBe('function');
        expect((value as (...a: never[]) => string).length, `${locale}.${key} 인자 개수`).toBe(base.length);
      }
    }
  });

  it('영어 카탈로그에 한글이 남아 있지 않다', () => {
    // 옮기다 만 줄을 잡는다. 눈으로는 못 본다.
    for (const key of messageKeys()) {
      const value = CATALOGS.en[key];
      if (typeof value === 'string') {
        expect(value, `en.${key}`).not.toMatch(/[가-힣]/);
      }
    }
  });

  it('중국어·일본어 카탈로그에 한국어가 섞여 있지 않다', () => {
    // 번역하다 만 자리에 한국어가 남으면 범례·안내가 반쯤 한국어로 보인다.
    for (const locale of ['zh-TW', 'zh-CN', 'ja'] as const) {
      for (const key of messageKeys()) {
        const value = CATALOGS[locale][key];
        if (typeof value === 'string') {
          expect(value, `${locale}.${key}`).not.toMatch(/[가-힣]/);
        }
      }
    }
  });
});

describe('t', () => {
  it('로케일에 맞는 문자열을 준다', () => {
    expect(t('ko', 'band.front')).toBe('앞판');
    expect(t('en', 'band.front')).toBe('Front');
  });

  it('밴드 이름 넷을 모두 낸다', () => {
    for (const id of ['topFront', 'front', 'bottom', 'back', 'topBack'] as const) {
      for (const locale of LOCALES) {
        expect(t(locale, `band.${id}`)).toBeTruthy();
      }
    }
  });
});

describe('t — 값이 함수인 메시지', () => {
  /*
   * 언어마다 조사와 어순이 달라 문자열 보간만으로는 안 된다. 한국어는
   * 받침에 따라 은/는이 갈리고, 영어는 그런 것이 없다. 카탈로그가
   * 그 차이를 흡수한다.
   */
  it('한국어 오류 메시지가 받침에 맞는 조사를 붙인다', () => {
    expect(t('ko', 'error.notNumber', '가로')).toBe('가로를 숫자로 입력해주세요.');
    expect(t('ko', 'error.notNumber', '바닥폭')).toBe('바닥폭을 숫자로 입력해주세요.');
  });

  it('영어 오류 메시지는 조사 없이 이어 붙인다', () => {
    expect(t('en', 'error.notNumber', 'Width')).toBe('Width must be a number.');
  });

  it('영어는 장수에 따라 단수·복수를 가린다', () => {
    expect(t('en', 'paper.sheets', 1)).toContain('1 sheet');
    expect(t('en', 'paper.sheets', 1)).not.toContain('sheets');
    expect(t('en', 'paper.sheets', 3)).toContain('3 sheets');
  });

  it('한국어는 장수에 따라 달라지지 않는다', () => {
    expect(t('ko', 'paper.sheets', 1)).toContain('1장');
    expect(t('ko', 'paper.sheets', 3)).toContain('3장');
  });
});

describe('용어집 — 재봉 관례를 지킨다', () => {
  /*
   * 직역하면 원단을 버린다. 웹에서 확인한 영어권 관례를 못 박아 둔다.
   * 근거는 설계 문서의 용어집 표에 URL과 함께 적었다.
   */
  const conventions: readonly [string, string][] = [
    ['legend.cutLine', 'Cutting line'],
    ['legend.stitchLine', 'Stitching line'],
    ['legend.seamAllowance', 'Seam allowance'],
    ['legend.foldEdge', 'Place on fold'],
    ['legend.centerLine', 'Center line'],
  ];

  for (const [key, term] of conventions) {
    it(`${key}는 "${term}"을 쓴다`, () => {
      expect(t('en', key as never)).toContain(term);
    });
  }

  it('접힘선(fold line)과 골선(place on fold)을 다른 말로 쓴다', () => {
    // 영어에서도 둘은 다른 용어다. 같은 말로 뭉치면 접는 자리와
    // 원단을 대는 자리가 구별되지 않는다.
    expect(t('en', 'band.front')).not.toBe(t('en', 'legend.foldEdge'));
    expect(t('en', 'legend.foldEdge')).toContain('fold');
    expect(t('en', 'legend.foldEdge')).not.toBe('Fold line');
  });
});
