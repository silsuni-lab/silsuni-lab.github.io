# 원통 파우치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/round/` 경로에 원통 파우치 도안 생성기를 더한다. 사각 파우치 화면과 계산은 건드리지 않는다.

**Architecture:** 페이지를 나누고(Vite 진입점 둘) 계산·PDF 기계는 공유한다. `core/tiling.ts`는 크기만 받도록 좁히고, `core/pdf.ts`에서 종류와 무관한 페이지 기계를 `core/page.ts`로 갈라낸다. 원통 전용 코드는 `core/round/`·`ui/round/`에 새로 둔다.

**Tech Stack:** TypeScript 5.9 (strict, `noUncheckedIndexedAccess`), Vite 8, Vitest 4, pdf-lib 1.17 + @pdf-lib/fontkit, 빌드 산출물은 GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-23-round-pouch-design.md`

## Global Constraints

- 시접 `S = 10mm`, 지퍼 여유 `Z = 10mm` — `src/core/constants.ts`의 `SEAM_MM`·`ZIPPER_ALLOWANCE_MM`를 그대로 쓴다. 새 상수를 만들지 않는다.
- 원주율은 `Math.PI`. `3.14` 같은 근사 상수를 두지 않는다.
- 뒷면 비율 기본 `0.2`, 범위 `0.10 ~ 0.30`.
- 유효 범위: 지름 `80~300`, 옆면 높이 `40~300`, 뚜껑 높이 `10 ~ min(옆면/2, 옆면−10−20)`.
- 조각 사이 간격 `5mm`. 배치는 항상 세 줄(앞면 윗단 / 앞면 아랫단 / 원+뒷면).
- 도안 이름 `동글동글 원통 파우치`, 파일명 접두사 `round-pouch-`, 페이지 제목 `동글동글 원통 파우치 패턴 나와라 얍!`.
- 계산은 실수로 하고 **표시할 때만** 소수 첫째 자리로 반올림한다.
- 모든 주석과 사용자 문구는 한국어. 기존 파일의 주석 밀도와 어투를 따른다.
- 각 작업은 `npm test`와 `npx tsc --noEmit`이 모두 통과한 뒤 커밋한다.

---

## 파일 구조

```
새로 만든다
  src/core/page.ts              종류와 무관한 PDF 페이지 기계 (pdf.ts에서 갈라냄)
  src/core/round/dimensions.ts  원통 치수 타입·검증·이름·파일명
  src/core/round/layout.ts      조각 계산과 배치
  src/core/round/pdf.ts         원통 조각 그리기
  src/ui/round/preview.ts       미리보기 SVG
  src/ui/round/shape.ts         완성 예상 사시도
  round/index.html              원통 페이지
  round/main.ts                 원통 화면 조립
  tests/round-dimensions.test.ts
  tests/round-layout.test.ts
  tests/round-pdf.test.ts
  tests/round-preview.test.ts

고친다
  src/core/tiling.ts            paginate가 크기만 받게
  src/core/pdf.ts               페이지 기계를 page.ts에서 가져다 쓰게
  src/core/constants.ts         원통 프리셋
  src/core/korean-font.ts       새 글자 (스크립트가 다시 만듦)
  scripts/build-korean-font.py  CHARS 목록
  src/track.ts                  kind 필드
  src/main.ts                   kind: 'box', 원통 페이지 링크
  index.html                    원통 페이지 링크
  vite.config.ts                진입점 둘
  docs/tracking.md              종류 열 + 분당 상한
  README.md
```

---

### Task 1: 타일링이 크기만 받게 좁히기

`paginate`가 `Layout` 전체를 받지만 실제로 쓰는 건 `totalWidthMm`·`totalHeightMm` 둘뿐이다. 원통은 `Layout`이 아니므로 이 문을 좁혀야 통과할 수 있다. 순수 리팩터라 기존 테스트가 그대로 통과해야 한다.

**Files:**
- Modify: `src/core/tiling.ts:59`
- Test: `tests/tiling.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `export interface SheetSize { readonly totalWidthMm: number; readonly totalHeightMm: number }`, `paginate(sheet: SheetSize, paper: PaperSize): Pagination`

- [ ] **Step 1: 크기 객체만 넘겨도 도는지 확인하는 테스트를 쓴다**

`tests/tiling.test.ts` 맨 아래에 더한다.

```ts
describe('paginate — Layout이 아니라 크기만 받는다', () => {
  it('totalWidthMm·totalHeightMm만 있는 객체를 받는다', () => {
    // 원통 파우치는 Layout이 아니다. 이 문이 좁아야 통과할 수 있다.
    const sheet = { totalWidthMm: 346.7, totalHeightMm: 320 };
    const pagination = paginate(sheet, 'a4');
    expect(pagination.pages.length).toBe(4);
  });

  it('Layout을 그대로 넘겨도 예전과 같다', () => {
    const layout = buildLayout({ widthMm: 200, heightMm: 50, depthMm: 50 });
    expect(paginate(layout, 'a4').pages.length).toBe(paginate(
      { totalWidthMm: layout.totalWidthMm, totalHeightMm: layout.totalHeightMm },
      'a4',
    ).pages.length);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/tiling.test.ts`
Expected: 타입 오류 또는 FAIL — `paginate`가 `Layout`을 요구한다.

- [ ] **Step 3: 시그니처를 좁힌다**

`src/core/tiling.ts`에서 `import type { Layout }`을 지우고 아래를 더한다.

```ts
/**
 * 종이에 놓을 도안의 전체 크기. 타일링은 이것 말고는 아무것도 안 본다.
 * Layout을 통째로 받으면 사각 파우치 전용이 되어 원통이 못 지나간다.
 */
export interface SheetSize {
  readonly totalWidthMm: number;
  readonly totalHeightMm: number;
}
```

`paginate`의 시그니처를 바꾼다.

```ts
export function paginate(sheet: SheetSize, paper: PaperSize): Pagination {
```

본문의 `layout.totalWidthMm`·`layout.totalHeightMm`를 `sheet.`로 바꾼다.

- [ ] **Step 4: 전체 테스트가 통과하는지 본다**

Run: `npm test && npx tsc --noEmit`
Expected: 모두 PASS. `Layout`은 `SheetSize`의 필드를 다 가지므로 호출부를 안 고쳐도 통과한다.

- [ ] **Step 5: 커밋**

```bash
git add src/core/tiling.ts tests/tiling.test.ts
git commit -m "타일링이 도안 전체가 아니라 크기만 받게 하기"
```

---

### Task 2: 원통 치수와 검증

**Files:**
- Create: `src/core/round/dimensions.ts`
- Test: `tests/round-dimensions.test.ts`

**Interfaces:**
- Consumes: `SEAM_MM`, `ZIPPER_ALLOWANCE_MM`, `Range` (`src/core/constants.ts`)
- Produces:
  - `RoundField = 'diameterMm' | 'sideHeightMm' | 'lidHeightMm'`
  - `RoundDimensions { diameterMm, sideHeightMm, lidHeightMm }`
  - `ROUND_FIELD_ORDER`, `ROUND_FIELD_LABELS`, `ROUND_RANGES`
  - `BACK_RATIO_DEFAULT/MIN/MAX`, `MIN_BODY_MM`
  - `lidHeightMaxMm(sideHeightMm): number`
  - `RoundValidationResult`, `validateRoundDimensions(input, backRatio?)`
  - `ROUND_PATTERN_NAME`, `roundPatternTitle(d, seamMm)`, `roundPatternFileName(d, paper, seamMm)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/round-dimensions.test.ts`를 만든다.

