// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { Pagination } from '../../core/tiling';
import type { RoundLayout, RoundPiece } from '../../core/round/layout';
import {
  escapeXml,
  CUT_COLOR,
  SEAM_COLOR,
  TILE_COLOR,
  PATTERN_FILL,
  type LegendItem,
} from '../preview';

const round1 = (v: number) => Math.round(v * 10) / 10;

/*
 * 선 굵기와 글자 크기는 도안 폭에 비례시킨다. mm 고정값으로 두면 작은
 * 도안에서 선이 굵고 글자가 커 보이고, 큰 도안에서는 반대가 된다.
 */
const CUT_STROKE_RATIO = 0.004;
const THIN_STROKE_RATIO = 0.002;
const LABEL_RATIO = 0.026;

/**
 * 조각 하나의 테두리. 원과 사각형을 같은 함수로 받는다.
 *
 * insetMm만큼 안으로 들어간 자리에 그린다 — 0이면 재단선, 시접 폭이면
 * 완성선이다. 채움은 재단선일 때만 준다. 완성선까지 칠하면 재단선 채움을
 * 덮어 시접 자리만 색이 달라 보인다.
 */
function pieceShape(
  piece: RoundPiece,
  insetMm: number,
  cls: string,
  stroke: string,
  width: number,
): string {
  const fill = insetMm === 0 ? PATTERN_FILL : 'none';
  if (piece.shape === 'circle') {
    const r = piece.widthMm / 2 - insetMm;
    if (r <= 0) return '';
    return `<circle class="${cls}" cx="${round1(piece.xMm + piece.widthMm / 2)}"` +
      ` cy="${round1(piece.yMm + piece.heightMm / 2)}" r="${round1(r)}"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="${round1(width)}" />`;
  }
  // 원의 r <= 0과 같은 자리다. 폭이나 높이가 음수인 rect는 SVG가 통째로
  // 버리므로, 반쪽짜리 도형을 내보내느니 아예 그리지 않는다.
  const w = piece.widthMm - 2 * insetMm;
  const h = piece.heightMm - 2 * insetMm;
  if (w <= 0 || h <= 0) return '';
  return `<rect class="${cls}" x="${round1(piece.xMm + insetMm)}" y="${round1(piece.yMm + insetMm)}"` +
    ` width="${round1(w)}" height="${round1(h)}"` +
    ` fill="${fill}" stroke="${stroke}" stroke-width="${round1(width)}" />`;
}

export function renderRoundPreviewSvg(layout: RoundLayout, pagination: Pagination): string {
  const w = layout.totalWidthMm;
  const h = layout.totalHeightMm;
  const cutStroke = w * CUT_STROKE_RATIO;
  const thinStroke = w * THIN_STROKE_RATIO;
  const labelSize = round1(w * LABEL_RATIO);

  const shapes = layout.pieces
    .map((p) => {
      // 재단선이 먼저다. 완성선은 시접만큼 안으로 들어간 자리라 위에 얹는다.
      const cut = pieceShape(p, 0, `piece piece-${p.id}`, CUT_COLOR, cutStroke);
      // 시접이 0이면 완성선이 재단선과 같은 자리다. 겹쳐 그으면 선만 두꺼워진다.
      const seam = layout.seamMm > 0
        ? pieceShape(p, layout.seamMm, 'seam-line', SEAM_COLOR, thinStroke)
        : '';
      return cut + seam;
    })
    .join('');

  const labels = layout.pieces
    .map((p) => {
      const text = p.count > 1 ? `${p.label} ${p.count}장` : p.label;
      return `<text class="piece-label" x="${round1(p.xMm + p.widthMm / 2)}"` +
        ` y="${round1(p.yMm + p.heightMm / 2)}" text-anchor="middle"` +
        ` dominant-baseline="middle" font-size="${labelSize}" fill="#333">${escapeXml(text)}</text>`;
    })
    .join('');

  /*
   * 페이지 경계는 도안 위에 얹어야 보인다. 먼저 그리면 조각 채움이 덮는다.
   *
   * 마지막 칸은 도안 끝에서 잘라낸다. 종이 한 장을 통째로 그리면 도안보다
   * 큰 사각이 나오는데, SVG에 overflow: visible이 걸려 있어(치수 글자를
   * 보이게 하려는 것) 그 선이 미리보기 상자 밖으로 뻗어 나가 범례와 아래
   * 문단을 가로지른다. 사각 미리보기가 같은 자리에서 같은 일을 한다.
   */
  const tiles = pagination.pages
    .map((page) => {
      const tileW = Math.min(pagination.contentWidthMm, w - page.originXMm);
      const tileH = Math.min(pagination.contentHeightMm, h - page.originYMm);
      return `<rect class="page-tile" x="${round1(page.originXMm)}" y="${round1(page.originYMm)}"` +
        ` width="${round1(tileW)}" height="${round1(tileH)}"` +
        ` fill="none" stroke="${TILE_COLOR}" stroke-width="${round1(thinStroke)}"` +
        ` stroke-dasharray="${round1(thinStroke * 4)} ${round1(thinStroke * 3)}" />`;
    })
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}"`,
    ` style="overflow: visible; width: 100%; max-width: 100%; height: auto;" role="img"`,
    ` aria-label="${escapeXml(`원통 파우치 조각 ${layout.pieces.length}종 미리보기`)}">`,
    shapes, tiles, labels,
    `</svg>`,
  ].join('');
}

/**
 * 범례는 실제로 그린 선만, 실제로 쓴 색으로 담는다. 원통에는 골선도
 * 중앙선도 없다 — 그리지도 않은 선을 적어 두면 도면에서 찾다가 헤맨다.
 */
export function roundLegendItems(layout: RoundLayout): readonly LegendItem[] {
  const items: LegendItem[] = [
    { swatch: 'swatch-cut', color: CUT_COLOR, text: '재단선 — 이 선을 따라 자릅니다' },
    { swatch: 'swatch-tile', color: TILE_COLOR, text: '페이지 경계 — 잘라 붙이는 자리' },
  ];
  if (layout.seamMm > 0) {
    items.splice(1, 0, {
      swatch: 'swatch-seam',
      color: SEAM_COLOR,
      text: `완성선 — 재단선에서 ${round1(layout.seamMm)}mm 안쪽`,
    });
  }
  return items;
}
