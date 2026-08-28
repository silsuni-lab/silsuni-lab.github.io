import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { buildLayout } from '../src/core/layout';
import { paginate } from '../src/core/tiling';
import { PRESETS } from '../src/core/constants';
import { LOCALES, type Locale } from '../src/core/i18n/locales';
import { t } from '../src/core/i18n/messages';
import { MM_PER_INCH } from '../src/core/units';
import {
  buildPdf,
  scaleSquareRectsMm,
  SCALE_SQUARE_MM,
  INCH_SQUARE_MM,
  MM_TO_PT,
  KOREAN_FONT_CHARS,
} from '../src/core/pdf';

const layout = buildLayout({ widthMm: 270, depthMm: 100, heightMm: 140 });
const pagination = paginate(layout, 'a4');

function pageText(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const stream = contents instanceof PDFArray ? contents.lookup(0) : contents;
  if (!(stream instanceof PDFRawStream)) throw new Error('stream missing');
  return inflateSync(Buffer.from(stream.asUint8Array())).toString('latin1');
}

/**
 * pdf-lib은 그린 글자를 전부 `<(글자 코드)> Tj` hex로 넣는다 — 표준 폰트도
 * 예외가 아니다. 표준 폰트는 코드가 WinAnsi라 1바이트씩 해석하면 원문이
 * 복원된다. 한글 서브셋은 글리프 번호라 여기서 복원할 수 없지만, 라틴
 * 폰트를 쓰는 영어 도안은 온전히 복원된다.
 */
function drawnTexts(text: string): string {
  return [...text.matchAll(/<([0-9A-Fa-f]+)> Tj/g)]
    .map((m) => Buffer.from(m[1]!, 'hex').toString('latin1'))
    .join('\n');
}

describe('buildPdf — 로케일별 문구', () => {
  it('한국어는 한글 서브셋 폰트로 그린다', async () => {
    const doc = await PDFDocument.load(await buildPdf(layout, pagination, 'ko'));
    const text = pageText(doc, 0);
    // 서브셋 폰트는 글자를 글리프 번호(<…> Tj)로 넣어 라틴 부분도 문자열로는
    // 남지 않는다. 폰트 리소스 이름으로 가린다.
    expect(text).toContain('/KoreanSubset');
  });

  it('영어는 라틴 폰트(Helvetica)로 그린다', async () => {
    const doc = await PDFDocument.load(await buildPdf(layout, pagination, 'en'));
    const text = pageText(doc, 0);
    expect(text).toContain('/Helvetica');
    expect(text).not.toContain('/KoreanSubset');
    const texts = drawnTexts(text);
    expect(texts).toContain('1inch check');
    expect(texts).toContain('PRINT AT 100%');
  });

  it('영어 PDF에는 한글이 하나도 없다', async () => {
    const doc = await PDFDocument.load(await buildPdf(layout, pagination, 'en'));
    for (let i = 0; i < doc.getPageCount(); i++) {
      // Helvetica가 담지 못하는 글자를 넣으면 pdf-lib이 던져서 여기까지
      // 오지도 못한다. 예방 확인이라 남긴다.
      expect(pageText(doc, i)).not.toMatch(/[가-힣]/);
    }
  });
});


describe('buildPdf — 중국어·일본어는 자기 서브셋 폰트로 그 언어 문구를 그린다', () => {
  // 각 로케일은 Noto Sans TC/SC/JP 서브셋(core/cjk-fonts.ts)을 쓴다.
  // 서브셋 이름은 예약 글꼴 이름('Noto' 등)을 피해 지었다.
  const FONT_RESOURCE = { 'zh-TW': '/TraditionalChineseSubset', 'zh-CN': '/SimplifiedChineseSubset', ja: '/JapaneseSubset' } as const;

  it('던지지 않고 자기 서브셋 폰트로 그린다', async () => {
    for (const locale of ['zh-TW', 'zh-CN', 'ja'] as const) {
      const doc = await PDFDocument.load(await buildPdf(layout, pagination, locale));
      const text = pageText(doc, 0);
      expect(text, `${locale} 자기 폰트`).toContain(FONT_RESOURCE[locale]);
      expect(text, `${locale} 무 KR`).not.toContain('/KoreanSubset');
      expect(text, `${locale} 무 Helvetica`).not.toContain('/Helvetica');
      expect(text, `${locale} 무한글`).not.toMatch(/[가-힣]/);
    }
  });
});