```ts
import { describe, expect, it } from 'vitest';
import {
  BACK_RATIO_DEFAULT,
  BACK_RATIO_MAX,
  BACK_RATIO_MIN,
  lidHeightMaxMm,
  roundPatternFileName,
  roundPatternTitle,
  validateRoundDimensions,
} from '../src/core/round/dimensions';

const ok = { diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 };

describe('lidHeightMaxMm — 뚜껑 상한은 두 겹이다', () => {
  it('낮은 파우치는 몸통 최소 20이 상한을 정한다', () => {
    // 옆면/2만 걸면 옆면 40에 뚜껑 20이 통과하고 몸통이 10만 남는다.
    expect(lidHeightMaxMm(40)).toBe(10);
  });

  it('큰 파우치는 옆면의 절반이 상한을 정한다', () => {
    // 몸통 조건만 걸면 뚜껑이 몸통보다 긴 조합이 통과한다.
    expect(lidHeightMaxMm(130)).toBe(65);
    expect(lidHeightMaxMm(300)).toBe(150);
  });
});

describe('validateRoundDimensions', () => {
  it('올바른 값을 통과시킨다', () => {
    const result = validateRoundDimensions(ok);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(ok);
  });

  it('범위를 벗어난 지름을 잡는다', () => {
    // 지름 80보다 작으면 원 시접의 곡률이 심해 접히지 않는다.
    const result = validateRoundDimensions({ ...ok, diameterMm: 70 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.field).toBe('diameterMm');
  });

  it('뚜껑이 상한을 넘으면 잡는다', () => {
    const result = validateRoundDimensions({ diameterMm: 130, sideHeightMm: 40, lidHeightMm: 20 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === 'lidHeightMm')).toBe(true);
  });

  it('빈 칸과 숫자가 아닌 값을 잡는다', () => {
    expect(validateRoundDimensions({ ...ok, diameterMm: '' }).ok).toBe(false);
    expect(validateRoundDimensions({ ...ok, diameterMm: '어제' }).ok).toBe(false);
  });

  it('뒷면 비율이 범위를 벗어나면 잡는다', () => {
    // 0.5면 지퍼가 반원보다 짧아져 뚜껑이 물리적으로 안 젖혀진다.
    expect(validateRoundDimensions(ok, 0.5).ok).toBe(false);
    expect(validateRoundDimensions(ok, BACK_RATIO_MIN).ok).toBe(true);
    expect(validateRoundDimensions(ok, BACK_RATIO_MAX).ok).toBe(true);
    expect(validateRoundDimensions(ok, BACK_RATIO_DEFAULT).ok).toBe(true);
  });
});

describe('이름과 파일명', () => {
  it('도안 이름에 세 치수를 붙인다', () => {
    expect(roundPatternTitle(ok, 10)).toBe('동글동글 원통 파우치 130*130*30');
  });

  it('시접 없이 뽑았으면 못 박는다', () => {
    // 종이만 돌아다니면 화면을 볼 수 없고, 모르고 재단하면 원단을 버린다.
    expect(roundPatternTitle(ok, 0)).toBe('동글동글 원통 파우치 130*130*30 시접없음');
  });

  it('파일명이 사각 파우치와 겹치지 않는다', () => {
    expect(roundPatternFileName(ok, 'a4', 10)).toBe('round-pouch-130x130x30-a4.pdf');
    expect(roundPatternFileName(ok, 'a3', 0)).toBe('round-pouch-130x130x30-a3-noseam.pdf');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/round-dimensions.test.ts`
Expected: FAIL — 모듈을 찾지 못한다.

- [ ] **Step 3: 구현한다**

`src/core/round/dimensions.ts`를 만든다.

```ts
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { SEAM_MM, ZIPPER_ALLOWANCE_MM, type Range } from '../constants';

export type RoundField = 'diameterMm' | 'sideHeightMm' | 'lidHeightMm';

export interface RoundDimensions {
  readonly diameterMm: number;
  readonly sideHeightMm: number;
  readonly lidHeightMm: number;
}

/** 입력칸 배치와 오류 문구가 모두 이 순서를 따른다. */
export const ROUND_FIELD_ORDER: readonly RoundField[] = ['diameterMm', 'sideHeightMm', 'lidHeightMm'];

export const ROUND_FIELD_LABELS: Record<RoundField, string> = {
  diameterMm: '지름',
  sideHeightMm: '옆면 높이',
  lidHeightMm: '뚜껑 높이',
};

/** 몸통이 이보다 낮으면 물건이 안 들어간다. */
export const MIN_BODY_MM = 20;

/*
 * 지름 하한 80은 시접 때문이다. 원에 시접 10을 붙이면 재단 지름이 100인데,
 * 그보다 작아지면 곡률이 심해 시접이 접히지 않는다.
 *
 * 옆면 하한 40은 뚜껑 최소 10 + 지퍼 10 + 몸통 최소 20의 합이다.
 */
export const ROUND_RANGES: Record<RoundField, Range> = {
  diameterMm: { min: 80, max: 300 },
  sideHeightMm: { min: 40, max: 300 },
  lidHeightMm: { min: 10, max: 150 },
};

/*
 * 뒷면은 절대 길이가 아니라 둘레에 대한 비율로 뜻이 정해진다. 80mm는 지름
 * 130에서 19.6%지만 지름 50에서는 50.9%가 되어 뚜껑이 안 젖혀지고, 지름
 * 300에서는 8.5%로 경첩이 흐물거린다.
 *
 * 상한 0.3은 지퍼가 원의 절반(180°)보다 짧아지지 않게 하는 값이고,
 * 하한 0.1은 경첩이 버티게 하는 값이다.
 */
export const BACK_RATIO_DEFAULT = 0.2;
export const BACK_RATIO_MIN = 0.1;
export const BACK_RATIO_MAX = 0.3;

/**
 * 옆면 높이가 정하는 뚜껑 높이의 상한.
 *
 * 두 겹인 이유가 있다. `옆면/2`만 걸면 옆면 40에 뚜껑 20이 통과하는데 그때
 * 몸통이 10밖에 안 된다. 반대로 몸통 조건만 걸면 큰 파우치에서 뚜껑이
 * 몸통보다 긴 조합이 통과한다. 둘 다 필요하다.
 */
export function lidHeightMaxMm(sideHeightMm: number): number {
  return Math.min(sideHeightMm / 2, sideHeightMm - ZIPPER_ALLOWANCE_MM - MIN_BODY_MM);
}

export interface RoundFieldError {
  readonly field: RoundField | 'backRatio';
  readonly message: string;
}

export type RoundValidationResult =
  | { readonly ok: true; readonly value: RoundDimensions }
  | { readonly ok: false; readonly errors: readonly RoundFieldError[] };

export function validateRoundDimensions(
  input: Record<RoundField, unknown>,
  backRatio: number = BACK_RATIO_DEFAULT,
): RoundValidationResult {
  const errors: RoundFieldError[] = [];
  const values: Partial<Record<RoundField, number>> = {};

  for (const field of ROUND_FIELD_ORDER) {
    const raw = input[field];
    const { min, max } = ROUND_RANGES[field];
    const label = ROUND_FIELD_LABELS[field];
    const num = typeof raw === 'number' ? raw : Number(raw);

    if (raw === '' || raw === null || raw === undefined || !Number.isFinite(num)) {
      errors.push({ field, message: `${label}를 숫자로 넣어주세요.` });
      continue;
    }
    if (num < min || num > max) {
      errors.push({ field, message: `${label}는 ${min}에서 ${max} 사이여야 합니다.` });
      continue;
    }
    values[field] = num;
  }

  // 뚜껑 상한은 옆면에 딸려 있어 값 하나씩으로는 못 잡는다.
  const side = values.sideHeightMm;
  const lid = values.lidHeightMm;
  if (side !== undefined && lid !== undefined) {
    const cap = lidHeightMaxMm(side);
    if (lid > cap) {
      errors.push({
        field: 'lidHeightMm',
        message: `옆면 높이 ${side}에서는 뚜껑 높이가 ${Math.floor(cap)} 이하여야 합니다.`,
      });
    }
  }

  if (backRatio < BACK_RATIO_MIN || backRatio > BACK_RATIO_MAX) {
    errors.push({
      field: 'backRatio',
      message: `뒷면 비율은 ${BACK_RATIO_MIN * 100}%에서 ${BACK_RATIO_MAX * 100}% 사이여야 합니다.`,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const { diameterMm, sideHeightMm, lidHeightMm } = values;
  if (diameterMm === undefined || sideHeightMm === undefined || lidHeightMm === undefined) {
    throw new Error('치수 검사를 통과했는데 값이 비어 있습니다.');
  }
  return { ok: true, value: { diameterMm, sideHeightMm, lidHeightMm } };
}

/** 도안에 찍는 이름. 화면 제목과 같은 말을 쓴다. */
export const ROUND_PATTERN_NAME = '동글동글 원통 파우치';

/**
 * 도안에 찍을 한 줄. 치수 순서는 화면·라벨과 같은 지름*옆면*뚜껑이다.
 *
 * 시접 없이 뽑았으면 그렇다고 못 박는다. 종이만 따로 돌아다니면 화면을
 * 볼 수 없고, 모르고 재단하면 원단을 버린다.
 */
export function roundPatternTitle(d: RoundDimensions, seamMm: number = SEAM_MM): string {
  const base = `${ROUND_PATTERN_NAME} ${d.diameterMm}*${d.sideHeightMm}*${d.lidHeightMm}`;
  return seamMm === 0 ? `${base} 시접없음` : base;
}

/** 내려받는 PDF의 파일 이름. 사각 파우치(box-pouch-)와 겹치지 않게 한다. */
export function roundPatternFileName(
  d: RoundDimensions,
  paper: string,
  seamMm: number = SEAM_MM,
): string {
  const seam = seamMm === 0 ? '-noseam' : '';
  return `round-pouch-${d.diameterMm}x${d.sideHeightMm}x${d.lidHeightMm}-${paper}${seam}.pdf`;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/round-dimensions.test.ts && npx tsc --noEmit`
