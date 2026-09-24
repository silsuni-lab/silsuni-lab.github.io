// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { t } from '../../core/i18n/messages';
import type { Locale } from '../../core/i18n/locales';
import type { Pagination } from '../../core/tiling';
import type { SquareLayout, SquarePiece } from '../../core/square/layout';
import { escapeXml, grainlineSvg, type LegendItem } from '../preview';
import {
  BAND_LABEL_COLOR,
  FOLD_COLOR,
  GRAIN_COLOR,
  PATTERN_FILL,
  PREVIEW_LINE_COLOR,
  SEAM_BAND_FILL,
  TILE_COLOR,
} from '../../core/colors';

const round1 = (v: number) => Math.round(v * 10) / 10;

// 원통 미리보기와 같은 비율이다. 두 화면에서 같은 굵기·크기로 보인다.
const THIN_STROKE_RATIO = 0.002;
const LABEL_RATIO = 0.026;
const TILE_LABEL_RATIO = 0.024;

/**
 * 조각 사각형 하나. insetMm이 0이면 재단선, 시접 폭이면 완성선이다.
 * 둥근 모서리는 PDF와 같은 셈이다 — 재단선 반지름 R + S, 완성선 R.
 */
function pieceRect(piece: SquarePiece, insetMm: number, cls: string, width: number, fill: string): string {
  const w = piece.widthMm - 2 * insetMm;
  const h = piece.heightMm - 2 * insetMm;
  if (w <= 0 || h <= 0) return '';
  const seamMm = (piece.widthMm - piece.finishedWidthMm) / 2;
  const r = piece.cornerRadiusMm > 0 ? piece.cornerRadiusMm + seamMm - insetMm : 0;
  const rx = r > 0 ? ` rx="${round1(r)}" ry="${round1(r)}"` : '';
  return `<rect class="${cls}" x="${round1(piece.xMm + insetMm)}" y="${round1(piece.yMm + insetMm)}"` +
    ` width="${round1(w)}" height="${round1(h)}"${rx}` +
    ` fill="${fill}" stroke="${PREVIEW_LINE_COLOR}" stroke-width="${round1(width)}" />`;
}

/**
 * 전개도 미리보기. 원통 미리보기와 같은 스펙이다 — 재단선과 완성선을 한 색
 * 한 두께로 긋고 그 사이를 분홍 시접 띠로 채운다.
 *
 * 손잡이 접힘선은 화면에도 긋는다. 사각 미리보기가 접힘선을 빼는 까닭은
 * 완성선과 한 직선을 나눠 가져 지그재그로 보이기 때문인데, 손잡이의
 * 접힘선은 조각 한가운데에 혼자 있어 헷갈릴 선이 없다.
 */
export function renderSquarePreviewSvg(layout: SquareLayout, pagination: Pagination, locale: Locale): string {
  const w = layout.totalWidthMm;
  const h = layout.totalHeightMm;
  const thinStroke = w * THIN_STROKE_RATIO;
  const labelSize = round1(w * LABEL_RATIO);
  const tileLabelSize = round1(w * TILE_LABEL_RATIO);
  const hasSeam = layout.seamMm > 0;

  const shapes = layout.pieces
    .map((p) =>
      pieceRect(p, 0, `piece piece-${p.id}`, thinStroke, hasSeam ? SEAM_BAND_FILL : PATTERN_FILL) +
      (hasSeam ? pieceRect(p, layout.seamMm, 'seam-line', thinStroke, PATTERN_FILL) : ''))
    .join('');

  const folds = layout.pieces
    .flatMap((p) => p.foldLinesMm)
    .map((l) =>
      `<line class="fold-line" x1="${round1(l.x1Mm)}" y1="${round1(l.y1Mm)}" x2="${round1(l.x2Mm)}" y2="${round1(l.y2Mm)}"` +
      ` stroke="${FOLD_COLOR}" stroke-width="${round1(thinStroke)}"` +
      ` stroke-dasharray="${round1(thinStroke * 4)} ${round1(thinStroke * 4)}" />`)
    .join('');

  const grainlines = layout.pieces.map((p) => grainlineSvg(p.grainlineMm, thinStroke, GRAIN_COLOR)).join('');

  /*
   * 조각 이름은 한가운데에 둔다. 손잡이만은 가운데로 접힘선이 지나가므로
   * 위쪽 절반의 한가운데로 올린다.
   */
  const labels = layout.pieces
    .map((p) => {
      const name = t(locale, `square.piece.${p.id}` as never);
      const text = p.count > 1 ? `${name} ${t(locale, 'paper.sheets', p.count)}` : name;
      const y = p.id === 'handle' ? p.yMm + p.heightMm / 4 + layout.seamMm / 2 : p.yMm + p.heightMm / 2;
      return `<text class="piece-label" x="${round1(p.xMm + p.widthMm / 2)}" y="${round1(y)}"` +
        ` text-anchor="middle" dominant-baseline="middle" font-size="${labelSize}"` +
        ` fill="${BAND_LABEL_COLOR}">${escapeXml(text)}</text>`;
    })
    .join('');

  // 페이지 경계는 도안 위에 얹는다. 마지막 칸은 도안 끝에서 잘라 상자 밖으로 안 뻗게 한다.
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

  const tileLabels = pagination.pages
    .map((page) =>
      `<text class="tile-label" x="${round1(page.originXMm + 4)}" y="${round1(page.originYMm + 14)}"` +
      ` font-size="${tileLabelSize}" fill="${TILE_COLOR}">${escapeXml(page.gridLabel)}</text>`)
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}"`,
    ` style="overflow: visible; width: 100%; max-width: 100%; height: auto;" role="img"`,
    ` aria-label="${escapeXml(t(locale, 'square.preview.ariaLabel', layout.pieces.length))}">`,
    shapes, folds, grainlines, tiles, tileLabels, labels,
    `</svg>`,
  ].join('');
}

/** 범례는 실제로 그린 선만, 실제로 쓴 색으로 담는다. */
export function squareLegendItems(layout: SquareLayout, locale: Locale): readonly LegendItem[] {
  const items: LegendItem[] = [
    { swatch: 'swatch-cut', color: PREVIEW_LINE_COLOR, text: t(locale, 'round.legend.cut') },
  ];
  if (layout.seamMm > 0) {
    items.push(
      { swatch: 'swatch-seam', color: PREVIEW_LINE_COLOR, text: t(locale, 'round.legend.seam', round1(layout.seamMm)) },
      {
        swatch: 'swatch-seam-band', color: PREVIEW_LINE_COLOR, fill: SEAM_BAND_FILL,
        text: t(locale, 'legend.seamAllowance', round1(layout.seamMm)),
      },
    );
  }
  if (layout.pieces.some((p) => p.foldLinesMm.length > 0)) {
    items.push({ swatch: 'swatch-fold', color: FOLD_COLOR, text: t(locale, 'square.legend.fold') });
  }
  items.push(
    { swatch: 'swatch-grain', color: GRAIN_COLOR, text: t(locale, 'legend.grainline') },
    { swatch: 'swatch-tile', color: TILE_COLOR, text: t(locale, 'legend.tile') },
  );
  return items;
}
