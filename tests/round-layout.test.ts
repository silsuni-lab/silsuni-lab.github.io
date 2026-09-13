import { describe, expect, it } from 'vitest';
import { buildRoundLayout, PIECE_GAP_MM, roundTitlePiece } from '../src/core/round/layout';
import { paginate } from '../src/core/tiling';
import { ROUND_RANGES, lidHeightMaxMm } from '../src/core/round/dimensions';
import { SEAM_MM, ZIPPER_ALLOWANCE_MM } from '../src/core/constants';

const golden = { diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 };

describe('buildRoundLayout — 도해 검산', () => {
  const layout = buildRoundLayout(golden);

  it('둘레는 지름 × π다', () => {
    expect(layout.circumferenceMm).toBeCloseTo(408.41, 2);
  });

  it('몸통 높이가 도해와 맞는다', () => {
    // 130 - 30 - 10 = 90. 도해의 '옆면 나머지 높이'와 같은 값이다.
    expect(layout.bodyHeightMm).toBe(90);
  });

  it('앞면과 뒷면을 이으면 둘레가 된다', () => {
    // 이게 깨지면 옆면을 원에 붙일 수 없다.
    expect(layout.frontLengthMm + layout.backLengthMm).toBeCloseTo(layout.circumferenceMm, 9);
  });
});

describe('조각', () => {
  const layout = buildRoundLayout(golden);
  const by = (id: string) => layout.pieces.find((p) => p.id === id)!;

  it('네 조각이 나온다', () => {
    expect(layout.pieces.map((p) => p.id).sort()).toEqual(
      ['back', 'circles', 'frontBottom', 'frontTop'].sort(),
    );
  });

  it('원은 한 장만 그리고 2장이라 적는다', () => {
    // 지름 150 원 하나를 아끼면 종이가 크게 준다.
    expect(by('circles').count).toBe(2);
    expect(by('circles').shape).toBe('circle');
    expect(by('circles').widthMm).toBe(150);
    expect(by('circles').heightMm).toBe(150);
  });

  it('사방에 시접이 붙는다', () => {
    // 네 조각 모두 모든 변이 다른 조각과 만난다.
    for (const p of layout.pieces) {
      expect(p.widthMm).toBeCloseTo(p.finishedWidthMm + 2 * SEAM_MM, 9);
      expect(p.heightMm).toBeCloseTo(p.finishedHeightMm + 2 * SEAM_MM, 9);
    }
  });

  it('앞면 두 단의 완성 높이 합에 지퍼를 더하면 옆면 높이다', () => {
    expect(by('frontTop').finishedHeightMm + by('frontBottom').finishedHeightMm + ZIPPER_ALLOWANCE_MM)
      .toBe(golden.sideHeightMm);
  });

  it('시접이 0이면 완성선이 곧 재단선이다', () => {
    const bare = buildRoundLayout(golden, 0);
    for (const p of bare.pieces) {
      expect(p.widthMm).toBeCloseTo(p.finishedWidthMm, 9);
    }
  });
});

describe('배치', () => {
  const layout = buildRoundLayout(golden);

  it('전체 크기가 모든 조각을 담는다', () => {
    for (const p of layout.pieces) {
      expect(p.xMm).toBeGreaterThanOrEqual(0);
      expect(p.yMm).toBeGreaterThanOrEqual(0);
      expect(p.xMm + p.widthMm).toBeLessThanOrEqual(layout.totalWidthMm + 0.001);
      expect(p.yMm + p.heightMm).toBeLessThanOrEqual(layout.totalHeightMm + 0.001);
    }
  });

  it('조각끼리 겹치지 않는다', () => {
    const ps = layout.pieces;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]!, b = ps[j]!;
        const apart =
          a.xMm + a.widthMm <= b.xMm + 0.001 || b.xMm + b.widthMm <= a.xMm + 0.001 ||
          a.yMm + a.heightMm <= b.yMm + 0.001 || b.yMm + b.heightMm <= a.yMm + 0.001;
        expect(apart, `${a.id}와 ${b.id}가 겹친다`).toBe(true);
      }
    }
  });

  it('줄 순서가 늘 같다', () => {
    /*
     * 종이 몇 장 아끼자고 조각이 매번 다른 자리에 가면 도안 읽는 사람이
     * 헷갈린다. 위에서부터 앞면 윗단 · 앞면 아랫단 · (원 + 뒷면)이다.
     */
    for (const d of [
      { diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 },
      golden,
      { diameterMm: 200, sideHeightMm: 160, lidHeightMm: 40 },
    ]) {
      const l = buildRoundLayout(d);
      const y = (id: string) => l.pieces.find((p) => p.id === id)!.yMm;
      expect(y('frontTop')).toBeLessThan(y('frontBottom'));
      expect(y('frontBottom')).toBeLessThan(y('circles'));
      expect(y('circles')).toBe(y('back'));
    }
  });

  it('조각 사이가 5mm 떨어져 있다', () => {
    const y = (id: string) => layout.pieces.find((p) => p.id === id)!;
    expect(y('frontBottom').yMm - (y('frontTop').yMm + y('frontTop').heightMm))
      .toBeCloseTo(PIECE_GAP_MM, 9);
  });
});

