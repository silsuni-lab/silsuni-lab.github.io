// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

// PDF 문구는 한국어로 쓴다. pdf-lib 표준 폰트에는 한글 글리프가 없으므로
// 필요한 글자만 담은 Noto Sans KR 서브셋(core/korean-font.ts)을 심어서 쓴다.
// 서브셋에 없는 글자는 그리지 못하니, 문구를 바꿀 때는 서브셋도 다시 만들어야 한다.
import { PDFDocument, type PDFFont } from 'pdf-lib';
import {
  CENTER_COLOR as CENTER_HEX,
  CUT_COLOR as CUT_HEX,
  FOLD_COLOR as FOLD_HEX,
  FOLD_EDGE_COLOR as FOLD_EDGE_HEX,
  SEAM_COLOR as SEAM_HEX,
} from './colors';
import { KOREAN_FONT_BASE64 } from './korean-font';
export { KOREAN_FONT_BASE64 };
import { centerXMm, patternTitlePointMm, type Layout, type Line, type Point } from './layout';
import { patternTitle } from './dimensions';
import type { Pagination, Page } from './tiling';
import {
  drawAlignmentMarks, drawJoinMarks, drawPatternNote, drawScaleSquare,
  drawSourceBlock, loadFonts, MM_TO_PT, pdfColor,
  toPagePoint, type PageContext,
} from './page';

// 예전 경로로 가져다 쓰던 곳이 깨지지 않게 다시 내보낸다.
export {
  MM_TO_PT, SCALE_SQUARE_MM, JOIN_DIAMOND_MM, SCALE_SQUARE_LABEL, PATTERN_NOTE,
  KOREAN_FONT_CHARS, KOREAN_BOLD_FONT_CHARS,
  joinMarksFor, gridLabelPointMm, patternNotePointMm, scaleSquareRectMm,
  toFramePoint, toPagePoint, titleScale, TITLE_SCALE_MAX, TITLE_MARGIN_MM,
} from './page';

/** 골선 변에 붙이는 문구. 서브셋 폰트에 골·선이 들어 있어야 한다. */
export const FOLD_EDGE_LABEL = '골선';

/*
 * 색 값은 core/colors.ts에 있고, pdf-lib 색으로 감싸는 일은 page.ts의
 * pdfColor가 한다. 여기서 값을 짓지 않는다 — 화면과 인쇄가 갈라지는 자리다.
 */
const CUT_COLOR = pdfColor(CUT_HEX);
const FOLD_COLOR = pdfColor(FOLD_HEX);
const SEAM_COLOR = pdfColor(SEAM_HEX);
/** 골선. 재단선으로 오인하면 안 되는 선이라 빨강으로 굵게 긋는다. */
const FOLD_EDGE_COLOR = pdfColor(FOLD_EDGE_HEX);
/** 세로 중앙선. 제도에서 중심선에 쓰는 일점쇄선으로 긋는다. */
const CENTER_COLOR = pdfColor(CENTER_HEX);

function drawPolygon(ctx: PageContext, points: readonly Point[], thickness: number) {
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    ctx.pdfPage.drawLine({
      start: toPagePoint(ctx.pagination, ctx.page, a.xMm, a.yMm),
      end: toPagePoint(ctx.pagination, ctx.page, b.xMm, b.yMm),
      thickness,
      color: CUT_COLOR,
    });
  }
}

/** 완성선. 접힘선(회색 긴 점선)과 헷갈리지 않도록 더 진하고 촘촘한 점선으로 긋는다. */
function drawSeamLine(ctx: PageContext, points: readonly Point[]) {
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    ctx.pdfPage.drawLine({
      start: toPagePoint(ctx.pagination, ctx.page, a.xMm, a.yMm),
      end: toPagePoint(ctx.pagination, ctx.page, b.xMm, b.yMm),
      thickness: 0.4,
      color: SEAM_COLOR,
      dashArray: [2, 2],
    });
  }
}

function drawFoldLine(ctx: PageContext, line: Line) {
  ctx.pdfPage.drawLine({
    start: toPagePoint(ctx.pagination, ctx.page, line.x1Mm, line.y1Mm),
    end: toPagePoint(ctx.pagination, ctx.page, line.x2Mm, line.y2Mm),
    thickness: 0.5,
    color: FOLD_COLOR,
    dashArray: [4, 4],
  });
}

/**
 * 골선 기호와 글자를 놓을 자리 (도안 좌표 x, mm). 골선이 없으면 undefined.
 *
 * 전개도 한가운데 한 번만 찍으면 그 자리를 담은 장에만 설명이 실린다. 나머지
 * 장에는 빨간 선만 남아 무슨 선인지 알 수 없다. 그래서 장마다, 그 장에 실제로
 * 보이는 구간의 한가운데에 하나씩 찍는다.
 */
export function foldEdgeLabelXMm(
  pagination: Pagination,
  page: Page,
  layout: Layout,
): number | undefined {
  if (layout.foldEdgeYMm === undefined) return undefined;
  const fromMm = Math.max(0, page.originXMm);
  const toMm = Math.min(layout.totalWidthMm, page.originXMm + pagination.contentWidthMm);
  if (toMm <= fromMm) return undefined;
  return (fromMm + toMm) / 2;
}

