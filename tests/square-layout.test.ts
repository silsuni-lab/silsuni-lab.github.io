import { describe, expect, it } from 'vitest';
import { SQUARE_PRESETS } from '../src/core/constants';
import { buildSquareLayout, squareTitlePiece, type SquarePiece } from '../src/core/square/layout';

const golden = { widthMm: 220, depthMm: 140, sideHeightMm: 150, lidHeightMm: 30 };
const layout = buildSquareLayout(golden);
const piece = (id: string, l = layout) => l.pieces.find((p) => p.id === id)!;
const notchXs = (p: SquarePiece) => p.notchesMm.map((n) => Math.round((n.x1Mm - p.xMm - 10) * 1000) / 1000);

describe('buildSquareLayout — 계산', () => {
  it('앞면과 뒷면을 합치면 둘레다', () => {
    expect(layout.perimeterMm).toBe(720);
    expect(layout.backLengthMm).toBeCloseTo(144);
    expect(layout.frontLengthMm).toBeCloseTo(576);
    expect(layout.frontLengthMm + layout.backLengthMm).toBeCloseTo(layout.perimeterMm);
  });

  it('몸통은 옆면 − 뚜껑 − 지퍼, 손잡이는 가로의 1.3배다', () => {
    expect(layout.bodyHeightMm).toBe(110);
    expect(layout.handleLengthMm).toBe(286);
  });

  it('조각 다섯의 완성 치수와 장수', () => {
    const sizes = Object.fromEntries(
      layout.pieces.map((p) => [p.id, [p.count, Math.round(p.finishedWidthMm), p.finishedHeightMm]]),
    );
    expect(sizes).toEqual({
      frontTop: [1, 576, 30],
      frontBottom: [1, 576, 110],
      panels: [2, 220, 140],
      back: [1, 144, 150],
      handle: [1, 286, 50],
    });
  });

  it('재단 치수는 완성 + 2×시접이고, 시접 0이면 같다', () => {
    for (const p of layout.pieces) {
      expect(p.widthMm).toBeCloseTo(p.finishedWidthMm + 20);
      expect(p.heightMm).toBeCloseTo(p.finishedHeightMm + 20);
    }
    for (const p of buildSquareLayout(golden, 0).pieces) {
      expect(p.widthMm).toBeCloseTo(p.finishedWidthMm);
    }
  });
});

describe('buildSquareLayout — 배치', () => {
  it('늘 세 줄이다 — 윗단, 아랫단, 그리고 뚜껑·바닥 → 뒷면 → 손잡이', () => {
    expect(piece('frontTop').yMm).toBe(0);
    expect(piece('frontBottom').yMm).toBe(50 + 5);
    const row3 = 50 + 5 + 130 + 5;
    for (const id of ['panels', 'back', 'handle']) expect(piece(id).yMm).toBe(row3);
    expect(piece('panels').xMm).toBe(0);
    expect(piece('back').xMm).toBe(240 + 5);
    expect(piece('handle').xMm).toBeCloseTo(245 + 164 + 5);
  });

  it('조각끼리 겹치지 않는다 — 프리셋 셋 × 비율 다섯', () => {
    for (const preset of SQUARE_PRESETS) {
      for (const ratio of [0.1, 0.15, 0.2, 0.25, 0.3]) {
        const { pieces } = buildSquareLayout(preset, 10, ratio);
        for (const a of pieces) {
          for (const b of pieces) {
            if (a === b) continue;
            const apart = a.xMm + a.widthMm <= b.xMm || b.xMm + b.widthMm <= a.xMm ||
              a.yMm + a.heightMm <= b.yMm || b.yMm + b.heightMm <= a.yMm;
            expect(apart).toBe(true);
          }
        }
      }
    }
  });

  it('전체 크기는 가장 멀리 나간 조각까지다', () => {
    expect(layout.totalWidthMm).toBeCloseTo(Math.max(...layout.pieces.map((p) => p.xMm + p.widthMm)));
    expect(layout.totalHeightMm).toBe(190 + 170);
  });
});

