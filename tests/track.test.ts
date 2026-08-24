import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../src/core/i18n/locales';
import { trackingEnabled, trackRecord } from '../src/track';

/*
 * 보내는 일(sendBeacon·fetch)은 브라우저 것이라 여기서 못 본다.
 * 대신 "무엇을 보내는가"와 "언제 안 보내는가"를 지킨다. 시트에 쌓인 뒤에는
 * 되돌릴 수 없어서, 모양이 틀어지면 그날부터의 기록이 통째로 어긋난다.
 */

const base = {
  kind: 'box' as const,
  sessionId: 'abc-123',
  widthMm: 150,
  heightMm: 90,
  depthMm: 50,
  paper: 'a4' as const,
  seamMm: 10,
  foldHalf: false,
  lang: 'ko' as const,
};

describe('trackRecord — 시트에 쌓일 한 줄', () => {
  it('치수를 입력한 그대로 남긴다', () => {
    // 구간으로 묶어 보내면 나중에 다른 구간으로 다시 볼 수 없다.
    const record = trackRecord({ ...base, widthMm: 173, heightMm: 88, depthMm: 41 });
    expect(record.w).toBe(173);
    expect(record.h).toBe(88);
    expect(record.d).toBe(41);
  });

  it('시접은 넣었는지 여부로 남긴다', () => {
    expect(trackRecord({ ...base, seamMm: 10 }).seam).toBe(true);
    expect(trackRecord({ ...base, seamMm: 0 }).seam).toBe(false);
  });

  it('용지와 반접기를 그대로 담는다', () => {
    const record = trackRecord({ ...base, paper: 'a3', foldHalf: true });
    expect(record.paper).toBe('a3');
    expect(record.fold).toBe(true);
  });

  it('탭 표시를 담는다', () => {
    // 이게 없으면 한 사람이 사이즈를 바꿔가며 세 번 받은 걸 세 명으로 센다.
    expect(trackRecord(base).sid).toBe('abc-123');
  });

  it('어느 언어 페이지에서 받았는지 담는다', () => {
    expect(trackRecord(base).lang).toBe('ko');
    expect(trackRecord({ ...base, lang: 'en' }).lang).toBe('en');
  });

  it('파우치 종류를 담는다', () => {
    // 이게 없으면 시트에서 사각과 원통 기록이 섞여 구분이 안 된다.
    expect(trackRecord(base).kind).toBe('box');
    expect(trackRecord({ ...base, kind: 'round' }).kind).toBe('round');
  });

  it('정해 둔 아홉 칸 말고는 아무것도 보내지 않는다', () => {
    // 시트 열 순서가 여기 맞춰져 있다. 늘리려면 시트도 함께 고칠 것.
    expect(Object.keys(trackRecord(base)).sort()).toEqual(
      ['d', 'fold', 'h', 'kind', 'lang', 'paper', 'seam', 'sid', 'w'].sort(),
    );
  });

  it('JSON으로 바꿔도 값이 그대로다', () => {
    expect(JSON.parse(JSON.stringify(trackRecord(base)))).toEqual(trackRecord(base));
  });
});

describe('trackingEnabled — 주소가 없으면 보내지 않는다', () => {
  it('빈 주소면 꺼진다', () => {
    // 로컬 개발과 남이 포크해 빌드한 사이트가 시트를 더럽히지 않게 하는 잠금이다.
    expect(trackingEnabled('')).toBe(false);
  });

  it('주소가 있으면 켜진다', () => {
    expect(trackingEnabled('https://script.google.com/macros/s/AKfy.../exec')).toBe(true);
  });
});

describe('받는 쪽 계약 — docs/tracking.md의 Apps Script', () => {
  /*
   * 받는 쪽은 저장소 밖(구글 시트에 붙인 스크립트)에 있어 타입이 닿지 않는다.
   * 그 스크립트의 언어 목록에 없는 값은 조용히 버려지므로, 로케일을 늘리고
   * 문서를 안 고치면 그 페이지의 다운로드가 통계에서 통째로 사라진다 —
   * 오류도 안 나고 시트만 비어 있어 한참 뒤에야 알아챈다.
   *
   * 붙여 넣을 코드가 문서에 글자로 있으니, 그 글자를 여기서 읽어 LOCALES와
   * 맞춘다. 문서를 안전망 안으로 끌어들이는 유일한 방법이다.
   */
  const doc = readFileSync('docs/tracking.md', 'utf8');

  it('Apps Script의 LANGS가 LOCALES와 같다', () => {
    const line = doc.match(/var LANGS = \[([^\]]*)\];/)?.[1];
    expect(line, 'docs/tracking.md에 var LANGS 선언이 없다').toBeTruthy();
    const langs = [...line!.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(langs).toEqual([...LOCALES]);
  });

  it('언어 열 설명이 로케일을 모두 적는다', () => {
    const row = doc.split('\n').find((l) => l.startsWith('| `언어` |'));
    expect(row, '언어 열 설명이 없다').toBeTruthy();
    for (const locale of LOCALES) {
      expect(row, `${locale}이 표에 없다`).toContain(`\`${locale}\``);
    }
  });

  it('보내는 값과 받는 값의 키가 같다', () => {
    // trackRecord가 내는 키가 appendRow의 data.* 와 어긋나면 열이 밀린다.
    const keys = Object.keys(trackRecord(base));
    for (const key of keys) {
      // \b가 없으면 data.w가 data.widthMm에도 걸려, 키 이름이 바뀌어도 통과한다.
      expect(doc, `appendRow에 data.${key}가 없다`).toMatch(new RegExp(`data\\.${key}\\b`));
    }
  });
});
