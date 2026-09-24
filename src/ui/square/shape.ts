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
export function renderSquareShapeSvg(dimensions: SquareDimensions, locale: Locale, cornerRadiusMm = 0): string {
  if (cornerRadiusMm > 0) return renderRoundedShapeSvg(dimensions, locale, cornerRadiusMm);
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

/** 평면 윤곽 위의 한 점과 그 자리의 바깥 방향. z는 앞(0)에서 뒤(D)로 간다. */
interface OutlinePoint {
  readonly x: number;
  readonly z: number;
  readonly nx: number;
  readonly nz: number;
}

/** 모서리 호 하나를 이 개수로 쪼갠다. 화면 크기에서 꺾임이 안 보이는 정도. */
const ARC_STEPS = 12;

/** 둥근 사각형 윤곽을 앞-왼쪽 모서리부터 한 바퀴 돈다. */
function roundedOutline(W: number, D: number, R: number): OutlinePoint[] {
  const corners: readonly [number, number, number][] = [
    [R, R, 180], [W - R, R, 270], [W - R, D - R, 0], [R, D - R, 90],
  ];
  const points: OutlinePoint[] = [];
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= ARC_STEPS; i++) {
      const rad = ((start + (90 * i) / ARC_STEPS) * Math.PI) / 180;
      const nx = Math.cos(rad);
      const nz = Math.sin(rad);
      points.push({ x: cx + R * nx, z: cz + R * nz, nx, nz });
    }
  }
  return points;
}

/** 볼록 껍질 (monotone chain). 둥근 상자는 볼록해서 몸통 실루엣이 곧 이것이다. */
function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: readonly Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** 조건을 만족하는 점이 이어지는 구간들. 윤곽이 닫혀 있어 끝과 처음을 잇는다. */
function runs<T>(items: readonly T[], keep: (item: T) => boolean): T[][] {
  const n = items.length;
  const startAt = items.findIndex((item) => !keep(item));
  if (startAt === -1) return [[...items, items[0]!]];
  const out: T[][] = [];
  let current: T[] = [];
  for (let k = 1; k <= n; k++) {
    const item = items[(startAt + k) % n]!;
    if (keep(item)) current.push(item);
    else if (current.length > 0) {
      out.push(current);
      current = [];
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * 모서리를 둥글린 네모 파우치. 각진 그림과 같은 눈높이·같은 글자 자리다.
 *
 * 곡면이 있어 면을 셋으로 나눠 칠할 수 없다. 대신 윤곽을 촘촘히 찍어
 * 투영하고, 몸통은 위·아래 윤곽의 볼록 껍질로 칠한다(둥근 상자는 볼록하다).
 * 윤곽에서 보이는 쪽은 바깥 방향이 보는 사람을 향하는 곳이다 — 사선 투영에서는
 * 앞(−z)과 오른쪽(+x)이 보이므로, kx·nx − nz > 0 이면 보인다.
 */
function renderRoundedShapeSvg(dimensions: SquareDimensions, locale: Locale, R: number): string {
  const { widthMm: W, depthMm: D, sideHeightMm: Hs, lidHeightMm: Hl } = dimensions;

  const radians = (DEPTH_ANGLE_DEG * Math.PI) / 180;
  const kx = DEPTH_SCALE * Math.cos(radians);
  const ky = DEPTH_SCALE * Math.sin(radians);
  const dx = D * kx;
  const dy = D * ky;
  const rise = handleRiseMm(W);

  const spanX = W + dx;
  const pad = spanX * PAD_RATIO;
  const topPad = spanX * TOP_PAD_RATIO;
  const font = spanX * FONT_RATIO;
  const stroke = spanX * STROKE_RATIO;
  const rightPad = pad + font * 4;
  const x0 = pad;
  const y0 = topPad + rise + dy;

  const project = (x: number, z: number, down: number): Point => ({ x: x0 + x + z * kx, y: y0 + down - z * ky });
  const outline = roundedOutline(W, D, R);
  const visible = (p: OutlinePoint) => kx * p.nx - p.nz > 1e-9;
  const at = (down: number) => (p: OutlinePoint) => project(p.x, p.z, down);

  const polyline = (cls: string, points: readonly Point[], color: string, width: number, extra = '') =>
    `<polyline class="${cls}" points="${toPoints(points)}" fill="none" stroke="${color}"` +
    ` stroke-width="${round1(width)}" stroke-linejoin="round" stroke-linecap="round"${extra} />`;

  const hull = convexHull([...outline.map(at(0)), ...outline.map(at(Hs))]);
  const body =
    `<polygon class="body" points="${toPoints(hull)}" fill="${SHAPE_FACE_FRONT_FILL}"` +
    ` stroke="${SHAPE_EDGE_COLOR}" stroke-width="${round1(stroke)}" stroke-linejoin="round" />`;
  const top =
    `<polygon class="face-top" points="${toPoints(outline.map(at(0)))}" fill="${SHAPE_FACE_TOP_FILL}"` +
    ` stroke="${SHAPE_EDGE_COLOR}" stroke-width="${round1(stroke)}" stroke-linejoin="round" />`;

  const dash = ` stroke-dasharray="${round1(stroke * 3)} ${round1(stroke * 2.2)}"`;
  const hiddenBottom = runs(outline, (p) => !visible(p))
    .map((run) => polyline('hidden-edge', run.map(at(Hs)), SHAPE_HIDDEN_COLOR, stroke * 0.65, dash))
    .join('');

  // 지퍼: 보이는 쪽은 진하게, 왼쪽으로 돌아가는 쪽은 흐리게. 뒤쪽(경첩)은 긋지 않는다.
  const zw = stroke * 0.9;
  const zipper =
    runs(outline, (p) => !visible(p) && p.nz < 0.5)
      .map((run) => polyline('zipper-hidden', run.map(at(Hl)), ZIPPER_COLOR, zw, ` stroke-opacity="${HIDDEN_SIDE_OPACITY}"`))
      .join('') +
    runs(outline, visible).map((run) => polyline('zipper', run.map(at(Hl)), ZIPPER_COLOR, zw)).join('');

  const leftEnd = project(0, D / 2, 0);
  const rightEnd = project(W, D / 2, 0);
  const control = { x: (leftEnd.x + rightEnd.x) / 2, y: leftEnd.y - 2 * rise };
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
    dimLabel(sideX, y0 - dy + Hl / 2 + font * 0.35, `${round1(Hl)}mm`, 'start') +
    dimLabel(sideX, y0 + Hs - dy / 2 + font * 0.4, `${round1(D)}mm`, 'start');

  const viewWidth = spanX + pad + rightPad;
  const viewHeight = topPad + rise + dy + Hs + pad;
  const label = t(locale, 'square.shape.ariaLabel', round1(W), round1(D), round1(Hs), round1(Hl));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(viewWidth)} ${round1(viewHeight)}"`,
    ` style="width: 100%; max-width: 100%; height: auto;" role="img" aria-label="${escapeXml(label)}">`,
    body,
    hiddenBottom,
    top,
    zipper,
    handle,
    labels,
    `</svg>`,
  ].join('');
}
