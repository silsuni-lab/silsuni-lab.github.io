// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 이 도구가 내는 언어.
 *
 * ko는 뿌리 경로(/)를, 나머지는 하위 경로(/en/, /zh-TW/ …)에 정적 페이지로
 * 나간다 — 검색엔진이 JS 없이 읽고, 링크를 보내면 언어가 따라간다.
 */

export const LOCALES = ['ko', 'en', 'zh-TW', 'zh-CN', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ko';

/** 사람에게 보여줄 이름. 그 언어로 적는다 — 찾는 사람이 자기 말을 본다. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  ko: '한국어',
  en: 'English',
  'zh-TW': '中文(繁體)',
  'zh-CN': '中文(简体)',
  ja: '日本語',
};

/**
 * 한 페이지에서 그 로케일 페이지로 가는 상대 경로.
 *
 * ko는 뿌리(/), 나머지는 한 단계 아래(/en/, /zh-TW/ …)다. 뿌리 페이지에서는
 * 아래로 내려가고, 하위 페이지에서는 한 칸 올라간 뒤 아래로 내려간다.
 * 상대 경로인 까닭은 vite base가 './'라서다 — 서브경로 배포
 * (example.com/pouch/)에서도 그대로 돈다. 지금 있는 페이지를 가리키면 './'다.
 */
export function localeHref(current: Locale, target: Locale): string {
  if (target === current) return './';
  if (current === DEFAULT_LOCALE) return `./${target}/`;
  return target === DEFAULT_LOCALE ? '../' : `../${target}/`;
}

/**
 * `<html lang>` 값에서 로케일을 읽는다.
 *
 * 주소를 파싱하지 않는 까닭이 있다. 하위 경로 배포에서는 주소만 보고
 * 어디까지가 배포 경로이고 어디부터가 로케일인지 알 수 없다. 빌드가
 * 각 페이지의 lang에 박아 두므로 그걸 믿는 편이 확실하다.
 *
 * zh-TW(대문자 하이픈) 같은 코드는 소문자로 낮춰 대조하고, en-US처럼
 * 지역 꼬리표가 붙어 온 경우는 첫 부분을 자른다. 모르는 값이면 기본
 * 로케일로 떨어진다.
 */
export function localeFromLang(lang: string | null | undefined): Locale {
  if (!lang) return DEFAULT_LOCALE;
  const value = lang.toLowerCase();
  const exact = LOCALES.find((l) => l.toLowerCase() === value);
  if (exact) return exact;
  const base = value.split('-')[0] ?? '';
  const byBase = LOCALES.find((l) => l.toLowerCase() === base);
  return byBase ?? DEFAULT_LOCALE;
}

/** 지금 문서의 로케일. 빌드가 박아 둔 `<html lang>`을 읽는다. */
export function currentLocale(doc: Document = document): Locale {
  return localeFromLang(doc.documentElement.lang);
}
