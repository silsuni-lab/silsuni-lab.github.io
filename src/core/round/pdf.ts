// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 원통 파우치 조각 넷(앞면 윗단·앞면 아랫단·원·뒷면)을 1:1 실치수로 그린다.
 * 전개도 한 장을 잘라 잇는 사각 파우치와 달리 조각이 이미 종이 위에 따로
 * 놓여 있으므로, buildPdf처럼 다각형 하나를 그리는 대신 조각마다 재단선·
 * 완성선·라벨을 반복해서 찍는다. 페이지를 도는 뼈대와 30mm·1인치 네모·맞춤표·
 * 이어붙임 표시·하단 문구를 부르는 자리는 core/pdf.ts의 buildPdf와 같다.
 */
import { PDFDocument, type PDFFont } from 'pdf-lib';
import {
  BAND_LABEL_COLOR as LABEL_HEX,
  CUT_COLOR as CUT_HEX,
  SEAM_COLOR as SEAM_HEX,
} from '../colors';
import type { Pagination } from '../tiling';
import {
  drawAlignmentMarks, drawJoinMarks, drawPatternNote, drawScaleSquares,
  drawSourceBlock, loadFonts, MARK, MM_TO_PT, pdfColor, sourceBlockSizeMm, TITLE_MARGIN_MM, toPagePoint,
  type PageContext,
} from '../page';
import { WATERMARK_HANDLE, WATERMARK_OPACITY } from '../dimensions';
import { t } from '../i18n/messages';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { roundPatternTitle } from './dimensions';
import { roundTitlePiece, type RoundLayout, type RoundPiece } from './layout';

/*
 * 색 값은 core/colors.ts에 있고, pdf-lib 색으로 감싸는 일은 page.ts의
 * pdfColor가 한다. 사각 도안과 같은 선은 같은 색이어야 한다.
 *
 * 조각 이름은 화면에서 밴드 이름에 쓰는 색을 그대로 쓴다. 매체가 달라도
 * "조각에 붙는 이름"이라는 뜻이 같다.
 */
const CUT_COLOR = pdfColor(CUT_HEX);
const SEAM_COLOR = pdfColor(SEAM_HEX);
const LABEL_COLOR = pdfColor(LABEL_HEX);

/** 조각 라벨 글자 크기. 출처 문구가 라벨 자리를 얼마나 비켜야 하는지 계산할 때도 같은 값을 쓴다. */
const LABEL_SIZE = 9;

/** 완성선(시접 안쪽 끝)에서 라벨 기준선까지 내려오는 여백 (mm). */
const LABEL_TOP_OFFSET_MM = 4;

/** 라벨 글자 아래에서 출처 문구 덩어리가 시작되기까지 남기는 틈 (mm). */
const LABEL_SOURCE_GAP_MM = 2;

/**
 * 사각 조각 위쪽에 라벨이 차지하는 세로 높이 (mm). 완성선에서 이만큼은
 * 라벨 몫으로 비워 둔다.
 *
 * 라벨 글자 실제 높이를 폰트에서 직접 잰다. 대충 어림한 값을 쓰면 폰트나
 * 라벨 크기를 바꿀 때 조용히 다시 겹친다 — 골든 케이스(130/130/30)처럼 큰
 * 조각에서는 안 보이다가 짧은 조각(예: 첫 프리셋 100/50/20의 앞면 아랫단,
 * 완성 높이 20mm)에서만 드러나는 버그였다.
 */
export function labelZoneHeightMm(font: PDFFont): number {
  return LABEL_TOP_OFFSET_MM + font.heightAtSize(LABEL_SIZE) / MM_TO_PT + LABEL_SOURCE_GAP_MM;
}

/**
 * 출처 문구에게 내줄 자리. 라벨 몫(labelZoneHeightMm)을 조각 위쪽에서 뺀
 * 나머지 영역의 한가운데를 기준점으로 돌려준다.
 *
 * buildRoundPdf 안에서도 쓰고, 테스트에서도 이 함수 하나만 보면 "라벨 자리를
 * 침범하지 않는가"를 좌표로 확인할 수 있도록 따로 뗐다.
 */
export function titleBlockRegion(
  titlePiece: RoundPiece,
  seamMm: number,
  font: PDFFont,
): { centerYMm: number; availableHeightMm: number } {
  const reservedTopMm = labelZoneHeightMm(font);
  const availableHeightMm = Math.max(0, titlePiece.finishedHeightMm - reservedTopMm);
  const centerYMm = titlePiece.yMm + titlePiece.heightMm / 2 + reservedTopMm / 2;
  return { centerYMm, availableHeightMm };
}