describe('종이 장수', () => {
  it('설계 문서의 표와 맞는다', () => {
    const cases: readonly [number, number, number, number, number][] = [
      [80, 60, 20, 2, 1],
      [130, 130, 30, 4, 2],
      [160, 100, 25, 4, 2],
      [200, 160, 40, 6, 4],
    ];
    for (const [d, s, l, a4, a3] of cases) {
      const layout = buildRoundLayout({ diameterMm: d, sideHeightMm: s, lidHeightMm: l });
      expect(paginate(layout, 'a4').pages.length, `${d}/${s}/${l} A4`).toBe(a4);
      expect(paginate(layout, 'a3').pages.length, `${d}/${s}/${l} A3`).toBe(a3);
    }
  });
});

describe('허용 범위 전체에서 깨지지 않는다', () => {
  it('겹침도 음수 조각도 없다', () => {
    for (let d = ROUND_RANGES.diameterMm.min; d <= ROUND_RANGES.diameterMm.max; d += 20) {
      for (let s = ROUND_RANGES.sideHeightMm.min; s <= ROUND_RANGES.sideHeightMm.max; s += 20) {
        const lid = Math.max(10, Math.floor(lidHeightMaxMm(s)));
        const layout = buildRoundLayout({ diameterMm: d, sideHeightMm: s, lidHeightMm: lid });
        for (const p of layout.pieces) {
          expect(p.widthMm).toBeGreaterThan(0);
          expect(p.heightMm).toBeGreaterThan(0);
        }
        expect(layout.bodyHeightMm).toBeGreaterThanOrEqual(20);
      }
    }
  });
});

describe('roundTitlePiece — 출처 문구가 앉을 조각', () => {
  it('가장 큰 조각을 고른다', () => {
    // 앞면 아랫단이 넓이가 가장 크다. 문구를 넣을 자리가 여기뿐이다.
    expect(roundTitlePiece(buildRoundLayout(golden))!.id).toBe('frontBottom');
  });

  it('원이 외접 사각형으로는 더 커 보이는 경우에도 사각 조각을 고른다', () => {
    // 원 넓이를 D*D로 재면 여기서 원이 뽑힌다. 지름에 비해 옆면이 낮은 치수다.
    expect(roundTitlePiece(buildRoundLayout({ diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 }))!.id).toBe('frontBottom');
    expect(roundTitlePiece(buildRoundLayout({ diameterMm: 300, sideHeightMm: 120, lidHeightMm: 10 }))!.id).toBe('frontBottom');
  });

  it('어떤 치수에서도 원을 고르지 않는다', () => {
    for (const d of [
      { diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 },
      { diameterMm: 300, sideHeightMm: 40, lidHeightMm: 10 },
      { diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 },
    ]) {
      expect(roundTitlePiece(buildRoundLayout(d))!.shape).toBe('rect');
    }
  });
});

/*
 * 식서방향(GRAINLINE). 사각과 같은 규칙을 따른다 — 기호만, 글자는 없다.
 *
 * 띠는 둘레 방향(가로)이다. 사각에서 지퍼와 나란히 잡은 것과 같은 결로,
 * 원통의 지퍼도 둘레를 돈다. 원은 세로다 — 파우치를 세워 둔 모양을 기준
 * 삼아야 결이 있는 원단에서 마개 무늬가 바로 선다.
 */
