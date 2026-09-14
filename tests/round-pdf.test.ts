// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFArray, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { GRAIN_COLOR, hexToRgb01 } from '../src/core/colors';
import { buildRoundLayout, roundTitlePiece } from '../src/core/round/layout';
import { buildRoundPdf, circleStackYMm, labelZoneHeightMm, pieceMarkRegion, titleBlockRegion } from '../src/core/round/pdf';
import { paginate } from '../src/core/tiling';
import { t } from '../src/core/i18n/messages';
import {
  KOREAN_FONT_CHARS, loadFonts, MM_TO_PT, sourceBlockSizeMm, toPagePoint,
  titleScale, TITLE_MARGIN_MM, TITLE_SCALE_MIN,
} from '../src/core/page';
import { ROUND_PRESETS, SEAM_MM } from '../src/core/constants';
import { roundBackRatioChoices, roundPatternTitle } from '../src/core/round/dimensions';

const golden = { diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 };
const layout = buildRoundLayout(golden);

describe('buildRoundPdf', () => {
  it('설계 문서의 장수만큼 페이지를 만든다', async () => {
    const bytes = await buildRoundPdf(layout, paginate(layout, 'a4'), 'ko');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPages().length).toBe(4);
  });

  it('1:1 실치수다', async () => {
    // 확대·축소 없이 뽑아야 도안이 쓸모 있다. A4 세로면 595.28 x 841.89pt.
    const bytes = await buildRoundPdf(layout, paginate(layout, 'a4'), 'ko');
    const page = (await PDFDocument.load(bytes)).getPages()[0]!;
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
  });

  it('출처 두 줄을 절반만 진하게 찍는다', async () => {
    // 미리보기와 같은 값이라야 화면에서 본 대로 종이에 나온다.
    const bytes = await buildRoundPdf(layout, paginate(layout, 'a4'), 'ko');
    const page = (await PDFDocument.load(bytes)).getPages()[0]!;
    const states = page.node.Resources()!.lookup(PDFName.of('ExtGState'))!.toString();
    expect(states).toContain('/ca 0.5');
  });

  it('도안 이름의 글자가 모두 서브셋 안에 있다', () => {
    // 빠지면 그 자리가 조용히 빈칸으로 인쇄된다.
    expect([...t('ko','round.pattern.name')].filter((c) => !KOREAN_FONT_CHARS.has(c))).toEqual([]);
  });

  it('조각 라벨의 글자가 모두 서브셋 안에 있다', () => {
    const labels = [t('ko','round.piece.frontTop'),t('ko','round.piece.frontBottom'),t('ko','round.piece.circles'),t('ko','round.piece.back'),t('ko','paper.sheets',2)].join('');
    expect([...labels].filter((c) => !KOREAN_FONT_CHARS.has(c))).toEqual([]);
  });

  it('시접 없이 뽑아도 만들어진다', async () => {
    const bare = buildRoundLayout(golden, 0);
    const bytes = await buildRoundPdf(bare, paginate(bare, 'a4'), 'ko');
    expect((await PDFDocument.load(bytes)).getPages().length).toBeGreaterThan(0);
  });

  it('짧은 조각에서도 출처 문구 자리가 조각 라벨 자리를 침범하지 않는다', async () => {
    /*
     * 130/130/30(골든 케이스)은 앞면 아랫단이 완성 높이 90mm라 라벨과
     * 출처 문구를 겹쳐 놓아도 눈에 안 띄었다. 80/60/20은 완성 높이가
     * 30mm뿐이라 실제로 겹쳐 찍히는 걸 눈으로 확인한 치수다.
     * 100/50/20은 첫 프리셋(납작 파우치)이라 화면을 열면 바로 이 도안이
     * 뜬다. 완성 높이가 20mm로 프리셋 중 가장 짧아 여기가 제일 위험하다.
     * 300/40/10은 허용 범위에서 몸통이 가장 납작해지는 극단값이다.
     */
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');

    for (const dims of [
      { diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 },
      { diameterMm: 100, sideHeightMm: 50, lidHeightMm: 20 },
      golden,
      { diameterMm: 300, sideHeightMm: 40, lidHeightMm: 10 },
    ]) {
      const l = buildRoundLayout(dims);
      const titlePiece = roundTitlePiece(l);
      expect(titlePiece).toBeDefined();

      const { centerYMm, availableHeightMm } = titleBlockRegion(titlePiece!, l.seamMm, font);
      // 라벨 자리(완성선에서 라벨 몫만큼)가 끝나는 지점.
      const labelZoneBottomMm = titlePiece!.yMm + l.seamMm + labelZoneHeightMm(font);
      // 출처 문구에게 내준 영역의 위쪽 경계.
      const regionTopMm = centerYMm - availableHeightMm / 2;

      // 출처 문구 영역은 라벨 자리가 끝나는 지점에서 시작해야 한다 — 겹치면 안 된다.
      expect(regionTopMm).toBeCloseTo(labelZoneBottomMm, 5);
      // 라벨 몫을 뺀 뒤에도 출처 문구가 앉을 자리가 실제로 남아 있어야 한다.
      expect(availableHeightMm).toBeGreaterThan(0);
    }
  });
});

