// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import {
  LOCALES,
  LOCALE_NAMES,
  localeHref,
  type Locale,
} from '../core/i18n/locales';

/*
 * 언어 전환 드롭다운에 넣을 항목. 선택지·이름·가리키는 경로를 순수
 * 함수로 조합만 한다. 화면에 붙이는 일(main.ts)은 여기서 값을 받아 간다.
 */

export interface LanguageOption {
  /** 로케일 코드. 항목을 식별하는 값이며, 테스트가 current 여부를 가릴 때 쓴다.
   *  <option value>에는 main.ts가 이동할 href(아래)를 넣는다. */
  readonly value: Locale;
  /** 그 언어의 네이티브 이름. 찾는 사람이 자기 말을 볼 수 있게 그 언어로 적는다. */
  readonly label: string;
  /** 그 언어 페이지로 가는 상대 경로. */
  readonly href: string;
  /** 지금 보고 있는 페이지인가. UI에서 현재 위치로 표시할 때 쓴다. */
  readonly current: boolean;
}

export function languageOptions(current: Locale): LanguageOption[] {
  return LOCALES.map((value) => ({
    value,
    label: LOCALE_NAMES[value],
    href: localeHref(current, value),
    current: value === current,
  }));
}
