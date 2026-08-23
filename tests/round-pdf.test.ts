// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { buildRoundLayout } from '../src/core/round/layout';
import { buildRoundPdf } from '../src/core/round/pdf';
import { paginate } from '../src/core/tiling';
import { ROUND_PATTERN_NAME } from '../src/core/round/dimensions';
import { KOREAN_FONT_CHARS } from '../src/core/page';

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
});
