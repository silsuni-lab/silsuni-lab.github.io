// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { SEAM_MM, ZIPPER_ALLOWANCE_MM } from '../constants';
import { BACK_RATIO_DEFAULT, type RoundDimensions } from './dimensions';

/** 조각 사이에 남기는 간격 (mm). 가위가 지나갈 자리다. */
export const PIECE_GAP_MM = 5;

export type RoundPieceId = 'circles' | 'frontTop' | 'frontBottom' | 'back';

export interface RoundPiece {
  readonly id: RoundPieceId;
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
      id: 'frontTop', count: 1, shape: 'rect',
      xMm: 0, yMm: 0,
      widthMm: frontCutWidth, heightMm: topCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: Hl,
    },
    {
      id: 'frontBottom', count: 1, shape: 'rect',
      xMm: 0, yMm: topCutHeight + PIECE_GAP_MM,
      widthMm: frontCutWidth, heightMm: bottomCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: bodyHeightMm,
    },
    {
      id: 'circles', count: 2, shape: 'circle',
      xMm: 0, yMm: row3Y,
      widthMm: circleCut, heightMm: circleCut,
      finishedWidthMm: D, finishedHeightMm: D,
    },
    {
      id: 'back', count: 1, shape: 'rect',
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
 * 출처 문구를 앉힐 조각. 가로로 긴 덩어리를 담을 수 있는 사각 조각 중 가장 큰 것을 고른다.
 *
 * 원은 후보에서 제외한다. 이유는 둘이다.
 * 첫째, 설계 문서 4.3이 "가장 큰 조각(앞면 아랫단) 한가운데"라 명시했다.
 * 둘째, 출처 문구는 가로로 긴 문자열이라 원 위에 얹으면 곡선 때문에 글자가
 * 원의 경계를 벗어날 수 있다. 특히 지름이 작을 때 위험하다. 사각만 후보로
 * 두면 이 위험이 완전히 없어진다.
 */
export function roundTitlePiece(
  layout: RoundLayout,
  fit?: { readonly minHeightMm: number; readonly minWidthMm: number },
): RoundPiece | undefined {
  const byArea = [...layout.pieces.filter((p) => p.shape === 'rect')].sort(
    (a, b) => b.finishedWidthMm * b.finishedHeightMm - a.finishedWidthMm * a.finishedHeightMm,
  );
  if (fit === undefined) return byArea[0];
  /*
   * 넓이만 보면 담지도 못할 조각을 고른다. 납작 파우치(100/50/20)가 그랬다 —
   * 앞면 두 단이 251*20으로 가장 넓은데 완성 높이가 20mm뿐이라, 조각 이름
   * 몫을 빼면 9.4mm만 남는다. 덩어리는 23.6mm가 필요해 완성선을 넘고 재단선
   * 위로까지 글자가 나갔다. 같은 도안의 뒷면(63*50)은 여유가 39.4mm다.
   *
   * 그래서 담을 수 있는 것 중에서 가장 넓은 조각을 고른다. 뒷면은 완성
   * 높이가 옆면 높이(최소 40)라 언제나 후보에 든다 — 못 찾는 경우는 없다.
   * 그래도 마지막 줄을 두는 건, 크기 상수가 바뀌어 아무것도 못 담게 되면
   * 문구가 사라지는 것보다 넘치더라도 찍히는 편이 눈에 띄기 때문이다.
   */
  return (
    byArea.find(
      (p) => p.finishedHeightMm >= fit.minHeightMm && p.finishedWidthMm >= fit.minWidthMm,
    ) ?? byArea[0]
  );
}
