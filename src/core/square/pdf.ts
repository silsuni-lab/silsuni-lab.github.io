// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 네모 파우치 조각 다섯을 1:1 실치수로 그린다. 원통의 round/pdf.ts와 같은
 * 뼈대다 — 조각마다 재단선·너치·완성선·식서선·라벨을 찍고, 출처 덩어리는
 * 담을 수 있는 조각 하나에 앉히고, 페이지 기계(축척 네모·맞춤표·이어붙임·
 * 하단 문구)는 page.ts를 부른다. 다른 점은 둘이다. 원이 없어 모든 조각이
 * 사각이고, 손잡이에 반 접는 선이 있다.
 *
 * 원통 파일은 silbap으로 넘긴 원본이라 공용으로 끌어내지 않고 이 파일에
 * 한 벌을 둔다. 값(글자 크기·여백)은 원통과 같게 맞춘다.
 */
import { PDFDocument, type PDFFont } from 'pdf-lib';
import {
  BAND_LABEL_COLOR as LABEL_HEX,
  CUT_COLOR as CUT_HEX,
  FOLD_COLOR as FOLD_HEX,
  SEAM_COLOR as SEAM_HEX,
} from '../colors';
import type { Pagination } from '../tiling';
import { GRAIN_RESERVE_MM, type Line } from '../constants';
import {
  drawAlignmentMarks, drawJoinMarks, drawPatternNote, drawScaleSquares,
  drawGrainline, drawSourceBlock, loadFonts, MARK, MM_TO_PT, pdfColor, sourceBlockSizeMm,
  TITLE_MARGIN_MM, TITLE_SCALE_MIN, toPagePoint,
  type PageContext,
} from '../page';
import { WATERMARK_HANDLE, WATERMARK_OPACITY } from '../dimensions';
import { t } from '../i18n/messages';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { squarePatternTitle } from './dimensions';
import { squareTitlePiece, type SquareLayout, type SquarePiece } from './layout';

const CUT_COLOR = pdfColor(CUT_HEX);
const SEAM_COLOR = pdfColor(SEAM_HEX);
const FOLD_COLOR = pdfColor(FOLD_HEX);
const LABEL_COLOR = pdfColor(LABEL_HEX);

/** 재단선 굵기 (pt). 너치도 같은 굵기다. 원통과 같은 값. */
const CUT_THICKNESS = 1.2;
const LABEL_SIZE = 9;
const LABEL_TOP_OFFSET_MM = 4;
const LABEL_SOURCE_GAP_MM = 2;

/** 조각 위쪽에 라벨이 차지하는 세로 높이 (mm). 글자 높이는 폰트에서 잰다. */
export function labelZoneHeightMm(font: PDFFont): number {
  return LABEL_TOP_OFFSET_MM + font.heightAtSize(LABEL_SIZE) / MM_TO_PT + LABEL_SOURCE_GAP_MM;
}

/**
 * 출처 덩어리의 자리. 위로는 라벨 몫, 아래로는 식서 몫을 비운 나머지의
 * 한가운데다. 원통의 titleBlockRegion과 같은 셈이다.
 */
export function titleBlockRegion(
  titlePiece: SquarePiece,
  font: PDFFont,
): { centerYMm: number; availableHeightMm: number } {
  const reservedTopMm = labelZoneHeightMm(font);
  const roomMm = Math.max(0, titlePiece.finishedHeightMm - reservedTopMm);
  const grainReserveMm = Math.min(GRAIN_RESERVE_MM, roomMm * 0.35);
  return {
    centerYMm: titlePiece.yMm + titlePiece.heightMm / 2 + reservedTopMm / 2 - grainReserveMm / 2,
    availableHeightMm: roomMm - grainReserveMm,
  };
}

/**
 * 조각 이름·장수·완성 치수 한 줄. 치수는 정수 mm로 반올림한다 — 둘레에서
 * 나온 길이는 소수가 붙는데 소수점이 서브셋에 없고, 0.1mm는 자로 못 잰다.
 */
export function pieceLabelText(piece: SquarePiece, locale: Locale): string {
  const label = t(locale, `square.piece.${piece.id}` as never);
  const name = piece.count > 1 ? `${label} ${t(locale, 'paper.sheets', piece.count)}` : label;
  // 둥근 모서리면 반지름을 붙인다(R20). 치수만 보고 각진 본으로 착각하지 않게.
  const corner = piece.cornerRadiusMm > 0 ? ` R${piece.cornerRadiusMm}` : '';
  return `${name} ${Math.round(piece.finishedWidthMm)}*${Math.round(piece.finishedHeightMm)}${corner}`;
}

function drawLine(ctx: PageContext, line: Line, thickness: number, color: ReturnType<typeof pdfColor>, dashArray?: number[]) {
  ctx.pdfPage.drawLine({
    start: toPagePoint(ctx.pagination, ctx.page, line.x1Mm, line.y1Mm),
    end: toPagePoint(ctx.pagination, ctx.page, line.x2Mm, line.y2Mm),
    thickness,
    color,
    ...(dashArray === undefined ? {} : { dashArray }),
  });
}