/** 조각 하나의 재단선. 원과 사각형을 같은 함수로 받는다. */
function drawPieceOutline(
  ctx: PageContext,
  piece: RoundPiece,
  insetMm: number,
  color: ReturnType<typeof pdfColor>,
  thickness: number,
) {
  const { pagination, page } = ctx;
  if (piece.shape === 'circle') {
    const rMm = piece.widthMm / 2 - insetMm;
    if (rMm <= 0) return;
    const center = toPagePoint(pagination, page, piece.xMm + piece.widthMm / 2, piece.yMm + piece.heightMm / 2);
    ctx.pdfPage.drawCircle({ x: center.x, y: center.y, size: rMm * MM_TO_PT, borderColor: color, borderWidth: thickness });
    return;
  }
  const topLeft = toPagePoint(pagination, page, piece.xMm + insetMm, piece.yMm + insetMm);
  ctx.pdfPage.drawRectangle({
    x: topLeft.x,
    y: topLeft.y - (piece.heightMm - 2 * insetMm) * MM_TO_PT,
    width: (piece.widthMm - 2 * insetMm) * MM_TO_PT,
    height: (piece.heightMm - 2 * insetMm) * MM_TO_PT,
    borderColor: color,
    borderWidth: thickness,
  });
}

/**
 * 조각 이름과 장수. 몇 장을 재단할지 여기서만 알 수 있다.
 *
 * 사각 조각은 완성선 바로 안쪽, 위쪽 여백에 둔다. 가운데 두면 네 조각 중
 * 가장 큰 조각(roundTitlePiece가 고르는 자리) 한가운데 찍히는 출처 문구와
 * 자리가 겹친다. 출처 문구 쪽에서 라벨 몫(labelZoneHeightMm)을 미리 비워
 * 두므로, 라벨은 언제나 그 비워 둔 자리 안에 들어간다.
 * 원 조각은 이 함수를 쓰지 않는다. 세 줄을 한 덩어리로 원 한가운데에 쌓는
 * drawCircleStack이 자리를 정한다.
 */
function drawPieceLabel(ctx: PageContext, piece: RoundPiece, font: PDFFont, seamMm: number, locale: Locale) {
  drawCentered(
    ctx, font,
    pieceLabelText(piece, locale),
    LABEL_SIZE,
    piece.xMm + piece.widthMm / 2,
    piece.yMm + seamMm + LABEL_TOP_OFFSET_MM,
    LABEL_COLOR,
  );
}

/** 조각 이름과 장수. 몇 장을 재단할지 여기서만 알 수 있다. */
function pieceLabelText(piece: RoundPiece, locale: Locale): string {
  const label = t(locale, `round.piece.${piece.id}` as never);
  return piece.count > 1 ? `${label} ${t(locale, 'paper.sheets', piece.count)}` : label;
}

/** 한 줄을 xMm 기준 가운데 정렬로 찍는다. 조각에 얹는 글자는 모두 이걸 쓴다. */
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


/*
 * 조각마다 찍는 두 줄 — 파우치 이름과 계정. 바탕 크기(pt)와 줄 간격(mm)이고
 * 여기에 배율을 곱해 쓴다.
 *
 * 조각 이름(LABEL_SIZE=9)보다 작게 잡았다. 그 조각이 무엇인지 알려 주는
 * 것이 먼저고, 어느 도안의 조각인지는 그다음이다.
 */
const PIECE_NAME_SIZE = 8;
const PIECE_HANDLE_SIZE = 10;
const PIECE_HANDLE_OFFSET_MM = 5;

/**
 * 이보다 더 줄여야 들어가면 아예 안 찍는다.
 *
 * 억지로 넣으면 완성선을 넘어 시접이나 재단선까지 글자가 나가는데, 그건
 * 조각을 알아보게 하려다 오히려 재단을 방해하는 것이다. 안 찍혀도 조각
 * 이름은 그대로 남으므로 무엇인지는 알 수 있다.
 */
const PIECE_MARK_MIN_SCALE = 0.6;

/**
 * 조각 표시 두 줄이 앉을 자리. 조각 이름 몫을 비켜 준 나머지의 한가운데다.
 *
 * 사각과 원이 다르다. 사각은 이름이 맨 위(완성선 안쪽)에 있으므로 그 아래
 * 전부가 남고, 원은 이름이 한가운데 있으므로 그 아래 절반만 남는다.
 * titleBlockRegion과 같은 셈을 조각 모양에 맞춰 나눈 것이다.
 */