Expected: 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/core/round/dimensions.ts tests/round-dimensions.test.ts
git commit -m "원통 파우치 치수와 검증 더하기"
```

---

### Task 3: 조각 계산과 배치

**Files:**
- Create: `src/core/round/layout.ts`
- Test: `tests/round-layout.test.ts`

**Interfaces:**
- Consumes: Task 2의 `RoundDimensions`, `BACK_RATIO_DEFAULT`; `SEAM_MM`, `ZIPPER_ALLOWANCE_MM`
- Produces:
  - `PIECE_GAP_MM = 5`
  - `RoundPieceId = 'circles' | 'frontTop' | 'frontBottom' | 'back'`
  - `RoundPiece { id, label, count, shape: 'rect' | 'circle', xMm, yMm, widthMm, heightMm, finishedWidthMm, finishedHeightMm }`
  - `RoundLayout { dimensions, seamMm, backRatio, circumferenceMm, backLengthMm, frontLengthMm, bodyHeightMm, pieces, totalWidthMm, totalHeightMm }`
  - `buildRoundLayout(dimensions, seamMm?, backRatio?): RoundLayout`
  - `roundTitlePiece(layout): RoundPiece | undefined`

`RoundPiece`의 `xMm`·`yMm`는 재단 도형의 왼쪽 위 모서리다. 원도 같은 규칙을 쓴다(외접 사각형의 왼쪽 위). `widthMm`·`heightMm`는 시접을 포함한 재단 치수, `finished*`는 완성 치수다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/round-layout.test.ts`를 만든다.

```ts
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
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/round-layout.test.ts`
Expected: FAIL — 모듈을 찾지 못한다.

- [ ] **Step 3: 구현한다**

`src/core/round/layout.ts`를 만든다.

```ts
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { SEAM_MM, ZIPPER_ALLOWANCE_MM } from '../constants';
import { BACK_RATIO_DEFAULT, type RoundDimensions } from './dimensions';

/** 조각 사이에 남기는 간격 (mm). 가위가 지나갈 자리다. */
export const PIECE_GAP_MM = 5;

export type RoundPieceId = 'circles' | 'frontTop' | 'frontBottom' | 'back';

export interface RoundPiece {
  readonly id: RoundPieceId;
  readonly label: string;
  /** 이 본으로 몇 장을 재단하는가. 원은 한 장만 그리고 2장이라 적는다. */
  readonly count: number;
  readonly shape: 'rect' | 'circle';
  /** 재단 도형의 왼쪽 위 모서리. 원은 외접 사각형의 왼쪽 위다. */
  readonly xMm: number;
  readonly yMm: number;
  /** 시접을 포함한 재단 치수. */
  readonly widthMm: number;
  readonly heightMm: number;
  /** 시접을 뺀 완성 치수. 박음질선을 그릴 때 쓴다. */
  readonly finishedWidthMm: number;
  readonly finishedHeightMm: number;
}

export interface RoundLayout {
  readonly dimensions: RoundDimensions;
  readonly seamMm: number;
  readonly backRatio: number;
  readonly circumferenceMm: number;
  readonly backLengthMm: number;
  readonly frontLengthMm: number;
  readonly bodyHeightMm: number;
  readonly pieces: readonly RoundPiece[];
  readonly totalWidthMm: number;
  readonly totalHeightMm: number;
}

/**
 * 조각 넷을 계산하고 종이에 앉힌다.
 *
 * 배치는 늘 세 줄이다 — 앞면 윗단, 앞면 아랫단, 그리고 원과 뒷면이 나란히.
 * 빈틈없이 채우는 배치는 일부러 하지 않는다. 종이 몇 장 아끼자고 조각이
 * 매번 다른 자리에 가면 도안을 읽는 사람이 헷갈린다.
 */
export function buildRoundLayout(
  dimensions: RoundDimensions,
  seamMm: number = SEAM_MM,
  backRatio: number = BACK_RATIO_DEFAULT,
): RoundLayout {
  const { diameterMm: D, sideHeightMm: Hs, lidHeightMm: Hl } = dimensions;
  const S = seamMm;

  const circumferenceMm = D * Math.PI;
  const backLengthMm = circumferenceMm * backRatio;
  const frontLengthMm = circumferenceMm - backLengthMm;
  const bodyHeightMm = Hs - Hl - ZIPPER_ALLOWANCE_MM;

  const cut = (finished: number) => finished + 2 * S;

  // 1줄과 2줄은 앞면이 통째로 차지한다. 가장 넓은 조각이라 기준이 된다.
  const frontCutWidth = cut(frontLengthMm);
  const topCutHeight = cut(Hl);
  const bottomCutHeight = cut(bodyHeightMm);
  const circleCut = cut(D);
  const backCutWidth = cut(backLengthMm);
  const backCutHeight = cut(Hs);

  const row3Y = topCutHeight + PIECE_GAP_MM + bottomCutHeight + PIECE_GAP_MM;

  const pieces: readonly RoundPiece[] = [
    {
      id: 'frontTop', label: '앞면 윗단', count: 1, shape: 'rect',
      xMm: 0, yMm: 0,
      widthMm: frontCutWidth, heightMm: topCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: Hl,
    },
    {
      id: 'frontBottom', label: '앞면 아랫단', count: 1, shape: 'rect',
      xMm: 0, yMm: topCutHeight + PIECE_GAP_MM,
      widthMm: frontCutWidth, heightMm: bottomCutHeight,
      finishedWidthMm: frontLengthMm, finishedHeightMm: bodyHeightMm,
    },
    {
      id: 'circles', label: '뚜껑·바닥', count: 2, shape: 'circle',
      xMm: 0, yMm: row3Y,
      widthMm: circleCut, heightMm: circleCut,
      finishedWidthMm: D, finishedHeightMm: D,
    },
    {
      id: 'back', label: '뒷면', count: 1, shape: 'rect',
      xMm: circleCut + PIECE_GAP_MM, yMm: row3Y,
      widthMm: backCutWidth, heightMm: backCutHeight,
      finishedWidthMm: backLengthMm, finishedHeightMm: Hs,
    },
  ];

  const totalWidthMm = Math.max(...pieces.map((p) => p.xMm + p.widthMm));
  const totalHeightMm = Math.max(...pieces.map((p) => p.yMm + p.heightMm));

  return {
    dimensions, seamMm: S, backRatio,
    circumferenceMm, backLengthMm, frontLengthMm, bodyHeightMm,
    pieces, totalWidthMm, totalHeightMm,
  };
}

/**
 * 출처 문구를 앉힐 조각. 넓이가 가장 큰 것을 고른다.
 *
 * 사각 파우치는 앞판 한가운데가 늘 가장 넓게 비어 있지만, 원통은 치수에
 * 따라 어느 조각이 가장 큰지 달라질 수 있다.
 */
export function roundTitlePiece(layout: RoundLayout): RoundPiece | undefined {
  return [...layout.pieces].sort(
    (a, b) => b.finishedWidthMm * b.finishedHeightMm - a.finishedWidthMm * a.finishedHeightMm,
  )[0];
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/round-layout.test.ts && npx tsc --noEmit`
Expected: 모두 PASS. 종이 장수 4가지와 겹침 검사가 특히 중요하다.

- [ ] **Step 5: 커밋**

```bash
git add src/core/round/layout.ts tests/round-layout.test.ts
git commit -m "원통 파우치 조각 계산과 배치 더하기"
```

---

### Task 4: PDF 페이지 기계를 갈라내기

`pdf.ts`가 700줄이 넘고 그 안에 종류와 무관한 페이지 기계가 섞여 있다. 원통도 같은 기계를 써야 하므로 갈라낸다. 순수 리팩터라 기존 테스트가 그대로 통과해야 한다.

**Files:**
- Create: `src/core/page.ts`
- Modify: `src/core/pdf.ts`
- Test: `tests/pdf.test.ts` (import 경로만)

