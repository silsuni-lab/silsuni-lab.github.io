// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { FILE_NAME_CREDIT, SEAM_MM, type FieldSpec, type Range } from '../constants';
import { t } from '../i18n/messages';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
/*
 * 원통과 뜻이 똑같은 것은 가져다 쓴다 — 뒷면 비율의 범위와 기본값, 뚜껑
 * 상한의 두 겹 규칙. 원통 파일은 silbap으로 넘긴 원본이라 고치지 않고
 * import만 한다.
 */
import { BACK_RATIO_DEFAULT, BACK_RATIO_MAX, BACK_RATIO_MIN, lidHeightMaxMm } from '../round/dimensions';

export { BACK_RATIO_DEFAULT };

export type SquareField = 'widthMm' | 'depthMm' | 'sideHeightMm' | 'lidHeightMm';

export interface SquareDimensions {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly sideHeightMm: number;
  readonly lidHeightMm: number;
}

/** 입력칸 배치와 오류 문구가 모두 이 순서를 따른다. */
export const SQUARE_FIELD_ORDER: readonly SquareField[] = ['widthMm', 'depthMm', 'sideHeightMm', 'lidHeightMm'];

/*
 * 가로 하한 100은 손잡이 때문이다. 손잡이 길이가 가로의 1.3배라 그보다 작으면
 * 손이 안 들어간다. 폭 하한 50은 모서리를 돌려 박을 자리가 남는 값이다.
 * 옆면·뚜껑은 원통과 같다 — 뚜껑 최소 10 + 지퍼 10 + 몸통 최소 20 = 40.
 *
 * 폭에는 범위 말고 조건이 하나 더 있다 — 가로를 넘지 않는다. 검사 참고.
 */
export const SQUARE_RANGES: Record<SquareField, Range> = {
  widthMm: { min: 100, max: 300 },
  depthMm: { min: 50, max: 200 },
  sideHeightMm: { min: 40, max: 300 },
  lidHeightMm: { min: 10, max: 150 },
};

/** 입력칸을 그리고 읽는 쪽에 넘길 한 벌. 원통의 ROUND_FIELDS와 짝이다. */
export const SQUARE_FIELDS: FieldSpec<SquareField> = {
  order: SQUARE_FIELD_ORDER,
  ranges: SQUARE_RANGES,
  labelPrefix: 'square.field',
  presetPrefix: 'square.preset',
};

const RATIO_STEPS = [10, 15, 20, 25, 30] as const;

type Plan = Pick<SquareDimensions, 'widthMm' | 'depthMm'>;

/**
 * 뚜껑·바닥 모서리를 둥글릴 반지름 (완성선 기준, mm). 0이면 각지다.
 *
 * 자유 입력이 아니라 넷 중에 고른다. 뒷면 비율처럼 뜻이 좁은 값이라,
 * 고를 수 있는 것만 보여 주면 틀린 값을 칠 자리가 없다.
 */
export const CORNER_RADIUS_CHOICES = [0, 10, 20, 30] as const;

/**
 * 반지름 상한은 폭의 1/4이다. 폭 쪽 곧은 부분이 폭의 절반은 남아야 옆면이
 * 면으로 선다. 폭 50이면 10까지, 80부터 20, 120부터 30이 된다.
 */
export function squareCornerAllowed(d: Pick<SquareDimensions, 'depthMm'>, radiusMm: number): boolean {
  return radiusMm <= d.depthMm / 4;
}

/** 모서리 선택지. 치수를 주면 그 폭에서 안 되는 것에 disabled를 단다. */
export function squareCornerChoices(
  locale: Locale,
  d?: Pick<SquareDimensions, 'depthMm'>,
): readonly { readonly value: number; readonly label: string; readonly disabled: boolean }[] {
  return CORNER_RADIUS_CHOICES.map((value) => ({
    value,
    label: value === 0 ? t(locale, 'square.corner.none') : t(locale, 'square.corner.round', value),
    disabled: d !== undefined && !squareCornerAllowed(d, value),
  }));
}

/** 고른 반지름이 새 폭에서 안 되면 되는 것 중 가장 큰 값으로 내린다. */
export function squareCornerFallback(d: Pick<SquareDimensions, 'depthMm'>, radiusMm: number): number {
  if (squareCornerAllowed(d, radiusMm)) return radiusMm;
  const allowed = CORNER_RADIUS_CHOICES.filter((r) => squareCornerAllowed(d, r));
  return allowed[allowed.length - 1] ?? 0;
}