export function pieceMarkRegion(
  piece: RoundPiece,
  font: PDFFont,
): { centerYMm: number; availableHeightMm: number } {
  const reservedMm = labelZoneHeightMm(font);
  return {
    centerYMm: piece.yMm + piece.heightMm / 2 + reservedMm / 2,
    availableHeightMm: Math.max(0, piece.finishedHeightMm - reservedMm),
  };
}

/**
 * 원 조각의 세 줄 — 조각 이름·파우치 이름·계정 — 의 기준선.
 *
 * 사각과 달리 셋을 한 덩어리로 묶어 원 한가운데에 앉힌다. 사각은 이름이
 * 맨 위(완성선 안쪽)에 있어야 출처 문구와 안 겹치지만, 원은 겹칠 문구가
 * 없다 — 원은 출처 문구 후보에서 빠져 있다. 그래서 셋을 나눠 놓을 까닭이
 * 없고, 나눠 놓으면 이름만 한가운데에 뜨고 나머지 둘이 아래로 처져 한
 * 덩어리로 안 읽힌다.
 *
 * 위아래 균형은 drawSourceBlock과 같은 셈으로 잡는다. 맨 윗줄의 위쪽 절반과
 * 맨 아랫줄의 아래쪽 절반까지 넣어야 글자 덩어리의 가운데가 원의 가운데와
 * 맞는다 — 기준선만 가운데에 두면 덩어리가 위로 치우친다.
 */
export function circleStackYMm(
  piece: RoundPiece,
  font: PDFFont,
): { labelYMm: number; nameYMm: number; handleYMm: number } {
  const heightMm = (size: number) => font.heightAtSize(size) / MM_TO_PT;

  // 기준선 사이 거리. 이름 → 파우치 이름은 글자 한 줄에 틈을 더한 만큼.
  const labelToNameMm = heightMm(PIECE_NAME_SIZE) + LABEL_SOURCE_GAP_MM;
  const nameToHandleMm = PIECE_HANDLE_OFFSET_MM;

  const aboveMm = heightMm(LABEL_SIZE) / 2;
  const belowMm = labelToNameMm + nameToHandleMm + heightMm(PIECE_HANDLE_SIZE) / 2;

  const labelYMm = piece.yMm + piece.heightMm / 2 - (aboveMm + belowMm) / 2 + aboveMm;
  return {
    labelYMm,
    nameYMm: labelYMm + labelToNameMm,
    handleYMm: labelYMm + labelToNameMm + nameToHandleMm,
  };
}

/**
 * 원 조각에 세 줄을 한가운데로 쌓는다. 가로도 모두 가운데 정렬이다.
 *
 * 배율을 두지 않는다. 원은 지름이 최소 80mm라 세 줄이 언제나 넉넉히 들어간다.
 * 사각 조각에서 배율을 두는 것은 완성 높이가 20mm까지 내려가기 때문이다.
 */
function drawCircleStack(ctx: PageContext, piece: RoundPiece, font: PDFFont, locale: Locale) {
  const xMm = piece.xMm + piece.widthMm / 2;
  const { labelYMm, nameYMm, handleYMm } = circleStackYMm(piece, font);

  drawCentered(ctx, font, pieceLabelText(piece, locale), LABEL_SIZE, xMm, labelYMm, LABEL_COLOR);
  drawCentered(ctx, font, t(locale, 'round.pattern.name'), PIECE_NAME_SIZE, xMm, nameYMm, MARK);
  drawCentered(
    ctx, font, WATERMARK_HANDLE, PIECE_HANDLE_SIZE, xMm, handleYMm, MARK, WATERMARK_OPACITY,
  );
}

/**
 * 조각마다 파우치 이름과 계정을 찍는다. 치수는 넣지 않는다.
 *
 * 조각이 넷으로 흩어져 있어, 다 오려 놓고 나면 어느 도안의 조각인지 알 
 * 방법이 없었다. 치수까지 조각마다 되풀이하면 종이가 빽빽해지고, 치수는
 * 어차피 가장 큰 조각의 출처 덩어리에 한 번 적힌다.
 *
 * 그 출처 덩어리가 있는 조각은 건너뛴다. 거기엔 이름도 계정도 이미 있다.
 */