**Interfaces:**
- Consumes: `Pagination`, `Page` (`core/tiling.ts`)
- Produces (`core/page.ts`에서):
  - `MM_TO_PT`, `MARK_COLOR`, `SCALE_COLOR`, `JOIN_DIAMOND_COLOR`
  - `toFramePoint`, `toPagePoint`
  - `joinMarksFor`, `JoinMark`, `JOIN_DIAMOND_MM`
  - `gridLabelPointMm`, `patternNotePointMm`, `PATTERN_NOTE`
  - `scaleSquareRectMm`, `SCALE_SQUARE_MM`, `SCALE_SQUARE_LABEL`
  - `drawAlignmentMarks`, `drawJoinMarks`, `drawPatternNote`, `drawScaleSquare`
  - `titleScale`, `TITLE_SCALE_MAX`, `TITLE_MARGIN_MM`, `TITLE_SIZE`, `MESSAGE_SIZE`, `HANDLE_SIZE`, `MESSAGE_OFFSET_MM`, `HANDLE_OFFSET_MM`
  - `KOREAN_FONT_CHARS`, `KOREAN_BOLD_FONT_CHARS` (지금 `pdf.ts:26`·`:54`에 있다)
  - `PageContext` 타입
  - `loadFonts(doc): Promise<{ font: PDFFont; boldFont: PDFFont }>`
  - `drawSourceBlock(ctx, font, xMm, centerYMm, availableHeightMm, title)` — 이름·권유·계정 세 줄을 한 덩어리로 그린다

**주의:** 지금 `pdf.ts`에는 페이지 바탕을 칠하는 상수(`PAGE_BG` 같은 것)가 **없다.** 페이지는 흰 종이 그대로 둔다. 새로 만들지 말 것.

`pdf.ts`는 이것들을 `export`로 다시 내보내 기존 테스트의 import 경로를 깨지 않는다.

- [ ] **Step 1: 기존 테스트가 그대로 통과하는지 먼저 확인한다**

Run: `npm test`
Expected: 284 PASS. 리팩터 전 기준선을 잡아 둔다.

- [ ] **Step 2: `core/page.ts`를 만들고 기계를 옮긴다**

`src/core/pdf.ts`에서 아래를 잘라 `src/core/page.ts`로 옮긴다. 파일 머리에 SPDX 두 줄과 아래 주석을 단다.

```ts
/*
 * 종이를 만드는 기계. 파우치 종류와 무관하다.
 *
 * 격자·맞춤표·이어붙임 표시·3cm 정사각형·하단 문구·좌표 변환·출처 문구는
 * 어떤 도안이든 똑같이 필요하다. 여기 두면 사각과 원통이 나눠 쓴다.
 * 무엇을 그리는지(전개도냐 조각이냐)는 종류별 모듈이 정한다.
 */
```

옮기는 것: `MM_TO_PT`, 색 상수 중 `MARK_COLOR`·`SCALE_COLOR`·`JOIN_DIAMOND_COLOR`, `decodeBase64`, `KOREAN_FONT_CHARS`, `KOREAN_BOLD_FONT_CHARS`, `toFramePoint`, `toPagePoint`, `JoinMark`, `JOIN_DIAMOND_MM`, `joinMarksFor`, `gridLabelPointMm`, `patternNotePointMm`, `PATTERN_NOTE`, `SCALE_SQUARE_MM`, `SCALE_SQUARE_LABEL`, `scaleSquareRectMm`, `drawAlignmentMarks`, `drawJoinMarks`, `drawPatternNote`, `drawScaleSquare`, `PageContext`, `titleScale`과 그 상수들.

지금 `buildPdf` 안에 흩어져 있는 폰트 적재를 함수로 묶는다.

```ts
/**
 * 한글 서브셋 폰트 두 벌을 문서에 심는다. 본문용(400)과 도안 하단
 * 강조용(700)이다. 파일 안에 담겨 있어 따로 받아오지 않는다.
 */
export async function loadFonts(doc: PDFDocument): Promise<{ font: PDFFont; boldFont: PDFFont }> {
  doc.registerFontkit(fontkit);
  return {
    font: await doc.embedFont(decodeBase64(KOREAN_FONT_BASE64)),
    boldFont: await doc.embedFont(decodeBase64(KOREAN_BOLD_FONT_BASE64)),
  };
}
```

`drawCenterAndTitle`에서 출처 문구를 그리는 부분만 떼어 아래 함수로 옮긴다.

```ts
/**
 * 도안 이름·권유·계정 세 줄을 한 덩어리로 그린다.
 *
 * 덩어리를 주어진 자리 한가운데에 맞춘다. 이름을 가운데 두고 아래로
 * 늘어뜨리면 아래쪽 자리만 쓰게 되어 키울 수 있는 폭이 절반으로 준다.
 * 덩어리 세로는 실제 글꼴에서 잰다 — 어림한 비율로 잡으면 글꼴을 바꿀 때
 * 조용히 넘친다.
 */
export function drawSourceBlock(
  ctx: PageContext,
  font: PDFFont,
  xMm: number,
  centerYMm: number,
  availableHeightMm: number,
  title: string,
): void {
  const aboveMm = font.heightAtSize(TITLE_SIZE) / MM_TO_PT / 2;
  const belowMm = HANDLE_OFFSET_MM + font.heightAtSize(HANDLE_SIZE) / MM_TO_PT / 2;
  const scale = titleScale(availableHeightMm, aboveMm + belowMm);
  const titleYMm = centerYMm - ((aboveMm + belowMm) * scale) / 2 + aboveMm * scale;

  const draw = (value: string, size: number, yMm: number, opacity?: number) => {
    const anchor = toPagePoint(ctx.pagination, ctx.page, xMm, yMm);
    ctx.pdfPage.drawText(value, {
      x: anchor.x - font.widthOfTextAtSize(value, size) / 2,
      y: anchor.y,
      size,
      font,
      color: MARK_COLOR,
      ...(opacity === undefined ? {} : { opacity }),
    });
  };

  draw(title, TITLE_SIZE * scale, titleYMm);
  // 권유 한 줄은 계정보다 작게. 옅어 보이는 일은 색이 아니라
  // 투명도가 맡는다 — 색까지 옅으면 인쇄에서 사라진다.
  draw(WATERMARK_MESSAGE, MESSAGE_SIZE * scale, titleYMm + MESSAGE_OFFSET_MM * scale, WATERMARK_OPACITY);
  // 계정은 이름보다도 크게. 여기가 강조하고 싶은 자리다.
  draw(WATERMARK_HANDLE, HANDLE_SIZE * scale, titleYMm + HANDLE_OFFSET_MM * scale, WATERMARK_OPACITY);
}
```

- [ ] **Step 3: `pdf.ts`가 `page.ts`를 쓰게 하고 다시 내보낸다**

`src/core/pdf.ts` 머리에 더한다.

```ts
import {
  drawAlignmentMarks, drawJoinMarks, drawPatternNote, drawScaleSquare,
  drawSourceBlock, loadFonts, MARK_COLOR, MM_TO_PT, PAGE_BG,
  toFramePoint, toPagePoint, type PageContext,
} from './page';

// 예전 경로로 가져다 쓰던 곳이 깨지지 않게 다시 내보낸다.
export {
  MM_TO_PT, SCALE_SQUARE_MM, JOIN_DIAMOND_MM, SCALE_SQUARE_LABEL, PATTERN_NOTE,
  joinMarksFor, gridLabelPointMm, patternNotePointMm, scaleSquareRectMm,
  toFramePoint, toPagePoint, titleScale, TITLE_SCALE_MAX, TITLE_MARGIN_MM,
} from './page';
```

`drawCenterAndTitle`은 앞판을 찾아 `drawSourceBlock`을 부르는 얇은 함수로 줄인다.

```ts
function drawCenterAndTitle(ctx: PageContext, layout: Layout, font: PDFFont) {
  const { pagination, page } = ctx;
  const xMm = centerXMm(layout);

  ctx.pdfPage.drawLine({
    start: toPagePoint(pagination, page, xMm, 0),
    end: toPagePoint(pagination, page, xMm, layout.totalHeightMm),
    thickness: 0.4,
    color: CENTER_COLOR,
    dashArray: [8, 3, 1.5, 3],
  });

  const point = patternTitlePointMm(layout);
  const front = layout.bands.find((band) => band.id === 'front');
  if (point === undefined || front === undefined) return;

  drawSourceBlock(ctx, font, point.xMm, point.yMm, front.heightMm,
    patternTitle(layout.dimensions, layout.seamMm));
}
```

- [ ] **Step 4: 기존 테스트가 그대로 통과하는지 확인한다**

