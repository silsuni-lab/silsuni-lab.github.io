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
  drawSourceBlock, loadFonts, MM_TO_PT, pdfColor, toPagePoint,
  type PageContext,
} from '../page';
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
 * 원 조각은 위쪽으로 갈수록 폭이 좁아져 라벨이 밖으로 삐져나가므로 그대로
 * 가운데에 둔다 — 원은 애초에 출처 문구 후보에서 빠져 있어 겹칠 일도 없다.
 */
function drawPieceLabel(ctx: PageContext, piece: RoundPiece, font: PDFFont, seamMm: number, locale: Locale) {
  const label = t(locale, `round.piece.${piece.id}` as never);
  const text = piece.count > 1
    ? `${label} ${t(locale, 'paper.sheets', piece.count)}`
    : label;
  const yMm = piece.shape === 'circle'
    ? piece.yMm + piece.heightMm / 2
    : piece.yMm + seamMm + LABEL_TOP_OFFSET_MM;
  const anchor = toPagePoint(ctx.pagination, ctx.page, piece.xMm + piece.widthMm / 2, yMm);
  ctx.pdfPage.drawText(text, {
    x: anchor.x - font.widthOfTextAtSize(text, LABEL_SIZE) / 2,
    y: anchor.y,
    size: LABEL_SIZE,
    font,
    color: LABEL_COLOR,
  });
}

export async function buildRoundPdf(
  layout: RoundLayout,
  pagination: Pagination,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { font, boldFont } = await loadFonts(doc, locale);
  const titlePiece = roundTitlePiece(layout);

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
      drawPieceLabel(ctx, piece, font, layout.seamMm, locale);
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
        roundPatternTitle(layout.dimensions, layout.seamMm, locale),
        locale,
      );
    }

    drawAlignmentMarks(ctx, font);
    drawJoinMarks(ctx, font);
    drawPatternNote(ctx, boldFont, locale);
  }

  return doc.save();
}