describe('buildPdf — 로케일 전부 스모크 + 극단 치수', () => {
  it('모든 로케일이 PDF를 만든다', async () => {
    // 로케일마다 폰트와 문구가 다르다. 어느 것도 크래시 없이 유효한 PDF를
    // 내는지 본다. 목록은 LOCALES에서 끌어와 새 로케일이 조용히 빠지지 않게
    // 한다.
    for (const locale of LOCALES) {
      const bytes = await buildPdf(layout, pagination, locale);
      expect(new TextDecoder().decode(bytes.slice(0, 5)), `${locale}`).toBe('%PDF-');
    }
  });

  it('허용 범위의 극단 치수(최소·최대)에서도 만든다', async () => {
    // RANGES 경계값 — 페이지가 몇 장이 되든 크래시 없이 나와야 한다.
    for (const dims of [
      { widthMm: 100, depthMm: 40, heightMm: 50 },
      { widthMm: 400, depthMm: 200, heightMm: 300 },
    ]) {
      const l = buildLayout(dims);
      const doc = await PDFDocument.load(await buildPdf(l, paginate(l, 'a4'), 'ko'));
      expect(doc.getPageCount()).toBeGreaterThan(0);
    }
  });

  it('알 수 없는 로케일은 기본(ko)으로 떨군다', async () => {
    // buildPdf는 공개 경로 — t()처럼 모르는 로케일이면 기본으로 떨어져야지,
    // 정의되지 않은 폰트로 크래시하면 안 된다.
    const unknown = ('fr' as unknown as Locale);
    const doc = await PDFDocument.load(await buildPdf(layout, pagination, unknown));
    expect(pageText(doc, 0)).toContain('/KoreanSubset');
  });
});

/*
 * 로케일이 길이를 부르는 말. 네모 라벨이 제 크기를 말하는지 대조하는 데만 쓴다.
 *
 * mm 네모는 로케일마다 적는 방식이 갈린다 — 한국어는 `30mm`, 중국어는
 * `3公分`처럼 센티미터로 적는다. 둘 다 같은 크기를 말하는 옳은 표기라
 * 어느 쪽이든 받아들이고, 대신 숫자는 상수에서 끌어내 대조한다.
 *
 * Record<Locale, …>이라 로케일을 늘리면 여기 한 줄을 채울 때까지 tsc가
 * 통과시키지 않는다. 새 언어가 "몇 cm라고 말하는지" 아무도 안 본 채로
 * 지나가는 일을 막는다.
 */
const LENGTH_WORDS: Readonly<Record<Locale, { readonly cm: readonly string[]; readonly inch: readonly string[] }>> = {
  ko: { cm: ['cm', 'mm'], inch: ['inch', '인치'] },
  en: { cm: ['cm', 'mm'], inch: ['inch'] },
  'zh-TW': { cm: ['公分', '毫米'], inch: ['inch', '吋', '英吋'] },
  'zh-CN': { cm: ['厘米', '毫米'], inch: ['inch', '英寸'] },
  ja: { cm: ['cm', 'mm'], inch: ['inch', 'インチ'] },
};