Run: `npm test && npx tsc --noEmit`
Expected: 284 PASS. 하나라도 깨지면 옮기다 무언가를 빠뜨린 것이다.

빌드로 산출물이 같은지도 본다.

Run: `npm run build`
Expected: 성공

- [ ] **Step 5: 커밋**

```bash
git add src/core/page.ts src/core/pdf.ts
git commit -m "PDF 페이지 기계를 종류와 무관한 자리로 갈라내기"
```

---

### Task 5: 한글 폰트에 새 글자

원통 도안에 찍힐 글자가 지금 서브셋에 없다. **목록만 고치고 스크립트를 안 돌리면 조용히 빈칸으로 인쇄된다.**

**Files:**
- Modify: `scripts/build-korean-font.py:38-42`
- Modify: `src/core/page.ts`의 `KOREAN_FONT_CHARS` (Task 4에서 옮겨 둔 자리)
- Modify: `src/core/korean-font.ts` (스크립트가 다시 만든다)

**Interfaces:**
- Consumes: Task 2의 `ROUND_PATTERN_NAME`, Task 3의 조각 라벨
- Produces: 새 글자가 든 서브셋

원통이 새로 쓰는 글자 — 도안 이름 `동글동글 원통 파우치`, 조각 라벨 `뚜껑·바닥`·`앞면 윗단`·`앞면 아랫단`·`뒷면`, 그리고 `지름`.

- [ ] **Step 1: 어떤 글자가 빠졌는지 센다**

```bash
python3 - <<'PY'
have = set(" !*@_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcilmnsu각게골들만보사선세시쁘없어예요우음인접지치퍼파하확")
need = set('동글동글 원통 파우치뚜껑바닥앞면윗단아랫뒷지름')
print('새로 필요:', ''.join(sorted(need - have)))
PY
```

- [ ] **Step 2: 목록 두 곳을 함께 고친다**

`scripts/build-korean-font.py`의 `CHARS["KOREAN_FONT_BASE64"]`와 `src/core/page.ts`의 `KOREAN_FONT_CHARS`에 Step 1이 알려준 글자를 더한다. **두 곳이 같아야 한다** — 테스트가 대조한다.

- [ ] **Step 3: 테스트가 먼저 실패하는지 본다**

Run: `npx vitest run tests/pdf.test.ts`
Expected: FAIL — 목록에는 있는데 글꼴 바이너리에 없다고 잡는다.

- [ ] **Step 4: 스크립트를 돌려 폰트를 다시 만든다**

```bash
python3 -m pip install fonttools brotli
python3 scripts/build-korean-font.py
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test && npx tsc --noEmit`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
git add scripts/build-korean-font.py src/core/page.ts src/core/korean-font.ts
git commit -m "원통 도안에 쓰는 글자를 서브셋 폰트에 더하기"
```

---

### Task 6: 원통 PDF

**Files:**
- Create: `src/core/round/pdf.ts`
- Test: `tests/round-pdf.test.ts`

**Interfaces:**
- Consumes: Task 3의 `RoundLayout`·`RoundPiece`·`roundTitlePiece`, Task 4의 `core/page.ts` 전부, Task 2의 `roundPatternTitle`
- Produces: `buildRoundPdf(layout: RoundLayout, pagination: Pagination): Promise<Uint8Array>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/round-pdf.test.ts`를 만든다.

```ts
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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/round-pdf.test.ts`
Expected: FAIL — 모듈을 찾지 못한다.

- [ ] **Step 3: 구현한다**

`src/core/round/pdf.ts`를 만든다. `core/pdf.ts`의 `buildPdf`가 페이지를 도는 방식을 그대로 따르되, 그리는 내용만 조각으로 바꾼다.

```ts
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import type { Pagination } from '../tiling';
import {
  drawAlignmentMarks, drawJoinMarks, drawPatternNote, drawScaleSquare,
  drawSourceBlock, loadFonts, MM_TO_PT, toPagePoint,
  type PageContext,
} from '../page';
import { roundPatternTitle } from './dimensions';
import { roundTitlePiece, type RoundLayout, type RoundPiece } from './layout';

const CUT_COLOR = rgb(0, 0, 0);
const SEAM_COLOR = rgb(0.3, 0.3, 0.3);
const LABEL_COLOR = rgb(0.2, 0.2, 0.2);

/** 조각 하나의 재단선. 원과 사각형을 같은 함수로 받는다. */
function drawPieceOutline(ctx: PageContext, piece: RoundPiece, insetMm: number, color: typeof CUT_COLOR, thickness: number) {
  const { pagination, page } = ctx;
  if (piece.shape === 'circle') {
    const rMm = piece.widthMm / 2 - insetMm;
    if (rMm <= 0) return;
    const center = toPagePoint(pagination, page, piece.xMm + piece.widthMm / 2, piece.yMm + piece.heightMm / 2);
    ctx.pdfPage.drawCircle({ x: center.x, y: center.y, size: rMm * MM_TO_PT, borderColor: color, borderWidth: thickness });
    return;
  }
  const topLeft = toPagePoint(pagination, page, piece.xMm + insetMm, piece.yMm + insetMm);
  ctx.pdfPage.drawRectangle({
    x: topLeft.x,
    y: topLeft.y - (piece.heightMm - 2 * insetMm) * MM_TO_PT,
    width: (piece.widthMm - 2 * insetMm) * MM_TO_PT,
    height: (piece.heightMm - 2 * insetMm) * MM_TO_PT,
    borderColor: color,
    borderWidth: thickness,
  });
}

/** 조각 이름과 장수. 몇 장을 재단할지 여기서만 알 수 있다. */
function drawPieceLabel(ctx: PageContext, piece: RoundPiece, font: PDFFont) {
  const size = 9;
  const text = piece.count > 1 ? `${piece.label} ${piece.count}장` : piece.label;
  const anchor = toPagePoint(
    ctx.pagination, ctx.page,
    piece.xMm + piece.widthMm / 2,
    piece.yMm + piece.heightMm / 2,
  );
  ctx.pdfPage.drawText(text, {
    x: anchor.x - font.widthOfTextAtSize(text, size) / 2,
    y: anchor.y,
    size,
    font,
    color: LABEL_COLOR,
  });
}

export async function buildRoundPdf(layout: RoundLayout, pagination: Pagination): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { font, boldFont } = await loadFonts(doc);
  const titlePiece = roundTitlePiece(layout);

  for (const page of pagination.pages) {
    const pdfPage = doc.addPage([pagination.pageWidthMm * MM_TO_PT, pagination.pageHeightMm * MM_TO_PT]);
    const ctx: PageContext = { pdfPage, pagination, page };

    /*
     * 배율 확인용 사각형은 첫 장에만, 도안보다 먼저 그린다. 나중에 그리면
     * 흰 바탕이 재단선을 끊는다. 사각 파우치의 buildPdf와 같은 순서다.
     */
    if (page === pagination.pages[0]) drawScaleSquare(pdfPage, pagination, font);

    for (const piece of layout.pieces) {
      // 재단선이 가장 굵고 진하다. 가위가 지나갈 선이다.
      drawPieceOutline(ctx, piece, 0, CUT_COLOR, 1.2);
      // 완성선은 시접만큼 안으로 들어간 자리. 시접이 0이면 그리지 않는다.
      if (layout.seamMm > 0) drawPieceOutline(ctx, piece, layout.seamMm, SEAM_COLOR, 0.5);
      drawPieceLabel(ctx, piece, font);
    }

    if (titlePiece !== undefined) {
      drawSourceBlock(
        ctx, font,
        titlePiece.xMm + titlePiece.widthMm / 2,
        titlePiece.yMm + titlePiece.heightMm / 2,
        titlePiece.finishedHeightMm,
        roundPatternTitle(layout.dimensions, layout.seamMm),
      );
    }

    drawAlignmentMarks(ctx, font);
    drawJoinMarks(ctx, font);
    drawPatternNote(ctx, boldFont);
  }

  return doc.save();
}
```

**주의:** `drawScaleSquare`·`drawPatternNote`·`drawAlignmentMarks`·`drawJoinMarks`·`loadFonts`의 실제 시그니처는 Task 4에서 옮긴 그대로여야 한다. 다르면 여기 호출을 맞춘다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/round-pdf.test.ts && npx tsc --noEmit`
Expected: 모두 PASS

- [ ] **Step 5: 눈으로 한 번 본다**

