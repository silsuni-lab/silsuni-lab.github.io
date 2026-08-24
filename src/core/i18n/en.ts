// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { Catalog } from './messages';

/*
 * 영어.
 *
 * 재봉 용어는 직역하지 않는다. 틀리면 원단을 버린다. 아래 용어는 영어권
 * 패턴에서 실제로 쓰는 말을 확인해 골랐고, 근거를 각 줄에 적어 두었다.
 *
 *   cutting line / stitching line   sewingtrip.com — "the space between
 *                                   cutting lines and stitching lines"
 *   place on fold                   blog.treasurie.com — "means place on the
 *                                   fold ... you do not add any [seam
 *                                   allowance] to fold lines"
 *   test square                     help.seamwork.com, blog.treasurie.com
 *   Print at 100% (Actual Size)     blog.treasurie.com — "Print at Actual
 *                                   Size (100%)"
 *   base                            columbusdesignbiennial.org — "Cut two
 *                                   pieces for the base"
 *   boxy zipper pouch               sewmodernbags.com, sewcanshe.com
 *
 * fold line(접힘선)과 place on fold(골선)는 영어에서도 다른 말이다. 하나로
 * 뭉치면 접는 자리와 원단을 대는 자리가 구별되지 않는다.
 */

export const en: Catalog = {
  // 머리말
  'app.title': 'Boxy Zipper Pouch Pattern Generator',
  'app.name': 'Boxy Zipper Pouch',
  'app.tagline': 'pattern, ready to print',
  'app.description':
    'Enter your finished measurements and get a true-to-scale PDF sewing pattern for a boxy zipper pouch.',
  'app.subLine1': 'Enter the size you want and a print-ready PDF pattern comes out.',
  'app.subLine2': 'Skip the drafting and spend that time on the making instead.',
  'app.photoAlt':
    'Three finished boxy pouches — a pink corduroy pencil case, a blue corduroy pencil case, and a light blue gingham pouch',

  // 섹션
  'section.size': 'Finished size (mm)',
  'section.presets': 'No size in mind?',
  'section.preview': 'Preview',
  'section.pattern': 'Pattern',

  // 입력
  'field.widthMm': 'Width',
  'field.heightMm': 'Height',
  'field.depthMm': 'Depth',
  'field.range': (min: number, max: number) => `${min}–${max}`,

  // 프리셋
  'preset.pencil': 'Pencil case',
  'preset.sanitary': 'Small pouch',
  'preset.cosmetic': 'Cosmetic pouch',

  // 조작
  'control.paper': 'Paper',
  // 시접을 넣을지 끌지. 영어권 패턴은 보통 시접 포함 여부를 명시한다.
  'control.addSeam': 'Add seam allowance',
  // 골선 반절 출력. 관례어 place on fold를 그대로 쓴다.
  'control.foldHalf': 'Half pattern (place on fold)',
  'control.download': 'Download PDF',
  // 인쇄물에 네모가 둘 있으므로 크기를 짚지 않는다. 어느 자를 쓰든
  // 자기 자에 맞는 네모를 재면 된다 — 크기는 네모 옆 라벨이 말한다.
  'control.printCheck': 'Check the printed test squares with your ruler!',

  // 요약
  // 영어만 복수형이 갈린다. 한국어·일본어·중국어에는 없는 규칙이다.
  'paper.sheets': (count: number) => `${count} ${count === 1 ? 'sheet' : 'sheets'}`,
  'orientation.portrait': 'portrait',
  'orientation.landscape': 'landscape',
  'preview.summary': (paper: string, orientation: string, sheets: number, cols: number, rows: number) =>
    `${paper} ${orientation} · ${sheets} ${sheets === 1 ? 'sheet' : 'sheets'} (${cols} × ${rows})`,
  'preview.ariaLabel': (widthMm: number, heightMm: number) =>
    `Pattern layout preview, ${widthMm}mm wide by ${heightMm}mm tall`,
  'shape.ariaLabel': (widthMm: number, heightMm: number, depthMm: number) =>
    `Finished pouch preview, ${widthMm}mm wide, ${heightMm}mm tall, ${depthMm}mm deep`,

  /*
   * 밴드 이름. 이 도안은 한 장으로 이어져 있고 이 이름들은 그 안의 구간이다.
   * base는 영어권 파우치 패턴에서 바닥 조각을 가리키는 말이다.
   */
  'band.topFront': 'Zipper band',
  'band.front': 'Front',
  'band.bottom': 'Base',
  'band.back': 'Back',
  'band.topBack': 'Zipper band',

  // 범례
  'legend.cutLine': 'Cutting line — cut along this line',
  'legend.stitchLine': 'Stitching line — sew along this line',
  'legend.seamAllowance': (seamMm: number) => `Seam allowance ${seamMm}mm — already included`,
  'legend.centerLine': 'Center line — middle of the pattern',
  'legend.foldEdge': 'Place on fold — lay this edge on the fabric fold',
  'legend.tile': 'Page edge — tile labels match the PDF',

  // 오류
  'error.notNumber': (label: string) => `${label} must be a number.`,
  'error.notInteger': (label: string) => `${label} must be a whole number of millimetres.`,
  'error.outOfRange': (label: string, min: number, max: number) =>
    `${label} must be between ${min}mm and ${max}mm.`,
  'error.pdfFailed': (message: string) => `Could not build the PDF: ${message}`,
  'error.stale': 'A new version is available. Reloading…',
  'confirm.manySheets': (count: number) =>
    `This will print ${count} ${count === 1 ? 'sheet' : 'sheets'}. Continue?`,

  // PDF
  'pdf.patternName': 'Boxy Zipper Pouch',
  'pdf.noSeam': 'NO SEAM ALLOWANCE',
  'pdf.watermark': 'Happy sewing!',
  // 도안 위 골선 옆에 찍는 글자. 범례와 같은 관례어를 쓴다.
  'pdf.foldEdge': 'Place on fold',
  // 축척 사각형 문구. 크기에 딱 붙여 몇 센티(또는 몇 인치)인지 못 박고,
  // 짧게 유지해 사각형 위에서 페이지 오른쪽으로 잘려 나가지 않게 한다.
  'pdf.testSquareMetric': '3-cm check!',
  'pdf.testSquareImperial': '1inch check!',
  // "Fit to Page"를 끄라는 말까지 넣는다. 배율이 틀리는 가장 흔한 원인이다.
  'pdf.printNote': 'PRINT AT 100% (ACTUAL SIZE) — DO NOT FIT TO PAGE',

  // 원통(round) — 별도 화면. 필드·프리셋 이름, 뒷면 표기.
  'round.field.diameterMm': 'Diameter',
  'round.field.sideHeightMm': 'Side height',
  'round.field.lidHeightMm': 'Lid height',
  'round.preset.coin': 'Coin & earbud pouch',
  'round.preset.cotton': 'Cotton pad case',
  'round.preset.sewingbox': 'Sewing kit',
  'round.control.backRatio': 'Back',
  // 원통(round) — 패턴 이름·조각 이름·검증 오류·뒷면 비율 표기.
  'round.pattern.name': 'Round zipper pouch',
  'round.pattern.noSeam': 'NO SEAM ALLOWANCE',
  'round.piece.frontTop': 'Front upper band',
  'round.piece.frontBottom': 'Front lower band',
  'round.piece.circles': 'Lid & base',
  'round.piece.back': 'Back',
  'round.error.notNumber': (label: string) => `${label} must be a number.`,
  'round.error.notInteger': (label: string) => `${label} must be a whole number of millimetres.`,
  'round.error.outOfRange': (label: string, min: number, max: number) =>
    `${label} must be between ${min}mm and ${max}mm.`,
  'round.error.lidHeight': (side: number, cap: number) =>
    `With a side height of ${side}, the lid may be at most ${cap}mm.`,
  'round.error.backRatio': (min: number, max: number) =>
    `The back ratio must be between ${min}% and ${max}%.`,
  'round.backRatio.10': '10% · narrow hinge',
  'round.backRatio.15': '15%',
  'round.backRatio.20': '20% · default',
  'round.backRatio.25': '25%',
  'round.backRatio.30': '30% · wide hinge',
  // 언어
  'lang.switch': 'Language',
};
