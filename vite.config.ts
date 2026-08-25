// vitest 설정을 함께 두므로 'vite'가 아니라 'vitest/config'에서 defineConfig를 가져온다.
// 'vite'의 defineConfig에는 test 필드 타입이 없어 `tsc --noEmit`이 실패한다.
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
// 확장자를 적는다. vite가 설정 파일을 네이티브(node)로 읽는 판에서는
// 확장자 없는 지정자를 풀지 못해 빌드가 멈춘다 — 지금은 경고지만
// 그 로더가 기본이 되면 오류가 된다.
import { DEFAULT_LOCALE, LOCALES } from './src/core/i18n/locales.ts';

/*
 * 언어별 정적 페이지. ko는 뿌리(/)에, 나머지는 하위 경로(/en/, /zh-TW/ …)
 * 아래에 나간다. 정적 문구는 각 HTML에 박아 두고, 모든 페이지가 같은
 * 구조인지는 tests/pages.test.ts가 지킨다.
 *
 * 목록을 손으로 적지 않고 LOCALES에서 유도한다. 손으로 적으면 로케일을
 * 늘렸을 때 드롭다운에는 새 언어가 뜨는데 빌드 산출물에는 그 페이지가
 * 없어서 404로 나간다. 여기서 유도하면 HTML을 만들지 않은 채로는 빌드가
 * 아예 통과하지 못한다.
 */
const localeInputs = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    resolve(locale === DEFAULT_LOCALE ? 'index.html' : `${locale}/index.html`),
  ]),
);

const roundInputs = Object.fromEntries(
  // 라운드는 `/round-pouch-test/{lang}/` — 라운드가 최상위, 언어가 그 아래다.
  // 박스(`/{lang}/`)와 달리 구조가 뒤집힌다. 그래도 목록은 LOCALES에서 유도해
  // 언어를 늘리면 라운드 페이지도 함께 있어야 빌드가 통과한다.
  LOCALES.map((locale) => [
    `round-${locale}`,
    resolve(locale === DEFAULT_LOCALE ? 'round-pouch-test/index.html' : `round-pouch-test/${locale}/index.html`),
  ]),
);

export default defineConfig({
  base: './',
  /*
   * 언어별 정적 박스 페이지(ko는 뿌리, 나머지는 하위 경로)와, 원통 화면
   * (noindex 시험 페이지)을 로케일별로 함께 뽑는다. box·round 모두 5개
   * 언어로 나간다. 위 목록은 LOCALES에서 유도해 언어를 늘리면 빌드가
   * 아예 통과하지 못하게 한다.
   */
  build: {
    rollupOptions: {
      input: {
        ...localeInputs,
        ...roundInputs,
      },
    },
  },
  test: {
    environment: 'node',
  },
});