/**
 * 골선. 절반만 남긴 전개도의 아래 변이다. 자르는 선이 아니라 원단 접은
 * 자리에 얹는 선이라, 재단선보다 굵고 빨갛게 긋고 글자로 짚어 준다.
 * 접는 자리를 잘라 버리면 도안이 반쪽이 되므로 헷갈릴 여지를 남기지 않는다.
 *
 * 반원 두 개를 덧그려 재봉 도안에서 쓰는 골선 기호를 흉내 낸다.
 */
function drawFoldEdge(ctx: PageContext, layout: Layout, font: PDFFont) {
  const yMm = layout.foldEdgeYMm;
  if (yMm === undefined) return;

  const { pagination, page } = ctx;
  ctx.pdfPage.drawLine({
    start: toPagePoint(pagination, page, 0, yMm),
    end: toPagePoint(pagination, page, layout.totalWidthMm, yMm),
    thickness: 1.6,
    color: FOLD_EDGE_COLOR,
  });

  const centerXMm = foldEdgeLabelXMm(pagination, page, layout);
  if (centerXMm === undefined) return;

  for (const radiusMm of [4, 6]) {
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = Math.PI + (Math.PI * i) / steps;
      const b = Math.PI + (Math.PI * (i + 1)) / steps;
      ctx.pdfPage.drawLine({
        start: toPagePoint(pagination, page, centerXMm + radiusMm * Math.cos(a), yMm + radiusMm * Math.sin(a)),
        end: toPagePoint(pagination, page, centerXMm + radiusMm * Math.cos(b), yMm + radiusMm * Math.sin(b)),
        thickness: 0.8,
        color: FOLD_EDGE_COLOR,
      });
    }
  }

  const label = toPagePoint(pagination, page, centerXMm + 9, yMm - 2);
  ctx.pdfPage.drawText(FOLD_EDGE_LABEL, {
    x: label.x,
    y: label.y,
    size: 10,
    font,
    color: FOLD_EDGE_COLOR,
  });
}

/**
 * 세로 중앙선과 도안 이름.
 *
 * 중앙선은 앞판·바닥의 가로 한가운데다. 원단에 올릴 때 기준이 된다. 선 종류가
 * 이미 여럿이라 제도에서 중심선에 쓰는 일점쇄선으로 긋는다. 모양만으로 갈리므로
 * 색은 눈에 띄지 않는 회색이면 된다.
 *
 * 이름은 앞판 한가운데에 한 번만 찍는다. 전개도에서 가장 넓게 비어 있고,
 * 골선으로 절반만 남겨도 살아 있는 자리다.
 */
function drawCenterAndTitle(ctx: PageContext, layout: Layout, font: PDFFont) {
  const { pagination, page } = ctx;
  const xMm = centerXMm(layout);

  ctx.pdfPage.drawLine({
    start: toPagePoint(pagination, page, xMm, 0),
    end: toPagePoint(pagination, page, xMm, layout.totalHeightMm),
    thickness: 0.4,
    color: CENTER_COLOR,
    dashArray: [8, 3, 1.5, 3],
  });

  const point = patternTitlePointMm(layout);
  const front = layout.bands.find((band) => band.id === 'front');
  if (point === undefined || front === undefined) return;

  drawSourceBlock(ctx, font, point.xMm, point.yMm, front.heightMm,
    patternTitle(layout.dimensions, layout.seamMm));
}

export async function buildPdf(layout: Layout, pagination: Pagination): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { font, boldFont } = await loadFonts(doc);

  for (const page of pagination.pages) {
    const pdfPage = doc.addPage([
      pagination.pageWidthMm * MM_TO_PT,
      pagination.pageHeightMm * MM_TO_PT,
    ]);
    const ctx: PageContext = { pdfPage, pagination, page };

    // 배율 확인용 사각형은 첫 장에만, 도안보다 먼저 그린다. 나중에 그리면
    // 흰 바탕이 재단선을 끊는데, 자를 대는 건 사각형의 빨간 변이라
    // 도안 선이 위로 지나가도 재는 데 지장이 없다.
    if (page === pagination.pages[0]) drawScaleSquare(pdfPage, pagination, font);

    drawPolygon(ctx, layout.outlineMm, 1);
    // 시접이 0이면 완성선이 재단선과 같은 자리다. 겹쳐 그으면 선만 두꺼워진다.
    if (layout.seamMm > 0) drawSeamLine(ctx, layout.seamLineMm);
    // 접힘선은 layout이 완성선 기준으로 계산해 둔다. 밴드 경계로 다시
    // 그리면 시접만큼 밀린 자리에 선이 생긴다.
    for (const line of layout.foldLinesMm) drawFoldLine(ctx, line);

    drawCenterAndTitle(ctx, layout, font);
    drawFoldEdge(ctx, layout, font);
    drawAlignmentMarks(ctx, font);
    drawJoinMarks(ctx, font);
    drawPatternNote(ctx, boldFont);

  }

  return doc.save();
}
