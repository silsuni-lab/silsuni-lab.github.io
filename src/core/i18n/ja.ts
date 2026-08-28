// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { Catalog } from './messages';

/*
 * 日本語 (ja).
 *
 * key 목록·함수 인자 개수는 한국어(ko.ts)가 정본이다. 여기서 빠뜨리면
 * tsc가 잡는다 — 빠진 것을 조용히 넘기지 않는다.
 *
 * PDF 문구(pdf.*)는 core/cjk-fonts.ts의 Noto Sans JP 서브셋으로 그 언어
 * (日本語)로 인쇄된다. 표준 폰트는 한자·가나를 넣으면 예외를 던져서
 * 서브셋 폰트를 쓴다.
 */

export const ja: Catalog = {
  // 머리말
  'app.title': 'スクエアファスナーポーチのパターン、出てこい！',
  'app.name': 'スクエアファスナーポーチ',
  'app.tagline': 'パターン出てこい！',
  'app.description': '完成寸法を入力すると、スクエアファスナーポーチの 1:1 実寸 PDF パターンを作ります。',
  'app.subLine1': '欲しいサイズを入力するだけで、すぐに印刷できる PDF パターンが出ます。',
  'app.subLine2': '製図の手間を省いて、「作る楽しみ」に時間を使いましょう！',
  'app.photoAlt': '完成したスクエアポーチ 3 つ — ピンクのコーデュロイペンケース、青のコーデュロイペンケース、水色のギンガムポーチ',

  // 섹션
  'section.size': '完成サイズ (mm)',
  'section.presets': '特にサイズが決まっていませんか？',
  'section.preview': 'プレビュー',
  'section.pattern': 'パターン',

  // 입력
  'field.widthMm': '幅',
  'field.heightMm': '高さ',
  'field.depthMm': '底幅',
  'field.range': (min: number, max: number) => `最小 ${min} 〜 最大 ${max}`,

  // 프리셋
  'preset.pencil': 'ペンケース',
  'preset.sanitary': '小物ポーチ',
  'preset.cosmetic': '化粧ポーチ',

  // 조작
  'control.paper': '用紙',
  'control.addSeam': '縫い代を足す',
  'control.foldHalf': '折り線パターン',
  'control.download': 'PDF をダウンロード',
  // 인쇄물에 네모가 둘 있으므로 크기를 짚지 않는다. 어느 자를 쓰든
  // 자기 자에 맞는 네모를 재면 된다 — 크기는 네모 옆 라벨이 말한다.
  'control.printCheck': '印刷後にものさしで四角を確認してください！',

  // 요약
  'paper.sheets': (count: number) => `${count} 枚`,
  'orientation.portrait': '縦',
  'orientation.landscape': '横',
  'preview.summary': (paper: string, orientation: string, sheets: number, cols: number, rows: number) =>
    `${paper} ${orientation} · 計 ${sheets} 枚 (${cols} 列 × ${rows} 行)`,
  'preview.ariaLabel': (widthMm: number, heightMm: number) =>
    `幅 ${widthMm}mm、高さ ${heightMm}mm のパターンプレビュー`,
  'shape.ariaLabel': (widthMm: number, heightMm: number, depthMm: number) =>
    `幅 ${widthMm}mm、高さ ${heightMm}mm、底幅 ${depthMm}mm のポーチ完成イメージ`,

  // 밴드 이름
  'band.topFront': 'ファスナー帯',
  'band.front': '前身頃',
  'band.bottom': '底',
  'band.back': '後身頃',
  'band.topBack': 'ファスナー帯',

  // 범례
  'legend.cutLine': '裁断線 — この線で切ります',
  'legend.stitchLine': '縫い代線 — ここを縫います',
  'legend.seamAllowance': (seamMm: number) => `縫い代 ${seamMm}mm — 込み済み`,
  'legend.centerLine': '中心線 — パターン幅の中央',
  'legend.foldEdge': '折り線 — 布の折り山に合わせます',
  'legend.tile': '印刷ページ境界 — ページ番号は PDF と同じ',

  // 오류
  'error.notNumber': (label: string) => `${label}は数字で入力してください。`,
  'error.notInteger': (label: string) => `${label}は 1mm 単位の整数で入力してください。`,
  'error.outOfRange': (label: string, min: number, max: number) =>
    `${label}は ${min}mm 以上 ${max}mm 以下で入力してください。`,
  'error.pdfFailed': (message: string) => `PDF を作成できませんでした：${message}`,
  'error.stale': '新しいバージョンが公開されました。画面を再読み込みします…',
  'confirm.manySheets': (count: number) => `${count} 枚印刷します。続けますか？`,

  // PDF는 Noto Sans JP 서브셋(core/cjk-fonts.ts)로 日本語를 찍는다.
  'pdf.patternName': 'スクエアファスナーポーチ',
  'pdf.noSeam': '縫い代なし',
  'pdf.watermark': '楽しく縫いましょう！',
  'pdf.foldEdge': '折り線',
  'pdf.testSquareMetric': '3cmを確認！',
  'pdf.testSquareImperial': '1inch 確認！',
  'pdf.printNote': '実際のサイズ(100%)で印刷してください！',

  // 원통(round) — 별도 화면. 필드·프리셋 이름, 뒷면 표기.
  'round.field.diameterMm': '直径',
  'round.field.sideHeightMm': '側面の高さ',
  'round.field.lidHeightMm': '蓋の高さ',
  'round.preset.flat': '平たいポーチ',
  'round.preset.pencase': '筒形ペンケース',
  'round.preset.cosmetic': '化粧ポーチ',
  'round.control.backRatio': '背面',
  // 원통(round) — 패턴 이름·조각 이름·검증 오류·뒷면 비율 표기.
  'round.pattern.name': '円筒ファスナーポーチ',
  'round.pattern.noSeam': '縫い代なし',
  'round.piece.frontTop': '前面上段',
  'round.piece.frontBottom': '前面下段',
  'round.piece.circles': '蓋・底',
  'round.piece.back': '後面',
  'round.error.notNumber': (label: string) => `${label}は数字で入力してください。`,
  'round.error.notInteger': (label: string) => `${label}は 1mm 単位の整数で入力してください。`,
  'round.error.outOfRange': (label: string, min: number, max: number) =>
    `${label}は ${min}mm 以上 ${max}mm 以下で入力してください。`,
  'round.error.lidHeight': (side: number, cap: number) =>
    `側面の高さ ${side} の場合は、蓋の高さ ${cap}mm 以下にしてください。`,
  'round.error.backRatio': (min: number, max: number) => `背面の比率は ${min}% から ${max}% の間にしてください。`,
  'round.backRatio.10': '10% · ヒンジ狭め',
  'round.backRatio.15': '15%',
  'round.backRatio.20': '20% · 基本',
  'round.backRatio.25': '25%',
  'round.backRatio.30': '30% · ヒンジ広め',
  // 원통 화면 — 미리보기·모양 aria, 범례.
  'round.shape.ariaLabel': (diameterMm: number, sideHeightMm: number, lidHeightMm: number) =>
    `できあがりの円筒ポーチ — 直径 ${diameterMm}mm、側面 ${sideHeightMm}mm、蓋 ${lidHeightMm}mm`,
  'round.preview.ariaLabel': (count: number) => `円筒ポーチのパターン、${count} 枚`,
  'round.legend.cut': '裁断線 — この線で切ります',
  'round.legend.seam': (seamMm: number) => `縫い代線 — 裁断線から ${seamMm}mm 内側`,
  // 언어
  'lang.switch': '言語',
};
