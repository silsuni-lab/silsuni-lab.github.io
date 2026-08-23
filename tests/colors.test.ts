import { describe, expect, it } from 'vitest';
import { hexToRgb01 } from '../src/core/colors';

describe('hexToRgb01', () => {
  it('검정과 흰색을 0과 1로 바꾼다', () => {
    expect(hexToRgb01('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb01('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('채널마다 다른 값을 제자리에 넣는다', () => {
    const { r, g, b } = hexToRgb01('#8a8175');
    expect(r).toBeCloseTo(0x8a / 255, 10);
    expect(g).toBeCloseTo(0x81 / 255, 10);
    expect(b).toBeCloseTo(0x75 / 255, 10);
  });

  it('세 자리 꼴을 여섯 자리와 같게 읽는다', () => {
    expect(hexToRgb01('#333')).toEqual(hexToRgb01('#333333'));
  });

  it('#을 붙이지 않아도 읽는다', () => {
    expect(hexToRgb01('4c4c4c')).toEqual(hexToRgb01('#4c4c4c'));
  });

  it('대문자로 적어도 읽는다', () => {
    expect(hexToRgb01('#B42318')).toEqual(hexToRgb01('#b42318'));
  });

  /*
   * 인쇄 색은 지금까지 rgb(0.3, 0.3, 0.3)처럼 0~1 실수로 적혀 있었다.
   * hex를 단일 출처로 삼으면 그 값이 반올림을 한 번 거친다. 눈으로는
   * 못 가르는 차이지만, 얼마나 벗어나는지는 알고 있어야 한다.
   */
  it('예전 인쇄 값과 채널당 1/255 안쪽에서 만난다', () => {
    const cases: readonly { hex: string; old: readonly [number, number, number] }[] = [
      { hex: '#000000', old: [0, 0, 0] },
      { hex: '#4c4c4c', old: [0.3, 0.3, 0.3] },
      { hex: '#8c8c8c', old: [0.55, 0.55, 0.55] },
      { hex: '#333333', old: [0.2, 0.2, 0.2] },
      { hex: '#d91a1a', old: [0.85, 0.1, 0.1] },
      { hex: '#b21a1a', old: [0.7, 0.1, 0.1] },
      { hex: '#807a70', old: [0.5, 0.48, 0.44] },
    ];
    for (const { hex, old } of cases) {
      const got = hexToRgb01(hex);
      expect(Math.abs(got.r - old[0])).toBeLessThan(1 / 255);
      expect(Math.abs(got.g - old[1])).toBeLessThan(1 / 255);
      expect(Math.abs(got.b - old[2])).toBeLessThan(1 / 255);
    }
  });

  it('hex가 아닌 값은 그냥 넘기지 않고 던진다', () => {
    // 조용히 검정을 돌려주면 색 하나가 사라진 걸 아무도 모른다.
    expect(() => hexToRgb01('#12345')).toThrow();
    expect(() => hexToRgb01('#gggggg')).toThrow();
    expect(() => hexToRgb01('')).toThrow();
  });
});
