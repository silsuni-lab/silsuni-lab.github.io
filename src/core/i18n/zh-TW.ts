// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { Catalog } from './messages';

/*
 * 繁體中文 (zh-TW).
 *
 * key 목록·함수 인자 개수는 한국어(ko.ts)가 정본이다. 여기서 빠뜨리면
 * tsc가 잡는다 — 빠진 것을 조용히 넘기지 않는다.
 *
 * PDF 문구(pdf.*)는 core/cjk-fonts.ts의 Noto Sans TC 서브셋으로 그 언어
 * (繁體中文)로 인쇄된다. 표준 폰트는 한자·가나를 넣으면 예외를 던져서
 * 서브셋 폰트를 쓴다.
 */

export const zhTW: Catalog = {
  // 머리말
  'app.title': '方形拉鍊筆袋版型，出來吧！',
  'app.name': '方形拉鍊筆袋',
  'app.tagline': '版型出來吧！',
  'app.description': '輸入完成尺寸，就能拿到方形拉鍊筆袋的 1:1 實寸 PDF 版型。',
  'app.subLine1': '輸入想要的尺寸，馬上就能下載 PDF 版型。',
  'app.subLine2': '省下打版畫線的時間，把心思花在「縫製的樂趣」上吧！',
  'app.photoAlt': '做好的三個方形筆袋 — 粉紅燈芯絨筆袋、藍色燈芯絨筆袋、淺藍格紋筆袋',

  // 섹션
  'section.size': '完成尺寸 (mm)',
  'section.presets': '還沒有特別想做的尺寸嗎？',
  'section.preview': '預覽',
  'section.pattern': '版型',

  // 입력
  'field.widthMm': '寬',
  'field.heightMm': '高',
  'field.depthMm': '底寬',
  'field.range': (min: number, max: number) => `最小 ${min} ~ 最大 ${max}`,

  // 프리셋
  'preset.pencil': '筆袋',
  'preset.sanitary': '小布包',
  'preset.cosmetic': '化妝包',

  // 조작
  'control.paper': '紙張',
  'control.addSeam': '加縫份',
  'control.foldHalf': '對摺版型',
  'control.download': '下載 PDF',
  // 인쇄물에 네모가 둘 있으므로 크기를 짚지 않는다. 어느 자를 쓰든
  // 자기 자에 맞는 네모를 재면 된다 — 크기는 네모 옆 라벨이 말한다.
  'control.printCheck': '印出後請用尺確認方格！',

  // 요약
  'paper.sheets': (count: number) => `${count} 張`,
  'orientation.portrait': '直式',
  'orientation.landscape': '橫式',
  'preview.summary': (paper: string, orientation: string, sheets: number, cols: number, rows: number) =>
    `${paper} ${orientation} · 共 ${sheets} 張 (${cols} 列 × ${rows} 行)`,
  'preview.ariaLabel': (widthMm: number, heightMm: number) =>
    `寬 ${widthMm}mm、高 ${heightMm}mm 版型預覽`,
  'shape.ariaLabel': (widthMm: number, heightMm: number, depthMm: number) =>
    `寬 ${widthMm}mm、高 ${heightMm}mm、底寬 ${depthMm}mm 筆袋完成預想樣貌`,

  // 밴드 이름
  'band.topFront': '拉鍊帶',
  'band.front': '前片',
  'band.bottom': '底片',
  'band.back': '後片',
  'band.topBack': '拉鍊帶',

  // 범례
  'legend.cutLine': '裁切線 — 沿此線裁切',
  'legend.stitchLine': '縫合線 — 沿此線車縫',
  'legend.seamAllowance': (seamMm: number) => `縫份 ${seamMm}mm — 已含在內`,
  'legend.centerLine': '中心線 — 版型寬度的正中央',
  'legend.foldEdge': '對摺線 — 置於布料對摺處',
  'legend.tile': '列印頁邊界 — 頁碼與 PDF 相同',

  // 오류
  'error.notNumber': (label: string) => `${label}必須輸入數字。`,
  'error.notInteger': (label: string) => `${label}必須輸入 1mm 單位的整數。`,
  'error.outOfRange': (label: string, min: number, max: number) =>
    `${label}必須介於 ${min}mm 和 ${max}mm 之間。`,
  'error.pdfFailed': (message: string) => `無法建立 PDF：${message}`,
  'error.stale': '有新版本已上線，正在重新載入畫面…',
  'confirm.manySheets': (count: number) => `將印出 ${count} 張，要繼續嗎？`,

  // PDF는 Noto Sans TC 서브셋(core/cjk-fonts.ts)로 繁體中文을 찍는다.
  'pdf.patternName': '方形拉鍊筆袋',
  'pdf.noSeam': '無縫份',
  'pdf.watermark': '縫製愉快！',
  'pdf.foldEdge': '對摺線',
  'pdf.testSquareMetric': '3公分確認！',
  'pdf.testSquareImperial': '1inch 確認！',
  'pdf.printNote': '請以實際尺寸(100%)列印！',

  // 원통(round) — 별도 화면. 필드·프리셋 이름, 뒷면 표기.
  'round.field.diameterMm': '直徑',
  'round.field.sideHeightMm': '側面高度',
  'round.field.lidHeightMm': '蓋子高度',
  'round.preset.flat': '扁圓收納包',
  'round.preset.pencase': '圓筒筆袋',
  'round.preset.cosmetic': '化妝包',
  'round.control.backRatio': '背面',
  // 원통(round) — 패턴 이름·조각 이름·검증 오류·뒷면 비율 표기.
  'round.pattern.name': '圓筒拉鍊袋',
  'round.pattern.noSeam': '無縫份',
  'round.piece.frontTop': '前面上段',
  'round.piece.frontBottom': '前面下段',
  'round.piece.circles': '蓋·底',
  'round.piece.back': '後面',
  'round.error.notNumber': (label: string) => `${label}必須輸入數字。`,
  'round.error.notInteger': (label: string) => `${label}必須輸入 1mm 單位的整數。`,
  'round.error.outOfRange': (label: string, min: number, max: number) =>
    `${label}必須介於 ${min}mm 和 ${max}mm 之間。`,
  'round.error.lidHeight': (side: number, cap: number) =>
    `側面高度 ${side} 時，蓋子高度不能超過 ${cap}mm。`,
  'round.error.backRatio': (min: number, max: number) => `背面比例必須介於 ${min}% 和 ${max}% 之間。`,
  'round.backRatio.10': '10% · 鉸鏈窄',
  'round.backRatio.15': '15%',
  'round.backRatio.20': '20% · 預設',
  'round.backRatio.25': '25%',
  'round.backRatio.30': '30% · 鉸鏈寬',
  // 원통 화면 — 미리보기·모양 aria, 범례.
  'round.shape.ariaLabel': (diameterMm: number, sideHeightMm: number, lidHeightMm: number) =>
    `完成後的圓筒袋 — 直徑 ${diameterMm}mm、側面 ${sideHeightMm}mm、蓋 ${lidHeightMm}mm`,
  'round.preview.ariaLabel': (count: number) => `圓筒袋版型，共 ${count} 片`,
  'round.legend.cut': '裁切線 — 沿此線裁剪',
  'round.legend.seam': (seamMm: number) => `縫合線 — 距裁切線向內 ${seamMm}mm`,
  // 언어
  'lang.switch': '語言',
};