describe('너치', () => {
  it('앞면 두 단에는 네 모서리 자리에 찍는다 — a, a+D, a+D+W, a+2D+W', () => {
    // a = (220 − 144)/2 = 38
    expect(notchXs(piece('frontTop'))).toEqual([38, 178, 398, 538]);
    expect(notchXs(piece('frontBottom'))).toEqual([38, 178, 398, 538]);
  });

  it('윗단은 위 변, 아랫단은 아래 변 — 지퍼 다는 변에는 없다', () => {
    const top = piece('frontTop');
    const bottom = piece('frontBottom');
    for (const n of top.notchesMm) {
      expect(n.y1Mm).toBe(top.yMm);
      expect(n.y2Mm).toBe(top.yMm + 5);
    }
    for (const n of bottom.notchesMm) {
      expect(n.y1Mm).toBe(bottom.yMm + bottom.heightMm);
      expect(n.y2Mm).toBe(bottom.yMm + bottom.heightMm - 5);
    }
  });

  it('뚜껑·바닥은 뒷변에 경첩 양 끝, 좌우 변 한가운데에 손잡이 자리', () => {
    const p = piece('panels');
    const top = p.notchesMm.filter((n) => n.y1Mm === p.yMm);
    expect(top.map((n) => n.x1Mm - p.xMm - 10)).toEqual([38, 182]);
    const sides = p.notchesMm.filter((n) => n.y1Mm !== p.yMm);
    expect(sides).toHaveLength(2);
    for (const n of sides) expect(n.y1Mm).toBe(p.yMm + 10 + 70);
    expect(sides.map((n) => n.x1Mm)).toEqual([p.xMm, p.xMm + p.widthMm]);
    expect(sides.map((n) => n.x2Mm)).toEqual([p.xMm + 5, p.xMm + p.widthMm - 5]);
  });

  it('경첩이 뒷면을 꽉 채우면(a = 0) 조각 끝과 겹치는 너치는 빼다', () => {
    // 200·200, 25% → 둘레 800, 뒷면 200 = 가로.
    const full = buildSquareLayout({ ...golden, widthMm: 200, depthMm: 200 }, 10, 0.25);
    expect(notchXs(piece('frontTop', full))).toEqual([200, 400]);
    const p = piece('panels', full);
    expect(p.notchesMm.filter((n) => n.y1Mm === p.yMm)).toHaveLength(0);
  });

  it('뒷면과 손잡이에는 없다', () => {
    expect(piece('back').notchesMm).toEqual([]);
    expect(piece('handle').notchesMm).toEqual([]);
  });
});

describe('손잡이 접힘선과 식서', () => {
  it('손잡이만 접힘선이 있고, 완성 높이 한가운데를 완성선 끝에서 끝까지 긋는다', () => {
    const h = piece('handle');
    expect(h.foldLinesMm).toEqual([{ x1Mm: h.xMm + 10, y1Mm: h.yMm + 10 + 25, x2Mm: h.xMm + 10 + 286, y2Mm: h.yMm + 10 + 25 }]);
    for (const p of layout.pieces) if (p.id !== 'handle') expect(p.foldLinesMm).toEqual([]);
  });

  it('식서는 모든 조각에서 가로이고 조각 안에 있다', () => {
    for (const p of layout.pieces) {
      const g = p.grainlineMm;
      expect(g.y1Mm).toBe(g.y2Mm);
      expect(Math.min(g.x1Mm, g.x2Mm)).toBeGreaterThan(p.xMm + 10);
      expect(Math.max(g.x1Mm, g.x2Mm)).toBeLessThan(p.xMm + p.widthMm - 10);
    }
  });
});

describe('squareTitlePiece', () => {
  it('손잡이는 후보에서 빠진다 — 가운데로 접힘선이 지나간다', () => {
    const fit = { blockHeightMm: 5, blockWidthMm: 5, reservedTopMm: 0, marginMm: 0 };
    expect(squareTitlePiece(layout, fit)!.id).not.toBe('handle');
    expect(squareTitlePiece(layout)!.id).toBe('frontBottom');
  });
});

