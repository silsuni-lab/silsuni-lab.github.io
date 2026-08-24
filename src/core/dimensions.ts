// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { DIMENSION_ORDER, RANGES, SEAM_MM, type DimensionField } from './constants';
import { t } from './i18n/messages';
import { DEFAULT_LOCALE, type Locale } from './i18n/locales';

export interface Dimensions {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
}

/*
 * 무엇이 잘못됐는지만 담는다. 문장은 만들지 않는다 — 언어마다 달라서
 * 여기서 지으면 검사가 로케일을 받아야 하는데, 숫자가 범위 안인지 보는 일은
 * 언어와 아무 상관이 없다. 문장은 fieldErrorMessage가 맡는다.
 */
export type FieldErrorCode = 'notNumber' | 'notInteger' | 'outOfRange';

export interface FieldError {
  readonly field: DimensionField;
  readonly code: FieldErrorCode;
}

export type ValidationResult =
  | { readonly ok: true; readonly value: Dimensions }
  | { readonly ok: false; readonly errors: readonly FieldError[] };

export function validateDimensions(input: Record<DimensionField, unknown>): ValidationResult {
  const errors: FieldError[] = [];
  // 검사 전에는 아무 값도 없으므로 Partial로 시작한다. 빈 객체를 완성된
  // Record인 척 단언하면 아래에서 값이 빠진 경우를 타입이 못 잡는다.
  const values: Partial<Record<DimensionField, number>> = {};

  for (const field of DIMENSION_ORDER) {
    const raw = input[field];
    const { min, max } = RANGES[field];
    const num = typeof raw === 'number' ? raw : Number(raw);

    if (raw === '' || raw === null || raw === undefined || !Number.isFinite(num)) {
      errors.push({ field, code: 'notNumber' });
      continue;
    }
    if (!Number.isInteger(num)) {
      errors.push({ field, code: 'notInteger' });
      continue;
    }
    if (num < min || num > max) {
      errors.push({ field, code: 'outOfRange' });
      continue;
    }
    values[field] = num;
  }

  if (errors.length > 0) return { ok: false, errors };

  // 오류가 없으면 세 값이 모두 채워져 있다. 다만 타입만으로는 그걸 알 수
  // 없으므로 단언 대신 실제로 확인한다. 필드가 늘었는데 검사 루프에서
  // 빠지는 경우를 여기서 잡는다.
  const { widthMm, depthMm, heightMm } = values;
  if (widthMm === undefined || depthMm === undefined || heightMm === undefined) {
    throw new Error('치수 검사를 통과했는데 값이 비어 있습니다.');
  }
  return { ok: true, value: { widthMm, depthMm, heightMm } };
}

/**
 * 검사 결과를 사람이 읽을 문장으로 옮긴다.
 *
 * 허용 범위는 오류에 담지 않고 여기서 RANGES를 다시 본다. 같은 값을 두 곳에
 * 들고 다니면 한쪽만 고쳤을 때 화면이 거짓말을 한다.
 */
export function fieldErrorMessage(locale: Locale, error: FieldError): string {
  const label = t(locale, `field.${error.field}`);
  const { min, max } = RANGES[error.field];

  switch (error.code) {
    case 'notNumber':
      return t(locale, 'error.notNumber', label);
    case 'notInteger':
      return t(locale, 'error.notInteger', label);
    case 'outOfRange':
      return t(locale, 'error.outOfRange', label, min, max);
  }
}

/*
 * 도안에 남기는 출처. 종이만 따로 돌아다녀도 어디서 나왔는지 알 수 있다.
 * 권유와 계정을 나눠 둔 건 계정만 키워 강조하기 위해서다. 한 줄에 섞으면
 * 크기를 따로 줄 수 없다.
 *
 * 권유 문구는 카탈로그 `pdf.watermark`가 정본이다. 한국어가 기본이라
 * 구성요소가 읽는 값도 여기서 꺼낸다 — 이 문구를 바꾸면 서브셋 폰트를
 * 다시 만들어야 한다. README의 "PDF 한글 폰트" 참고.
 */
export const WATERMARK_MESSAGE = t(DEFAULT_LOCALE, 'pdf.watermark');
export const WATERMARK_HANDLE = '@silsuni_lab';

/*
 * 출처 두 줄을 찍는 진하기. 도면 위에 얹힌 글자가 재단선만큼 진해 보이면
 * 도면을 읽을 때 눈이 먼저 그리로 간다. 계정은 크기로 눈에 띄게 하고,
 * 진하기는 두 줄 모두 반만 남긴다.
 *
 * 미리보기와 PDF가 같은 값을 써야 화면에서 본 대로 종이에 나온다.
 */
export const WATERMARK_OPACITY = 0.5;

/**
 * 도안에 찍을 한 줄. 이름과 치수를 붙인다.
 * 치수 순서는 화면·라벨과 같은 가로*높이*바닥폭이다.
 *
 * 시접 없이 뽑았으면 그렇다고 못 박는다. 종이만 따로 돌아다니면 화면을
 * 볼 수 없고, 모르고 재단하면 원단을 버린다.
 *
 * 도안 이름·시접 문구는 카탈로그에서 온다. 한국어가 기본이라 기존
 * 두 인자 호출은 그대로 동작한다.
 */
export function patternTitle(
  dimensions: Dimensions,
  seamMm: number = SEAM_MM,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { widthMm: W, heightMm: H, depthMm: D } = dimensions;
  const base = `${t(locale, 'pdf.patternName')} ${W}*${H}*${D}`;
  return seamMm === 0 ? `${base} ${t(locale, 'pdf.noSeam')}` : base;
}

/**
 * 내려받는 PDF의 파일 이름.
 *
 * 치수 순서는 patternTitle과 같은 가로x높이x바닥폭이다. 파일을 여러 개
 * 받아 두었을 때 이름과 도안 속 글자가 다른 순서면 어느 쪽이 맞는지
 * 알 수 없다.
 */
export function patternFileName(
  dimensions: Dimensions,
  paper: string,
  foldHalf: boolean,
  seamMm: number = SEAM_MM,
): string {
  const { widthMm: W, heightMm: H, depthMm: D } = dimensions;
  // 같은 치수를 골선·시접 조합만 바꿔 여러 번 받아 두면 이름이 같아진다.
  const half = foldHalf ? '-half' : '';
  const seam = seamMm === 0 ? '-noseam' : '';
  return `box-pouch-${W}x${H}x${D}-${paper}${half}${seam}.pdf`;
}
