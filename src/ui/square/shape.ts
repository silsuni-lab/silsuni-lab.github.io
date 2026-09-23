// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { SquareDimensions } from '../../core/square/dimensions';
import { HANDLE_LENGTH_RATIO, HANDLE_WIDTH_MM } from '../../core/square/layout';
import { t } from '../../core/i18n/messages';
import type { Locale } from '../../core/i18n/locales';
import { escapeXml } from '../preview';
// 눈높이와 투명도는 사각 사시도와 같아야 세 종류가 같은 눈으로 보인다.
import { DEPTH_ANGLE_DEG, DEPTH_SCALE, HIDDEN_SIDE_OPACITY } from '../shape';
import {
  SHAPE_DIM_COLOR,
  SHAPE_EDGE_COLOR,
  SHAPE_FACE_FRONT_FILL,
  SHAPE_FACE_SIDE_FILL,
  SHAPE_FACE_TOP_FILL,
  SHAPE_HIDDEN_COLOR,
  ZIPPER_COLOR,
} from '../../core/colors';

// 여백·글자·선 굵기는 그림 폭에 비례한다. 사각·원통 사시도와 같은 값이다.
const PAD_RATIO = 0.15;
const TOP_PAD_RATIO = 0.04;
const FONT_RATIO = 0.062;
const STROKE_RATIO = 0.006;

