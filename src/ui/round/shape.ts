// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { RoundDimensions } from '../../core/round/dimensions';
import { escapeXml } from '../preview';
// 눈높이와 투명도는 색이 아니라 그리는 규칙이라 shape.ts에 남아 있다.
import { DEPTH_ANGLE_DEG, DEPTH_SCALE, HIDDEN_SIDE_OPACITY } from '../shape';
/*
 * 색은 core/colors.ts에서만 꺼낸다. 사각 사시도와 같은 면·같은 선은 같은
 * 색이어야 한다 — 값을 여기에 따로 적으면 두 그림이 조용히 갈라진다.
 */
import {
  SHAPE_DIM_COLOR,
  SHAPE_EDGE_COLOR,
  SHAPE_FACE_FRONT_FILL,
  SHAPE_FACE_TOP_FILL,
  SHAPE_HIDDEN_COLOR,
  ZIPPER_COLOR,
} from '../../core/colors';

/**
 * 타원이 납작해지는 정도(ry / rx).
 *
 * 사각 파우치 사시도와 같은 눈높이에서 본 것처럼 맞춘다. 거기서는 바닥폭 D가
 * 화면에서 세로로 D × DEPTH_SCALE × sin(각도)만큼 물러난다. 원통 윗면도 지름 D가
 * 그만큼 물러나야 하므로 타원 세로 지름 2·ry가 같은 값이 되고, rx는 D/2이니
 * ry / rx가 곧 이 비율이다. 30°·0.6에서 0.3이 나온다.
 *
 * 값을 따로 적지 않고 계산해 두는 이유가 있다. 사각 쪽 각도를 고치면 원통도
 * 따라와야 두 그림이 같은 눈높이로 남는다.
 */
const ELLIPSE_RATIO = DEPTH_SCALE * Math.sin((DEPTH_ANGLE_DEG * Math.PI) / 180);

/*
 * 여백·글자·선 굵기는 그림 가로 폭에 비례시킨다. 사각 사시도와 같은 값이다 —
 * 두 그림이 나란히 놓이지는 않지만, 종류를 바꿔 가며 볼 때 글자 크기가
 * 널뛰면 같은 도구로 보이지 않는다.
 */
const PAD_RATIO = 0.15;
const TOP_PAD_RATIO = 0.04;
const FONT_RATIO = 0.062;
const STROKE_RATIO = 0.006;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 원통을 두르는 수평 원 하나. 화면에서는 타원의 반쪽 호로 보인다.
 *
 * near가 참이면 앞쪽(아래로 부푼 호), 거짓이면 뒤쪽(위로 부푼 호)이다.
 * SVG는 y가 아래로 자라므로 sweep 1이 위쪽 호, 0이 아래쪽 호가 된다.
 */
function ring(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  near: boolean,
  cls: string,
  stroke: string,
  width: number,
  extra = '',
): string {
  const sweep = near ? 0 : 1;
  const d = `M ${round1(cx - rx)},${round1(cy)} A ${round1(rx)},${round1(ry)} 0 0 ${sweep} ${round1(cx + rx)},${round1(cy)}`;
  return `<path class="${cls}" d="${d}" fill="none" stroke="${stroke}"` +
    ` stroke-width="${round1(width)}" stroke-linecap="round"${extra} />`;
}

