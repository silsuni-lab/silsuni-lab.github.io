// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import {
  GRAIN_BAND_EDGE_MM,
  GRAIN_BAND_LENGTH_RATIO,
  GRAIN_LENGTH_RATIO,
  GRAIN_OFFSET_RATIO,
  SEAM_MM,
  ZIPPER_ALLOWANCE_MM,
  type Line,
} from '../constants';
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
  /**
   * 식서방향 (mm). 조각마다 하나씩, 한가운데를 지난다.
   *
   * 띠는 둘레 방향(가로)이다. 사각에서 지퍼와 나란히 잡은 것과 같은 결로,
   * 원통의 지퍼도 둘레를 돈다. 원은 세로다 — 파우치를 세워 둔 모양을
   * 기준 삼아야 결이 있는 원단에서 마개 무늬가 바로 선다.
   */
  readonly grainlineMm: Line;
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

  const bare: readonly Omit<RoundPiece, 'grainlineMm'>[] = [
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

  /*
   * 식서선을 조각마다 얹는다. 한 자리에서 한꺼번에 하는 까닭은, 조각
   * 목록에 하나를 더할 때 식서선만 빠뜨리는 일을 없애기 위해서다.
   *
   * 길이는 완성 치수로 잡는다. 재단 치수로 잡으면 시접 위로 화살촉이
   * 올라가고, 원에서는 원주 밖으로 나간다.
   *
   * 자리는 조각 한가운데를 피한다. 거기엔 이미 글자가 앉는다 — 띠 조각은
   * 위쪽에 조각 이름, 가운데에 출처 덩어리가 오고, 원은 세 줄을 한가운데
   * 쌓는다. 가운데를 지나가면 식서선도 글자도 둘 다 못 읽는다.
   *
   * 비키는 방향은 사각과 다르다. 사각 앞판은 아래쪽에 띠를 잡아 글자 쪽
   * 자리를 줄이지만, 원통은 뚜껑이 10mm까지 얇아질 수 있어 그 수를 못 쓴다.
   * 자리를 줄이는 대신 글자를 비켜 간다.
   *
   * 띠는 가로·세로 두 방향으로 함께 물러난다. 한 방향만으로는 모자라다 —
   * 넓고 낮은 띠(앞면 윗단 251*20)는 가로가 살리지만, 좁고 높은 띠
   * (뒷면 31*50)는 가로로 물러나 봐야 가운데 라벨에 부딪힌다. 그쪽은
   * 세로가 살린다. 원은 세로선이라 가로로만 물러난다.
   *
   * 방향이 곧 뜻이므로 방향만은 어떤 경우에도 안 바꾼다.
   */
  const pieces: readonly RoundPiece[] = bare.map((piece) => {
    const cxMm = piece.xMm + piece.widthMm / 2;
    const cyMm = piece.yMm + piece.heightMm / 2;

    const offsetMm = piece.finishedWidthMm * GRAIN_OFFSET_RATIO;

    if (piece.shape === 'circle') {
      const halfMm = (piece.finishedHeightMm * GRAIN_LENGTH_RATIO) / 2;
      const xMm = cxMm - offsetMm;
      return { ...piece, grainlineMm: { x1Mm: xMm, y1Mm: cyMm - halfMm, x2Mm: xMm, y2Mm: cyMm + halfMm } };
    }

    const halfMm = (piece.finishedWidthMm * GRAIN_BAND_LENGTH_RATIO) / 2;
    const xMm = cxMm - offsetMm;
    // 완성선 아래 변에서 조금만 띄운다. 글자는 위쪽과 가운데를 쓴다.
    const yMm = piece.yMm + piece.heightMm - S - GRAIN_BAND_EDGE_MM;
    return { ...piece, grainlineMm: { x1Mm: xMm - halfMm, y1Mm: yMm, x2Mm: xMm + halfMm, y2Mm: yMm } };
  });

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
  fit?: {
    /** 덩어리가 배율 1로 차지하는 크기. */
    readonly blockHeightMm: number;
    readonly blockWidthMm: number;
    /** 조각 위쪽에서 조각 이름 몫으로 비워 두는 높이. */
    readonly reservedTopMm: number;
    /** 덩어리와 조각 경계 사이에 남길 여백. */
    readonly marginMm: number;
  },
): RoundPiece | undefined {
  const byArea = [...layout.pieces.filter((p) => p.shape === 'rect')].sort(
    (a, b) => b.finishedWidthMm * b.finishedHeightMm - a.finishedWidthMm * a.finishedHeightMm,
  );
  if (fit === undefined) return byArea[0];

  /*
   * 넓이만 보면 담지도 못할 조각을 고른다. 납작 파우치(100/50/20)가 그랬다 —
   * 앞면 두 단이 251*20으로 가장 넓은데 완성 높이가 20mm뿐이라, 조각 이름
   * 몫을 빼면 9.4mm만 남는다. 덩어리는 23.6mm가 필요해 완성선을 넘고 재단선
   * 위로까지 글자가 나갔다.
   *
   * 세로만 봐도 모자란다. 세로가 넉넉하고 가로가 좁은 조각에서는 배율이
   * 커져 이번엔 옆으로 넘친다. 두 방향을 함께 본다.
   */
  const roomRatio = (p: RoundPiece) =>
    Math.min(
      (p.finishedHeightMm - fit.reservedTopMm - 2 * fit.marginMm) / fit.blockHeightMm,
      (p.finishedWidthMm - 2 * fit.marginMm) / fit.blockWidthMm,
    );

  const roomy = byArea.filter((p) => roomRatio(p) >= 1);
  if (roomy.length > 0) return roomy[0];

  /*
   * 하나도 못 담는 경우가 있다. 납작 파우치에 뒷면 10%를 고르면 앞면 두 단은
   * 너무 낮고(20mm) 뒷면은 너무 좁다(31mm). 그때는 가장 덜 모자란 조각을
   * 고르고, 덩어리 쪽에서 배율을 1 아래로 내려 맞춘다(TITLE_SCALE_MIN).
   * 넓이로 고르면 세로가 9.4mm뿐인 조각이 뽑혀 훨씬 크게 넘친다.
   */
  return [...byArea].sort((a, b) => roomRatio(b) - roomRatio(a))[0];
}