```bash
cat > /tmp/round-look.mjs <<'JS'
import { buildRoundLayout } from './src/core/round/layout.ts';
import { buildRoundPdf } from './src/core/round/pdf.ts';
import { paginate } from './src/core/tiling.ts';
import { writeFileSync } from 'node:fs';
const l = buildRoundLayout({ diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 });
writeFileSync('/tmp/round.pdf', await buildRoundPdf(l, paginate(l, 'a3')));
JS
npx vite-node /tmp/round-look.mjs && sips -s format png --out /tmp/round.png /tmp/round.pdf
```

조각 넷이 겹치지 않고, 라벨이 조각 안에 있고, 출처 문구가 앞면 아랫단을 벗어나지 않는지 본다.

- [ ] **Step 6: 커밋**

```bash
git add src/core/round/pdf.ts tests/round-pdf.test.ts
git commit -m "원통 파우치 PDF 만들기"
```

---

### Task 7: 원통 미리보기 SVG

**Files:**
- Create: `src/ui/round/preview.ts`
- Test: `tests/round-preview.test.ts`

**Interfaces:**
- Consumes: Task 3의 `RoundLayout`, `Pagination`, `escapeXml`(`src/ui/preview.ts`에서 가져온다)
- Produces: `renderRoundPreviewSvg(layout, pagination): string`, `roundLegendItems(layout): LegendItem[]`

`LegendItem`은 `src/ui/preview.ts:225`에 이미 `export`되어 있다. 그대로 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/round-preview.test.ts`를 만든다.

```ts
import { describe, expect, it } from 'vitest';
import { buildRoundLayout } from '../src/core/round/layout';
import { paginate } from '../src/core/tiling';
import { renderRoundPreviewSvg, roundLegendItems } from '../src/ui/round/preview';

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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/round-preview.test.ts`
Expected: FAIL — 모듈을 찾지 못한다.

- [ ] **Step 3: 구현한다**

`src/ui/round/preview.ts`를 만든다. 색은 `src/ui/preview.ts`와 같은 값을 쓰되, 그 파일에서 `export`해 가져다 쓴다. **색을 복사해 적지 말 것** — 한쪽만 고치면 두 화면이 다른 색이 된다.

```ts
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { Pagination } from '../../core/tiling';
import type { RoundLayout, RoundPiece } from '../../core/round/layout';
import { escapeXml, CUT_COLOR, SEAM_COLOR, TILE_COLOR, PATTERN_FILL, type LegendItem } from '../preview';

const round1 = (v: number) => Math.round(v * 10) / 10;

/*
 * 선 굵기와 글자 크기는 도안 폭에 비례시킨다. mm 고정값으로 두면 작은
 * 도안에서 선이 굵고 글자가 커 보이고, 큰 도안에서는 반대가 된다.
 */
const CUT_STROKE_RATIO = 0.004;
const THIN_STROKE_RATIO = 0.002;
const LABEL_RATIO = 0.026;

function pieceShape(piece: RoundPiece, insetMm: number, cls: string, stroke: string, width: number): string {
  const fill = insetMm === 0 ? PATTERN_FILL : 'none';
  if (piece.shape === 'circle') {
    const r = piece.widthMm / 2 - insetMm;
    if (r <= 0) return '';
    return `<circle class="${cls}" cx="${round1(piece.xMm + piece.widthMm / 2)}"` +
      ` cy="${round1(piece.yMm + piece.heightMm / 2)}" r="${round1(r)}"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="${round1(width)}" />`;
  }
  return `<rect class="${cls}" x="${round1(piece.xMm + insetMm)}" y="${round1(piece.yMm + insetMm)}"` +
    ` width="${round1(piece.widthMm - 2 * insetMm)}" height="${round1(piece.heightMm - 2 * insetMm)}"` +
    ` fill="${fill}" stroke="${stroke}" stroke-width="${round1(width)}" />`;
}

export function renderRoundPreviewSvg(layout: RoundLayout, pagination: Pagination): string {
  const w = layout.totalWidthMm;
  const h = layout.totalHeightMm;
  const cutStroke = w * CUT_STROKE_RATIO;
  const thinStroke = w * THIN_STROKE_RATIO;
  const labelSize = round1(w * LABEL_RATIO);

  const shapes = layout.pieces
    .map((p) => {
      // 재단선이 먼저다. 완성선은 시접만큼 안으로 들어간 자리라 위에 얹는다.
      const cut = pieceShape(p, 0, `piece piece-${p.id}`, CUT_COLOR, cutStroke);
      // 시접이 0이면 완성선이 재단선과 같은 자리다. 겹쳐 그으면 선만 두꺼워진다.
      const seam = layout.seamMm > 0
        ? pieceShape(p, layout.seamMm, 'seam-line', SEAM_COLOR, thinStroke)
        : '';
      return cut + seam;
    })
    .join('');

  const labels = layout.pieces
    .map((p) => {
      const text = p.count > 1 ? `${p.label} ${p.count}장` : p.label;
      return `<text class="piece-label" x="${round1(p.xMm + p.widthMm / 2)}"` +
        ` y="${round1(p.yMm + p.heightMm / 2)}" text-anchor="middle"` +
        ` dominant-baseline="middle" font-size="${labelSize}" fill="#333">${escapeXml(text)}</text>`;
    })
    .join('');

  // 페이지 경계는 도안 위에 얹어야 보인다. 먼저 그리면 조각 채움이 덮는다.
  const tiles = pagination.pages
    .map((page) =>
      `<rect class="page-tile" x="${round1(page.xMm)}" y="${round1(page.yMm)}"` +
      ` width="${round1(pagination.contentWidthMm)}" height="${round1(pagination.contentHeightMm)}"` +
      ` fill="none" stroke="${TILE_COLOR}" stroke-width="${round1(thinStroke)}"` +
      ` stroke-dasharray="${round1(thinStroke * 4)} ${round1(thinStroke * 3)}" />`)
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}"`,
    ` style="overflow: visible; width: 100%; max-width: 100%; height: auto;" role="img"`,
    ` aria-label="${escapeXml(`원통 파우치 조각 ${layout.pieces.length}종 미리보기`)}">`,
    shapes, tiles, labels,
    `</svg>`,
  ].join('');
}

/**
 * 범례는 실제로 그린 선만, 실제로 쓴 색으로 담는다. 원통에는 골선도
 * 중앙선도 없다 — 그리지도 않은 선을 적어 두면 도면에서 찾다가 헤맨다.
 */
export function roundLegendItems(layout: RoundLayout): readonly LegendItem[] {
  const items: LegendItem[] = [
    { swatch: 'swatch-cut', color: CUT_COLOR, text: '재단선 — 이 선을 따라 자릅니다' },
    { swatch: 'swatch-tile', color: TILE_COLOR, text: '페이지 경계 — 잘라 붙이는 자리' },
  ];
  if (layout.seamMm > 0) {
    items.splice(1, 0, {
      swatch: 'swatch-seam', color: SEAM_COLOR,
      text: `완성선 — 재단선에서 ${layout.seamMm}mm 안쪽`,
    });
  }
  return items;
}
```

**색을 복사해 적지 말 것.** `CUT_COLOR`·`SEAM_COLOR`·`TILE_COLOR`·`PATTERN_FILL`은 지금 `src/ui/preview.ts`에 `const`로만 있으므로 `export`를 붙여 가져다 쓴다. 두 파일에 값을 따로 적으면 한쪽만 고쳤을 때 두 화면이 다른 색이 되고 아무도 못 잡는다.

`page.xMm`·`page.yMm`와 `pagination.contentWidthMm`의 실제 이름은 `src/core/tiling.ts`의 `Page`·`Pagination`을 보고 맞춘다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/round-preview.test.ts && npx tsc --noEmit`
Expected: 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/ui/round/preview.ts tests/round-preview.test.ts
git commit -m "원통 파우치 미리보기 그리기"
```

---

### Task 8: 완성 예상 사시도

**Files:**
- Create: `src/ui/round/shape.ts`
- Test: `tests/round-preview.test.ts`에 describe 블록을 더한다

**Interfaces:**
- Consumes: Task 2의 `RoundDimensions`
- Produces: `renderRoundShapeSvg(d: RoundDimensions): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/round-preview.test.ts` 아래에 더한다.

```ts
import { renderRoundShapeSvg } from '../src/ui/round/shape';

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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/round-preview.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현한다**

`src/ui/round/shape.ts`를 만든다. 원통을 옆에서 본 모습으로 그린다 — 위 타원, 아래 타원, 좌우 세로선, 뚜껑 높이 자리에 지퍼선 하나. 타원의 납작한 정도(`ry/rx`)는 사각 파우치의 사선 투영 30°와 맞춰 `0.3` 근처로 잡고, 그려 보고 조정한다.

