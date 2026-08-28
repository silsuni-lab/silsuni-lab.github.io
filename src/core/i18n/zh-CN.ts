// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { Catalog } from './messages';

/*
 * 简体中文 (zh-CN).
 *
 * key 목록·함수 인자 개수는 한국어(ko.ts)가 정본이다. 여기서 빠뜨리면
 * tsc가 잡는다 — 빠진 것을 조용히 넘기지 않는다.
 *
 * PDF 문구(pdf.*)는 core/cjk-fonts.ts의 Noto Sans SC 서브셋으로 그 언어
 * (简体中文)로 인쇄된다. 표준 폰트는 한자·가나를 넣으면 예외를 던져서
 * 서브셋 폰트를 쓴다.
 */

export const zhCN: Catalog = {
  // 머리말
  'app.title': '方形拉链笔袋版型，出来吧！',
  'app.name': '方形拉链笔袋',
  'app.tagline': '版型出来吧！',
  'app.description': '输入完成尺寸，就能拿到方形拉链笔袋的 1:1 实寸 PDF 版型。',
  'app.subLine1': '输入想要的尺寸，马上就能下载 PDF 版型。',
  'app.subLine2': '省下打版画线的时间，把心思花在“缝制的乐趣”上吧！',
  'app.photoAlt': '做好的三个方形笔袋 — 粉色灯芯绒笔袋、蓝色灯芯绒笔袋、浅蓝格纹笔袋',

  // 画面 section
  'section.size': '完成尺寸 (mm)',
  'section.presets': '还没有特别想做的尺寸吗？',
  'section.preview': '预览',
  'section.pattern': '版型',

  // 입력
  'field.widthMm': '宽',
  'field.heightMm': '高',
  'field.depthMm': '底宽',
  'field.range': (min: number, max: number) => `最小 ${min} ~ 最大 ${max}`,

  // 프리셋
  'preset.pencil': '笔袋',
  'preset.sanitary': '小布包',
  'preset.cosmetic': '化妆包',

  // 조작
  'control.paper': '纸张',
  'control.addSeam': '加缝份',
  'control.foldHalf': '对折版型',
  'control.download': '下载 PDF',
  // 크기를 짚지 않는다. 찍히는 네모 수가 언어를 따르므로(영어는 30mm와
  // 1인치 둘, 나머지는 30mm 하나 — page.ts의 scaleSquareRectsMm 참고) 한
  // 문구로 둘 다 가리켜야 한다. 크기는 네모 옆 라벨이 말한다.
  'control.printCheck': '打印后请用尺确认方格！',

  // 요약
  'paper.sheets': (count: number) => `${count} 张`,
  'orientation.portrait': '纵向',
  'orientation.landscape': '横向',
  'preview.summary': (paper: string, orientation: string, sheets: number, cols: number, rows: number) =>
    `${paper} ${orientation} · 共 ${sheets} 张 (${cols} 列 × ${rows} 行)`,
  'preview.ariaLabel': (widthMm: number, heightMm: number) =>
    `宽 ${widthMm}mm、高 ${heightMm}mm 版型预览`,
  'shape.ariaLabel': (widthMm: number, heightMm: number, depthMm: number) =>
    `宽 ${widthMm}mm、高 ${heightMm}mm、底宽 ${depthMm}mm 笔袋完成预想样貌`,

  // 밴드 이름
  'band.topFront': '拉链带',
  'band.front': '前片',
  'band.bottom': '底片',
  'band.back': '后片',
  'band.topBack': '拉链带',

  // 범례
  'legend.cutLine': '裁切线 — 沿此线裁剪',
  'legend.stitchLine': '缝合线 — 沿此线车缝',
  'legend.seamAllowance': (seamMm: number) => `缝份 ${seamMm}mm — 已含在内`,
  'legend.centerLine': '中心线 — 版型宽度的正中央',
  'legend.foldEdge': '对折线 — 置于布料对折处',
  'legend.tile': '打印页边界 — 页码与 PDF 相同',

  // 오류
  'error.notNumber': (label: string) => `${label}必须输入数字。`,
  'error.notInteger': (label: string) => `${label}必须输入 1mm 单位的整数。`,
  'error.outOfRange': (label: string, min: number, max: number) =>
    `${label}必须介于 ${min}mm 和 ${max}mm 之间。`,
  'error.pdfFailed': (message: string) => `无法建立 PDF：${message}`,
  'error.stale': '有新版本已上线，正在重新加载页面…',
  'confirm.manySheets': (count: number) => `将打印 ${count} 张，要继续吗？`,

  // PDF는 Noto Sans SC 서브셋(core/cjk-fonts.ts)로 简体中文을 찍는다.
  'pdf.patternName': '方形拉链笔袋',
  'pdf.noSeam': '无缝份',
  'pdf.watermark': '缝制愉快！',
  'pdf.foldEdge': '对折线',
  'pdf.testSquareMetric': '3厘米确认！',
  'pdf.testSquareImperial': '1inch 确认！',
  'pdf.printNote': '请以实际尺寸(100%)打印！',

  // 원통(round) — 별도 화면. 필드·프리셋 이름, 뒷면 표기.
  'round.field.diameterMm': '直径',
  'round.field.sideHeightMm': '侧面高度',
  'round.field.lidHeightMm': '盖子高度',
  'round.preset.flat': '扁圆收纳包',
  'round.preset.pencase': '圆筒笔袋',
  'round.preset.cosmetic': '化妆包',
  'round.control.backRatio': '背面',
  // 원통(round) — 패턴 이름·조각 이름·검증 오류·뒷면 비율 표기.
  'round.pattern.name': '圆筒拉链袋',
  'round.pattern.noSeam': '无缝份',
  'round.piece.frontTop': '前面上段',
  'round.piece.frontBottom': '前面下段',
  'round.piece.circles': '盖·底',
  'round.piece.back': '后面',
  'round.error.notNumber': (label: string) => `${label}必须输入数字。`,
  'round.error.notInteger': (label: string) => `${label}必须输入 1mm 单位的整数。`,
  'round.error.outOfRange': (label: string, min: number, max: number) =>
    `${label}必须介于 ${min}mm 和 ${max}mm 之间。`,
  'round.error.lidHeight': (side: number, cap: number) =>
    `侧面高度 ${side} 时，盖子高度不能超过 ${cap}mm。`,
  'round.error.backRatio': (min: number, max: number) => `背面比例必须介于 ${min}% 和 ${max}% 之间。`,
  'round.backRatio.10': '10% · 铰链窄',
  'round.backRatio.15': '15%',
  'round.backRatio.20': '20% · 默认（推荐）',
  'round.backRatio.25': '25%',
  'round.backRatio.30': '30% · 铰链宽',
  // 원통 화면 — 미리보기·모양 aria, 범례.
  'round.shape.ariaLabel': (diameterMm: number, sideHeightMm: number, lidHeightMm: number) =>
    `完成后的圆筒袋 — 直径 ${diameterMm}mm、侧面 ${sideHeightMm}mm、盖 ${lidHeightMm}mm`,
  'round.preview.ariaLabel': (count: number) => `圆筒袋版型，共 ${count} 片`,
  'round.legend.cut': '裁切线 — 沿此线裁剪',
  'round.legend.seam': (seamMm: number) => `缝合线 — 距裁切线向内 ${seamMm}mm`,
  // 언어
  'lang.switch': '语言',
};
