import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fontkit from '@pdf-lib/fontkit';
import { t } from '../src/core/i18n/messages';
import { LOCALES, type Locale } from '../src/core/i18n/locales';
import {
  ZH_TW_FONT_CHARS,
  ZH_CN_FONT_CHARS,
  JA_FONT_CHARS,
  ZH_TW_FONT_BASE64,
  ZH_CN_FONT_BASE64,
  JA_FONT_BASE64,
} from '../src/core/cjk-fonts';

/*
 * CJK 서브셋 폰트(core/cjk-fonts.ts)는 scripts/build-cjk-font.py가 만든다.
 * 새 문구를 넣고 스크립트를 돌리지 않으면 서브셋에 없는 글자가 빈칸으로
 * 인쇄된다 — 여기서 먼저 잡는다.
 */

interface Subset {
  readonly base64: string;
  readonly chars: ReadonlySet<string>;
}

/*
 * 로케일 → 그 로케일이 쓰는 CJK 서브셋. CJK가 아닌 로케일은 null이다.
 *
 * Record<Locale, …>로 두는 까닭이 있다. 로케일을 하나 늘리면 여기 한 줄을
 * 채울 때까지 tsc가 통과시키지 않으므로, "새 언어에 어떤 폰트를 쓸지"를
 * 반드시 정하고 지나가게 된다. 손으로 적은 세 줄짜리 목록이었다면 새
 * 언어가 조용히 검사 밖에 남는다 — 그러면 빈칸으로 인쇄되는 걸 아무도
 * 못 잡는다. pdf.ts의 FONT_KIND와 같은 결정이며, 그쪽이 정본이다.
 */
const CJK_SUBSET: Readonly<Record<Locale, Subset | null>> = {
  ko: null, // 한글 서브셋(core/korean-font.ts) — tests/pdf.test.ts가 지킨다
  en: null, // 표준 폰트(Helvetica) — 심는 글꼴이 없다
  'zh-TW': { base64: ZH_TW_FONT_BASE64, chars: ZH_TW_FONT_CHARS },
  'zh-CN': { base64: ZH_CN_FONT_BASE64, chars: ZH_CN_FONT_CHARS },
  ja: { base64: JA_FONT_BASE64, chars: JA_FONT_CHARS },
};

/** 서브셋 폰트를 심어 쓰는 로케일만. LOCALES 순서를 그대로 따른다. */
const CJK_CASES: readonly [Locale, Subset][] = LOCALES.flatMap((locale) => {
  const subset = CJK_SUBSET[locale];
  return subset === null ? [] : [[locale, subset] as [Locale, Subset]];
});

const PDF_KEYS = [
  'pdf.patternName',
  'pdf.noSeam',
  'pdf.watermark',
  'pdf.foldEdge',
  'pdf.testSquareMetric',
  'pdf.testSquareImperial',
  'pdf.printNote',
] as const;

// 서브셋 생성기와 같은 라틴 집합. 칸 번호(A, B…)·계정(@silsuni_lab)·치수 표기(*).
const LATIN = ' @_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz*';

describe('CJK 서브셋 — 문구 커버리지', () => {
  it('서브셋을 쓰는 로케일이 셋이다 (zh-TW·zh-CN·ja)', () => {
    expect(CJK_CASES.map(([locale]) => locale)).toEqual(['zh-TW', 'zh-CN', 'ja']);
  });

  for (const [locale, { chars }] of CJK_CASES) {
    it(`${locale}의 PDF 문구가 서브셋에 모두 담긴다`, () => {
      const text = PDF_KEYS.map((key) => t(locale, key)).join('');
      const missing = [...new Set(text)].filter((ch) => !chars.has(ch));
      expect(missing, `${locale} 빠진 글자`).toEqual([]);
    });
  }

  it('PDF에 등장하는 라틴(칸 번호·계정·치수)도 담긴다', () => {
    for (const [locale, { chars }] of CJK_CASES) {
      for (const ch of LATIN) {
        expect(chars.has(ch), `${locale}: ${ch}`).toBe(true);
      }
    }
  });

  it('build-cjk-font.py의 LOCALE_TEXT가 카탈로그 pdf.* 와 겹치는 글자만 담는다', () => {
    // 위 커버리지는 카탈로그⊆CHARS만 본다. 여기선 LOCALE_TEXT가 카탈로그에
    // 없는 글자를 담고 있지 않은지 양방향으로 강제한다 — 초과 글자가 쌓이면
    // (서브셋만 커지고 아무도 모름) 잡는다. ASCII(라틴·숫자·문장부호)는
    // ASCII_SAFE가 원래 담고, 그 외의 글자는 전부 카탈로그에서 와야 한다.
    // (box·round의 noSeam이 같은 말이라 순서·중복은 무시한다.)
    const script = readFileSync('scripts/build-cjk-font.py', 'utf8');
    const SCRIPT_KEY: Record<string, string> = { 'zh-TW': 'ZH_TW', 'zh-CN': 'ZH_CN', ja: 'JA' };
    for (const [locale] of CJK_CASES) {
      const fromScript = script.match(new RegExp(`"${SCRIPT_KEY[locale]}": "([^"]*)"`))?.[1] ?? '';
      const fromCatalog = [...PDF_KEYS, 'round.pattern.name', 'round.pattern.noSeam',
        'round.piece.frontTop', 'round.piece.frontBottom', 'round.piece.circles', 'round.piece.back',
      ].map((key) => t(locale, key as never)).join('') + t(locale, 'paper.sheets', 2);
      const catalogChars = new Set(fromCatalog);
      const scriptNonAscii = [...new Set(fromScript)].filter((ch) => !/[ -~]/.test(ch));
      const extra = scriptNonAscii.filter((ch) => !catalogChars.has(ch));
      expect(extra, `${locale} LOCALE_TEXT 잉여 글자`).toEqual([]);
    }
  });
});

