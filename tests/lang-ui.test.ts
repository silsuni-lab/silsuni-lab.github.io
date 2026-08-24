import { describe, expect, it } from 'vitest';
import { languageOptions } from '../src/ui/lang';

/*
 * 언어 전환 드롭다운. 모든 언어를 네이티브 이름으로 나열하고, 각 항목이
 * 그 언어 페이지로 가는 상대 경로를 갖는다. 순수 함수라 DOM 없이 검증한다.
 */

describe('languageOptions — 언어 전환 드롭다운 항목', () => {
  it('모든 언어를 네이티브 이름으로 나열한다', () => {
    expect(languageOptions('ko').map((o) => o.label)).toEqual([
      '한국어', 'English', '中文(繁體)', '中文(简体)', '日本語',
    ]);
  });

  it('뿌리 페이지(ko)에서는 다른 언어로 가짜 상대 경로를 만든다', () => {
    const options = languageOptions('ko');
    expect(options.find((o) => o.value === 'ko')!.href).toBe('./');
    expect(options.find((o) => o.value === 'en')!.href).toBe('./en/');
    expect(options.find((o) => o.value === 'zh-CN')!.href).toBe('./zh-CN/');
    expect(options.find((o) => o.value === 'ja')!.href).toBe('./ja/');
  });

  it('하위 페이지(ja)에서는 뿌리로 한 칸 올라간 뒤 내려간다', () => {
    const options = languageOptions('ja');
    expect(options.find((o) => o.value === 'ko')!.href).toBe('../');
    expect(options.find((o) => o.value === 'en')!.href).toBe('../en/');
    expect(options.find((o) => o.value === 'ja')!.href).toBe('./');
  });

  it('지금 보고 있는 페이지를 current로 표시한다', () => {
    expect(languageOptions('zh-TW').filter((o) => o.current).map((o) => o.value))
      .toEqual(['zh-TW']);
  });
});