describe('모서리 라운드', () => {
  const R = 20;
  const rounded = buildSquareLayout(golden, 10, 0.2, R);
  const q = (Math.PI * R) / 2;

  it('앞면 띠가 둥근 둘레만큼 짧아진다', () => {
    const P = 720 - (8 - 2 * Math.PI) * R;
    expect(rounded.perimeterMm).toBeCloseTo(P);
    expect(rounded.frontLengthMm + rounded.backLengthMm).toBeCloseTo(P);
    expect(piece('frontTop', rounded).finishedWidthMm).toBeCloseTo(P * 0.8);
  });

  it('뚜껑·바닥에만 반지름이 붙는다', () => {
    for (const p of rounded.pieces) expect(p.cornerRadiusMm).toBe(p.id === 'panels' ? R : 0);
  });

  it('띠의 너치는 네 호의 한가운데다', () => {
    const Lb = rounded.backLengthMm;
    const a = (220 - 2 * R - Lb) / 2;
    const c1 = a + q / 2;
    const c2 = c1 + q + (140 - 2 * R);
    const c3 = c2 + q + (220 - 2 * R);
    const c4 = c3 + q + (140 - 2 * R);
    const xs = notchXs(piece('frontTop', rounded));
    [c1, c2, c3, c4].forEach((c, i) => expect(xs[i]).toBeCloseTo(c, 2));
    // 띠 끝에서 끝까지 호 네 개와 곧은 변을 돌면 앞면 길이가 된다.
    expect(c4 + q / 2 + a).toBeCloseTo(rounded.frontLengthMm);
  });

  it('뚜껑·바닥은 네 호의 45° 자리에 너치를 받고, 너치는 재단선에서 시작한다', () => {
    const p = piece('panels', rounded);
    const diagonal = p.notchesMm.filter((n) => n.x1Mm !== n.x2Mm && n.y1Mm !== n.y2Mm);
    expect(diagonal).toHaveLength(4);
    const cx = p.xMm + 10 + R;
    const cy = p.yMm + 10 + R;
    const first = diagonal[0]!;
    expect(Math.hypot(first.x1Mm - cx, first.y1Mm - cy)).toBeCloseTo(R + 10);
    expect(Math.hypot(first.x2Mm - cx, first.y2Mm - cy)).toBeCloseTo(R + 10 - 5);
  });

  it('경첩 너치는 뒷변의 곧은 부분 안에 있다', () => {
    const p = piece('panels', rounded);
    const hinge = p.notchesMm.filter((n) => n.y1Mm === p.yMm);
    expect(hinge).toHaveLength(2);
    for (const n of hinge) {
      expect(n.x1Mm).toBeGreaterThanOrEqual(p.xMm + 10 + R);
      expect(n.x1Mm).toBeLessThanOrEqual(p.xMm + 10 + 220 - R);
    }
  });

  it('식서선은 둥근 모서리 안쪽에 머문다 — 가장 좁은 폭에 가장 큰 반지름에서도', () => {
    const tight = buildSquareLayout({ widthMm: 120, depthMm: 120, sideHeightMm: 100, lidHeightMm: 20 }, 10, 0.1, 30);
    const p = piece('panels', tight);
    const g = p.grainlineMm;
    const inside = (x: number, y: number) => {
      const left = p.xMm + 10, right = left + 120, top = p.yMm + 10, low = top + 120;
      const cx = Math.min(Math.max(x, left + 30), right - 30);
      const cy = Math.min(Math.max(y, top + 30), low - 30);
      return Math.hypot(x - cx, y - cy) <= 30;
    };
    expect(inside(g.x1Mm, g.y1Mm)).toBe(true);
    expect(inside(g.x2Mm, g.y2Mm)).toBe(true);
  });
});
