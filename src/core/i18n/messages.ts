// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { ko } from './ko';
import { en } from './en';
import { zhTW } from './zh-TW';
import { zhCN } from './zh-CN';
import { ja } from './ja';
import { DEFAULT_LOCALE, type Locale } from './locales';

/*
 * 화면과 PDF에 나가는 모든 문구.
 *
 * 값이 함수인 것이 있다. 언어마다 조사와 어순이 달라 문자열 보간만으로는
 * 감당이 안 된다 — 한국어는 받침에 따라 은/는이 갈리고, 영어는 장수에 따라
 * sheet/sheets가 갈린다. 그 차이를 카탈로그가 흡수한다.
 *
 * 키 목록은 한국어 카탈로그가 정한다. 새 로케일에 한 줄만 빠져도
 * `tsc --noEmit`이 잡는다 — 빠진 것을 조용히 넘기지 않는 것이 이 파일의 몫이다.
 */

export type Message = string | ((...args: never[]) => string);

/** 키 목록의 출처. 한국어 카탈로그가 기준이다. */
export type MessageKey = keyof typeof ko;

/*
 * 다른 로케일이 따라야 할 모양. 키뿐 아니라 **함수 인자까지** 한국어와
 * 같아야 한다. Record<MessageKey, Message>로 두면 인자 개수가 달라도
 * 통과해서, 부르는 쪽에서 조용히 undefined가 박힌다.
 */
export type Catalog = {
  readonly [K in MessageKey]: (typeof ko)[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : string;
};

export const CATALOGS: Readonly<Record<Locale, Catalog>> = {
  ko,
  en,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  ja,
};

/** 카탈로그가 담아야 할 키 전부. 테스트가 로케일끼리 대조하는 데 쓴다. */
export function messageKeys(): readonly MessageKey[] {
  return Object.keys(ko) as MessageKey[];
}

/*
 * 값이 문자열인 키와 함수인 키를 타입으로 갈라, 부르는 쪽에서 인자를
 * 빠뜨리거나 더 주는 것을 막는다. 문구를 함수로 바꾸면 부르는 자리가
 * 전부 컴파일 오류로 드러난다.
 */
type StringKey = { [K in MessageKey]: (typeof ko)[K] extends string ? K : never }[MessageKey];
type FnKey = Exclude<MessageKey, StringKey>;
type ArgsOf<K extends FnKey> = (typeof ko)[K] extends (...args: infer A) => string ? A : never;

export function t(locale: Locale, key: StringKey): string;
export function t<K extends FnKey>(locale: Locale, key: K, ...args: ArgsOf<K>): string;
export function t(locale: Locale, key: MessageKey, ...args: unknown[]): string {
  // 모르는 로케일이 들어와도 화면이 비지 않게 기본 로케일로 떨어진다.
  const value = (CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE])[key];
  return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value;
}
