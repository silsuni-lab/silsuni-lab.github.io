// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import {
  GRAIN_BAND_EDGE_MM,
  GRAIN_BAND_LENGTH_RATIO,
  GRAIN_OFFSET_RATIO,
  SEAM_MM,
  ZIPPER_ALLOWANCE_MM,
  type Line,
} from '../constants';
// 조각 간격과 너치 길이는 원통과 같은 값이어야 한다. 같은 손으로 자르고 박는다.
import { notchLengthMm, PIECE_GAP_MM } from '../round/layout';
import { BACK_RATIO_DEFAULT, squareBackLengthMm, squarePerimeterMm, type SquareDimensions } from './dimensions';

/** 손잡이 완성 폭 (mm). 반으로 접어 박으므로 펼친 조각은 두 배다. */
export const HANDLE_WIDTH_MM = 25;

/**
 * 손잡이 길이 = 가로 × 이 값. 양 끝이 뚜껑 좌우 변 한가운데에 박히므로
 * 가로와 같으면 뚜껑에 딱 붙어 손이 안 들어간다. 1.3배면 가로 100에서도
 * 뚜껑 위로 손가락 네 개가 들어갈 만큼 뜬다.
 */
export const HANDLE_LENGTH_RATIO = 1.3;

export type SquarePieceId = 'frontTop' | 'frontBottom' | 'panels' | 'back' | 'handle';

export interface SquarePiece {
  readonly id: SquarePieceId;
  /** 이 본으로 몇 장을 재단하는가. 뚜껑·바닥은 한 장만 그리고 2장이라 적는다. */
  readonly count: number;
  /** 재단 사각형의 왼쪽 위 모서리. */
  readonly xMm: number;
  readonly yMm: number;
  /** 시접을 포함한 재단 치수. */
  readonly widthMm: number;
  readonly heightMm: number;
  /** 시접을 뺀 완성 치수. */
  readonly finishedWidthMm: number;
  readonly finishedHeightMm: number;
  /** 식서방향. 모든 조각이 가로다 — 띠는 지퍼와 나란히, 뚜껑·바닥은 가로 방향. */
  readonly grainlineMm: Line;
  /** 너치. 선의 1은 재단선 위, 2는 안쪽 끝이다. */
  readonly notchesMm: readonly Line[];
  /** 접힘선. 손잡이에만 하나 있다. */
  readonly foldLinesMm: readonly Line[];
}

export interface SquareLayout {
  readonly dimensions: SquareDimensions;
  readonly seamMm: number;
  readonly backRatio: number;
  readonly perimeterMm: number;
  readonly backLengthMm: number;
  readonly frontLengthMm: number;
  readonly bodyHeightMm: number;
  readonly handleLengthMm: number;
  readonly pieces: readonly SquarePiece[];
  readonly totalWidthMm: number;
  readonly totalHeightMm: number;
}

/** 이보다 가까우면 너치가 완성선 끝(조각 모서리)과 같은 자리로 본다. */
const SAME_SPOT_MM = 0.5;

/**
 * 조각 다섯을 계산하고 종이에 앉힌다.
 *
 * 배치는 원통처럼 늘 세 줄이다 — 앞면 윗단, 앞면 아랫단, 그리고 뚜껑·바닥,
 * 뒷면, 손잡이가 나란히. 줄 순서가 늘 같아야 도안을 읽는 사람이 안 헷갈린다.
 */