function drawPieceMark(ctx: PageContext, piece: RoundPiece, font: PDFFont, locale: Locale) {
  const { centerYMm, availableHeightMm } = pieceMarkRegion(piece, font);

  const aboveMm = font.heightAtSize(PIECE_NAME_SIZE) / MM_TO_PT / 2;
  const belowMm = PIECE_HANDLE_OFFSET_MM + font.heightAtSize(PIECE_HANDLE_SIZE) / MM_TO_PT / 2;
  const blockMm = aboveMm + belowMm;

  // 키우지는 않는다. 조각 이름보다 커지면 무엇이 주인지가 뒤집힌다.
  const room = availableHeightMm - 2 * TITLE_MARGIN_MM;
  const scale = Math.min(1, room / blockMm);
  if (scale < PIECE_MARK_MIN_SCALE) return;

  const nameYMm = centerYMm - (blockMm * scale) / 2 + aboveMm * scale;
  const xMm = piece.xMm + piece.widthMm / 2;

  drawCentered(ctx, font, t(locale, 'round.pattern.name'), PIECE_NAME_SIZE * scale, xMm, nameYMm, MARK);
  // 계정은 어디서나 같은 투명도로 물러나 있는다. 색까지 옅게 잡으면
  // 옅은 잉크로 뽑을 때 종이에서 사라진다.
  drawCentered(
    ctx, font, WATERMARK_HANDLE, PIECE_HANDLE_SIZE * scale, xMm,
    nameYMm + PIECE_HANDLE_OFFSET_MM * scale, MARK, WATERMARK_OPACITY,
  );
}

export async function buildRoundPdf(
  layout: RoundLayout,
  pagination: Pagination,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { font, boldFont } = await loadFonts(doc, locale);

  /*
   * 출처 덩어리를 실제로 담을 수 있는 조각을 고른다. 넓이만 보면 아주 넓고
   * 아주 낮은 조각이 뽑혀 글자가 재단선 밖으로 나간다 — layout.ts의
   * roundTitlePiece 주석 참고. 조각 이름 몫까지 더해 필요한 높이를 넘긴다.
   */
  const title = roundPatternTitle(layout.dimensions, layout.seamMm, locale);
  const block = sourceBlockSizeMm(font, title, locale);
  const titlePiece = roundTitlePiece(layout, {
    minHeightMm: block.heightMm + 2 * TITLE_MARGIN_MM + labelZoneHeightMm(font),
    minWidthMm: block.widthMm,
  });

  for (const page of pagination.pages) {
    const pdfPage = doc.addPage([pagination.pageWidthMm * MM_TO_PT, pagination.pageHeightMm * MM_TO_PT]);
    const ctx: PageContext = { pdfPage, pagination, page };

    /*
     * 배율 확인용 사각형은 첫 장에만, 도안보다 먼저 그린다. 나중에 그리면
     * 흰 바탕이 재단선을 끊는다. 사각 파우치의 buildPdf와 같은 순서다.
     */
    if (page === pagination.pages[0]) drawScaleSquares(pdfPage, pagination, font, locale);

    for (const piece of layout.pieces) {
      // 재단선이 가장 굵고 진하다. 가위가 지나갈 선이다.
      drawPieceOutline(ctx, piece, 0, CUT_COLOR, 1.2);
      // 완성선은 시접만큼 안으로 들어간 자리. 시접이 0이면 그리지 않는다.
      if (layout.seamMm > 0) drawPieceOutline(ctx, piece, layout.seamMm, SEAM_COLOR, 0.5);
      if (piece.shape === 'circle') {
        // 원은 세 줄을 한 덩어리로 한가운데에 쌓는다. 겹칠 출처 문구가 없다.
        drawCircleStack(ctx, piece, font, locale);
      } else {
        drawPieceLabel(ctx, piece, font, layout.seamMm, locale);
        // 출처 덩어리가 앉을 조각은 건너뛴다 — 거기엔 이름도 계정도 이미 있다.
        if (piece !== titlePiece) drawPieceMark(ctx, piece, font, locale);
      }
    }

    if (titlePiece !== undefined) {
      /*
       * 출처 문구는 조각 한가운데가 아니라, 위쪽에 라벨 몫을 비워 둔 나머지
       * 자리의 한가운데에 앉힌다. 라벨을 조각 맨 위(완성선 바로 안쪽)에
       * 그렸으므로 그만큼 덩어리를 아래로 내리고, drawSourceBlock에 넘기는
       * availableHeightMm도 그만큼 줄인다 — 안 줄이면 배율이 라벨 자리까지
       * 채우도록 커져서 결국 라벨과 겹친다.
       */
      const { centerYMm, availableHeightMm } = titleBlockRegion(titlePiece, layout.seamMm, font);
      drawSourceBlock(
        ctx, font,
        titlePiece.xMm + titlePiece.widthMm / 2,
        centerYMm,
        availableHeightMm,
        title,
        locale,
        titlePiece.finishedWidthMm,
      );
    }

    drawAlignmentMarks(ctx, font);
    drawJoinMarks(ctx, font);
    drawPatternNote(ctx, boldFont, locale);
  }

  return doc.save();
}