export function renderRoundShapeSvg(dimensions: RoundDimensions): string {
  const { diameterMm: D, sideHeightMm: Hs, lidHeightMm: Hl } = dimensions;

  const rx = D / 2;
  const ry = rx * ELLIPSE_RATIO;

  const spanX = D;
  const pad = spanX * PAD_RATIO;
  const topPad = spanX * TOP_PAD_RATIO;
  const font = spanX * FONT_RATIO;
  const stroke = spanX * STROKE_RATIO;
  /*
   * 오른쪽에는 뚜껑 높이 글자가 붙는다. 그만큼만 비운다.
   *
   * 사각 사시도는 여기가 pad + font * 4다. 거기서는 깊이 치수 글자가 dx만큼
   * 더 오른쪽으로 밀려 그 여백을 실제로 쓴다. 원통에는 물러나는 깊이가 없어
   * 같은 공식을 쓰면 남는 자리가 통째로 빈 채로 남고 그림이 왼쪽으로 쏠린다.
   * 글자가 차지하는 만큼(다섯 자 남짓 + 사이 틈)으로 줄인다.
   */
  const rightPad = font * 4;

  const cx = pad + rx;
  const cyTop = topPad + ry;
  const cyBottom = cyTop + Hs;
  // 지퍼는 뚜껑과 몸통이 갈라지는 자리다. 윗면에서 뚜껑 높이만큼 내려온다.
  const cyZip = cyTop + Hl;

  /*
   * 몸통 채움을 먼저 깐다. 바닥 타원을 통째로 칠한 뒤 옆면 사각으로 그 윗
   * 절반을 덮으면 아래만 둥근 실루엣이 남는다. 채움에는 선을 주지 않는다 —
   * 여기서 선을 그으면 뒤쪽 호까지 실선으로 나와 앞뒤 구분이 사라진다.
   */
  const body =
    `<ellipse class="bottom-ellipse" cx="${round1(cx)}" cy="${round1(cyBottom)}"` +
    ` rx="${round1(rx)}" ry="${round1(ry)}" fill="${SHAPE_FACE_FRONT_FILL}" stroke="none" />` +
    `<rect class="body" x="${round1(cx - rx)}" y="${round1(cyTop)}"` +
    ` width="${round1(rx * 2)}" height="${round1(Hs)}" fill="${SHAPE_FACE_FRONT_FILL}" stroke="none" />`;

  // 바닥 뒤쪽은 몸통에 가려 보이지 않는다. 사각 사시도처럼 점선으로 비친다.
  const hiddenBottom = ring(
    cx, cyBottom, rx, ry, false, 'hidden-edge', SHAPE_HIDDEN_COLOR, stroke * 0.65,
    ` stroke-dasharray="${round1(stroke * 3)} ${round1(stroke * 2.2)}"`,
  );
  const frontBottom = ring(cx, cyBottom, rx, ry, true, 'bottom-arc', SHAPE_EDGE_COLOR, stroke);

  const sideEdge = (x: number) =>
    `<line class="side-edge" x1="${round1(x)}" y1="${round1(cyTop)}"` +
    ` x2="${round1(x)}" y2="${round1(cyBottom)}" stroke="${SHAPE_EDGE_COLOR}"` +
    ` stroke-width="${round1(stroke)}" />`;
  const sides = sideEdge(cx - rx) + sideEdge(cx + rx);

  /*
   * 지퍼는 원통을 한 바퀴 두른다. 뒤쪽 반 바퀴는 몸통에 가려 보이지 않지만,
   * 한 바퀴 돈다는 걸 보여 주려고 흐리게 비춘다. 사각 사시도에서 왼쪽 옆면
   * 지퍼를 흐리게 비추는 것과 같은 취지다.
   */
  const zipperStroke = stroke * 0.9;
  const zipper =
    ring(cx, cyZip, rx, ry, false, 'zipper-hidden', ZIPPER_COLOR, zipperStroke,
      ` stroke-opacity="${HIDDEN_SIDE_OPACITY}"`) +
    ring(cx, cyZip, rx, ry, true, 'zipper', ZIPPER_COLOR, zipperStroke);

  // 뚜껑 상판. 몸통 채움 위에 얹어야 아랫 절반이 덮이지 않는다.
  const topEllipse =
    `<ellipse class="top-ellipse" cx="${round1(cx)}" cy="${round1(cyTop)}"` +
    ` rx="${round1(rx)}" ry="${round1(ry)}" fill="${SHAPE_FACE_TOP_FILL}"` +
    ` stroke="${SHAPE_EDGE_COLOR}" stroke-width="${round1(stroke)}" />`;

  const dimLabel = (x: number, y: number, text: string, anchor: string, rotate?: string) =>
    `<text class="dim-label" x="${round1(x)}" y="${round1(y)}" text-anchor="${anchor}"` +
    ` font-size="${round1(font)}" fill="${SHAPE_DIM_COLOR}"${rotate ?? ''}>${escapeXml(text)}</text>`;

  const heightLabelX = cx - rx - font * 0.7;
  const heightLabelY = cyTop + Hs / 2;
  const labels =
    dimLabel(cx, cyBottom + ry + font * 1.2, `${round1(D)}mm`, 'middle') +
    dimLabel(
      heightLabelX,
      heightLabelY,
      `${round1(Hs)}mm`,
      'middle',
      ` transform="rotate(-90 ${round1(heightLabelX)} ${round1(heightLabelY)})"`,
    ) +
    // 뚜껑 높이는 지퍼 오른쪽에 붙인다. 짧은 구간이라 글자를 그 한가운데에 맞춘다.
    dimLabel(cx + rx + font * 0.4, cyTop + Hl / 2 + font * 0.35, `${round1(Hl)}mm`, 'start');

  const viewWidth = spanX + pad + rightPad;
  const viewHeight = topPad + Hs + 2 * ry + pad;

  const label =
    `지름 ${round1(D)}mm, 옆높이 ${round1(Hs)}mm, 뚜껑 높이 ${round1(Hl)}mm` +
    ` 원통 파우치의 완성 예상 모습`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(viewWidth)} ${round1(viewHeight)}"`,
    // width를 비우고 viewBox 비율에만 맡기면 WebKit이 flex 안에서 폭을 0으로
    // 계산해 그림이 통째로 사라진다. 폭을 못 박고 높이만 비율대로 따라오게 한다.
    ` style="width: 100%; max-width: 100%; height: auto;" role="img" aria-label="${escapeXml(label)}">`,
    body,
    hiddenBottom,
    frontBottom,
    sides,
    zipper,
    topEllipse,
    labels,
    `</svg>`,
  ].join('');
}