interface Point {
  readonly x: number;
  readonly y: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toPoints(points: readonly Point[]): string {
  return points.map((p) => `${round1(p.x)},${round1(p.y)}`).join(' ');
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 손잡이가 뚜껑 위로 뜨는 높이. 양 끝이 가로만큼 떨어져 있고 길이는 가로의
 * 1.3배이므로, 반쪽을 빗변으로 보면 높이는 √((L/2)² − (W/2)²)이다. 실제로는
 * 둥글게 휘지만 그림에서 어림하기에는 이 정도면 된다.
 */
export function handleRiseMm(widthMm: number): number {
  const half = (widthMm * HANDLE_LENGTH_RATIO) / 2;
  return Math.sqrt(half * half - (widthMm / 2) ** 2);
}

/**
 * 완성된 네모 파우치를 사선 투영으로 그린다. 사각 사시도와 같은 눈높이다.
 *
 * 지퍼는 뚜껑 높이만큼 내려온 자리에서 앞면과 오른쪽 옆면을 돈다. 뒤로
 * 돌아 들어가는 끝과 경첩은 몸통에 가려 안 보인다. 왼쪽 옆면 지퍼는 사각
 * 사시도처럼 흐리게 비춘다.
 */
export function renderSquareShapeSvg(dimensions: SquareDimensions, locale: Locale): string {
  const { widthMm: W, depthMm: D, sideHeightMm: Hs, lidHeightMm: Hl } = dimensions;

  const radians = (DEPTH_ANGLE_DEG * Math.PI) / 180;
  const dx = D * DEPTH_SCALE * Math.cos(radians);
  const dy = D * DEPTH_SCALE * Math.sin(radians);
  const rise = handleRiseMm(W);

  const spanX = W + dx;
  const pad = spanX * PAD_RATIO;
  const topPad = spanX * TOP_PAD_RATIO;
  const font = spanX * FONT_RATIO;
  const stroke = spanX * STROKE_RATIO;
  const rightPad = pad + font * 4;

  const x0 = pad;
  const y0 = topPad + rise + dy;

  const ftl = { x: x0, y: y0 };
  const ftr = { x: x0 + W, y: y0 };
  const fbr = { x: x0 + W, y: y0 + Hs };
  const fbl = { x: x0, y: y0 + Hs };
  const btl = { x: x0 + dx, y: y0 - dy };
  const btr = { x: x0 + W + dx, y: y0 - dy };
  const bbr = { x: x0 + W + dx, y: y0 + Hs - dy };
  const bbl = { x: x0 + dx, y: y0 + Hs - dy };

  const face = (name: string, points: readonly Point[], fill: string) =>
    `<polygon class="${name}" points="${toPoints(points)}" fill="${fill}" stroke="${SHAPE_EDGE_COLOR}"` +
    ` stroke-width="${round1(stroke)}" stroke-linejoin="round" />`;

  const faces =
    face('face-front', [ftl, ftr, fbr, fbl], SHAPE_FACE_FRONT_FILL) +
    face('face-top', [ftl, btl, btr, ftr], SHAPE_FACE_TOP_FILL) +
    face('face-side', [ftr, btr, bbr, fbr], SHAPE_FACE_SIDE_FILL);

  const line = (cls: string, a: Point, b: Point, color: string, width: number, extra = '') =>
    `<line class="${cls}" x1="${round1(a.x)}" y1="${round1(a.y)}" x2="${round1(b.x)}" y2="${round1(b.y)}"` +
    ` stroke="${color}" stroke-width="${round1(width)}"${extra} />`;

  const dash = ` stroke-dasharray="${round1(stroke * 3)} ${round1(stroke * 2.2)}"`;
  const hiddenEdges =
    line('hidden-edge', bbl, bbr, SHAPE_HIDDEN_COLOR, stroke * 0.65, dash) +
    line('hidden-edge', bbl, btl, SHAPE_HIDDEN_COLOR, stroke * 0.65, dash) +
    line('hidden-edge', bbl, fbl, SHAPE_HIDDEN_COLOR, stroke * 0.65, dash);

  // 지퍼: 앞면 → 오른쪽 옆면, 왼쪽 옆면은 흐리게.
  const down = (p: Point) => ({ x: p.x, y: p.y + Hl });
  const zw = stroke * 0.9;
  const cap = ' stroke-linecap="round"';
  const zipper =
    line('zipper-hidden', down(ftl), down(btl), ZIPPER_COLOR, zw, `${cap} stroke-opacity="${HIDDEN_SIDE_OPACITY}"`) +
    line('zipper', down(ftl), down(ftr), ZIPPER_COLOR, zw, cap) +
    line('zipper', down(ftr), down(btr), ZIPPER_COLOR, zw, cap);

  /*
   * 손잡이. 뚜껑 좌우 변의 한가운데에서 솟는다. 폭은 실제 25mm를 윗면에
   * 눕힌 만큼(깊이 축소율) 두께로 준다. 테두리 색으로 한 번, 윗면 색으로
   * 조금 가늘게 한 번 그어 띠처럼 보이게 한다.
   */
  const leftEnd = mid(ftl, btl);
  const rightEnd = mid(ftr, btr);
  const control = { x: (leftEnd.x + rightEnd.x) / 2, y: (leftEnd.y + rightEnd.y) / 2 - 2 * rise };
  const d = `M ${round1(leftEnd.x)},${round1(leftEnd.y)} Q ${round1(control.x)},${round1(control.y)}` +
    ` ${round1(rightEnd.x)},${round1(rightEnd.y)}`;
  const band = Math.max(stroke * 3, HANDLE_WIDTH_MM * DEPTH_SCALE);
  const handle =
    `<path class="handle-edge" d="${d}" fill="none" stroke="${SHAPE_EDGE_COLOR}" stroke-width="${round1(band)}" stroke-linecap="butt" />` +
    `<path class="handle" d="${d}" fill="none" stroke="${SHAPE_FACE_TOP_FILL}" stroke-width="${round1(band - 2 * stroke)}" stroke-linecap="butt" />`;

  const dimLabel = (x: number, y: number, text: string, anchor: string, rotate?: string) =>
    `<text class="dim-label" x="${round1(x)}" y="${round1(y)}" text-anchor="${anchor}"` +
    ` font-size="${round1(font)}" fill="${SHAPE_DIM_COLOR}"${rotate ?? ''}>${escapeXml(text)}</text>`;

  const heightLabelX = x0 - font * 0.7;
  const heightLabelY = y0 + Hs / 2;
  const sideX = x0 + W + dx + font * 0.4;
  const labels =
    dimLabel(x0 + W / 2, y0 + Hs + font * 1.2, `${round1(W)}mm`, 'middle') +
    dimLabel(heightLabelX, heightLabelY, `${round1(Hs)}mm`, 'middle',
      ` transform="rotate(-90 ${round1(heightLabelX)} ${round1(heightLabelY)})"`) +
    // 뚜껑 높이는 지퍼 오른쪽 끝 옆에, 폭은 옆면 아래쪽 옆에.
    dimLabel(sideX, y0 - dy + Hl / 2 + font * 0.35, `${round1(Hl)}mm`, 'start') +
    dimLabel(sideX, y0 + Hs - dy / 2 + font * 0.4, `${round1(D)}mm`, 'start');

  const viewWidth = spanX + pad + rightPad;
  const viewHeight = topPad + rise + dy + Hs + pad;
  const label = t(locale, 'square.shape.ariaLabel', round1(W), round1(D), round1(Hs), round1(Hl));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(viewWidth)} ${round1(viewHeight)}"`,
    // 폭을 못 박는다 — WebKit이 flex 안에서 viewBox만 보고 폭을 0으로 잡는다.
    ` style="width: 100%; max-width: 100%; height: auto;" role="img" aria-label="${escapeXml(label)}">`,
    faces,
    hiddenEdges,
    zipper,
    handle,
    labels,
    `</svg>`,
  ].join('');
}
