// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { withObjectParticle, withTopicParticle } from '../korean';

/*
 * 한국어. 기본 로케일이다.
 *
 * 여기 있는 문구는 다국어화 전에 화면과 PDF에 박혀 있던 것과 글자 하나까지
 * 같아야 한다. 한국어 사용자에게는 아무것도 바뀌지 않는 것이 이번 작업의
 * 조건이다.
 *
 * 조사 처리(withTopicParticle 등)는 한국어에만 있는 규칙이라 여기서만 쓴다.
 *
 * 타입을 붙이지 않는다. 이 객체가 키 목록의 출처라서(messages.ts의
 * MessageKey), Catalog로 annotate하면 자기에게서 나온 타입으로 자신을
 * 가리키게 되어 순환이 된다. 다른 로케일이 Catalog를 따른다.
 */

export const ko = {
  // 머리말
  'app.title': '사각사각 지퍼 파우치 패턴 나와라 얍!',
  'app.name': '사각사각 지퍼 파우치',
  'app.tagline': '패턴 나와라 얍!',
  'app.description': '완성 치수를 입력하면 지퍼 사각 파우치 도안을 1:1 실치수 PDF로 만들어 줍니다.',
  'app.subLine1': '원하는 파우치 사이즈를 입력하면 바로 PDF 패턴이 나옵니다.',
  'app.subLine2': '패턴 찾고 그리는 시간 아껴서 ‘만드는 즐거움’에 더 몰입해보세요!',
  'app.photoAlt': '완성된 사각 파우치 세 개 — 분홍 골덴 필통, 파랑 골덴 필통, 하늘색 체크 파우치',

  // 섹션
  'section.size': '완성 사이즈 (mm)',
  'section.presets': '원하는 사이즈가 특별히 없다면?',
  'section.preview': '미리보기',
  'section.pattern': '패턴',

  // 입력
  'field.widthMm': '가로',
  'field.heightMm': '높이',
  'field.depthMm': '바닥폭',
  'field.range': (min: number, max: number) => `최소 ${min} ~ 최대 ${max}`,

  // 프리셋
  'preset.pencil': '필통',
  'preset.sanitary': '생리대 파우치',
  'preset.cosmetic': '화장품 파우치',

  // 조작
  'control.paper': '용지',
  'control.addSeam': '시접 추가',
  'control.foldHalf': '골선접기',
  'control.download': 'PDF 다운로드',
  // 인쇄물에 네모가 둘 있으므로 크기를 짚지 않는다. 어느 자를 쓰든
  // 자기 자에 맞는 네모를 재면 된다 — 크기는 네모 옆 라벨이 말한다.
  'control.printCheck': '출력 후 네모를 자로 꼭 확인하세요!',

  // 요약
  'paper.sheets': (count: number) => `${count}장`,
  'orientation.portrait': '세로',
  'orientation.landscape': '가로',
  'preview.summary': (paper: string, orientation: string, sheets: number, cols: number, rows: number) =>
    `${paper} ${orientation} · 총 ${sheets}장 (${cols}열 × ${rows}행)`,
  'preview.ariaLabel': (widthMm: number, heightMm: number) =>
    `가로 ${widthMm}mm, 세로 ${heightMm}mm 전개도 미리보기`,
  'shape.ariaLabel': (widthMm: number, heightMm: number, depthMm: number) =>
    `가로 ${widthMm}mm, 높이 ${heightMm}mm, 바닥폭 ${depthMm}mm 파우치의 완성 예상 모습`,

  // 밴드 이름
  'band.topFront': '지퍼단',
  'band.front': '앞판',
  'band.bottom': '바닥',
  'band.back': '뒤판',
  'band.topBack': '지퍼단',

  // 범례
  'legend.cutLine': '재단선 — 이 선대로 자릅니다',
  'legend.stitchLine': '완성선 — 여기를 박습니다',
  'legend.seamAllowance': (seamMm: number) => `시접 ${seamMm}mm — 이미 포함되어 있습니다`,
  'legend.centerLine': '중앙선 — 도안 폭의 한가운데',
  'legend.foldEdge': '골선 — 원단 접은 자리에 놓습니다',
  'legend.tile': '인쇄 페이지 경계 — 칸 번호는 PDF와 같습니다',

  // 오류
  'error.notNumber': (label: string) => `${withObjectParticle(label)} 숫자로 입력해주세요.`,
  'error.notInteger': (label: string) => `${withTopicParticle(label)} 1mm 단위 정수로 입력해주세요.`,
  'error.outOfRange': (label: string, min: number, max: number) =>
    `${withTopicParticle(label)} ${min}mm 이상 ${max}mm 이하여야 합니다.`,
  'error.pdfFailed': (message: string) => `PDF를 만들지 못했습니다: ${message}`,
  'error.stale': '새 버전이 올라왔습니다. 화면을 다시 불러옵니다…',
  'confirm.manySheets': (count: number) => `${count}장이 출력됩니다. 계속할까요?`,

  // PDF
  'pdf.patternName': '사각사각 지퍼 파우치',
  'pdf.noSeam': '시접없음',
  'pdf.watermark': '예쁘게 만들어보세요!',
  'pdf.foldEdge': '골선',
  'pdf.testSquareMetric': '3cm 확인하세요!',
  'pdf.testSquareImperial': '1inch 확인하세요!',
  'pdf.printNote': "'실제사이즈'로 출력해주세요!",

  // 원통(round) — 별도 화면. 필드·프리셋 이름, 뒷면 표기.
  'round.field.diameterMm': '지름',
  'round.field.sideHeightMm': '옆면 높이',
  'round.field.lidHeightMm': '뚜껑 높이',
  'round.preset.coin': '동전·이어폰 파우치',
  'round.preset.cotton': '화장솜 케이스',
  'round.preset.sewingbox': '반짇고리',
  'round.control.backRatio': '뒷면',
  // 원통(round) — 패턴 이름·조각 이름·검증 오류·뒷면 비율 표기.
  'round.pattern.name': '동글동글 원통 파우치',
  'round.pattern.noSeam': '시접없음',
  'round.piece.frontTop': '앞면 윗단',
  'round.piece.frontBottom': '앞면 아랫단',
  'round.piece.circles': '뚜껑·바닥',
  'round.piece.back': '뒷면',
  'round.error.notNumber': (label: string) => `${withObjectParticle(label)} 숫자로 입력해주세요.`,
  'round.error.notInteger': (label: string) => `${withTopicParticle(label)} 1mm 단위 정수로 입력해주세요.`,
  'round.error.outOfRange': (label: string, min: number, max: number) =>
    `${withTopicParticle(label)} ${min}mm 이상 ${max}mm 이하여야 합니다.`,
  'round.error.lidHeight': (side: number, cap: number) =>
    `옆면 높이 ${side}에서는 뚜껑 높이 ${cap} 이하여야 합니다.`,
  'round.error.backRatio': (min: number, max: number) => `뒷면 비율은 ${min}%에서 ${max}% 사이여야 합니다.`,
  'round.backRatio.10': '10% · 경첩 좁게',
  'round.backRatio.15': '15%',
  'round.backRatio.20': '20% · 기본',
  'round.backRatio.25': '25%',
  'round.backRatio.30': '30% · 경첩 넓게',
  // 원통 화면 — 미리보기·모양 aria, 범례.
  'round.shape.ariaLabel': (diameterMm: number, sideHeightMm: number, lidHeightMm: number) =>
    `지름 ${diameterMm}mm, 옆높이 ${sideHeightMm}mm, 뚜껑 높이 ${lidHeightMm}mm 원통 파우치의 완성 예상 모습`,
  'round.preview.ariaLabel': (count: number) => `원통 파우치 조각 ${count}종 미리보기`,
  'round.legend.cut': '재단선 — 이 선을 따라 자릅니다',
  'round.legend.seam': (seamMm: number) => `완성선 — 재단선에서 ${seamMm}mm 안쪽`,
  // 언어
  'lang.switch': '언어',
};