`src/ui/shape.ts`와 같이 여백·글자·선 굵기를 그림 폭에 비례시킨다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/round-preview.test.ts && npx tsc --noEmit`
Expected: 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/ui/round/shape.ts tests/round-preview.test.ts
git commit -m "원통 파우치 완성 예상 그림 그리기"
```

---

### Task 9: `/round/` 페이지 붙이기

**Files:**
- Create: `round/index.html`, `round/main.ts`
- Modify: `vite.config.ts`, `index.html`, `src/main.ts`, `src/core/constants.ts`, `src/style.css`

**Interfaces:**
- Consumes: Task 2·3·6·7·8 전부
- Produces: 도는 페이지 두 개

- [ ] **Step 1: Vite에 진입점을 더한다**

`vite.config.ts`:

```ts
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  /*
   * 페이지를 둘로 나눈다. 나누면 각 화면이 자기 제목을 가지므로 사이트
   * 제목을 안 바꿔도 되고, 종류를 고르는 UI도 필요 없다. base가 './'라
   * 하위 경로에서 자산 경로가 '../assets/'로 알아서 맞는다.
   */
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        round: resolve(__dirname, 'round/index.html'),
      },
    },
  },
  test: { environment: 'node' },
});
```

- [ ] **Step 2: 원통 프리셋을 더한다**

`src/core/constants.ts`:

```ts
export interface RoundPreset {
  readonly id: string;
  readonly label: string;
  readonly diameterMm: number;
  readonly sideHeightMm: number;
  readonly lidHeightMm: number;
}

/** 작은 것, 도해와 같은 크기, 큰 것으로 잡았다. */
export const ROUND_PRESETS: readonly RoundPreset[] = [
  { id: 'coin', label: '동전·이어폰 파우치', diameterMm: 80, sideHeightMm: 60, lidHeightMm: 20 },
  { id: 'cotton', label: '화장솜 케이스', diameterMm: 130, sideHeightMm: 130, lidHeightMm: 30 },
  { id: 'sewingbox', label: '반짇고리', diameterMm: 160, sideHeightMm: 100, lidHeightMm: 25 },
];
```

- [ ] **Step 3: `round/index.html`을 만든다**

`index.html`을 본떠 만들되 이렇게 바꾼다.

- `<title>동글동글 원통 파우치 패턴 나와라 얍!</title>`
- `<h1><strong>동글동글 원통 파우치</strong> <span class="head-tail">패턴 나와라 얍!</span></h1>`
- 머리말 사진(`head-photo`)은 원통 사진이 없으므로 뺀다
- 골선접기 자리(`#fold-field`)를 빼고 그 자리에 뒷면 비율 선택(`#back-field`)을 둔다
- 스크립트는 `<script type="module" src="./main.ts"></script>`
- 머리말 아래에 사각 파우치로 가는 링크

```html
<p class="other-kind"><a href="../">사각 파우치 도안 만들러 가기 →</a></p>
```

미리보기 아래에 **만드는 순서 안내**를 넣는다. 설계 3.4에서 "도안에 그리지 않고 화면 안내로만 둔다"고 정한 부분이다. 가위집도 여기서 알린다.

```html
<section class="panel" aria-labelledby="steps-heading">
  <h2 class="section" id="steps-heading">만드는 순서</h2>
  <ol class="steps">
    <li>앞면 윗단과 아랫단 사이에 지퍼를 답니다. 지퍼는 앞면 길이보다 길어야 합니다.</li>
    <li>지퍼로 이어진 앞면의 좌우를 뒷면 좌우와 이어 원통을 만듭니다.</li>
    <li>위 둘레에 뚜껑 원을, 아래 둘레에 바닥 원을 붙입니다.</li>
    <li><strong>곡선 시접에는 가위집을 넣어주세요.</strong> 넣지 않으면 뒤집었을 때 시접이 울어 모양이 안 나옵니다.</li>
  </ol>
  <p class="steps-note">뒷면은 지퍼가 지나가지 않아 뚜껑과 몸통을 잇는 경첩이 됩니다.</p>
</section>
```

`src/style.css`에 `.steps`·`.steps-note`를 더한다. 본문 크기에 목록 들여쓰기만 있으면 충분하다.

- [ ] **Step 4: `index.html`에 원통으로 가는 링크를 더한다**

`made-by` 줄 아래에 같은 모양으로 넣는다.

```html
<p class="other-kind"><a href="./round/">동글동글 원통 파우치 도안 만들러 가기 →</a></p>
```

`src/style.css`에 `.other-kind`를 더한다. `.made-by`와 같은 급으로 두되 링크 색은 `--info`를 쓴다.

- [ ] **Step 5: `round/main.ts`를 만든다**

`src/main.ts`를 본떠 만든다. 흐름(검증 → 계산 → 미리보기 → 다운로드)과 오류 처리, 낡은 화면 되살리기는 **그대로 옮긴다.** 다른 점만 아래 코드로 적는다.

```ts
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { ROUND_PRESETS, SEAM_MM, type RoundPreset } from '../src/core/constants';
import {
  BACK_RATIO_DEFAULT,
  roundPatternFileName,
  validateRoundDimensions,
} from '../src/core/round/dimensions';
import { buildRoundLayout } from '../src/core/round/layout';
import { paginate, type PaperSize } from '../src/core/tiling';
import { renderRoundPreviewSvg, roundLegendItems } from '../src/ui/round/preview';
import { renderRoundShapeSvg } from '../src/ui/round/shape';
import { trackDownload } from '../src/track';
import { isStaleChunkError, keepState, takeState } from '../src/stale';
import '../src/style.css';

let paper: PaperSize = 'a4';
let addSeam = true;
// 뒷면은 절대 길이가 아니라 둘레 비율로 뜻이 정해진다 — dimensions.ts 참고.
let backRatio = BACK_RATIO_DEFAULT;

function refresh(): void {
  const result = validateRoundDimensions(readRoundInputs(), backRatio);
  if (!result.ok) { /* src/main.ts와 같은 모양으로 오류를 보여주고 비운다 */ return; }

  shapeEl.innerHTML = renderRoundShapeSvg(result.value);

  const layout = buildRoundLayout(result.value, addSeam ? SEAM_MM : 0, backRatio);
  const byPaper = { a4: paginate(layout, 'a4'), a3: paginate(layout, 'a3') };

  previewEl.innerHTML = renderRoundPreviewSvg(layout, byPaper[paper]);
  legendEl.innerHTML = roundLegendItems(layout).map(/* src/main.ts와 같다 */).join('');
  setPaperCount('a4', byPaper.a4.pages.length);
  setPaperCount('a3', byPaper.a3.pages.length);
}

async function download(): Promise<void> {
  const result = validateRoundDimensions(readRoundInputs(), backRatio);
  if (!result.ok) return;

  const layout = buildRoundLayout(result.value, addSeam ? SEAM_MM : 0, backRatio);
  const pagination = paginate(layout, paper);
  // 장수 경고는 src/main.ts의 PAGE_WARN_THRESHOLD를 그대로 쓴다.

  downloadBtn.disabled = true;
  try {
    // PDF 생성기는 한글 폰트와 fontkit을 끌고 와 첫 로딩을 무겁게 만든다.
    const { buildRoundPdf } = await import('../src/core/round/pdf');
    const bytes = await buildRoundPdf(layout, pagination);
    // Blob → objectURL → link.click() → setTimeout revoke: src/main.ts와 같다.
    link.download = roundPatternFileName(result.value, paper, layout.seamMm);

    trackDownload({
      kind: 'round',
      // 원통도 치수 칸 셋을 그대로 쓴다 — w에 지름, h에 옆면, d에 뚜껑이다.
      widthMm: result.value.diameterMm,
      heightMm: result.value.sideHeightMm,
      depthMm: result.value.lidHeightMm,
      paper,
      seamMm: layout.seamMm,
      foldHalf: false,   // 원통에는 반접기가 없다
    });
  } catch (error) {
    if (isStaleChunkError(error) && keepState(currentState())) {
      location.reload();
      return;
    }
    // 나머지는 src/main.ts와 같다.
  } finally {
    downloadBtn.disabled = false;
  }
}
```

입력칸을 그리는 `renderInputs`·`readInputs`·`writeInputValues`는 `DimensionField`에 묶여 있어 그대로 못 쓴다. `src/ui/form.ts`의 것을 본떠 `round/`에서 `RoundField`용으로 만들거나, `form.ts`의 함수들을 필드 타입에 대해 일반화한다. **어느 쪽이든 사각 파우치 화면의 동작이 바뀌면 안 된다** — 기존 테스트가 지킨다.