export function buildSquareLayout(
  dimensions: SquareDimensions,
  seamMm: number = SEAM_MM,
  backRatio: number = BACK_RATIO_DEFAULT,
): SquareLayout {
  const { widthMm: W, depthMm: D, sideHeightMm: Hs, lidHeightMm: Hl } = dimensions;
  const S = seamMm;

  const perimeterMm = squarePerimeterMm(dimensions);
  const backLengthMm = squareBackLengthMm(dimensions, backRatio);
  const frontLengthMm = perimeterMm - backLengthMm;
  const bodyHeightMm = Hs - Hl - ZIPPER_ALLOWANCE_MM;
  const handleLengthMm = Math.round(W * HANDLE_LENGTH_RATIO);
  const handleFlatMm = 2 * HANDLE_WIDTH_MM;

  const cut = (finished: number) => finished + 2 * S;

  const topCutHeight = cut(Hl);
  const bottomCutHeight = cut(bodyHeightMm);
  const row3Y = topCutHeight + PIECE_GAP_MM + bottomCutHeight + PIECE_GAP_MM;
  const backX = cut(W) + PIECE_GAP_MM;
  const handleX = backX + cut(backLengthMm) + PIECE_GAP_MM;

  const bare: readonly Omit<SquarePiece, 'grainlineMm' | 'notchesMm' | 'foldLinesMm'>[] = [
    {
      id: 'frontTop', count: 1, xMm: 0, yMm: 0,
      widthMm: cut(frontLengthMm), heightMm: topCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: Hl,
    },
    {
      id: 'frontBottom', count: 1, xMm: 0, yMm: topCutHeight + PIECE_GAP_MM,
      widthMm: cut(frontLengthMm), heightMm: bottomCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: bodyHeightMm,
    },
    {
      id: 'panels', count: 2, xMm: 0, yMm: row3Y,
      widthMm: cut(W), heightMm: cut(D),
      finishedWidthMm: W, finishedHeightMm: D,
    },
    {
      id: 'back', count: 1, xMm: backX, yMm: row3Y,
      widthMm: cut(backLengthMm), heightMm: cut(Hs),
      finishedWidthMm: backLengthMm, finishedHeightMm: Hs,
    },
    {
      id: 'handle', count: 1, xMm: handleX, yMm: row3Y,
      widthMm: cut(handleLengthMm), heightMm: cut(handleFlatMm),
      finishedWidthMm: handleLengthMm, finishedHeightMm: handleFlatMm,
    },
  ];

  /*
   * 너치 자리. 앞면 띠는 경첩 끝에서 시작해 뒤 모서리 → 옆 → 앞 모서리 →
   * 앞 → 앞 모서리 → 옆 → 뒤 모서리 → 경첩 끝으로 돈다. 띠 끝에서 뒤 모서리까지가
   * a = (W − Lb)/2이고, 네 모서리가 a, a+D, a+D+W, a+2D+W에 온다.
   *
   * 경첩이 뒷면을 꽉 채우면(a = 0) 첫·끝 모서리가 곧 조각 끝이다. 그 자리에
   * 너치를 넣으면 재단 모서리를 한 번 더 자르는 것일 뿐이라 뺀다.
   */
  const a = (W - backLengthMm) / 2;
  const onEdge = (x: number, length: number) => x > SAME_SPOT_MM && x < length - SAME_SPOT_MM;
  const bandCorners = [a, a + D, a + D + W, a + 2 * D + W].filter((x) => onEdge(x, frontLengthMm));
  const hingeEnds = [a, a + backLengthMm].filter((x) => onEdge(x, W));

  const notchMm = notchLengthMm(S);
  const vertical = (xMm: number, edgeYMm: number, dir: 1 | -1): Line =>
    ({ x1Mm: xMm, y1Mm: edgeYMm, x2Mm: xMm, y2Mm: edgeYMm + dir * notchMm });

  const pieces: readonly SquarePiece[] = bare.map((piece) => {
    const left = piece.xMm + S;
    const bottom = piece.yMm + piece.heightMm;

    /*
     * 식서선은 원통 띠와 같은 자리다 — 아래 완성선에서 조금 띄우고, 가운데
     * 라벨을 비켜 왼쪽으로 물러난다. 모든 조각이 가로다.
     */
    const halfMm = (piece.finishedWidthMm * GRAIN_BAND_LENGTH_RATIO) / 2;
    const gx = piece.xMm + piece.widthMm / 2 - piece.finishedWidthMm * GRAIN_OFFSET_RATIO;
    const gy = bottom - S - GRAIN_BAND_EDGE_MM;
    const grainlineMm = { x1Mm: gx - halfMm, y1Mm: gy, x2Mm: gx + halfMm, y2Mm: gy };

    let notchesMm: Line[] = [];
    let foldLinesMm: Line[] = [];
    switch (piece.id) {
      case 'frontTop':
        // 위 변이 뚜껑과 박힌다. 아래 변은 지퍼다.
        notchesMm = bandCorners.map((x) => vertical(left + x, piece.yMm, 1));
        break;
      case 'frontBottom':
        // 아래 변이 바닥과 박힌다. 위 변은 지퍼다.
        notchesMm = bandCorners.map((x) => vertical(left + x, bottom, -1));
        break;
      case 'panels': {
        /*
         * 위 변이 뒷변이다 — 경첩 양 끝. 좌우 변 한가운데는 손잡이 끝을 끼울
         * 자리다. 한 본으로 뚜껑과 바닥을 함께 뜨므로 바닥에서는 이 둘을 무시한다.
         */
        const midY = piece.yMm + S + D / 2;
        notchesMm = [
          ...hingeEnds.map((x) => vertical(left + x, piece.yMm, 1)),
          { x1Mm: piece.xMm, y1Mm: midY, x2Mm: piece.xMm + notchMm, y2Mm: midY },
          { x1Mm: piece.xMm + piece.widthMm, y1Mm: midY, x2Mm: piece.xMm + piece.widthMm - notchMm, y2Mm: midY },
        ];
        break;
      }
      case 'handle': {
        // 길이 방향으로 반 접어 박고 뒤집는다. 접는 자리는 완성 높이 한가운데.
        const foldY = piece.yMm + S + HANDLE_WIDTH_MM;
        foldLinesMm = [{ x1Mm: left, y1Mm: foldY, x2Mm: left + handleLengthMm, y2Mm: foldY }];
        break;
      }
      case 'back':
        break;
    }
    return { ...piece, grainlineMm, notchesMm, foldLinesMm };
  });

  const totalWidthMm = Math.max(...pieces.map((p) => p.xMm + p.widthMm));
  const totalHeightMm = Math.max(...pieces.map((p) => p.yMm + p.heightMm));

  return {
    dimensions, seamMm: S, backRatio,
    perimeterMm, backLengthMm, frontLengthMm, bodyHeightMm, handleLengthMm,
    pieces, totalWidthMm, totalHeightMm,
  };
}

