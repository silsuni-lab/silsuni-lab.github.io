// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { SEAM_MM, ZIPPER_ALLOWANCE_MM, type Range } from '../constants';
import { withObjectParticle, withTopicParticle } from '../korean';

export type RoundField = 'diameterMm' | 'sideHeightMm' | 'lidHeightMm';

export interface RoundDimensions {
  readonly diameterMm: number;
  readonly sideHeightMm: number;
  readonly lidHeightMm: number;
}

/** 입력칸 배치와 오류 문구가 모두 이 순서를 따른다. */
export const ROUND_FIELD_ORDER: readonly RoundField[] = ['diameterMm', 'sideHeightMm', 'lidHeightMm'];

export const ROUND_FIELD_LABELS: Record<RoundField, string> = {
  diameterMm: '지름',
  sideHeightMm: '옆면 높이',
  lidHeightMm: '뚜껑 높이',
};

/** 몸통이 이보다 낮으면 물건이 안 들어간다. */
export const MIN_BODY_MM = 20;

/*
 * 지름 하한 80은 시접 때문이다. 원에 시접 10을 붙이면 재단 지름이 100인데,
 * 그보다 작아지면 곡률이 심해 시접이 접히지 않는다.
 *
 * 옆면 하한 40은 뚜껑 최소 10 + 지퍼 10 + 몸통 최소 20의 합이다.
 */
export const ROUND_RANGES: Record<RoundField, Range> = {
  diameterMm: { min: 80, max: 300 },
  sideHeightMm: { min: 40, max: 300 },
  lidHeightMm: { min: 10, max: 150 },
};

/*
 * 뒷면은 절대 길이가 아니라 둘레에 대한 비율로 뜻이 정해진다. 80mm는 지름
 * 130에서 19.6%지만 지름 50에서는 50.9%가 되어 뚜껑이 안 젖혀지고, 지름
 * 300에서는 8.5%로 경첩이 흐물거린다.
 *
 * 상한 0.3은 지퍼가 원의 절반(180°)보다 짧아지지 않게 하는 값이고,
 * 하한 0.1은 경첩이 버티게 하는 값이다.
 */
export const BACK_RATIO_DEFAULT = 0.2;
export const BACK_RATIO_MIN = 0.1;
export const BACK_RATIO_MAX = 0.3;

/**
 * 옆면 높이가 정하는 뚜껑 높이의 상한.
 *
 * 두 겹인 이유가 있다. `옆면/2`만 걸면 옆면 40에 뚜껑 20이 통과하는데 그때
 * 몸통이 10밖에 안 된다. 반대로 몸통 조건만 걸면 큰 파우치에서 뚜껑이
 * 몸통보다 긴 조합이 통과한다. 둘 다 필요하다.
 */
export function lidHeightMaxMm(sideHeightMm: number): number {
  return Math.min(sideHeightMm / 2, sideHeightMm - ZIPPER_ALLOWANCE_MM - MIN_BODY_MM);
}

export interface RoundFieldError {
  readonly field: RoundField | 'backRatio';
  readonly message: string;
}

export type RoundValidationResult =
  | { readonly ok: true; readonly value: RoundDimensions }
  | { readonly ok: false; readonly errors: readonly RoundFieldError[] };

export function validateRoundDimensions(
  input: Record<RoundField, unknown>,
  backRatio: number = BACK_RATIO_DEFAULT,
): RoundValidationResult {
  const errors: RoundFieldError[] = [];
  const values: Partial<Record<RoundField, number>> = {};

  for (const field of ROUND_FIELD_ORDER) {
    const raw = input[field];
    const { min, max } = ROUND_RANGES[field];
    const label = ROUND_FIELD_LABELS[field];
    const num = typeof raw === 'number' ? raw : Number(raw);

    if (raw === '' || raw === null || raw === undefined || !Number.isFinite(num)) {
      errors.push({ field, message: `${withObjectParticle(label)} 숫자로 입력해주세요.` });
      continue;
    }
    if (!Number.isInteger(num)) {
      errors.push({ field, message: `${withTopicParticle(label)} 1mm 단위 정수로 입력해주세요.` });
      continue;
    }
    if (num < min || num > max) {
      errors.push({ field, message: `${withTopicParticle(label)} ${min}mm 이상 ${max}mm 이하여야 합니다.` });
      continue;
    }
    values[field] = num;
  }

  // 뚜껑 상한은 옆면에 딸려 있어 값 하나씩으로는 못 잡는다.
  const side = values.sideHeightMm;
  const lid = values.lidHeightMm;
  if (side !== undefined && lid !== undefined) {
    const cap = lidHeightMaxMm(side);
    if (lid > cap) {
      errors.push({
        field: 'lidHeightMm',
        message: `옆면 높이 ${side}에서는 ${withTopicParticle(ROUND_FIELD_LABELS.lidHeightMm)} ${Math.floor(cap)} 이하여야 합니다.`,
      });
    }
  }

  if (backRatio < BACK_RATIO_MIN || backRatio > BACK_RATIO_MAX) {
    errors.push({
      field: 'backRatio',
      message: `뒷면 비율은 ${BACK_RATIO_MIN * 100}%에서 ${BACK_RATIO_MAX * 100}% 사이여야 합니다.`,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const { diameterMm, sideHeightMm, lidHeightMm } = values;
  if (diameterMm === undefined || sideHeightMm === undefined || lidHeightMm === undefined) {
    throw new Error('치수 검사를 통과했는데 값이 비어 있습니다.');
  }
  return { ok: true, value: { diameterMm, sideHeightMm, lidHeightMm } };
}

/** 도안에 찍는 이름. 화면 제목과 같은 말을 쓴다. */
export const ROUND_PATTERN_NAME = '동글동글 원통 파우치';

/**
 * 도안에 찍을 한 줄. 치수 순서는 화면·라벨과 같은 지름*옆면*뚜껑이다.
 *
 * 시접 없이 뽑았으면 그렇다고 못 박는다. 종이만 따로 돌아다니면 화면을
 * 볼 수 없고, 모르고 재단하면 원단을 버린다.
 */
export function roundPatternTitle(d: RoundDimensions, seamMm: number = SEAM_MM): string {
  const base = `${ROUND_PATTERN_NAME} ${d.diameterMm}*${d.sideHeightMm}*${d.lidHeightMm}`;
  return seamMm === 0 ? `${base} 시접없음` : base;
}

/** 내려받는 PDF의 파일 이름. 사각 파우치(box-pouch-)와 겹치지 않게 한다. */
export function roundPatternFileName(
  d: RoundDimensions,
  paper: string,
  seamMm: number = SEAM_MM,
): string {
  const seam = seamMm === 0 ? '-noseam' : '';
  return `round-pouch-${d.diameterMm}x${d.sideHeightMm}x${d.lidHeightMm}-${paper}${seam}.pdf`;
}
