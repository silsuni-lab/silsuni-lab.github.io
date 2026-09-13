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

/*
 * 도면 좌표 두 벌. 사각과 원통이 함께 쓴다 — 한쪽에 두고 다른 쪽이
 * 건너다 쓰면 종류 사이에 없어도 될 의존이 생긴다.
 */
export interface Point {
  readonly xMm: number;
  readonly yMm: number;
}

export interface Line {
  readonly x1Mm: number;
  readonly y1Mm: number;
  readonly x2Mm: number;
  readonly y2Mm: number;
}

/**
 * 식서선 길이가 조각 완성 치수에서 차지하는 몫. 사각·원통이 같은 값을 쓴다.
 *
 * 길수록 좋다. 이 선은 읽는 표시가 아니라 자를 대고 원단 셀비지와 맞추는
 * 선이라 짧으면 각도 오차가 커진다. 그래도 양옆으로 12.5%씩은 남겨야
 * 완성선 안쪽에 머문다 — 허용 최소 폭(100+2*10=120mm)에서 15mm가 남아
 * 시접 10mm를 넘긴다. 원에서는 지름보다 짧아야 화살촉이 원주를 넘지 않는다.
 */
export const GRAIN_LENGTH_RATIO = 0.75;

/**
 * 식서선이 조각 아래쪽에 잡아 두는 띠의 높이 (mm). 화살촉 팔과 여백 몫이다.
 *
 * 글자 덩어리를 그리는 쪽은 받은 높이를 꽉 채우도록 배율을 키우므로, 이만큼
 * 빼 주지 않으면 덩어리가 조각 아래끝까지 자라 식서선을 덮는다. 사각의
 * 앞판과 원통의 조각이 같은 값을 쓴다 — 한쪽만 고치면 같은 도구가 종류에
 * 따라 다르게 군다.
 */
export const GRAIN_RESERVE_MM = 12;

/**
 * 원통 조각에서 식서선을 한가운데에서 왼쪽으로 물리는 몫 (완성 치수 대비).
 *
 * 원통 조각은 한가운데가 이미 글자 차지다 — 사각 조각은 위에 조각 이름,
 * 가운데에 출처 덩어리가 오고, 원은 세 줄을 한가운데 쌓는다.
 *
 * 사각 앞판처럼 아래쪽에 띠를 잡아 주는 수는 못 쓴다. 뚜껑은 10mm까지
 * 얇아질 수 있어(ROUND_RANGES.lidHeightMm.min) 12mm를 빼면 글자 자리가
 * 사라진다. 세로로 나눌 자리가 없으니 가로로 비킨다 — 띠 조각은 둘레만큼
 * 길어서 좌우 여백은 늘 넉넉하다.
 *
 * 원에서는 0.25면 현 절반이 0.433D라 0.375D짜리 식서선이 원주 안에 든다.
 */
export const GRAIN_OFFSET_RATIO = 0.25;

/**
 * 원통 띠 조각의 식서선 길이 (완성 폭 대비). 사각보다 짧다.
 *
 * 가운데 글자 덩어리를 비켜 왼쪽 구석에 들어가야 하므로 0.75를 쓰면 덩어리
 * 위로 올라탄다. 0.3이면 왼쪽 끝 5%에서 시작해 35%에서 끝나, 가운데에
 * 앉는 덩어리가 완성 폭의 30%보다 넓지 않는 한 만나지 않는다.
 */
export const GRAIN_BAND_LENGTH_RATIO = 0.3;

/**
 * 띠 조각에서 식서선을 완성선 아래 변에서 띄우는 거리 (mm).
 *
 * 가로로만 비키면 좁은 조각에서 모자란다. 납작 파우치(100/50/20)의 뒷면은
 * 완성 폭이 31mm뿐이라 가운데 정렬한 글자가 조각을 거의 다 덮어, 왼쪽으로
 * 물러난 화살촉이 글자를 파고들었다. 그래서 세로로도 함께 비킨다.
 *
 * 높이 비율이 아니라 고정 거리로 잡는다. 비율로 잡으면 뚜껑이 얇을 때
 * (10mm까지 얇아진다) 아래 여유가 같이 줄어 화살촉이 시접으로 넘어간다.
 * 3mm면 화살촉 반높이 1.5mm가 어떤 치수에서도 완성선 안에 든다.
 */
export const GRAIN_BAND_EDGE_MM = 3;

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