describe('출처 덩어리를 담을 수 있는 조각에 앉힌다', () => {
  /*
   * 넓이만 보고 고르면 담지도 못할 조각이 뽑힌다. 납작 파우치(100/50/20)의
   * 앞면 두 단은 251*20으로 가장 넓지만 완성 높이가 20mm뿐이라, 조각 이름
   * 몫을 빼면 9.4mm만 남는다. 덩어리는 23.6mm가 필요해 글자가 완성선을 넘고
   * 재단선 위까지 나갔다 — 눈으로 확인한 결함이다.
   *
   * 세로만 봐도 모자란다. 세로가 넉넉하고 가로가 좁은 조각에서는 배율이
   * 커져 이번엔 옆으로 넘친다. 두 방향을 함께 지킨다.
   */
  it('모든 프리셋과 모든 뒷면 비율에서 덩어리가 조각 안에 들어간다', async () => {
    /*
     * 뒷면 비율까지 돌린다. 납작 파우치에 10%를 고르면 앞면 두 단은 너무
     * 낮고(20mm) 뒷면은 너무 좁아(31mm) 담을 조각이 하나도 없다. 그때는
     * 가장 덜 모자란 조각을 고르고 배율을 1 아래로 내려 맞춘다. 프리셋만
     * 돌리면 이 구멍이 안 잡힌다 — 실제로 못 잡고 있었다.
     */
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');

    for (const preset of ROUND_PRESETS) {
      for (const choice of roundBackRatioChoices('ko')) {
        const where = `${preset.id} r=${choice.value}`;
        const l = buildRoundLayout(preset, SEAM_MM, choice.value);
        const title = roundPatternTitle(l.dimensions, l.seamMm, 'ko');
        const block = sourceBlockSizeMm(font, title, 'ko');
        const piece = roundTitlePiece(l, {
          blockHeightMm: block.heightMm,
          blockWidthMm: block.widthMm,
          reservedTopMm: labelZoneHeightMm(font),
          marginMm: TITLE_MARGIN_MM,
        })!;

        const { availableHeightMm } = titleBlockRegion(piece, l.seamMm, font);
        // drawSourceBlock이 쓰는 것과 같은 셈.
        const heightScale = titleScale(availableHeightMm, block.heightMm, TITLE_SCALE_MIN);
        const widthScale = Math.max(
          TITLE_SCALE_MIN,
          (piece.finishedWidthMm - 2 * TITLE_MARGIN_MM) / block.widthMm,
        );
        const scale = Math.min(heightScale, widthScale);

        expect(block.heightMm * scale, `${where} 세로`).toBeLessThanOrEqual(availableHeightMm);
        expect(block.widthMm * scale, `${where} 가로`).toBeLessThanOrEqual(piece.finishedWidthMm);
      }
    }
  });

  it('자리가 넉넉한 프리셋은 예전처럼 앞면 아랫단을 고른다', async () => {
    // 좁은 경우만 달라져야 한다. 넓은 도안까지 자리가 바뀌면 도안이 낯설어진다.
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');
    const l = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 });
    const block = sourceBlockSizeMm(font, roundPatternTitle(l.dimensions, l.seamMm, 'ko'), 'ko');
    const piece = roundTitlePiece(l, {
      blockHeightMm: block.heightMm,
      blockWidthMm: block.widthMm,
      reservedTopMm: labelZoneHeightMm(font),
      marginMm: TITLE_MARGIN_MM,
    })!;
    expect(piece.id).toBe('frontBottom');
  });
});