/**
 * 출처 덩어리를 앉힐 조각. 원통의 roundTitlePiece와 같은 규칙이다 — 담을 수
 * 있는 것 중 가장 넓은 조각, 하나도 못 담으면 가장 덜 모자란 조각.
 *
 * 손잡이는 후보에서 뺀다. 한가운데로 접힘선이 지나가 덩어리가 반으로 갈린다.
 */
export function squareTitlePiece(
  layout: SquareLayout,
  fit?: {
    readonly blockHeightMm: number;
    readonly blockWidthMm: number;
    readonly reservedTopMm: number;
    readonly marginMm: number;
  },
): SquarePiece | undefined {
  const byArea = layout.pieces
    .filter((p) => p.id !== 'handle')
    .sort((a, b) => b.finishedWidthMm * b.finishedHeightMm - a.finishedWidthMm * a.finishedHeightMm);
  if (fit === undefined) return byArea[0];

  const roomRatio = (p: SquarePiece) =>
    Math.min(
      (p.finishedHeightMm - fit.reservedTopMm - 2 * fit.marginMm) / fit.blockHeightMm,
      (p.finishedWidthMm - 2 * fit.marginMm) / fit.blockWidthMm,
    );

  const roomy = byArea.filter((p) => roomRatio(p) >= 1);
  if (roomy.length > 0) return roomy[0];
  return [...byArea].sort((a, b) => roomRatio(b) - roomRatio(a))[0];
}
