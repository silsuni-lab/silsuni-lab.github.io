// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 이 도구가 쓰는 색 전부. 화면(SVG)과 인쇄(PDF)가 여기서만 꺼내 쓴다.
 *
 * 예전에는 화면 색이 preview.ts에, 인쇄 색이 pdf.ts에 따로 있었다. 화면
 * 팔레트를 대비 기준에 맞춰 올리면서 인쇄 쪽을 안 고쳐, 같은 선인데 색이
 * 달라졌다. 한쪽만 고쳐도 아무도 못 잡는 자리였다.
 *
 * pdf-lib을 부르지 않는다. 첫 화면에 바로 뜨는 preview.ts가 이 파일을
 * 부르므로, 여기서 rgb를 끌어오면 PDF 생성기 1.1MB가 첫 화면 조각으로
 * 딸려 온다. 오류는 안 나고 첫 화면만 느려져서 알아채기 어렵다. 0~1
 * 실수로 바꾸는 일은 hexToRgb01이 하고, pdf-lib의 rgb로 감싸는 일은
 * pdf.ts가 한다.
 *
 * 값을 바꿀 때는 대비를 다시 잴 것. tests/svg-contrast.test.ts가 화면
 * 기준(선 3:1, 글자 4.5:1)을 지킨다.
 */

/* ─── 화면과 인쇄가 함께 쓰는 색 ─────────────────────────────────── */

/** 재단선. 이 선대로 자른다. 도면에서 가장 진해야 한다. */
export const CUT_COLOR = '#000000';

/** 완성선. 재단선에서 시접만큼 안쪽, 여기를 박는다. */
export const SEAM_COLOR = '#4c4c4c';

/** 세로 중앙선. 제도에서 중심선에 쓰는 일점쇄선으로 긋는다. */
export const CENTER_COLOR = '#8a8175';

/**
 * 골선. 원단 접은 자리에 놓는 선이다. 재단선으로 오인해 잘라 버리면 도안이
 * 반쪽이 되므로 재단선과 확실히 갈라 놓는다.
 */
export const FOLD_EDGE_COLOR = '#b42318';

/**
 * 도안에 찍는 세 줄 — 이름·권유·계정.
 *
 * 셋이 한 덩어리라 색은 하나로 두고, 위계는 크기와 투명도가 만든다.
 * 진하기를 반으로 낮추는 쪽(WATERMARK_OPACITY)이 물러나 보이는 일을 맡으므로
 * 색까지 옅게 잡으면 안 된다 — 옅은 잉크로 뽑을 때 종이에서 사라진다.
 */
export const PATTERN_TITLE_COLOR = '#333333';

/* ─── 전개도 미리보기 (화면 전용) ────────────────────────────────── */

/**
 * 인쇄 페이지 경계와 칸 번호. 화면 요약줄(--info)과 같은 청록 계열이라
 * "페이지"라는 개념이 한 색으로 묶인다. 회색으로 두면 다른 선과 헷갈린다.
 * 배경(--tint-pattern) 위에서 4.99:1 — 선(3:1)과 글자(4.5:1) 기준을 넘는다.
 */
export const TILE_COLOR = '#2a7387';

/** 도안 안쪽 채움. 인쇄는 면을 칠하지 않으므로 화면에만 있다. */
export const PATTERN_FILL = '#fffdf5';

/** 재단선과 완성선 사이(=시접)를 칠하는 색. */
export const SEAM_BAND_FILL = '#fce7f0';

/** 밴드 이름(지퍼단·앞판·바닥…). PDF는 밴드 이름을 그리지 않는다. */
export const BAND_LABEL_COLOR = '#333333';

/** 전개도 전체 치수 라벨. */
export const DIM_LABEL_COLOR = '#555555';

/* ─── 완성 예상 선화 (화면 전용) ─────────────────────────────────── */

/*
 * 도안이 아니라 완성된 파우치를 그린다. 자르는 선이 아니므로 윤곽선에
 * 재단선과 같은 검정을 쓰지 않는다. 값이 비슷하다고 묶으면 개념이 뭉개진다.
 */

/** 보이는 모서리. */
export const SHAPE_EDGE_COLOR = '#222222';

/** 가려진 왼쪽 옆면의 모서리. */
export const SHAPE_HIDDEN_COLOR = '#858585';

/** 치수 라벨. */
export const SHAPE_DIM_COLOR = '#555555';

export const SHAPE_FACE_FRONT_FILL = '#fffdf5';
export const SHAPE_FACE_TOP_FILL = '#f7f4ea';
export const SHAPE_FACE_SIDE_FILL = '#efeade';

/** 지퍼. style.css의 --danger와 같은 빨강이다. */
export const ZIPPER_COLOR = '#b42318';

/* ─── 인쇄 전용 ──────────────────────────────────────────────────── */

/** 접힘선. 접어서 옆면·바닥을 만든다. 미리보기는 이 선을 그리지 않는다. */
export const FOLD_COLOR = '#8c8c8c';

/**
 * 조립 표시 — 맞춤표·칸 번호·이어붙임 점선. 도안 선이 아니라는 걸
 * 색과 점선 간격으로 함께 가른다.
 */
export const MARK_COLOR = '#333333';

/** 축척 확인용 네모(30mm·1인치)와 도안 장 아래쪽 강조 문구. */
export const SCALE_COLOR = '#d91a1a';

/** 이어 붙일 때 포개는 맞춤 마름모. 도안 선과 섞이지 않도록 빨강을 쓴다. */
export const JOIN_DIAMOND_COLOR = '#d91a1a';

/* ─── 변환 ───────────────────────────────────────────────────────── */

const HEX_PATTERN = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export interface Rgb01 {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * hex를 0~1 실수 셋으로 바꾼다. `#abc`와 `#aabbcc`를 모두 받는다.
 *
 * hex가 아니면 던진다. 조용히 검정을 돌려주면 색 하나가 사라진 걸 아무도
 * 모른 채 도면이 나간다.
 */
export function hexToRgb01(hex: string): Rgb01 {
  if (!HEX_PATTERN.test(hex)) throw new Error(`hex가 아닙니다: ${hex}`);

  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const channel = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;

  return { r: channel(0), g: channel(2), b: channel(4) };
}
