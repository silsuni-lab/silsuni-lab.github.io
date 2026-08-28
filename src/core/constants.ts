// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/**
 * 파우치 종류. 화면 하나에 하나씩이다.
 *
 * 기록(track.ts)에서 시트의 두 도구를 가르는 값이자, 낡은 화면 되살리기
 * (stale.ts)에서 남의 화면 것을 집어가지 않게 막는 표식이다.
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
 * 열어 두었다. **라벨은 여기 두지 않는다** — 언어마다 다르므로 카탈로그가
 * 든다. labelPrefix가 `field.<칸 이름>`(사각) 또는 `round.field.<칸 이름>`
 * (원통), presetPrefix가 `preset.<id>` 또는 `round.preset.<id>`를 만든다.
 * 화면 코드에 종류별 분기를 두지 않으려는 것이다.
 */
export interface FieldSpec<F extends string> {
  readonly order: readonly F[];
  readonly ranges: Readonly<Record<F, Range>>;
  readonly labelPrefix: string;
  readonly presetPrefix: string;
}

/** 프리셋 한 벌. 치수 칸 이름은 종류를 따른다. 이름(라벨)은 카탈로그가 든다. */
export type PresetOf<F extends string> = { readonly id: string } & Readonly<Record<F, number>>;

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

/*
 * 프리셋. 이름은 여기 없다 — 언어마다 다르므로 카탈로그가 `preset.<id>`로
 * 든다. id가 그 열쇠다.
 */
/*
 * id를 리터럴 유니온으로 둔다. 카탈로그 키(`preset.<id>`)와 맞물려서,
 * 프리셋을 늘리면 모든 언어에 이름을 넣을 때까지 tsc가 통과시키지 않는다.
 */
export type PresetId = 'pencil' | 'sanitary' | 'cosmetic';

export type Preset = PresetOf<DimensionField>;

export const PRESETS: readonly Preset[] = [
  { id: 'pencil', widthMm: 200, heightMm: 50, depthMm: 50 },
  { id: 'sanitary', widthMm: 120, heightMm: 70, depthMm: 40 },
  { id: 'cosmetic', widthMm: 150, heightMm: 90, depthMm: 50 },
];

export const BOX_FIELDS: FieldSpec<DimensionField> = {
  order: DIMENSION_ORDER,
  ranges: RANGES,
  labelPrefix: 'field',
  presetPrefix: 'preset',
};

/** 원통 파우치 프리셋. 납작한 것, 길쭉한 것, 도해와 같은 크기로 잡았다. */
export interface RoundPreset {
  readonly id: string;
  readonly diameterMm: number;
  readonly sideHeightMm: number;
  readonly lidHeightMm: number;
}

export const ROUND_PRESETS: readonly RoundPreset[] = [
  { id: 'flat', diameterMm: 100, sideHeightMm: 50, lidHeightMm: 20 },
  { id: 'pencase', diameterMm: 80, sideHeightMm: 200, lidHeightMm: 50 },
  { id: 'cosmetic', diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 },
];

/**
 * 이 장수를 넘으면 정말 뽑을지 한 번 묻는다. 사각·원통 두 화면이 같은
 * 값을 쓴다 — 한쪽만 고치면 같은 도구가 종류에 따라 다르게 군다.
 */
export const PAGE_WARN_THRESHOLD = 20;
