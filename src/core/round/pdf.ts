// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 원통 파우치 조각 넷(앞면 윗단·앞면 아랫단·원·뒷면)을 1:1 실치수로 그린다.
 * 전개도 한 장을 잘라 잇는 사각 파우치와 달리 조각이 이미 종이 위에 따로
 * 놓여 있으므로, buildPdf처럼 다각형 하나를 그리는 대신 조각마다 재단선·
 * 완성선·라벨을 반복해서 찍는다. 페이지를 도는 뼈대와 3cm 사각형·맞춤표·
 * 이어붙임 표시·하단 문구를 부르는 자리는 core/pdf.ts의 buildPdf와 같다.
 */
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import type { Pagination } from '../tiling';
import {
  drawAlignmentMarks, drawJoinMarks, drawPatternNote, drawScaleSquare,
  drawSourceBlock, loadFonts, MM_TO_PT, toPagePoint,
  type PageContext,
} from '../page';
import { roundPatternTitle } from './dimensions';
import { roundTitlePiece, type RoundLayout, type RoundPiece } from './layout';

const CUT_COLOR = rgb(0, 0, 0);
const SEAM_COLOR = rgb(0.3, 0.3, 0.3);
const LABEL_COLOR = rgb(0.2, 0.2, 0.2);

/** 조각 하나의 재단선. 원과 사각형을 같은 함수로 받는다. */
function drawPieceOutline(
  ctx: PageContext,
  piece: RoundPiece,
  insetMm: number,
  color: ReturnType<typeof rgb>,
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
 * 사각 조각은 시접선 바로 안쪽에, 위쪽 여백에 둔다. 가운데 두면 네 조각 중
 * 가장 큰 조각(roundTitlePiece가 고르는 자리) 한가운데 찍히는 출처 문구와
 * 자리가 겹친다. 출처 문구는 그 조각의 완성선 안쪽에서만 그려지므로, 라벨을
 * 시접 폭만큼 위로 올려 두면 어떤 조각이 골라지든 절대 겹치지 않는다.
 * 원 조각은 위쪽으로 갈수록 폭이 좁아져 라벨이 밖으로 삐져나가므로 그대로
 * 가운데에 둔다 — 원은 애초에 출처 문구 후보에서 빠져 있어 겹칠 일도 없다.
 */
function drawPieceLabel(ctx: PageContext, piece: RoundPiece, font: PDFFont, seamMm: number) {
  const size = 9;
  const text = piece.count > 1 ? `${piece.label} ${piece.count}장` : piece.label;
  const yMm = piece.shape === 'circle' ? piece.yMm + piece.heightMm / 2 : piece.yMm + seamMm + 4;
  const anchor = toPagePoint(ctx.pagination, ctx.page, piece.xMm + piece.widthMm / 2, yMm);
  ctx.pdfPage.drawText(text, {
    x: anchor.x - font.widthOfTextAtSize(text, size) / 2,
    y: anchor.y,
    size,
    font,
    color: LABEL_COLOR,
  });
}

export async function buildRoundPdf(layout: RoundLayout, pagination: Pagination): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { font, boldFont } = await loadFonts(doc);
  const titlePiece = roundTitlePiece(layout);

  for (const page of pagination.pages) {
    const pdfPage = doc.addPage([pagination.pageWidthMm * MM_TO_PT, pagination.pageHeightMm * MM_TO_PT]);
    const ctx: PageContext = { pdfPage, pagination, page };

    /*
     * 배율 확인용 사각형은 첫 장에만, 도안보다 먼저 그린다. 나중에 그리면
     * 흰 바탕이 재단선을 끊는다. 사각 파우치의 buildPdf와 같은 순서다.
     */
    if (page === pagination.pages[0]) drawScaleSquare(pdfPage, pagination, font);

    for (const piece of layout.pieces) {
      // 재단선이 가장 굵고 진하다. 가위가 지나갈 선이다.
      drawPieceOutline(ctx, piece, 0, CUT_COLOR, 1.2);
      // 완성선은 시접만큼 안으로 들어간 자리. 시접이 0이면 그리지 않는다.
      if (layout.seamMm > 0) drawPieceOutline(ctx, piece, layout.seamMm, SEAM_COLOR, 0.5);
      drawPieceLabel(ctx, piece, font, layout.seamMm);
    }

    if (titlePiece !== undefined) {
      drawSourceBlock(
        ctx, font,
        titlePiece.xMm + titlePiece.widthMm / 2,
        titlePiece.yMm + titlePiece.heightMm / 2,
        titlePiece.finishedHeightMm,
        roundPatternTitle(layout.dimensions, layout.seamMm),
      );
    }

    drawAlignmentMarks(ctx, font);
    drawJoinMarks(ctx, font);
    drawPatternNote(ctx, boldFont);
  }

  return doc.save();
}
