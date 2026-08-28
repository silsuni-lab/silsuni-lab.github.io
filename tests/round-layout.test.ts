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
