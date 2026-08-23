// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { SEAM_MM, ZIPPER_ALLOWANCE_MM } from '../constants';
import { BACK_RATIO_DEFAULT, type RoundDimensions } from './dimensions';

/** 조각 사이에 남기는 간격 (mm). 가위가 지나갈 자리다. */
export const PIECE_GAP_MM = 5;

export type RoundPieceId = 'circles' | 'frontTop' | 'frontBottom' | 'back';

export interface RoundPiece {
  readonly id: RoundPieceId;
  readonly label: string;
  /** 이 본으로 몇 장을 재단하는가. 원은 한 장만 그리고 2장이라 적는다. */
  readonly count: number;
  readonly shape: 'rect' | 'circle';
  /** 재단 도형의 왼쪽 위 모서리. 원은 외접 사각형의 왼쪽 위다. */
  readonly xMm: number;
  readonly yMm: number;
  /** 시접을 포함한 재단 치수. */
  readonly widthMm: number;
  readonly heightMm: number;
  /** 시접을 뺀 완성 치수. 박음질선을 그릴 때 쓴다. */
  readonly finishedWidthMm: number;
  readonly finishedHeightMm: number;
}

export interface RoundLayout {
  readonly dimensions: RoundDimensions;
  readonly seamMm: number;
  readonly backRatio: number;
  readonly circumferenceMm: number;
  readonly backLengthMm: number;
  readonly frontLengthMm: number;
  readonly bodyHeightMm: number;
  readonly pieces: readonly RoundPiece[];
  readonly totalWidthMm: number;
  readonly totalHeightMm: number;
}

/**
 * 조각 넷을 계산하고 종이에 앉힌다.
 *
 * 배치는 늘 세 줄이다 — 앞면 윗단, 앞면 아랫단, 그리고 원과 뒷면이 나란히.
 * 빈틈없이 채우는 배치는 일부러 하지 않는다. 종이 몇 장 아끼자고 조각이
 * 매번 다른 자리에 가면 도안을 읽는 사람이 헷갈린다.
 */
export function buildRoundLayout(
  dimensions: RoundDimensions,
  seamMm: number = SEAM_MM,
  backRatio: number = BACK_RATIO_DEFAULT,
): RoundLayout {
  const { diameterMm: D, sideHeightMm: Hs, lidHeightMm: Hl } = dimensions;
  const S = seamMm;

  const circumferenceMm = D * Math.PI;
  const backLengthMm = circumferenceMm * backRatio;
  const frontLengthMm = circumferenceMm - backLengthMm;
  const bodyHeightMm = Hs - Hl - ZIPPER_ALLOWANCE_MM;

  const cut = (finished: number) => finished + 2 * S;

  // 1줄과 2줄은 앞면이 통째로 차지한다. 가장 넓은 조각이라 기준이 된다.
  const frontCutWidth = cut(frontLengthMm);
  const topCutHeight = cut(Hl);
  const bottomCutHeight = cut(bodyHeightMm);
  const circleCut = cut(D);
  const backCutWidth = cut(backLengthMm);
  const backCutHeight = cut(Hs);

  const row3Y = topCutHeight + PIECE_GAP_MM + bottomCutHeight + PIECE_GAP_MM;

  const pieces: readonly RoundPiece[] = [
    {
      id: 'frontTop', label: '앞면 윗단', count: 1, shape: 'rect',
      xMm: 0, yMm: 0,
      widthMm: frontCutWidth, heightMm: topCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: Hl,
    },
    {
      id: 'frontBottom', label: '앞면 아랫단', count: 1, shape: 'rect',
      xMm: 0, yMm: topCutHeight + PIECE_GAP_MM,
      widthMm: frontCutWidth, heightMm: bottomCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: bodyHeightMm,
    },
    {
      id: 'circles', label: '뚜껑·바닥', count: 2, shape: 'circle',
      xMm: 0, yMm: row3Y,
      widthMm: circleCut, heightMm: circleCut,
      finishedWidthMm: D, finishedHeightMm: D,
    },
    {
      id: 'back', label: '뒷면', count: 1, shape: 'rect',
      xMm: circleCut + PIECE_GAP_MM, yMm: row3Y,
      widthMm: backCutWidth, heightMm: backCutHeight,
      finishedWidthMm: backLengthMm, finishedHeightMm: Hs,
    },
  ];

  const totalWidthMm = Math.max(...pieces.map((p) => p.xMm + p.widthMm));
  const totalHeightMm = Math.max(...pieces.map((p) => p.yMm + p.heightMm));

  return {
    dimensions, seamMm: S, backRatio,
    circumferenceMm, backLengthMm, frontLengthMm, bodyHeightMm,
    pieces, totalWidthMm, totalHeightMm,
  };
}

/**
 * 출처 문구를 앉힐 조각. 넓이가 가장 큰 것을 고른다.
 *
 * 사각 파우치는 앞판 한가운데가 늘 가장 넓게 비어 있지만, 원통은 치수에
 * 따라 어느 조각이 가장 큰지 달라질 수 있다.
 */
export function roundTitlePiece(layout: RoundLayout): RoundPiece | undefined {
  return [...layout.pieces].sort(
    (a, b) => b.finishedWidthMm * b.finishedHeightMm - a.finishedWidthMm * a.finishedHeightMm,
  )[0];
}
