// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { describe, expect, it } from 'vitest';
import { buildRoundLayout } from '../src/core/round/layout';
import { paginate } from '../src/core/tiling';
import { renderRoundPreviewSvg, roundLegendItems } from '../src/ui/round/preview';
import { renderRoundShapeSvg } from '../src/ui/round/shape';

const layout = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 });
const svg = renderRoundPreviewSvg(layout, paginate(layout, 'a4'));

describe('renderRoundPreviewSvg', () => {
  it('조각 넷을 모두 그린다', () => {
    for (const id of ['circles', 'frontTop', 'frontBottom', 'back']) {
      expect(svg).toContain(`class="piece piece-${id}"`);
    }
  });

  it('원은 circle로, 나머지는 rect로 그린다', () => {
    expect(svg).toMatch(/<circle[^>]*class="piece piece-circles"/);
    expect(svg).toMatch(/<rect[^>]*class="piece piece-back"/);
  });

  it('원에 2장이라고 적는다', () => {
    expect(svg).toContain('뚜껑·바닥 2장');
  });

  it('viewBox가 전체 크기와 맞는다', () => {
    expect(svg).toContain(`viewBox="0 0 ${Math.round(layout.totalWidthMm * 10) / 10} ${Math.round(layout.totalHeightMm * 10) / 10}"`);
  });

  it('페이지 경계를 함께 보여준다', () => {
    expect(svg).toContain('class="page-tile"');
  });

  it('시접이 0이면 완성선을 그리지 않는다', () => {
    // 그리지도 않은 선이 도면에 남으면 재단할 때 헷갈린다.
    const bare = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 }, 0);
    expect(renderRoundPreviewSvg(bare, paginate(bare, 'a4'))).not.toContain('class="seam-line"');
  });
});

describe('roundLegendItems — 실제로 그린 선만 담는다', () => {
  it('골선과 중앙선이 없다', () => {
    // 원통에는 접는 자리도 중심선도 없다. 없는 선을 적어 두면 도면에서 찾다가 헤맨다.
    const text = roundLegendItems(layout).map((i) => i.text).join(' ');
    expect(text).not.toContain('골선');
    expect(text).not.toContain('중앙선');
  });

  it('시접이 0이면 시접 견본이 빠진다', () => {
    const bare = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 }, 0);
    expect(roundLegendItems(bare).map((i) => i.text).join(' ')).not.toContain('시접');
  });

  it('범례 색이 도면에 실제로 쓰인 색이다', () => {
    // 견본이 딴 색을 가리키면 아무도 못 잡는다.
    for (const item of roundLegendItems(layout)) {
      expect(svg).toContain(item.color);
    }
  });
});

describe('renderRoundShapeSvg — 완성 예상', () => {
  const shape = renderRoundShapeSvg({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 });

  it('위아래 타원과 지퍼선을 그린다', () => {
    expect(shape).toContain('class="top-ellipse"');
    expect(shape).toContain('class="zipper"');
  });

  it('치수를 적는다', () => {
    expect(shape).toContain('130mm');
  });

  it('납작한 파우치와 긴 파우치의 비율이 다르다', () => {
    // 치수를 넣는 즉시 납작한지 길쭉한지 감이 잡혀야 한다.
    const flat = renderRoundShapeSvg({ diameterMm: 200, sideHeightMm: 50, lidHeightMm: 15 });
    const tall = renderRoundShapeSvg({ diameterMm: 100, sideHeightMm: 250, lidHeightMm: 40 });
    expect(flat).not.toBe(tall);
  });

  it('그림에 접근성 이름이 있다', () => {
    expect(shape).toContain('role="img"');
    expect(shape).toContain('aria-label=');
  });
});
