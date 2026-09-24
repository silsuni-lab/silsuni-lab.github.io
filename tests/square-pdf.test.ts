import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { SEAM_MM, SQUARE_PRESETS } from '../src/core/constants';
import { t } from '../src/core/i18n/messages';
import {
  KOREAN_FONT_CHARS, loadFonts, MM_TO_PT, sourceBlockSizeMm, titleScale, toPagePoint,
  TITLE_MARGIN_MM, TITLE_SCALE_MIN,
} from '../src/core/page';
import { paginate } from '../src/core/tiling';
import { squareBackRatioChoices, squarePatternTitle } from '../src/core/square/dimensions';
import { buildSquareLayout, squareTitlePiece } from '../src/core/square/layout';
import { buildSquarePdf, labelZoneHeightMm, pieceLabelText, titleBlockRegion } from '../src/core/square/pdf';

const golden = { widthMm: 220, depthMm: 140, sideHeightMm: 150, lidHeightMm: 30 };
const layout = buildSquareLayout(golden);

function pageContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const stream = contents instanceof PDFArray ? contents.lookup(0) : contents;
  if (!(stream instanceof PDFRawStream)) throw new Error('콘텐츠 스트림을 찾지 못했다');
  return inflateSync(Buffer.from(stream.asUint8Array())).toString('latin1');
}

/** 콘텐츠 스트림에 두 점(pt)을 잇는 선이 있는지. 방향은 가리지 않는다. */
function hasSegment(content: string, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const num = String.raw`(-?\d+(?:\.\d+)?)`;
  const near = (p: { x: number; y: number }, x: number, y: number) =>
    Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01;
  for (const m of content.matchAll(new RegExp(`${num} ${num} m\\n${num} ${num} l`, 'g'))) {
    const [x1, y1, x2, y2] = m.slice(1, 5).map(Number) as [number, number, number, number];
    if ((near(a, x1, y1) && near(b, x2, y2)) || (near(a, x2, y2) && near(b, x1, y1))) return true;
  }
  return false;
}

describe('buildSquarePdf', () => {
  it('A4 1:1 실치수로 여러 장을 만든다', async () => {
    const pagination = paginate(layout, 'a4');
    const doc = await PDFDocument.load(await buildSquarePdf(layout, pagination, 'ko'));
    expect(doc.getPages().length).toBe(pagination.pages.length);
    // 세로든 가로든 A4 한 장 크기 그대로다 (595.28 × 841.89pt).
    const first = doc.getPages()[0]!;
    const [short, long] = [first.getWidth(), first.getHeight()].sort((a, b) => a - b);
    expect(short).toBeCloseTo(595.28, 1);
    expect(long).toBeCloseTo(841.89, 1);
  });

  it('시접 없이 뽑아도 만들어진다', async () => {
    const bare = buildSquareLayout(golden, 0);
    const doc = await PDFDocument.load(await buildSquarePdf(bare, paginate(bare, 'a4'), 'ko'));
    expect(doc.getPages().length).toBeGreaterThan(0);
  });

  it('도안 이름과 조각 라벨의 글자가 모두 한글 서브셋 안에 있다', () => {
    // 빠지면 그 자리가 조용히 빈칸으로 인쇄된다.
    const text = [
      squarePatternTitle(0, 'ko'),
      ...layout.pieces.map((p) => pieceLabelText(p, 'ko')),
      t('ko', 'paper.sheets', 2),
    ].join('');
    expect([...text].filter((c) => !KOREAN_FONT_CHARS.has(c))).toEqual([]);
  });

  it('너치·접힘선·식서선을 그 좌표에 긋는다', async () => {
    const pagination = paginate(layout, 'a4');
    const doc = await PDFDocument.load(await buildSquarePdf(layout, pagination, 'ko'));
    const pages = doc.getPages().map((_, i) => pageContent(doc, i));
    const lines = layout.pieces.flatMap((p) => [...p.notchesMm, ...p.foldLinesMm, p.grainlineMm]);
    // 너치 4+4+4, 접힘선 1, 식서선 5
    expect(lines).toHaveLength(18);
    for (const l of lines) {
      const found = pagination.pages.some((page, i) =>
        hasSegment(pages[i]!, toPagePoint(pagination, page, l.x1Mm, l.y1Mm), toPagePoint(pagination, page, l.x2Mm, l.y2Mm)),
      );
      expect(found, `${l.x1Mm},${l.y1Mm}`).toBe(true);
    }
  });
});

