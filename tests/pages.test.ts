import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../src/core/i18n/messages';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../src/core/i18n/locales';

/*
 * 정적 페이지 다섯 벌(ko: /, en: /en/, zh-TW: /zh-TW/, …)과 sitemap.xml을
 * 지킨다. 정적 텍스트는 카탈로그와 같은 말이어야 하고, 모든 페이지는 같은
 * 구조를 유지해야 한다 — 한쪽만 고치면 번역이 새는지 몰라서다.
 *
 * 사이트 루트는 package.json의 homepage와 같다. 도메인이 바뀌면 여기와
 * 각 index.html · public/sitemap.xml을 함께 고친다.
 */
const SITE_URL = 'https://silsuni-lab.github.io';

/*
 * 로케일 → 그 언어의 정적 페이지 파일. LOCALES에서 유도한다 — 로케일을
 * 하나 늘리면 여기 빠뜨릴 수 없고(Record가 tsc로 강제), 페이지를 만들지
 * 않으면 아래 테스트가 파일을 못 읽어 즉시 실패한다. 손으로 적어 두면
 * 새 언어의 링크만 나가고 페이지는 404인 채로 배포될 수 있다.
 *
 * 뿌리(ko)만 최상위 index.html이고 나머지는 `<locale>/index.html`이다 —
 * localeHref(locales.ts)가 가리키는 경로와 같은 규칙이다.
 */
const LANG_FILE: Readonly<Record<Locale, string>> = {
  ko: 'index.html',
  en: 'en/index.html',
  'zh-TW': 'zh-TW/index.html',
  'zh-CN': 'zh-CN/index.html',
  ja: 'ja/index.html',
};

const LANG_FILES: readonly [Locale, string][] = LOCALES.map((l) => [l, LANG_FILE[l]]);

const read = (rel: string) => readFileSync(rel, 'utf8');

function idsOf(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!).sort();
}

/** 한국어가 아닌 페이지들. 기준(ko)과 대조하거나 한글 잔존을 볼 때 쓴다. */
const TRANSLATED = LANG_FILES.filter(([locale]) => locale !== DEFAULT_LOCALE);

/** 원통(round) 페이지 파일. box와 같은 규칙 — 뿌리(ko)는 최상위, 나머지는 <locale>/ 아래. */
const ROUND_LANG_FILE: Readonly<Record<Locale, string>> = {
  ko: 'round-pouch-test/index.html',
  en: 'en/round-pouch-test/index.html',
  'zh-TW': 'zh-TW/round-pouch-test/index.html',
  'zh-CN': 'zh-CN/round-pouch-test/index.html',
  ja: 'ja/round-pouch-test/index.html',
};
const ROUND_FILES: readonly [Locale, string][] = LOCALES.map((l) => [l, ROUND_LANG_FILE[l]]);

const roundSiteUrlOf = (locale: Locale) =>
  locale === DEFAULT_LOCALE ? `${SITE_URL}/round-pouch-test/` : `${SITE_URL}/${locale}/round-pouch-test/`;

describe('정적 페이지 — 원통 다섯 언어', () => {
  it('각 언어에 원통 페이지가 있다', () => {
    for (const [locale, file] of ROUND_FILES) {
      expect(read(file), file).toMatch(new RegExp(`<html lang="${locale}">`));
      expect(read(file), `${file} 드롭다운`).toContain('id="lang-select"');
    }
  });

  it('한국어가 아닌 원통 페이지에는 한글이 없다', () => {
    for (const [locale, file] of ROUND_FILES) {
      if (locale === DEFAULT_LOCALE) continue;
      expect(read(file), `${locale} 원통 한글 잔존`).not.toMatch(/[가-힣]/);
    }
  });

  it('원통 페이지에 로케일 전부의 교차 링크와 x-default가 있다', () => {
    for (const [, file] of ROUND_FILES) {
      const html = read(file);
      for (const locale of LOCALES) {
        expect(html, `${file} ${locale}`).toContain(`hreflang="${locale}" href="${roundSiteUrlOf(locale)}"`);
      }
      expect(html, `${file} x-default`).toContain(`hreflang="x-default" href="${roundSiteUrlOf(DEFAULT_LOCALE)}"`);
    }
  });
});