/**
 * 둘레. 지퍼와 경첩이 이것을 나눠 갖는다.
 *
 * 모서리를 둥글리면 직각 두 변(2R) 대신 1/4 원호(πR/2)가 들어가, 모서리
 * 하나에 (2 − π/2)R씩 줄어든다. 넷이면 (8 − 2π)R. 앞면 띠가 이만큼 짧아져야
 * 뚜껑 둘레와 맞는다.
 */
export function squarePerimeterMm(d: Plan, cornerRadiusMm = 0): number {
  return 2 * (d.widthMm + d.depthMm) - (8 - 2 * Math.PI) * cornerRadiusMm;
}

/** 뒷면(경첩) 길이. 원통처럼 둘레에 대한 비율로 받는다. */
export function squareBackLengthMm(d: Plan, ratio: number, cornerRadiusMm = 0): number {
  return squarePerimeterMm(d, cornerRadiusMm) * ratio;
}

/** 뒷변에서 경첩이 놓일 수 있는 곧은 부분. 양 끝 모서리 호를 뺀 길이다. */
export function squareBackStraightMm(d: Pick<SquareDimensions, 'widthMm'>, cornerRadiusMm = 0): number {
  return d.widthMm - 2 * cornerRadiusMm;
}

/**
 * 이 비율을 쓸 수 있는가. 경첩은 뒷면 안에 있어야 한다 — 가로보다 길어지면
 * 경첩이 옆 모서리를 돌아 뚜껑이 비틀려 열린다.
 *
 * 각진 모서리에서는 가로 ≥ 폭이면 둘레가 가로의 네 배를 넘지 않으므로 25%까지는
 * 늘 된다. 잠길 수 있는 것은 30%뿐이고, 폭이 가로의 2/3를 넘을 때다. 모서리를
 * 둥글리면 곧은 부분이 2R만큼 줄어 25%도 잠길 수 있다.
 *
 * 부동소수 오차로 딱 맞는 경우(가로 = 뒷면)가 떨어지지 않게 0.001mm 봐준다.
 */
export function squareBackRatioAllowed(d: Plan, ratio: number, cornerRadiusMm = 0): boolean {
  // 모서리를 둥글리면 경첩은 뒷변의 곧은 부분 안에만 들어간다 — 호 위에 걸치면 뚜껑이 비틀린다.
  return squareBackLengthMm(d, ratio, cornerRadiusMm) <= squareBackStraightMm(d, cornerRadiusMm) + 1e-3;
}

/**
 * 화면에서 고를 수 있는 뒷면 비율. 라벨은 원통 것을 그대로 쓴다 — 뜻이 같다.
 * 치수를 주면 그 치수에서 안 되는 것에 disabled를 단다.
 */
export function squareBackRatioChoices(
  locale: Locale,
  d?: Plan,
  cornerRadiusMm = 0,
): readonly { readonly value: number; readonly label: string; readonly disabled: boolean }[] {
  return RATIO_STEPS.map((pct) => {
    const value = pct / 100;
    return {
      value,
      label: t(locale, `round.backRatio.${pct}` as never),
      disabled: d !== undefined && !squareBackRatioAllowed(d, value, cornerRadiusMm),
    };
  });
}

/**
 * 고른 비율이 새 치수에서 안 되면 되는 것 중 가장 큰 값으로 내린다.
 * 폭을 키우다 30%가 잠겼을 때, 경첩을 넓게 쓰려던 뜻에 가장 가까운 값이다.
 */
export function squareBackRatioFallback(d: Plan, ratio: number, cornerRadiusMm = 0): number {
  if (squareBackRatioAllowed(d, ratio, cornerRadiusMm)) return ratio;
  const allowed = RATIO_STEPS.map((pct) => pct / 100).filter((r) => squareBackRatioAllowed(d, r, cornerRadiusMm));
  return allowed[allowed.length - 1] ?? BACK_RATIO_MIN;
}

export interface SquareFieldError {
  readonly field: SquareField | 'backRatio' | 'cornerRadius';
  readonly message: string;
}

export type SquareValidationResult =
  | { readonly ok: true; readonly value: SquareDimensions }
  | { readonly ok: false; readonly errors: readonly SquareFieldError[] };