describe('글자가 조각 안에 들어간다', () => {
  it('모든 프리셋 × 고를 수 있는 모든 뒷면 비율에서 출처 덩어리가 조각 안이다', async () => {
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');
    const extremes = [
      ...SQUARE_PRESETS,
      { widthMm: 100, depthMm: 50, sideHeightMm: 40, lidHeightMm: 10 },
      { widthMm: 300, depthMm: 200, sideHeightMm: 300, lidHeightMm: 150 },
    ];
    for (const dims of extremes) {
      for (const choice of squareBackRatioChoices('ko', dims)) {
        if (choice.disabled) continue;
        const where = `${dims.widthMm}/${dims.depthMm}/${dims.sideHeightMm}/${dims.lidHeightMm} r=${choice.value}`;
        const l = buildSquareLayout(dims, SEAM_MM, choice.value);
        const title = squarePatternTitle(l.seamMm, 'ko');
        const block = sourceBlockSizeMm(font, title, 'ko');
        const piece = squareTitlePiece(l, {
          blockHeightMm: block.heightMm,
          blockWidthMm: block.widthMm,
          reservedTopMm: labelZoneHeightMm(font),
          marginMm: TITLE_MARGIN_MM,
        })!;
        expect(piece.id, where).not.toBe('handle');

        const { availableHeightMm } = titleBlockRegion(piece, font);
        const heightScale = titleScale(availableHeightMm, block.heightMm, TITLE_SCALE_MIN);
        const widthScale = Math.max(TITLE_SCALE_MIN, (piece.finishedWidthMm - 2 * TITLE_MARGIN_MM) / block.widthMm);
        const scale = Math.min(heightScale, widthScale);
        expect(block.heightMm * scale, `${where} 세로`).toBeLessThanOrEqual(availableHeightMm);
        expect(block.widthMm * scale, `${where} 가로`).toBeLessThanOrEqual(piece.finishedWidthMm);
      }
    }
  });

  it('치수를 붙인 조각 이름이 가장 좁은 조각에서도 폭 안에 들어간다', async () => {
    // 가장 좁은 뒷면: 100·50, 10% → 30mm. 옆면 최대 300을 붙인 "뒷면 30*300".
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');
    for (const dims of [...SQUARE_PRESETS, { widthMm: 100, depthMm: 50, sideHeightMm: 300, lidHeightMm: 150 }]) {
      for (const { value, disabled } of squareBackRatioChoices('ko', dims)) {
        if (disabled) continue;
        for (const piece of buildSquareLayout(dims, SEAM_MM, value).pieces) {
          const text = pieceLabelText(piece, 'ko');
          const widthMm = font.widthOfTextAtSize(text, 9) / MM_TO_PT;
          expect(widthMm, text).toBeLessThan(piece.finishedWidthMm - 2 * TITLE_MARGIN_MM);
        }
      }
    }
  });
});

describe('모서리 라운드 — PDF', () => {
  it('둥근 뚜껑·바닥도 만들어지고, 너치와 식서선을 그 좌표에 긋는다', async () => {
    const l = buildSquareLayout(golden, SEAM_MM, 0.2, 30);
    const pagination = paginate(l, 'a4');
    const doc = await PDFDocument.load(await buildSquarePdf(l, pagination, 'ko'));
    const pages = doc.getPages().map((_, i) => pageContent(doc, i));
    for (const line of l.pieces.flatMap((p) => [...p.notchesMm, p.grainlineMm])) {
      const found = pagination.pages.some((page, i) =>
        hasSegment(pages[i]!, toPagePoint(pagination, page, line.x1Mm, line.y1Mm), toPagePoint(pagination, page, line.x2Mm, line.y2Mm)),
      );
      expect(found, `${line.x1Mm},${line.y1Mm}`).toBe(true);
    }
    // 곡선(베지어) 연산자가 들어 있다 — 둥근 모서리를 실제로 그렸다.
    expect(pages.some((c) => / c\n/.test(c))).toBe(true);
  });

  it('조각 이름에 반지름이 붙고, 가장 좁은 조각에서도 폭 안에 들어간다', async () => {
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');
    const tight = buildSquareLayout({ widthMm: 100, depthMm: 50, sideHeightMm: 300, lidHeightMm: 150 }, SEAM_MM, 0.1, 10);
    for (const piece of tight.pieces) {
      const text = pieceLabelText(piece, 'ko');
      if (piece.id === 'panels') expect(text).toBe('뚜껑·바닥 2장 100*50 R10');
      expect(font.widthOfTextAtSize(text, 9) / MM_TO_PT, text).toBeLessThan(piece.finishedWidthMm - 2 * TITLE_MARGIN_MM);
    }
  });
});
