// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { describe, expect, it } from 'vitest';
import { buildRoundLayout } from '../src/core/round/layout';
import { paginate } from '../src/core/tiling';
import { renderRoundPreviewSvg, roundLegendItems } from '../src/ui/round/preview';
import { renderRoundShapeSvg } from '../src/ui/round/shape';

const layout = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 });
const svg = renderRoundPreviewSvg(layout, paginate(layout, 'a4'), 'ko');

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

  it('페이지 경계가 도안 밖으로 뻗지 않는다', () => {
    /*
     * SVG에 overflow: visible이 걸려 있어(치수 글자를 보이게 하려는 것)
     * viewBox보다 큰 사각을 그리면 그 선이 미리보기 상자 밖으로 나가
     * 범례와 아래 문단을 가로지른다. 화면에서 눈으로 확인한 버그다.
     *
     * 80/60/20은 도안 폭 221mm가 A4 내용 폭을 겨우 넘겨 둘째 칸이 도안
     * 밖으로 한참 나가는 치수다.
     */
    const wide = buildRoundLayout({ diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 });
    const pagination = paginate(wide, 'a4');
    expect(pagination.pages.length).toBeGreaterThan(1);

    const drawn = renderRoundPreviewSvg(wide, pagination, 'ko');
    for (const tile of drawn.matchAll(
      /<rect class="page-tile" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
    )) {
      const [x, y, tw, th] = tile.slice(1).map(Number) as [number, number, number, number];
      expect(x + tw).toBeLessThanOrEqual(Math.round(wide.totalWidthMm * 10) / 10 + 0.05);
      expect(y + th).toBeLessThanOrEqual(Math.round(wide.totalHeightMm * 10) / 10 + 0.05);
    }
  });

  it('칸 번호를 찍는다', () => {
    /*
     * PDF에는 칸 번호가 찍힌다(page.ts). 미리보기에 없으면 잘라 붙일 때
     * 화면에서 본 자리를 종이에서 찾을 길이 없다. 사각 미리보기와 같다.
     */
    const wide = buildRoundLayout({ diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 });
    const pagination = paginate(wide, 'a4');
    expect(pagination.pages.length).toBeGreaterThan(1);

    const drawn = renderRoundPreviewSvg(wide, pagination, 'ko');
    for (const page of pagination.pages) {
      expect(drawn).toContain(`>${page.gridLabel}</text>`);
    }
    expect(drawn).toContain('class="tile-label"');
  });

  it('시접이 0이면 완성선을 그리지 않는다', () => {
    // 그리지도 않은 선이 도면에 남으면 재단할 때 헷갈린다.
    const bare = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 }, 0);
    expect(renderRoundPreviewSvg(bare, paginate(bare, 'a4'), 'ko')).not.toContain('class="seam-line"');
  });

  it('재단선과 완성선을 같은 색·같은 두께로 긋는다', () => {
    // 사각 미리보기와 같은 스펙이다. colors.ts의 PREVIEW_LINE_COLOR 참고.
    const cut = svg.match(/class="piece piece-back"[^>]*stroke="([^"]+)" stroke-width="([\d.]+)"/)!;
    const seam = svg.match(/class="seam-line"[^>]*stroke="([^"]+)" stroke-width="([\d.]+)"/)!;
    expect(seam[1]).toBe(cut[1]);
    expect(Number(seam[2])).toBe(Number(cut[2]));
  });

  it('시접이 있으면 재단선과 완성선 사이가 띠로 남는다', () => {
    /*
     * 이 띠가 위 결정의 전제다. 두 선이 색도 두께도 같으므로, 어느 쪽을
     * 잘라야 하는지 알려 주는 것은 띠의 바깥이냐 안이냐뿐이다. 띠가 사라지면
     * 원통 도안은 같은 선 두 줄만 남아 읽을 수 없게 된다.
     */
    const cutFill = svg.match(/class="piece piece-back"[^>]*fill="([^"]+)"/)![1];
    const seamFill = svg.match(/class="seam-line"[^>]*fill="([^"]+)"/)![1];
    expect(cutFill).not.toBe(seamFill);
    expect(cutFill).not.toBe('none');

    // 시접이 0이면 띠가 없으므로 재단선은 도안 채움색으로 돌아간다.
    const bare = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 }, 0);
    const bareSvg = renderRoundPreviewSvg(bare, paginate(bare, 'a4'), 'ko');
    expect(bareSvg.match(/class="piece piece-back"[^>]*fill="([^"]+)"/)![1]).toBe(seamFill);
  });
});

describe('roundLegendItems — 실제로 그린 선만 담는다', () => {
  it('골선과 중앙선이 없다', () => {
    // 원통에는 접는 자리도 중심선도 없다. 없는 선을 적어 두면 도면에서 찾다가 헤맨다.
    const text = roundLegendItems(layout, 'ko').map((i) => i.text).join(' ');
    expect(text).not.toContain('골선');
    expect(text).not.toContain('중앙선');
  });

  it('시접이 0이면 시접 견본이 빠진다', () => {
    const bare = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 }, 0);
    expect(roundLegendItems(bare, 'ko').map((i) => i.text).join(' ')).not.toContain('시접');
  });

  it('범례 색이 도면에 실제로 쓰인 색이다', () => {
    // 견본이 딴 색을 가리키면 아무도 못 잡는다.
    for (const item of roundLegendItems(layout, 'ko')) {
      expect(svg).toContain(item.color);
    }
  });
});

describe('renderRoundShapeSvg — 완성 예상', () => {
  const shape = renderRoundShapeSvg({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 }, 'ko');

  it('위아래 타원과 지퍼선을 그린다', () => {
    expect(shape).toContain('class="top-ellipse"');
    expect(shape).toContain('class="zipper"');
  });

  it('치수를 적는다', () => {
    expect(shape).toContain('130mm');
  });

  it('납작한 파우치와 긴 파우치의 비율이 다르다', () => {
    // 치수를 넣는 즉시 납작한지 길쭉한지 감이 잡혀야 한다.
    const flat = renderRoundShapeSvg({ diameterMm: 200, sideHeightMm: 50, lidHeightMm: 15 }, 'ko');
    const tall = renderRoundShapeSvg({ diameterMm: 100, sideHeightMm: 250, lidHeightMm: 40 }, 'ko');
    expect(flat).not.toBe(tall);
  });

  it('그림에 접근성 이름이 있다', () => {
    expect(shape).toContain('role="img"');
    expect(shape).toContain('aria-label=');
  });
});