/** 1/4 원을 3차 베지어로 그릴 때 조절점까지의 비율. */
const ARC_K = 0.5522847498;

/**
 * 모서리가 둥근 사각형의 SVG 경로 (pt, 왼쪽 위가 원점, y는 아래로).
 * pdf-lib의 drawSvgPath가 y를 뒤집어 페이지 좌표로 옮긴다.
 */
export function roundedRectPath(widthPt: number, heightPt: number, radiusPt: number): string {
  const w = widthPt;
  const h = heightPt;
  const r = radiusPt;
  const k = r * ARC_K;
  const f = (v: number) => Math.round(v * 1000) / 1000;
  return [
    `M ${f(r)} 0`, `L ${f(w - r)} 0`,
    `C ${f(w - r + k)} 0 ${f(w)} ${f(r - k)} ${f(w)} ${f(r)}`, `L ${f(w)} ${f(h - r)}`,
    `C ${f(w)} ${f(h - r + k)} ${f(w - r + k)} ${f(h)} ${f(w - r)} ${f(h)}`, `L ${f(r)} ${f(h)}`,
    `C ${f(r - k)} ${f(h)} 0 ${f(h - r + k)} 0 ${f(h - r)}`, `L 0 ${f(r)}`,
    `C 0 ${f(r - k)} ${f(r - k)} 0 ${f(r)} 0`, 'Z',
  ].join(' ');
}

function drawRect(
  ctx: PageContext,
  piece: SquarePiece,
  insetMm: number,
  color: ReturnType<typeof pdfColor>,
  thickness: number,
) {
  const topLeft = toPagePoint(ctx.pagination, ctx.page, piece.xMm + insetMm, piece.yMm + insetMm);
  /*
   * 둥근 모서리. 재단선(inset 0)은 완성선의 호에서 시접만큼 바깥으로 나간
   * 곡선이라 반지름이 R + S이고, 완성선(inset S)은 R이다 — 둘이 같은 중심을
   * 나눠 가져 시접 폭이 모서리에서도 고르다.
   */
  if (piece.cornerRadiusMm > 0) {
    const seamMm = (piece.widthMm - piece.finishedWidthMm) / 2;
    const radiusMm = piece.cornerRadiusMm + seamMm - insetMm;
    ctx.pdfPage.drawSvgPath(
      roundedRectPath(
        (piece.widthMm - 2 * insetMm) * MM_TO_PT,
        (piece.heightMm - 2 * insetMm) * MM_TO_PT,
        radiusMm * MM_TO_PT,
      ),
      { x: topLeft.x, y: topLeft.y, borderColor: color, borderWidth: thickness },
    );
    return;
  }
  ctx.pdfPage.drawRectangle({
    x: topLeft.x,
    y: topLeft.y - (piece.heightMm - 2 * insetMm) * MM_TO_PT,
    width: (piece.widthMm - 2 * insetMm) * MM_TO_PT,
    height: (piece.heightMm - 2 * insetMm) * MM_TO_PT,
    borderColor: color,
    borderWidth: thickness,
  });
}

function drawCentered(
  ctx: PageContext,
  font: PDFFont,
  value: string,
  size: number,
  xMm: number,
  yMm: number,
  color: ReturnType<typeof pdfColor>,
  opacity?: number,
): void {
  const anchor = toPagePoint(ctx.pagination, ctx.page, xMm, yMm);
  ctx.pdfPage.drawText(value, {
    x: anchor.x - font.widthOfTextAtSize(value, size) / 2,
    y: anchor.y,
    size,
    font,
    color,
    ...(opacity === undefined ? {} : { opacity }),
  });
}

/** 도안 이름이 폭에 안 들어가면 "시접없음"을 떼고, 그래도 안 되면 건너뛴다. */
function fitPieceTitle(font: PDFFont, full: string, nameOnly: string, sizePt: number, maxWidthMm: number) {
  const widthMm = (value: string) => font.widthOfTextAtSize(value, sizePt) / MM_TO_PT;
  const room = maxWidthMm - 2 * TITLE_MARGIN_MM;
  if (widthMm(full) <= room) return full;
  if (widthMm(nameOnly) <= room) return nameOnly;
  return undefined;
}

// 조각마다 찍는 파우치 이름과 계정. 원통과 같은 크기다.
const PIECE_NAME_SIZE = 8;
const PIECE_HANDLE_SIZE = 10;
const PIECE_HANDLE_OFFSET_MM = 5;
const PIECE_MARK_MIN_SCALE = 0.6;