describe('CJK 서브셋 — base64가 선언한 문자를 담는지', () => {
  /*
   * 위의 커버리지 테스트는 선언부(CHARS) 집합 소속만 본다. 여기서는 base64를
   * 디코드해, 선언한 문자가 서브셋의 cmap에 담겼는지 확인한다. CHARS와
   * base64가 어긋나면(서브셋을 재생성하지 않고 문구를 바꿨다면) 여기서 걸린다.
   *
   * fontkit의 characterSet은 cmap 소속을 뜻한다 — '실제로 렌더되는 윤곽선이
   * 있다'는 뜻은 아니다(글리프 0/.notdef로 매핑된 문자도 cmap엔 있다). 다만
   * 문자가 cmap에서 빠졌다면 그것이야말로 '.notdef 빈칸'으로 인쇄되는 확실한
   * 신호라, 빠진 문자를 여기서 잡는다.
   */
  it('선언한 문자가 서브셋 cmap에 담긴다', () => {
    for (const [locale, { base64, chars }] of CJK_CASES) {
      const font = fontkit.create(Buffer.from(base64, 'base64')) as { characterSet: number[] };
      const have = new Set(font.characterSet);
      const missing = [...chars].filter((ch) => !have.has(ch.codePointAt(0)!));
      expect(missing, `${locale} 빠진 글자`).toEqual([]);
    }
  });

  it('선언하지 않은 글자를 쓸데없이 담지 않는다', () => {
    // 서브셋이 필요 이상으로 커지는 것도 함께 막는다. U+FFFF(비문자)는
    // subsetter가 남기는 표식이라 뺀다.
    //
    // 이 검증은 fonttools 내부(정확히는 subsetter가 무엇을 남기는지)와 묶여
    // 있다. 미래에 fonttools가 다르게 잘라내거나 폰트가 다른 표식을 남기면
    // 정상 재생성이 여기서 오실패할 수 있다 — 그때는 이 검증을 함께 다시
    // 볼 것. scripts/requirements.txt가 fonttools 버전을 못 박는 이유이기도
    // 하다.
    const NON_CHARACTER = 0xffff;
    for (const [locale, { base64, chars }] of CJK_CASES) {
      const font = fontkit.create(Buffer.from(base64, 'base64')) as { characterSet: number[] };
      const declared = new Set([...chars].map((ch) => ch.codePointAt(0)!));
      const extra = [...font.characterSet].filter((cp) => cp !== NON_CHARACTER && !declared.has(cp));
      expect(extra.map((cp) => String.fromCodePoint(cp)), `${locale} 여분 글자`).toEqual([]);
    }
  });
});

describe('고지 — 배포물에 실린 글꼴 이름을 그대로 적는다', () => {
  /*
   * OFL은 예약 글꼴 이름을 파생물에 쓰지 못하게 한다. 그래서 서브셋 이름을
   * 새로 지었는데, 고지 문서가 옛 이름을 적고 있으면 배포물에 없는 이름을
   * 고지하는 셈이 된다 — 라이선스 문서가 사실과 다른 것이라 가볍지 않다.
   *
   * 이름을 문서와 코드 양쪽에 손으로 적어 두면 언젠가 갈라진다. 글꼴
   * 바이너리에서 직접 읽어 문서와 맞춘다.
   */
  const notices = readFileSync('THIRD-PARTY-NOTICES.md', 'utf8');

  const familyOf = (base64: string) =>
    (fontkit.create(Buffer.from(base64, 'base64')) as { familyName: string }).familyName;

  it('세 서브셋의 실제 이름이 고지에 적혀 있다', () => {
    for (const [locale, subset] of CJK_CASES) {
      expect(notices, `${locale} 글꼴 이름`).toContain(familyOf(subset.base64));
    }
  });

  it('CJK 서브셋 이름에 예약 이름도 원래 계열 이름도 쓰지 않는다', () => {
    /*
     * 글꼴이 선언한 예약 이름은 'Source'(Source Han Sans) 하나다 —
     * 'Noto'는 예약 이름이 아니다. CJK 세 벌은 계열 이름까지 걷어내
     * 언어로 부르는 이름을 쓰므로 둘 다 나오지 않아야 한다.
     *
     * 한글 서브셋은 'Noto Sans KR Subset'을 그대로 쓴다. 예약 이름을 쓰지
     * 않으니 문제 될 것이 없고, 그래서 이 검사는 CJK만 본다.
     */
    for (const [locale, subset] of CJK_CASES) {
      const family = familyOf(subset.base64);
      expect(family, `${locale}: ${family}`).not.toMatch(/Source|Noto/);
    }
  });
});