export function validateSquareDimensions(
  input: Record<SquareField, unknown>,
  backRatio: number = BACK_RATIO_DEFAULT,
  locale: Locale = DEFAULT_LOCALE,
  cornerRadiusMm = 0,
): SquareValidationResult {
  const errors: SquareFieldError[] = [];
  const values: Partial<Record<SquareField, number>> = {};

  for (const field of SQUARE_FIELD_ORDER) {
    const raw = input[field];
    const { min, max } = SQUARE_RANGES[field];
    const label = t(locale, `${SQUARE_FIELDS.labelPrefix}.${field}` as never);
    const num = typeof raw === 'number' ? raw : Number(raw);

    // 오류 문구는 원통 것을 쓴다. 칸 이름만 다르고 말은 같다.
    if (raw === '' || raw === null || raw === undefined || !Number.isFinite(num)) {
      errors.push({ field, message: t(locale, 'round.error.notNumber', label) });
      continue;
    }
    if (!Number.isInteger(num)) {
      errors.push({ field, message: t(locale, 'round.error.notInteger', label) });
      continue;
    }
    if (num < min || num > max) {
      errors.push({ field, message: t(locale, 'round.error.outOfRange', label, min, max) });
      continue;
    }
    values[field] = num;
  }

  const { widthMm, depthMm, sideHeightMm, lidHeightMm } = values;

  // 아래 셋은 값 하나로는 못 잡는다. 두 칸이 모두 살아 있을 때만 본다.
  if (widthMm !== undefined && depthMm !== undefined && depthMm > widthMm) {
    errors.push({ field: 'depthMm', message: t(locale, 'square.error.depth', widthMm) });
  }
  if (sideHeightMm !== undefined && lidHeightMm !== undefined) {
    const cap = lidHeightMaxMm(sideHeightMm);
    if (lidHeightMm > cap) {
      errors.push({ field: 'lidHeightMm', message: t(locale, 'round.error.lidHeight', sideHeightMm, cap) });
    }
  }
  if (depthMm !== undefined && !squareCornerAllowed({ depthMm }, cornerRadiusMm)) {
    errors.push({ field: 'cornerRadius', message: t(locale, 'square.error.corner', cornerRadiusMm, depthMm) });
  }
  if (backRatio < BACK_RATIO_MIN || backRatio > BACK_RATIO_MAX) {
    errors.push({
      field: 'backRatio',
      message: t(locale, 'round.error.backRatio', BACK_RATIO_MIN * 100, BACK_RATIO_MAX * 100),
    });
  } else if (
    widthMm !== undefined && depthMm !== undefined && depthMm <= widthMm &&
    squareCornerAllowed({ depthMm }, cornerRadiusMm) &&
    !squareBackRatioAllowed({ widthMm, depthMm }, backRatio, cornerRadiusMm)
  ) {
    errors.push({
      field: 'backRatio',
      message: t(
        locale, 'square.error.backRatio',
        Math.round(backRatio * 100), squareBackStraightMm({ widthMm }, cornerRadiusMm),
      ),
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  if (widthMm === undefined || depthMm === undefined || sideHeightMm === undefined || lidHeightMm === undefined) {
    throw new Error('치수 검사를 통과했는데 값이 비어 있습니다.');
  }
  return { ok: true, value: { widthMm, depthMm, sideHeightMm, lidHeightMm } };
}

/**
 * 도안에 찍을 이름. 원통처럼 전체 치수는 붙이지 않는다 — 조각마다 그 조각의
 * 완성 치수가 따로 찍힌다. 시접 없이 뽑았으면 그렇다고 못 박는다.
 */
export function squarePatternTitle(
  seamMm: number = SEAM_MM,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const base = t(locale, 'square.pattern.name');
  return seamMm === 0 ? `${base} ${t(locale, 'round.pattern.noSeam')}` : base;
}

/**
 * 내려받는 PDF의 파일 이름. 사각(box-pouch-)·원통(round-pouch-)과 겹치지 않게 한다.
 * 모서리를 둥글렸으면 `-r20`처럼 붙인다 — 같은 치수라도 띠 길이가 달라 섞이면 안 맞는다.
 */
export function squarePatternFileName(
  d: SquareDimensions,
  paper: string,
  seamMm: number = SEAM_MM,
  cornerRadiusMm = 0,
): string {
  const seam = seamMm === 0 ? '-noseam' : '';
  const corner = cornerRadiusMm > 0 ? `-r${cornerRadiusMm}` : '';
  return `${FILE_NAME_CREDIT}-square-pouch-${d.widthMm}x${d.depthMm}x${d.sideHeightMm}x${d.lidHeightMm}${corner}-${paper}${seam}.pdf`;
}
