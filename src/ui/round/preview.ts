// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { t } from '../../core/i18n/messages';
import type { Locale } from '../../core/i18n/locales';
import type { Pagination } from '../../core/tiling';
import type { RoundLayout, RoundPiece } from '../../core/round/layout';
import { escapeXml, type LegendItem } from '../preview';
/*
 * 색은 core/colors.ts에서만 꺼낸다. 사각 미리보기와 같은 선은 같은 색이어야
 * 한다 — 값을 여기에 따로 적으면 한쪽만 고쳤을 때 두 화면이 조용히 갈라진다.
 */
import {
  BAND_LABEL_COLOR,
  PATTERN_FILL,
  PREVIEW_LINE_COLOR,
  SEAM_BAND_FILL,
  TILE_COLOR,
} from '../../core/colors';

const round1 = (v: number) => Math.round(v * 10) / 10;

/*
 * 선 굵기와 글자 크기는 도안 폭에 비례시킨다. mm 고정값으로 두면 작은
 * 도안에서 선이 굵고 글자가 커 보이고, 큰 도안에서는 반대가 된다.
 */
const THIN_STROKE_RATIO = 0.002;
const LABEL_RATIO = 0.026;
/** 칸 번호 글자. 사각 미리보기와 같은 값이라 두 화면에서 같은 크기로 보인다. */
const TILE_LABEL_RATIO = 0.024;

/**
 * 조각 하나의 테두리. 원과 사각형을 같은 함수로 받는다.
 *
 * insetMm만큼 안으로 들어간 자리에 그린다 — 0이면 재단선, 시접 폭이면
 * 완성선이다. 채움은 부르는 쪽이 정한다. 시접 띠를 만들려면 바깥 도형과
 * 안쪽 도형에 서로 다른 색을 줘야 하기 때문이다.
 */
function pieceShape(
  piece: RoundPiece,
  insetMm: number,
  cls: string,
  stroke: string,
  width: number,
  fill: string,
): string {
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

export function renderRoundPreviewSvg(layout: RoundLayout, pagination: Pagination, locale: Locale): string {
  const w = layout.totalWidthMm;
  const h = layout.totalHeightMm;
  const thinStroke = w * THIN_STROKE_RATIO;
  const labelSize = round1(w * LABEL_RATIO);
  const tileLabelSize = round1(w * TILE_LABEL_RATIO);

  const shapes = layout.pieces
    .map((p) => {
      /*
       * 재단선이 먼저고 완성선을 그 위에 얹는다. 두 도형의 채움색을 달리
       * 하면 그 사이(=시접)만 분홍으로 남는다 — 사각 미리보기가 evenodd로
       * 만드는 띠와 같은 것을, 조각이 이미 따로 놓여 있어 더 쉽게 얻는다.
       *
       * 이 띠가 있어야 도안 선을 한 색으로 합칠 수 있다. 재단선과 완성선이
       * 색도 두께도 같으므로, 둘을 가르는 것은 띠의 바깥이냐 안이냐뿐이다.
       */
      const hasSeam = layout.seamMm > 0;
      const cut = pieceShape(
        p, 0, `piece piece-${p.id}`, PREVIEW_LINE_COLOR, thinStroke,
        hasSeam ? SEAM_BAND_FILL : PATTERN_FILL,
      );
      // 시접이 0이면 완성선이 재단선과 같은 자리다. 겹쳐 그으면 선만 두꺼워진다.
      const seam = hasSeam
        ? pieceShape(p, layout.seamMm, 'seam-line', PREVIEW_LINE_COLOR, thinStroke, PATTERN_FILL)
        : '';
      return cut + seam;
    })
    .join('');

  const labels = layout.pieces
    .map((p) => {
      const name = t(locale, `round.piece.${p.id}` as never);
      const text = p.count > 1 ? `${name} ${t(locale, 'paper.sheets', p.count)}` : name;
      return `<text class="piece-label" x="${round1(p.xMm + p.widthMm / 2)}"` +
        ` y="${round1(p.yMm + p.heightMm / 2)}" text-anchor="middle"` +
        ` dominant-baseline="middle" font-size="${labelSize}" fill="${BAND_LABEL_COLOR}">${escapeXml(text)}</text>`;
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

  /*
   * 칸 번호. PDF에 찍히는 것과 같은 값이라(page.ts가 그린다) 화면에서 본
   * 자리를 종이에서 그대로 찾을 수 있다. 잘라 붙일 때 어느 장이 어디였는지
   * 아는 유일한 단서다.
   */
  const tileLabels = pagination.pages
    .map((page) =>
      `<text class="tile-label" x="${round1(page.originXMm + 4)}"` +
      ` y="${round1(page.originYMm + 14)}" font-size="${tileLabelSize}"` +
      ` fill="${TILE_COLOR}">${escapeXml(page.gridLabel)}</text>`)
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}"`,
    ` style="overflow: visible; width: 100%; max-width: 100%; height: auto;" role="img"`,
    ` aria-label="${escapeXml(t(locale, 'round.preview.ariaLabel', layout.pieces.length))}">`,
    shapes, tiles, tileLabels, labels,
    `</svg>`,
  ].join('');
}

/**
 * 범례는 실제로 그린 선만, 실제로 쓴 색으로 담는다. 원통에는 골선도
 * 중앙선도 없다 — 그리지도 않은 선을 적어 두면 도면에서 찾다가 헤맨다.
 */
export function roundLegendItems(layout: RoundLayout, locale: Locale): readonly LegendItem[] {
  const items: LegendItem[] = [
    { swatch: 'swatch-cut', color: PREVIEW_LINE_COLOR, text: t(locale, 'round.legend.cut') },
    { swatch: 'swatch-tile', color: TILE_COLOR, text: t(locale, 'legend.tile') },
  ];
  if (layout.seamMm > 0) {
    items.splice(1, 0, {
      swatch: 'swatch-seam',
      color: PREVIEW_LINE_COLOR,
      text: t(locale, 'round.legend.seam', round1(layout.seamMm)),
    });
    /*
     * 시접 띠. 도안 선을 한 색으로 합친 뒤로는 이 띠가 재단선과 완성선을
     * 가르는 유일한 단서라, 범례에서 빠지면 안 된다. 문구는 사각과 같은
     * 것을 쓴다 — 뜻이 똑같고, 두 화면이 같은 것을 다르게 부를 이유가 없다.
     */
    items.splice(2, 0, {
      swatch: 'swatch-seam-band',
      color: PREVIEW_LINE_COLOR,
      fill: SEAM_BAND_FILL,
      text: t(locale, 'legend.seamAllowance', round1(layout.seamMm)),
    });
  }
  return items;
}
