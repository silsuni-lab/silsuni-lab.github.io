// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/**
 * 파우치 종류. 화면 하나에 하나씩이다.
 *
 * 기록(track.ts)에서 시트의 두 도구를 가르는 값이자, 낡은 화면 되살리기
 * (stale.ts)에서 남의 화면 것을 집어가지 않게 막는 표식이다. 두 곳에 따로
 * 적으면 한쪽만 늘렸을 때 조용히 갈라진다.
 */
export type PouchKind = 'box' | 'round';

/** 시접 (mm). 도안 치수에 이미 포함되므로 사용자가 따로 더하지 않는다. */
export const SEAM_MM = 10;

/** 지퍼가 차지하는 폭 (mm). 윗단 밴드 높이에서 절반씩 빠진다. */
export const ZIPPER_ALLOWANCE_MM = 10;

export type DimensionField = 'widthMm' | 'depthMm' | 'heightMm';

/**
 * 치수를 사람에게 보여주는 순서. 입력칸 배치, 프리셋 표기, 오류 메시지가
 * 모두 이 순서를 따른다. 순서를 바꾸려면 여기만 고친다.
 */
export const DIMENSION_ORDER: readonly DimensionField[] = ['widthMm', 'heightMm', 'depthMm'];

export interface Range {
  readonly min: number;
  readonly max: number;
}

/**
 * 치수 칸 한 벌. 입력칸을 그리고 읽는 쪽(src/ui/form.ts)이 이것만 받으면
 * 사각이든 원통이든 같은 코드로 돈다.
 *
 * 종류마다 칸 이름이 달라(가로/높이/바닥폭 vs 지름/옆면/뚜껑) 필드 타입을
 * 열어 두었다. 화면 코드에 종류별 분기를 두지 않으려는 것이다.
 */
export interface FieldSpec<F extends string> {
  readonly order: readonly F[];
  readonly labels: Readonly<Record<F, string>>;
  readonly ranges: Readonly<Record<F, Range>>;
}

/** 프리셋 한 벌. 치수 칸 이름은 종류를 따른다. */
export type PresetOf<F extends string> = {
  readonly id: string;
  readonly label: string;
} & Readonly<Record<F, number>>;

/**
 * 높이 최소값은 `4 × SEAM_MM`(=40)보다 커야 한다. 앞판 높이가 `H − 2S`이고
 * 거기서 완성선이 위아래로 다시 `S`씩 들어가므로, 40 이하가 되면 완성선이
 * 무너진다. tests/layout.test.ts의 "허용 최소 치수" 테스트가 이를 지킨다.
 */
export const RANGES: Record<DimensionField, Range> = {
  widthMm: { min: 100, max: 400 },
  depthMm: { min: 40, max: 200 },
  heightMm: { min: 50, max: 300 },
};

export const FIELD_LABELS: Record<DimensionField, string> = {
  widthMm: '가로',
  depthMm: '바닥폭',
  heightMm: '높이',
};

export type Preset = PresetOf<DimensionField>;

export const BOX_FIELDS: FieldSpec<DimensionField> = {
  order: DIMENSION_ORDER,
  labels: FIELD_LABELS,
  ranges: RANGES,
};

export const PRESETS: readonly Preset[] = [
  { id: 'pencil', label: '필통', widthMm: 200, heightMm: 50, depthMm: 50 },
  { id: 'sanitary', label: '생리대 파우치', widthMm: 120, heightMm: 70, depthMm: 40 },
  { id: 'cosmetic', label: '화장품 파우치', widthMm: 150, heightMm: 90, depthMm: 50 },
];

/**
 * 이 장수를 넘으면 정말 뽑을지 한 번 묻는다. 사각·원통 두 화면이 같은
 * 값을 쓴다 — 한쪽만 고치면 같은 도구가 종류에 따라 다르게 군다.
 */
export const PAGE_WARN_THRESHOLD = 20;

/** 원통 파우치 프리셋. 작은 것, 도해와 같은 크기, 큰 것으로 잡았다. */
export interface RoundPreset {
  readonly id: string;
  readonly label: string;
  readonly diameterMm: number;
  readonly sideHeightMm: number;
  readonly lidHeightMm: number;
}

export const ROUND_PRESETS: readonly RoundPreset[] = [
  { id: 'coin', label: '동전·이어폰 파우치', diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 },
  { id: 'cotton', label: '화장솜 케이스', diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 },
  { id: 'sewingbox', label: '반짇고리', diameterMm: 160, sideHeightMm: 100, lidHeightMm: 25 },
];