describe('정적 페이지 — 다섯 언어', () => {
  it('로케일마다 정적 페이지가 하나씩 있다', () => {
    // LOCALES를 늘려 놓고 페이지를 안 만들면 링크만 나가고 404가 된다.
    expect(LANG_FILES).toHaveLength(LOCALES.length);
    for (const [locale, file] of LANG_FILES) {
      expect(() => read(file), `${locale} 페이지 없음`).not.toThrow();
    }
  });

  it('모든 페이지가 같은 구조(같은 id 집합)를 갖는다', () => {
    const base = idsOf(read(LANG_FILE[DEFAULT_LOCALE]));
    for (const [, file] of TRANSLATED) {
      expect(idsOf(read(file)), file).toEqual(base);
    }
  });

  it('각 페이지에 자기 언어가 표시된다', () => {
    for (const [locale, file] of LANG_FILES) {
      expect(read(file), file).toMatch(new RegExp(`<html lang="${locale}">`));
    }
  });

  it('한국어를 쓰지 않는 페이지에는 한글이 하나도 없다', () => {
    // 옮기다 만 한 줄이 남아도 여기서 걸린다. ko 페이지는 한글이라 제외.
    for (const [locale, file] of TRANSLATED) {
      expect(read(file), `${locale}에 한글 잔존`).not.toMatch(/[가-힣]/);
    }
  });

  it('정적 문구가 카탈로그와 같은 말이다', () => {
    const keys = [
      'app.title', 'app.subLine1', 'section.size', 'section.presets',
      'section.preview', 'section.pattern', 'control.paper',
      'control.download',
    ] as const;
    for (const [locale, file] of LANG_FILES) {
      const html = read(file);
      for (const key of keys) {
        expect(html, `${locale} ${key}`).toContain(t(locale, key));
      }
      // 축척 안내도 카탈로그와 같은 말이어야 한다. 정적 HTML이 다른 말을
      // 하고 있으면 스크립트가 붙는 순간 문구가 한 번 바뀐다.
      expect(html, `${locale} printCheck`).toContain(t(locale, 'control.printCheck'));
    }
  });

  it('각 페이지에 언어 전환 드롭다운 자리가 있다', () => {
    for (const [, file] of LANG_FILES) {
      expect(read(file), file).toContain('id="lang-select"');
    }
  });
});

/** 그 로케일 페이지의 절대 주소. ko는 뿌리, 나머지는 한 단계 아래다. */
const siteUrlOf = (locale: Locale) =>
  locale === DEFAULT_LOCALE ? `${SITE_URL}/` : `${SITE_URL}/${locale}/`;

describe('hreflang — 언어별 주소를 남긴다', () => {
  it('모든 페이지에 로케일 전부의 교차 링크와 x-default가 있다', () => {
    for (const [, file] of LANG_FILES) {
      const html = read(file);
      for (const locale of LOCALES) {
        expect(html, `${file} → ${locale}`).toContain(
          `hreflang="${locale}" href="${siteUrlOf(locale)}"`,
        );
      }
      expect(html).toContain(`hreflang="x-default" href="${siteUrlOf(DEFAULT_LOCALE)}"`);
    }
  });

  it('각 페이지가 자기 주소를 canonical로 가리킨다', () => {
    for (const [locale, file] of LANG_FILES) {
      expect(read(file), file).toContain(
        `<link rel="canonical" href="${siteUrlOf(locale)}" />`,
      );
    }
  });
});

describe('sitemap.xml', () => {
  it('box·round 로케일마다 한 줄씩 담는다', () => {
    const xml = read('public/sitemap.xml');
    // box 5개 + round 5개 = 로케일 수의 두 배. 손으로 세면 두 화면을 나중에
    // 넣을 때 잊는다.
    expect(xml.match(/<loc>/g)).toHaveLength(LOCALES.length * 2);
    for (const locale of LOCALES) {
      expect(xml).toContain(`<loc>${siteUrlOf(locale)}</loc>`);
      expect(xml).toContain(`<loc>${roundSiteUrlOf(locale)}</loc>`);
    }
  });

  it('각 버전에 xhtml 교차 링크를 함께 남긴다', () => {
    const xml = read('public/sitemap.xml');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    for (const locale of LOCALES) {
      expect(xml).toContain(
        `<xhtml:link rel="alternate" hreflang="${locale}" href="${siteUrlOf(locale)}"`,
      );
    }
  });

  it('sitemap과 HTML이 같은 언어 교차 링크를 남긴다', () => {
    // 두 곳이 따로 쓰다 보면 한쪽만 고치기 쉽다. 페이지의 <link rel="alternate">
    // 집합과 sitemap의 <xhtml:link> 집합이 언어별로 같아야 한다.
    const xml = read('public/sitemap.xml');
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const htmlAlternates = (file: string) =>
      [...read(file).matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)]
        .map((m) => `${m[1]}=${m[2]}`).sort();

    for (const [locale, file] of LANG_FILES) {
      const path = siteUrlOf(locale);
      const block = xml.match(new RegExp(`<url>\\s*<loc>${escape(path)}</loc>([\\s\\S]*?)</url>`))?.[1];
      expect(block, `${locale} sitemap 블록`).toBeTruthy();
      const blockLinks = [...block!.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)]
        .map((m) => `${m[1]}=${m[2]}`).sort();
      expect(blockLinks, `${locale} 교차 링크`).toEqual(htmlAlternates(file));
    }
  });
});
