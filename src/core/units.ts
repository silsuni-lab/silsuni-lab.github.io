// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 인치의 정의.
 *
 * 도안 치수는 입력·계산·인쇄 전부 mm다. 인치가 필요한 곳은 한 군데뿐 —
 * 인쇄 후 축척을 인치 자로 재라고 PDF에 그리는 1인치 네모(core/page.ts)다.
 * 화면에는 인치 표기가 없어 mm↔인치 변환도 화면 쪽에는 남아 있지 않다.
 */

/** 1인치 (mm). 정의값이라 바뀌지 않는다. */
export const MM_PER_INCH = 25.4;