/** 조각 표시 두 줄이 앉을 자리 — 라벨 몫을 비켜 준 나머지의 한가운데. */
export function pieceMarkRegion(
  piece: SquarePiece,
  font: PDFFont,
): { centerYMm: number; availableHeightMm: number } {
  const reservedMm = labelZoneHeightMm(font);
  return {
    centerYMm: piece.yMm + piece.heightMm / 2 + reservedMm / 2,
    availableHeightMm: Math.max(0, piece.finishedHeightMm - reservedMm),
  };
}

function drawPieceMark(ctx: PageContext, piece: SquarePiece, font: PDFFont, locale: Locale, title: string) {
  const { centerYMm, availableHeightMm } = pieceMarkRegion(piece, font);
  const aboveMm = font.heightAtSize(PIECE_NAME_SIZE) / MM_TO_PT / 2;
  const belowMm = PIECE_HANDLE_OFFSET_MM + font.heightAtSize(PIECE_HANDLE_SIZE) / MM_TO_PT / 2;
  const blockMm = aboveMm + belowMm;

  const scale = Math.min(1, (availableHeightMm - 2 * TITLE_MARGIN_MM) / blockMm);
  if (scale < PIECE_MARK_MIN_SCALE) return;

  const nameYMm = centerYMm - (blockMm * scale) / 2 + aboveMm * scale;
  const xMm = piece.xMm + piece.widthMm / 2;
  const text = fitPieceTitle(font, title, t(locale, 'square.pattern.name'), PIECE_NAME_SIZE * scale, piece.finishedWidthMm);
  if (text !== undefined) drawCentered(ctx, font, text, PIECE_NAME_SIZE * scale, xMm, nameYMm, MARK);
  drawCentered(
    ctx, font, WATERMARK_HANDLE, PIECE_HANDLE_SIZE * scale, xMm,
    nameYMm + PIECE_HANDLE_OFFSET_MM * scale, MARK, WATERMARK_OPACITY,
  );
}

export async function buildSquarePdf(
  layout: SquareLayout,
  pagination: Pagination,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { font, boldFont } = await loadFonts(doc, locale);

  const title = squarePatternTitle(layout.seamMm, locale);
  const block = sourceBlockSizeMm(font, title, locale);
  const titlePiece = squareTitlePiece(layout, {
    blockHeightMm: block.heightMm,
    blockWidthMm: block.widthMm,
    reservedTopMm: labelZoneHeightMm(font),
    marginMm: TITLE_MARGIN_MM,
  });

  for (const page of pagination.pages) {
    const pdfPage = doc.addPage([pagination.pageWidthMm * MM_TO_PT, pagination.pageHeightMm * MM_TO_PT]);
    const ctx: PageContext = { pdfPage, pagination, page };

    // 축척 네모는 첫 장에만, 도안보다 먼저. 나중에 그리면 흰 바탕이 재단선을 끊는다.
    if (page === pagination.pages[0]) drawScaleSquares(pdfPage, pagination, font, locale);

    for (const piece of layout.pieces) {
      drawRect(ctx, piece, 0, CUT_COLOR, CUT_THICKNESS);
      for (const notch of piece.notchesMm) drawLine(ctx, notch, CUT_THICKNESS, CUT_COLOR);
      if (layout.seamMm > 0) drawRect(ctx, piece, layout.seamMm, SEAM_COLOR, 0.5);
      // 접힘선은 사각 도안과 같은 연회색 4,4 점선이다.
      for (const fold of piece.foldLinesMm) drawLine(ctx, fold, 0.5, FOLD_COLOR, [4, 4]);
      drawGrainline(ctx, piece.grainlineMm);

      drawCentered(
        ctx, font, pieceLabelText(piece, locale), LABEL_SIZE,
        piece.xMm + piece.widthMm / 2, piece.yMm + layout.seamMm + LABEL_TOP_OFFSET_MM, LABEL_COLOR,
      );
      /*
       * 출처 덩어리가 앉을 조각은 건너뛴다 — 거기엔 이름도 계정도 있다.
       * 손잡이도 건너뛴다. 가운데로 접힘선이 지나가 두 줄이 반씩 갈린다.
       * 조각 이름 줄에 "손잡이"가 있어 어느 도안인지는 짐작할 수 있다.
       */
      if (piece !== titlePiece && piece.id !== 'handle') drawPieceMark(ctx, piece, font, locale, title);
    }

    if (titlePiece !== undefined) {
      const { centerYMm, availableHeightMm } = titleBlockRegion(titlePiece, font);
      drawSourceBlock(ctx, font, locale, {
        xMm: titlePiece.xMm + titlePiece.widthMm / 2,
        centerYMm,
        availableHeightMm,
        availableWidthMm: titlePiece.finishedWidthMm,
        title,
        minScale: TITLE_SCALE_MIN,
      });
    }

    drawAlignmentMarks(ctx, font);
    drawJoinMarks(ctx, font);
    drawPatternNote(ctx, boldFont, locale);
  }

  return doc.save();
}
