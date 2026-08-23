import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * 색은 src/core/colors.ts에서만 짓는다. 그리는 파일이 색을 스스로 정하면
 * 화면과 인쇄가 다시 갈라진다. 지금까지 두 번 그렇게 됐고, 두 번 다
 * 사람 눈으로는 못 잡았다.
 *
 * 매체마다 색을 짓는 방법이 달라 찾을 것도 다르다. 화면은 hex 문자열을
 * 쓰고 pdf.ts는 rgb(0.3, 0.3, 0.3) 꼴로 짓는다. hex만 찾으면 pdf.ts는
 * 그물에 걸리지 않는다.
 */

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

/**
 * 블록 주석을 걷어낸다. 주석에는 "이 색은 배경 위에서 몇 대 몇" 같은 근거를
 * 적어 두므로 hex가 나올 수 있고, 그건 잡을 대상이 아니다.
 *
 * 줄 주석(//)은 건드리지 않는다. SVG 문자열에 들어 있는 http:// 같은 것까지
 * 주석으로 오인해 잘라내면, 그 뒤에 숨은 hex를 놓친다. 대신 줄 주석에는 색
 * 값을 적지 않는다 — 적어야 하면 상수 이름을 쓴다.
 */
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

const HEX_LITERAL = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;

describe('색은 colors.ts에서만 짓는다', () => {
  for (const file of ['src/ui/preview.ts', 'src/ui/shape.ts']) {
    it(`${file}에 hex 리터럴이 없다`, () => {
      const found = stripBlockComments(read(file)).match(HEX_LITERAL) ?? [];
      expect(found).toEqual([]);
    });
  }

  it('pdf.ts가 rgb()를 pdfColor 안에서 한 번만 부른다', () => {
    const calls = stripBlockComments(read('src/core/pdf.ts')).match(/\brgb\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it('pdf.ts에도 hex 리터럴이 없다', () => {
    const found = stripBlockComments(read('src/core/pdf.ts')).match(HEX_LITERAL) ?? [];
    expect(found).toEqual([]);
  });

  /*
   * 위 검사들이 헛돌지 않는지 확인한다. colors.ts에는 hex가 잔뜩 있어야
   * 하고, 그게 없으면 정규식이 아무것도 못 찾고 있다는 뜻이다.
   */
  it('colors.ts에는 hex가 실제로 들어 있다', () => {
    const found = stripBlockComments(read('src/core/colors.ts')).match(HEX_LITERAL) ?? [];
    expect(found.length).toBeGreaterThan(10);
  });
});
