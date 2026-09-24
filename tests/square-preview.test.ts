import { describe, expect, it } from 'vitest';
import { FOLD_COLOR, SEAM_BAND_FILL, ZIPPER_COLOR } from '../src/core/colors';
import { buildSquareLayout } from '../src/core/square/layout';
import { paginate } from '../src/core/tiling';
import { renderSquarePreviewSvg, squareLegendItems } from '../src/ui/square/preview';
import { handleRiseMm, renderSquareShapeSvg } from '../src/ui/square/shape';

const golden = { widthMm: 220, depthMm: 140, sideHeightMm: 150, lidHeightMm: 30 };
const layout = buildSquareLayout(golden);
const svg = renderSquarePreviewSvg(layout, paginate(layout, 'a4'), 'ko');

describe('renderSquarePreviewSvg', () => {
  it('조각 다섯을 모두 그린다', () => {
    for (const id of ['panels', 'frontTop', 'frontBottom', 'back', 'handle']) {
      expect(svg).toContain(`class="piece piece-${id}"`);
    }
  });

  it('뚜껑·바닥에 2장이라고 적는다', () => {
    expect(svg).toContain('뚜껑·바닥 2장');
  });

  it('손잡이 접힘선을 긋는다', () => {
    expect(svg).toContain('class="fold-line"');
    expect(svg).toContain(FOLD_COLOR);
  });

  it('범례의 색은 모두 그린 SVG 안에 있다', () => {
    for (const item of squareLegendItems(layout, 'ko')) {
      expect(svg, item.text).toContain(item.color);
      if (item.fill !== undefined) expect(svg).toContain(item.fill);
    }
  });

  it('시접 없이 뽑으면 완성선과 시접 띠가 범례와 도면에서 빠진다', () => {
    const bare = buildSquareLayout(golden, 0);
    const bareSvg = renderSquarePreviewSvg(bare, paginate(bare, 'a4'), 'ko');
    expect(bareSvg).not.toContain('seam-line');
    expect(bareSvg).not.toContain(SEAM_BAND_FILL);
    expect(squareLegendItems(bare, 'ko').map((i) => i.swatch)).not.toContain('swatch-seam-band');
  });
});

describe('renderSquareShapeSvg', () => {
  const shape = renderSquareShapeSvg(golden, 'ko');

  it('네 치수를 모두 적는다', () => {
    for (const v of ['220mm', '140mm', '150mm', '30mm']) expect(shape).toContain(v);
  });

  it('지퍼와 손잡이를 그린다', () => {
    expect(shape).toContain(ZIPPER_COLOR);
    expect(shape).toContain('class="handle"');
  });

  it('손잡이는 가로 1.3배 길이만큼 뜬다', () => {
    // 반쪽 143, 가로 반 110 → √(143² − 110²) ≈ 91.4
    expect(handleRiseMm(220)).toBeCloseTo(91.4, 1);
  });
});

describe('모서리 라운드 — 화면', () => {
  it('미리보기의 뚜껑·바닥은 재단선 R + S, 완성선 R로 둥글다', () => {
    const l = buildSquareLayout(golden, 10, 0.2, 20);
    const out = renderSquarePreviewSvg(l, paginate(l, 'a4'), 'ko');
    expect(out).toMatch(/class="piece piece-panels"[^>]*rx="30"/);
    expect(out).toContain('rx="20"');
    expect(out).not.toMatch(/class="piece piece-back"[^>]*rx=/);
  });

  it('완성 예상 그림은 둥근 윤곽으로 그리고, 지퍼·손잡이·치수를 그대로 담는다', () => {
    const out = renderSquareShapeSvg(golden, 'ko', 20);
    expect(out).toContain('class="body"');
    expect(out).toContain('class="face-top"');
    expect(out).toContain('class="zipper"');
    expect(out).toContain('class="handle"');
    for (const v of ['220mm', '140mm', '150mm', '30mm']) expect(out).toContain(v);
    // 각진 그림의 세 면 폴리곤은 쓰지 않는다.
    expect(out).not.toContain('face-front');
  });
});