describe('네모 라벨이 말하는 크기', () => {
  /*
   * 라벨이 말하는 크기가 실제로 인쇄되는 네모(SCALE_SQUARE_MM·INCH_SQUARE_MM)와
   * 같은지 본다. 어긋나면 사용자가 맞는 인쇄물을 틀렸다고 버리거나 그 반대가
   * 된다 — 원단이 걸린 자리다.
   *
   * 기대값을 '30mm'처럼 적어 두지 않고 상수에서 끌어낸다. 라벨만 고정하면
   * 네모 크기가 바뀌어도 아무도 못 잡는다. 끌어내면 30을 25로 고치는 순간
   * 다섯 로케일의 라벨이 한꺼번에 깨진다.
   */

  /** 숫자 뒤에 단위 낱말이 붙는 자리. `30mm`·`3 cm`·`3-cm`를 모두 같게 본다. */
  const says = (amount: number, words: readonly string[]) => {
    const text = String(Number(amount.toFixed(3))).replace(/\./g, '\\.');
    // 앞에 숫자나 소수점이 오면 매치하지 않는다. 없으면 `13cm`가 `3cm`로,
    // `11 inch`가 `1 inch`로 통과해 틀린 라벨을 옳다고 말한다.
    return new RegExp(`(?<![0-9.])${text}[\\s-]*(?:${words.join('|')})`);
  };

  it('mm 네모 라벨이 30mm(=3cm)를 말한다 — 모든 로케일', () => {
    for (const locale of LOCALES) {
      const label = t(locale, 'pdf.testSquareMetric');
      const words = LENGTH_WORDS[locale].cm;
      // mm로 적었거나 cm로 적었거나, 둘 중 하나로는 크기를 말해야 한다.
      const ok = says(SCALE_SQUARE_MM, words).test(label)
        || says(SCALE_SQUARE_MM / 10, words).test(label);
      expect(ok, `${locale}: ${label}이 ${SCALE_SQUARE_MM}mm를 말하지 않는다`).toBe(true);
    }
  });

  it('인치 네모 라벨이 1인치를 말한다 — 모든 로케일', () => {
    for (const locale of LOCALES) {
      const label = t(locale, 'pdf.testSquareImperial');
      expect(label, `${locale}: ${label}`).toMatch(
        says(INCH_SQUARE_MM / MM_PER_INCH, LENGTH_WORDS[locale].inch),
      );
    }
  });

  it('앞자리가 붙은 숫자를 옳다고 하지 않는다', () => {
    // says가 자릿수 경계 없이 부분 문자열만 보면 아래 둘이 통과한다.
    expect('130mm').not.toMatch(says(30, ['mm']));
    expect('11인치').not.toMatch(says(1, ['인치']));
    expect('30mm').toMatch(says(30, ['mm']));
    expect('1인치').toMatch(says(1, ['인치']));
  });

  it('한국어 라벨은 전부 서브셋 폰트에 담긴다', () => {
    const labels = t('ko', 'pdf.testSquareMetric') + t('ko', 'pdf.testSquareImperial');
    expect([...new Set(labels)].filter((ch) => !KOREAN_FONT_CHARS.has(ch))).toEqual([]);
  });
});

describe('실제 PDF의 축척 네모', () => {
  /*
   * 한 수만 찾으면 안 된다. 1인치는 정확히 72pt인데, 그 두 글자는 좌표와
   * 색상값 안에도 흔히 들어 있어 아무 장에서나 걸린다. 두 수를 나란히 잇는
   * 경로 레코드로 찾으면 그런 오탐이 없다 — pdf.test.ts의 squareEdge와 같다.
   */
  const sidePt = (mm: number) => {
    const pt = String(mm * MM_TO_PT);
    return `${pt} ${pt} l`;
  };

  it('모든 로케일의 첫 장에 30mm 네모가 있다', async () => {
    for (const locale of LOCALES) {
      const doc = await PDFDocument.load(await buildPdf(layout, pagination, locale));
      expect(pageText(doc, 0), `${locale} 30mm 네모`).toContain(sidePt(SCALE_SQUARE_MM));
    }
  });

  it('1인치 네모는 영어에만 있다', async () => {
    /*
     * 인치 자를 쓰는 곳은 영어를 고르는 사람들뿐이다. 나머지 언어권에서는
     * 잴 일이 없는 네모가 첫 장 자리만 차지한다 — page.ts의
     * scaleSquareRectsMm 주석 참고.
     */
    for (const locale of LOCALES) {
      const doc = await PDFDocument.load(await buildPdf(layout, pagination, locale));
      const has = pageText(doc, 0).includes(sidePt(INCH_SQUARE_MM));
      expect(has, `${locale} 1인치 네모`).toBe(locale === 'en');
    }
  });

  it('두 라벨이 서로 겹치지 않는다 — 실제 글꼴 폭으로', async () => {
    /*
     * 라벨은 각 네모의 왼쪽 위에서 오른쪽으로 나간다. 왼쪽(인치) 라벨이 길면
     * 오른쪽(mm) 네모 위로 올라타고, 오른쪽(mm) 라벨이 길면 페이지 밖으로
     * 잘린다. 영어는 표준 글꼴이라 여기서 실제 폭을 잴 수 있다.
     *
     * 반환 순서는 [인치(왼쪽), mm(오른쪽)]이다.
     */
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const [inch, cm] = scaleSquareRectsMm(pagination, 'en');
    const size = 9;

    const inchWidthPt = font.widthOfTextAtSize(t('en', 'pdf.testSquareImperial'), size);
    expect(inch!.xMm * MM_TO_PT + inchWidthPt, '인치 라벨이 mm 네모를 침범').toBeLessThanOrEqual(
      cm!.xMm * MM_TO_PT,
    );

    const cmWidthPt = font.widthOfTextAtSize(t('en', 'pdf.testSquareMetric'), size);
    expect(cm!.xMm * MM_TO_PT + cmWidthPt, 'mm 라벨이 페이지 밖으로').toBeLessThanOrEqual(
      pagination.pageWidthMm * MM_TO_PT,
    );
  });
});