describe('식서방향 — 원통 조각', () => {
  const layout = buildRoundLayout(golden);
  const by = (id: string) => layout.pieces.find((p) => p.id === id)!;

  it('조각마다 하나씩 있다', () => {
    for (const piece of layout.pieces) {
      expect(piece.grainlineMm, piece.id).toBeDefined();
    }
  });

  it('띠 셋은 가로다 — 둘레 방향', () => {
    for (const id of ['frontTop', 'frontBottom', 'back']) {
      const g = by(id).grainlineMm;
      expect(g.y1Mm, id).toBe(g.y2Mm);
      expect(g.x1Mm, id).toBeLessThan(g.x2Mm);
    }
  });

  it('원은 세로다 — 마개 무늬가 바로 서게', () => {
    const g = by('circles').grainlineMm;
    expect(g.x1Mm).toBe(g.x2Mm);
    expect(g.y1Mm).toBeLessThan(g.y2Mm);
  });

  it('조각의 완성선 안쪽에 머문다', () => {
    const S = layout.seamMm;
    for (const piece of layout.pieces) {
      const g = piece.grainlineMm;
      expect(Math.min(g.x1Mm, g.x2Mm), piece.id).toBeGreaterThanOrEqual(piece.xMm + S);
      expect(Math.max(g.x1Mm, g.x2Mm), piece.id).toBeLessThanOrEqual(piece.xMm + piece.widthMm - S);
      // 왼쪽으로 물러나도 완성선 왼쪽 변을 넘지 않아야 한다.
      expect(Math.min(g.y1Mm, g.y2Mm), piece.id).toBeGreaterThanOrEqual(piece.yMm + S);
      expect(Math.max(g.y1Mm, g.y2Mm), piece.id).toBeLessThanOrEqual(piece.yMm + piece.heightMm - S);
    }
  });

  /*
   * 한가운데는 비운다. 거기엔 이미 글자가 앉는다 — 사각 조각은 위에 조각
   * 이름, 가운데에 출처 덩어리가 오고, 원은 세 줄을 한가운데 쌓는다.
   * 방향만 지키고 자리는 비켜 준다.
   */
  it('셋 다 가로로 왼쪽에 물러나 있다', () => {
    for (const p of layout.pieces) {
      const g = p.grainlineMm;
      expect(Math.max(g.x1Mm, g.x2Mm), p.id).toBeLessThan(p.xMm + p.widthMm / 2);
    }
  });

  it('띠는 세로로도 한 번 더 물러난다 — 좁은 조각에서 라벨을 피하려면 둘 다 필요하다', () => {
    for (const id of ['frontTop', 'frontBottom', 'back']) {
      const p = by(id);
      expect(p.grainlineMm.y1Mm, id).toBeGreaterThan(p.yMm + p.heightMm / 2);
    }
  });

  it('원은 높이만은 한가운데다 — 세로선이라 가로로만 비키면 된다', () => {
    const p = by('circles');
    const g = p.grainlineMm;
    expect((g.y1Mm + g.y2Mm) / 2).toBeCloseTo(p.yMm + p.heightMm / 2, 9);
  });

  it('원의 세로선이 원주 안에 머문다', () => {
    // 중심에서 물러난 만큼 쓸 수 있는 현이 짧아진다. 반지름으로 검산한다.
    const p = by('circles');
    const g = p.grainlineMm;
    const rMm = p.finishedWidthMm / 2;
    const dxMm = Math.abs(g.x1Mm - (p.xMm + p.widthMm / 2));
    const halfChordMm = Math.sqrt(rMm * rMm - dxMm * dxMm);
    expect((g.y2Mm - g.y1Mm) / 2).toBeLessThan(halfChordMm);
  });

  it('원의 세로선이 원 밖으로 나가지 않는다', () => {
    // 지름을 그대로 쓰면 양 끝이 원주에 닿는다. 화살촉이 선 밖으로 나가므로
    // 완성 지름보다 짧아야 한다.
    const circle = by('circles');
    const g = circle.grainlineMm;
    expect(g.y2Mm - g.y1Mm).toBeLessThan(circle.finishedHeightMm);
  });

  it('가장 납작한 파우치에서도 조각을 벗어나지 않는다', () => {
    const flat = buildRoundLayout({
      diameterMm: ROUND_RANGES.diameterMm.min,
      sideHeightMm: ROUND_RANGES.sideHeightMm.min,
      lidHeightMm: ROUND_RANGES.lidHeightMm.min,
    });
    for (const piece of flat.pieces) {
      const g = piece.grainlineMm;
      expect(Math.min(g.x1Mm, g.x2Mm), piece.id).toBeGreaterThanOrEqual(piece.xMm);
      expect(Math.max(g.x1Mm, g.x2Mm), piece.id).toBeLessThanOrEqual(piece.xMm + piece.widthMm);
      expect(Math.min(g.y1Mm, g.y2Mm), piece.id).toBeGreaterThanOrEqual(piece.yMm);
      expect(Math.max(g.y1Mm, g.y2Mm), piece.id).toBeLessThanOrEqual(piece.yMm + piece.heightMm);
    }
  });
});
