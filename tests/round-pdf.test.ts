// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { buildRoundLayout, roundTitlePiece } from '../src/core/round/layout';
import { buildRoundPdf, labelZoneHeightMm, titleBlockRegion } from '../src/core/round/pdf';
import { paginate } from '../src/core/tiling';
import { ROUND_PATTERN_NAME } from '../src/core/round/dimensions';
import { KOREAN_FONT_CHARS, loadFonts } from '../src/core/page';

const golden = { diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 };
const layout = buildRoundLayout(golden);

describe('buildRoundPdf', () => {
  it('설계 문서의 장수만큼 페이지를 만든다', async () => {
    const bytes = await buildRoundPdf(layout, paginate(layout, 'a4'));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPages().length).toBe(4);
  });

  it('1:1 실치수다', async () => {
    // 확대·축소 없이 뽑아야 도안이 쓸모 있다. A4 세로면 595.28 x 841.89pt.
    const bytes = await buildRoundPdf(layout, paginate(layout, 'a4'));
    const page = (await PDFDocument.load(bytes)).getPages()[0]!;
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
  });

  it('출처 두 줄을 절반만 진하게 찍는다', async () => {
    // 미리보기와 같은 값이라야 화면에서 본 대로 종이에 나온다.
    const bytes = await buildRoundPdf(layout, paginate(layout, 'a4'));
    const page = (await PDFDocument.load(bytes)).getPages()[0]!;
    const states = page.node.Resources()!.lookup(PDFName.of('ExtGState'))!.toString();
    expect(states).toContain('/ca 0.5');
  });

  it('도안 이름의 글자가 모두 서브셋 안에 있다', () => {
    // 빠지면 그 자리가 조용히 빈칸으로 인쇄된다.
    expect([...ROUND_PATTERN_NAME].filter((c) => !KOREAN_FONT_CHARS.has(c))).toEqual([]);
  });

  it('조각 라벨의 글자가 모두 서브셋 안에 있다', () => {
    const labels = layout.pieces.map((p) => p.label).join('');
    expect([...labels].filter((c) => !KOREAN_FONT_CHARS.has(c))).toEqual([]);
  });

  it('시접 없이 뽑아도 만들어진다', async () => {
    const bare = buildRoundLayout(golden, 0);
    const bytes = await buildRoundPdf(bare, paginate(bare, 'a4'));
    expect((await PDFDocument.load(bytes)).getPages().length).toBeGreaterThan(0);
  });

  it('짧은 조각에서도 출처 문구 자리가 조각 라벨 자리를 침범하지 않는다', async () => {
    /*
     * 130/130/30(골든 케이스)은 앞면 아랫단이 완성 높이 90mm라 라벨과
     * 출처 문구를 겹쳐 놓아도 눈에 안 띄었다. 80/60/20은 완성 높이가
     * 30mm뿐이라 실제로 겹쳐 찍히는 걸 눈으로 확인한 프리셋이다.
     * 300/40/10은 허용 범위에서 몸통이 가장 납작해지는 극단값이다.
     */
    const doc = await PDFDocument.create();
    const { font } = await loadFonts(doc);

    for (const dims of [
      { diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 },
      golden,
      { diameterMm: 300, sideHeightMm: 40, lidHeightMm: 10 },
    ]) {
      const l = buildRoundLayout(dims);
      const titlePiece = roundTitlePiece(l);
      expect(titlePiece).toBeDefined();

      const { centerYMm, availableHeightMm } = titleBlockRegion(titlePiece!, l.seamMm, font);
      // 라벨 자리(완성선에서 라벨 몫만큼)가 끝나는 지점.
      const labelZoneBottomMm = titlePiece!.yMm + l.seamMm + labelZoneHeightMm(font);
      // 출처 문구에게 내준 영역의 위쪽 경계.
      const regionTopMm = centerYMm - availableHeightMm / 2;

      // 출처 문구 영역은 라벨 자리가 끝나는 지점에서 시작해야 한다 — 겹치면 안 된다.
      expect(regionTopMm).toBeCloseTo(labelZoneBottomMm, 5);
      // 라벨 몫을 뺀 뒤에도 출처 문구가 앉을 자리가 실제로 남아 있어야 한다.
      expect(availableHeightMm).toBeGreaterThan(0);
    }
  });
});