describe('조각마다 파우치 이름과 계정을 찍는다', () => {
  it('모든 프리셋의 모든 조각에 두 줄이 들어갈 자리가 있다', async () => {
    /*
     * 조각이 넷으로 흩어져 있어, 다 오려 놓으면 어느 도안의 조각인지 알 수
     * 없었다. 자리가 없으면 아예 안 찍도록 해 두었으므로(PIECE_MIN_SCALE),
     * 프리셋에서 실제로 찍히는지를 여기서 지킨다.
     */
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');
    // drawPieceMark와 같은 셈. 상수가 바뀌면 이 값도 함께 고쳐야 한다.
    const blockMm =
      font.heightAtSize(8) / MM_TO_PT / 2 + 5 + font.heightAtSize(10) / MM_TO_PT / 2;

    for (const preset of ROUND_PRESETS) {
      const l = buildRoundLayout(preset);
      // 원은 배율을 두지 않는다 — 아래 "원은 세 줄을 한가운데에 쌓는다" 참고.
      for (const piece of l.pieces.filter((p) => p.shape === 'rect')) {
        const { availableHeightMm } = pieceMarkRegion(piece, font);
        const scale = Math.min(1, (availableHeightMm - 2 * TITLE_MARGIN_MM) / blockMm);
        expect(scale, `${preset.id} ${piece.id}`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it('원은 세 줄을 한가운데에 쌓는다', async () => {
    /*
     * 셋을 나눠 놓으면 이름만 한가운데에 뜨고 나머지 둘이 아래로 처져 한
     * 덩어리로 안 읽힌다. 글자 덩어리의 가운데가 원의 가운데와 맞아야 한다 —
     * 기준선만 가운데에 두면 아래로 뻗은 두 줄만큼 덩어리가 위로 치우친다.
     */
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');

    for (const preset of ROUND_PRESETS) {
      const l = buildRoundLayout(preset);
      const circle = l.pieces.find((p) => p.shape === 'circle')!;
      const { labelYMm, nameYMm, handleYMm } = circleStackYMm(circle, font);

      // 순서가 위에서 아래로여야 한다.
      expect(labelYMm, `${preset.id} 순서`).toBeLessThan(nameYMm);
      expect(nameYMm, `${preset.id} 순서`).toBeLessThan(handleYMm);

      // 맨 윗줄의 위쪽 절반부터 맨 아랫줄의 아래쪽 절반까지가 글자 덩어리다.
      const topMm = labelYMm - font.heightAtSize(9) / MM_TO_PT / 2;
      const bottomMm = handleYMm + font.heightAtSize(10) / MM_TO_PT / 2;
      const circleCenterYMm = circle.yMm + circle.heightMm / 2;
      expect((topMm + bottomMm) / 2, `${preset.id} 중앙`).toBeCloseTo(circleCenterYMm, 6);

      // 덩어리가 완성선 안에 있어야 한다.
      const finishedTopMm = circleCenterYMm - circle.finishedHeightMm / 2;
      const finishedBottomMm = circleCenterYMm + circle.finishedHeightMm / 2;
      expect(topMm, `${preset.id} 위`).toBeGreaterThan(finishedTopMm);
      expect(bottomMm, `${preset.id} 아래`).toBeLessThan(finishedBottomMm);
    }
  });

  it('치수는 조각에 되풀이하지 않는다', async () => {
    /*
     * 치수는 출처 덩어리에 한 번만 적힌다. 조각마다 되풀이하면 종이가
     * 빽빽해지고, 짧은 조각에서는 들어가지도 않는다.
     */
    const l = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 });
    const bytes = await buildRoundPdf(l, paginate(l, 'a4'), 'ko');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPages().length).toBeGreaterThan(0);
    // 치수 문자열이 도안 전체에서 한 번만 나오는지는 콘텐츠 스트림으로 세기
    // 어렵다(서브셋 폰트라 글자가 코드로 바뀐다). 대신 조각 표시 쪽이 치수를
    // 만들지 않는다는 것을 roundPatternTitle을 안 부르는 것으로 지킨다.
    const source = readFileSync(new URL('../src/core/round/pdf.ts', import.meta.url), 'utf8');
    const markFn = source.slice(source.indexOf('function drawPieceMark'));
    expect(markFn.slice(0, markFn.indexOf('\n}'))).not.toContain('roundPatternTitle');
  });
});

describe('너치 — 원통 PDF', () => {
  it('앞면 두 단의 너치를 그 좌표에 긋는다', async () => {
    const pagination = paginate(layout, 'a4');
    const doc = await PDFDocument.load(await buildRoundPdf(layout, pagination, 'ko'));
    const pages = doc.getPages().map((_, i) => roundPageContent(doc, i));
    const notches = layout.pieces.flatMap((p) => p.notchesMm);
    expect(notches).toHaveLength(4);
    for (const n of notches) {
      const found = pagination.pages.some((page, i) =>
        hasSegment(
          pages[i]!,
          toPagePoint(pagination, page, n.x1Mm, n.y1Mm),
          toPagePoint(pagination, page, n.x2Mm, n.y2Mm),
        ),
      );
      expect(found, `${n.x1Mm},${n.y1Mm}`).toBe(true);
    }
  });
});

describe('식서방향 — 원통 PDF', () => {
  it('도안에 식서선을 그린다', async () => {
    const pagination = paginate(layout, 'a4');
    const doc = await PDFDocument.load(await buildRoundPdf(layout, pagination, 'ko'));
    const { r, g, b } = hexToRgb01(GRAIN_COLOR);
    const pages = doc.getPages().map((_, i) => roundPageContent(doc, i));
    expect(pages.some((c) => c.includes(`${r} ${g} ${b} RG`))).toBe(true);
    // 색은 재단선과 같은 검정이고 굵기도 다른 선과 같아 둘로는 식서선을 못 가린다.
    // 조각마다 식서선 좌표에 그어진 선을 찾는다.
    for (const piece of layout.pieces) {
      const gl = piece.grainlineMm;
      const found = pagination.pages.some((page, i) =>
        hasSegment(
          pages[i]!,
          toPagePoint(pagination, page, gl.x1Mm, gl.y1Mm),
          toPagePoint(pagination, page, gl.x2Mm, gl.y2Mm),
        ),
      );
      expect(found, piece.id).toBe(true);
    }
  });

  it('조각마다 하나씩, 조각 안에 머문다', () => {
    // 자리 계산은 layout이 하고 PDF는 그리기만 한다. 조각을 벗어나면
    // 이웃 조각 위에 결 방향을 그리는 셈이라 재단이 어긋난다.
    for (const piece of layout.pieces) {
      const gr = piece.grainlineMm;
      expect(Math.min(gr.x1Mm, gr.x2Mm), piece.id).toBeGreaterThanOrEqual(piece.xMm);
      expect(Math.max(gr.y1Mm, gr.y2Mm), piece.id).toBeLessThanOrEqual(piece.yMm + piece.heightMm);
    }
  });

  /*
   * 사각은 앞판 아래쪽에 띠를 잡아 세로로 갈라 두지만, 원통은 뚜껑이 10mm까지
   * 얇아질 수 있어 그 수를 못 쓴다. 대신 가로로 비킨다 — 그래서 여기서 볼 것은
   * 위아래 거리가 아니라 "왼쪽 구석에 머무는가"다.
   */
  it('가운데 글자 자리를 비켜 왼쪽 구석에 머문다', () => {
    for (const piece of layout.pieces) {
      const g = piece.grainlineMm;
      const finishedLeftMm = piece.xMm + layout.seamMm;
      expect(Math.min(g.x1Mm, g.x2Mm), piece.id).toBeGreaterThan(finishedLeftMm);
      expect(Math.max(g.x1Mm, g.x2Mm), piece.id)
        .toBeLessThanOrEqual(finishedLeftMm + piece.finishedWidthMm * 0.45);
    }
  });

  /*
   * 이 검사가 없어서 한 번 놓쳤다. 미리보기는 조각 이름을 한가운데에 찍고
   * PDF는 위쪽에 찍으므로, 미리보기만 보고는 PDF의 겹침을 못 본다. 납작
   * 파우치 뒷면에서 출처 덩어리가 조각을 꽉 채우도록 커져 식서선을 덮었다.
   */
  it('모든 프리셋에서 출처 덩어리가 식서선 위에서 멈춘다', async () => {
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');
    for (const preset of ROUND_PRESETS) {
      const l = buildRoundLayout(preset);
      const piece = roundTitlePiece(l);
      if (piece === undefined) continue;
      const region = titleBlockRegion(piece, l.seamMm, font);
      const blockBottomMm = region.centerYMm + region.availableHeightMm / 2;
      expect(blockBottomMm, preset.id).toBeLessThanOrEqual(piece.grainlineMm.y1Mm);
    }
  });

  it('식서선이 완성선 아래 변을 넘지 않는다', () => {
    // 화살촉은 선에서 위아래로 1.5mm 벌어진다. 그만큼도 안에 있어야 한다.
    for (const preset of ROUND_PRESETS) {
      const l = buildRoundLayout(preset);
      for (const piece of l.pieces) {
        const finishedBottomMm = piece.yMm + piece.heightMm - l.seamMm;
        expect(Math.max(piece.grainlineMm.y1Mm, piece.grainlineMm.y2Mm) + 1.5,
          `${preset.id} ${piece.id}`).toBeLessThanOrEqual(finishedBottomMm);
      }
    }
  });

  it('출처 덩어리가 그 구석까지 넓어지지는 않는다', async () => {
    // 덩어리는 가운데 정렬이라, 완성 폭의 30%보다 좁으면 식서선과 만나지 않는다.
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc, 'ko');
    const titlePiece = roundTitlePiece(layout)!;
    const { widthMm } = sourceBlockSizeMm(font, roundPatternTitle(golden, SEAM_MM), 'ko');
    expect(widthMm).toBeLessThan(titlePiece.finishedWidthMm * 0.3);
  });
});

/** 해당 페이지의 콘텐츠 스트림을 풀어 텍스트로 돌려준다. (사각 쪽과 같은 셈) */
function roundPageContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const stream = contents instanceof PDFArray ? contents.lookup(0) : contents;
  if (!(stream instanceof PDFRawStream)) throw new Error('콘텐츠 스트림을 찾지 못했다');
  return inflateSync(Buffer.from(stream.asUint8Array())).toString('latin1');
}

/**
 * 콘텐츠 스트림에 두 점(pt)을 잇는 선이 있는지. pdf-lib의 drawLine은 `x y m` 바로
 * 뒤에 `x y l`을 쓴다. 방향은 가리지 않는다.
 */
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