- [ ] **Step 6: 두 페이지가 모두 도는지 본다**

```bash
npm run build && npx vite preview --port 4190
```

브라우저로 `/`와 `/round/`를 열어 각각 PDF를 받아 본다. 콘솔에 오류가 없어야 한다.

- [ ] **Step 7: 통과를 확인하고 커밋**

Run: `npm test && npx tsc --noEmit && npm run build`

```bash
git add vite.config.ts index.html round src/main.ts src/core/constants.ts src/style.css
git commit -m "원통 파우치 페이지를 /round/에 붙이기"
```

---

### Task 10: 기록에 종류 더하기

**Files:**
- Modify: `src/track.ts`, `src/main.ts`, `round/main.ts`
- Modify: `tests/track.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `PouchKind = 'box' | 'round'`, `TrackRecord`에 `kind` 추가

- [ ] **Step 1: 테스트를 먼저 고친다**

`tests/track.test.ts`에서 `base`에 `kind: 'box'`를 더하고 아래를 더한다.

```ts
it('파우치 종류를 담는다', () => {
  // 이게 없으면 시트에서 사각과 원통 기록이 섞여 구분이 안 된다.
  expect(trackRecord({ ...base, kind: 'round' }).kind).toBe('round');
});

it('아홉 칸 말고는 아무것도 보내지 않는다', () => {
  // 시트 열 순서가 여기 맞춰져 있다. 늘리려면 시트도 함께 고칠 것.
  expect(Object.keys(trackRecord(base)).sort()).toEqual(
    ['d', 'fold', 'h', 'kind', 'paper', 'seam', 'sid', 'w'].sort(),
  );
});
```

기존 `'정해 둔 여덟 칸…'` 테스트는 지운다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/track.test.ts`
Expected: FAIL

- [ ] **Step 3: `src/track.ts`를 고친다**

```ts
/** 파우치 종류. 시트에서 두 도구의 기록을 가르는 값이다. */
export type PouchKind = 'box' | 'round';
```

`TrackRecord`에 `readonly kind: PouchKind;`를, `TrackInput`에 `readonly kind: PouchKind;`를 더하고 `trackRecord`가 그대로 옮기게 한다.

원통은 치수 칸 셋을 그대로 쓴다. **`w`에 지름, `h`에 옆면 높이, `d`에 뚜껑 높이**를 넣는다. 주석으로 못 박는다.

```ts
/*
 * 원통도 치수 칸 셋을 그대로 쓴다 — w에 지름, h에 옆면 높이, d에 뚜껑 높이다.
 * 열을 새로 만들면 두 종류가 서로 빈 칸을 만들어 피벗이 지저분해진다.
 * 열 이름이 원통에는 안 맞지만 kind를 보면 무슨 값인지 알 수 있다.
 */
```

- [ ] **Step 4: 두 화면이 종류를 넘기게 한다**

`src/main.ts`의 `trackDownload` 호출에 `kind: 'box'`를, `round/main.ts`에 `kind: 'round'`와 세 치수 대응을 넣는다.

- [ ] **Step 5: 통과를 확인하고 커밋**

Run: `npm test && npx tsc --noEmit`

```bash
git add src/track.ts src/main.ts round/main.ts tests/track.test.ts
git commit -m "다운로드 기록에 파우치 종류 남기기"
```

---

### Task 11: Apps Script — 종류 열과 분당 상한

**Files:**
- Modify: `docs/tracking.md`

수인님이 직접 스프레드시트와 Apps Script를 고쳐야 하는 작업이다. **문서를 먼저 정확히 고치고, 실제 반영은 사용자에게 안내한다.**

- [ ] **Step 1: 시트 머리글을 아홉 칸으로 고친 문서를 쓴다**

`docs/tracking.md`의 머리글 표와 1단계 안내를 고친다.

```
시각	탭	종류	가로	높이	바닥폭	용지	시접	반접기
```

`종류` 열 설명을 더한다 — `box`는 사각, `round`는 원통. 원통은 `가로`에 지름, `높이`에 옆면 높이, `바닥폭`에 뚜껑 높이가 들어간다는 것을 표로 적는다. 이미 쌓인 줄은 `box`로 채우라고 안내한다.

- [ ] **Step 2: Apps Script 코드를 고친다**

문서의 코드 블록을 아래로 바꾼다.

```javascript
var SHEET_NAME = 'log';

// 1분에 이만큼까지만 받는다. 사람이 1분에 60번 다운로드할 일은 없다.
var LIMIT_PER_MINUTE = 60;

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (!valid(data)) return ok();
    if (tooMany()) return ok();

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(SHEET_NAME)
        .appendRow([
          new Date(),
          String(data.sid).slice(0, 40),
          data.kind === 'round' ? 'round' : 'box',
          data.w,
          data.h,
          data.d,
          data.paper,
          data.seam === true,
          data.fold === true,
        ]);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // 보낸 쪽은 답을 읽지 않는다. 오류를 되돌려 봐야 아무도 못 본다.
  }
  return ok();
}

/*
 * 분당 상한. 주소는 번들에 들어가므로 누구나 꺼낼 수 있고, 작정한 사람은
 * 막을 수 없다. 토큰을 심어도 같이 읽히고 doPost는 헤더를 못 읽어 Origin
 * 검사도 안 된다. 막을 수 있는 건 멍청한 폭주뿐이지만, 그것만 막아도
 * 할당량이 날아가 진짜 기록이 사라지는 사고는 피한다.
 */
function tooMany() {
  var cache = CacheService.getScriptCache();
  var key = 'rate-' + Math.floor(Date.now() / 60000);
  var count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), 120);
  return count > LIMIT_PER_MINUTE;
}

function valid(d) {
  return d
    && num(d.w, 50, 400)
    && num(d.h, 40, 300)
    && num(d.d, 10, 200)
    && (d.paper === 'a4' || d.paper === 'a3');
}

function num(v, min, max) {
  return typeof v === 'number' && isFinite(v) && v >= min && v <= max;
}

function ok() {
  return ContentService.createTextOutput('ok');
}
```

**`valid`의 범위가 넓어진 것에 주의한다.** 두 종류를 함께 받으므로 각 칸의 범위가 두 도구의 합집합이어야 한다. 사각은 가로 100~400·높이 50~300·바닥폭 40~200, 원통은 지름 80~300·옆면 40~300·뚜껑 10~150이다.

- [ ] **Step 3: 문서의 통계 뽑기 절을 고친다**

피벗에서 `종류`로 먼저 거른 뒤 집계하라고 적는다.

- [ ] **Step 4: 커밋하고 사용자에게 안내한다**

```bash
git add docs/tracking.md
git commit -m "기록에 종류 열과 분당 상한 넣는 법 적기"
```

사용자에게 알린다: 시트에 `종류` 열을 `탭` 다음에 끼워 넣고, 기존 줄을 `box`로 채우고, Apps Script를 새 코드로 바꾼 뒤 **배포 → 배포 관리 → 연필 → 새 버전**으로 다시 배포해야 반영된다.

---

### Task 12: README와 스크린샷

**Files:**
- Modify: `README.md`
- Modify: `docs/img/screenshot.jpg`, 필요하면 `docs/img/screenshot-round.jpg` 추가

- [ ] **Step 1: README에 원통 절을 더한다**

`## 도안 계산` 뒤에 `## 원통 파우치` 절을 만들어 형태·계산식·조각·배치를 적는다. 설계 문서의 3장과 4장을 요약하되 **왜 비율로 다루는지**를 반드시 적는다.

`## 구조` 목록에 새 파일들을 더한다.

`## README 스크린샷` 절에 원통 페이지도 찍는다는 것을 적는다.

- [ ] **Step 2: 스크린샷을 다시 찍는다**

README에 적힌 절차를 그대로 쓴다. 원통 페이지는 `http://localhost:5173/round/`로 찍는다.

- [ ] **Step 3: 커밋**

```bash
git add README.md docs/img
git commit -m "원통 파우치를 README에 적고 스크린샷 찍기"
```

---

## 마무리 확인

- [ ] `npm test` 통과
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 성공
- [ ] `npx vite preview`로 `/`와 `/round/` 둘 다 PDF가 받아진다
- [ ] 사각 파우치 화면이 예전과 똑같다 (회귀 없음)
- [ ] 배포 후 실제 주소에서 두 페이지 확인
- [ ] 시트에 `종류`가 `round`로 들어오는지 확인
