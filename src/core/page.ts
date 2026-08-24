// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 종이를 만드는 기계. 파우치 종류와 무관하다.
 *
 * 격자·맞춤표·이어붙임 표시·축척 확인 네모·하단 문구·좌표 변환·출처 문구는
 * 어떤 도안이든 똑같이 필요하다. 여기 두면 사각과 원통이 나눠 쓴다.
 * 무엇을 그리는지(전개도냐 조각이냐)는 종류별 모듈이 정한다.
 *
 * 표시 문구는 카탈로그 t()에서 온다. 폰트는 로케일을 따른다 — ko는 Noto Sans
 * KR 서브셋, en은 표준 Helvetica, zh-TW/zh-CN/ja는 소스 폰트가 Noto Sans
 * TC/SC/JP인 서브셋이다. 서브셋에 없는 글자는 그리지 못하니, 문구를 바꿀 때는
 * 서브셋도 다시 만들어야 한다.
 */
import fontkit from '@pdf-lib/fontkit';
import { rgb, StandardFonts, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import { hexToRgb01, JOIN_DIAMOND_COLOR, MARK_COLOR, SCALE_COLOR } from './colors';
import { KOREAN_BOLD_FONT_BASE64, KOREAN_FONT_BASE64 } from './korean-font';
import { ZH_TW_FONT_BASE64, ZH_CN_FONT_BASE64, JA_FONT_BASE64 } from './cjk-fonts';
import { WATERMARK_HANDLE, WATERMARK_OPACITY } from './dimensions';
import { DEFAULT_LOCALE, type Locale } from './i18n/locales';
import { t } from './i18n/messages';
import { MM_PER_INCH } from './units';
import { PAGE_MARGIN_MM, PAGE_OVERLAP_MM, type Pagination, type Page } from './tiling';

export const MM_TO_PT = 72 / 25.4;

/**
 * 서브셋 폰트가 담고 있는 글자. PDF에 찍는 문구는 전부 이 안에 있어야 한다.
 * 없는 글자를 쓰면 그 자리가 비어 나오므로, 테스트로 미리 막는다.
 */
export const KOREAN_FONT_CHARS: ReadonlySet<string> = new Set(
  " !*@_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabchilmnsu각게골들만보사선세시쁘없어예요우음인접지치퍼파하확·글껑닥단동뒷뚜랫면바아앞원윗장통",
);

/** 브라우저와 Node 양쪽에서 도는 base64 디코더. */
function decodeBase64(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

/** 축척 확인용 30mm·1인치 네모 중 30mm 쪽 한 변 (mm). 인쇄 후 자로 재는 기준. */
export const SCALE_SQUARE_MM = 30;
/** 축척 확인용 1인치 네모 한 변 (mm). */
export const INCH_SQUARE_MM = MM_PER_INCH;
/** 두 네모 사이의 틈 (mm). 붙여 두면 한 도형처럼 보여 각각을 재지 못한다. */
const SQUARE_GAP_MM = 5;

/*
 * 아래 두 라벨 상수는 DEFAULT_LOCALE(ko) 기준으로, 테스트가 한국어 문구를
 * 못 박을 때 쓴다. 실제 인쇄는 drawScaleSquares가 로케일별로 t()로 그린다.
 */
/** 30mm 네모 옆에 붙는 문구. 한국어(기준) — 테스트 앵커용. */
export const SCALE_SQUARE_LABEL = t(DEFAULT_LOCALE, 'pdf.testSquareMetric');
/** 1인치 네모 옆에 붙는 문구. 한국어(기준) — 테스트 앵커용. */
export const INCH_SQUARE_LABEL = t(DEFAULT_LOCALE, 'pdf.testSquareImperial');

/** 도안 장마다 아래쪽에 넣는 강조 문구. 굵은 서브셋 폰트로 그린다. 한국어가 기준. */
export const PATTERN_NOTE = t(DEFAULT_LOCALE, 'pdf.printNote');

/** 굵은 서브셋 폰트가 담고 있는 글자. PATTERN_NOTE만 그릴 수 있다. */
export const KOREAN_BOLD_FONT_CHARS: ReadonlySet<string> = new Set(" '!로사세실요이제주즈출력해");

/**
 * 도안 하단 문구의 기준점 (mm). 가로 가운데, 인쇄 영역 바깥 아래쪽 여백에 둔다.
 * 도안은 사방 여백 안쪽에만 그려지므로 이 자리는 도면과 절대 겹치지 않는다.
 */
export function patternNotePointMm(pagination: Pagination): { xMm: number; yMm: number } {
  return {
    xMm: pagination.pageWidthMm / 2,
    yMm: pagination.pageHeightMm - PAGE_MARGIN_MM + 5.5,
  };
}

export type JoinEdge = 'left' | 'top' | 'right' | 'bottom';

export interface JoinMark {
  /** 이 선이 붙어 있는 인쇄 영역 가장자리. */
  readonly edge: JoinEdge;
  readonly x1Mm: number;
  readonly y1Mm: number;
  readonly x2Mm: number;
  readonly y2Mm: number;
  /** 이 선을 실제로 잘라내는가. 왼쪽·위쪽만 자르고 나머지는 맞추는 기준선이다. */
  readonly isCut: boolean;
  /** 맞춤용 마름모의 중심. 마주 보는 장의 같은 순번과 도안에서 같은 자리다. */
  readonly diamonds: readonly { readonly xMm: number; readonly yMm: number }[];
  /** ▼가 선에 닿는 지점. isCut일 때만 그린다. */
  readonly arrowXMm: number;
  readonly arrowYMm: number;
  /** 이 선 너머로 이어지는 이웃 페이지의 칸 번호. */
  readonly neighborLabel: string;
  /** 칸 번호를 찍을 자리. 잘라 버리는 쪽에 두면 붙이는 동안 읽을 수 없다. */
  readonly labelXMm: number;
  readonly labelYMm: number;
}

/** ▼ 마크의 팔 길이 (mm). */
const JOIN_ARM_MM = 4;

/** 맞춤 마름모의 중심에서 꼭짓점까지 (mm). */
export const JOIN_DIAMOND_MM = 3;

/** 마름모를 놓을 자리. 선 길이를 4등분한 안쪽 세 지점. */
const DIAMOND_STOPS = [0.25, 0.5, 0.75];

/** ▼를 놓을 자리. 마름모 세 곳(0.25/0.5/0.75) 사이의 빈 구간이라 뭉치지 않는다. */
const ARROW_STOP = 0.625;

/** 칸 번호 두 글자가 차지하는 폭 어림값 (mm). 선 왼쪽에 놓을 때 물려 주는 몫이다. */
const JOIN_LABEL_WIDTH_MM = 9;

/**
 * 이어 붙일 자리 (페이지 프레임 좌표, mm).
 *
 * 이웃 페이지끼리는 PAGE_OVERLAP_MM만큼 겹쳐 있다. 그 겹침 구간의
 * 한가운데를 기준선으로 삼는다. 왼쪽·위쪽은 거기서 잘라내고, 오른쪽·아래는
 * 이웃의 자른 변이 와서 앉을 자리를 알려 준다.
 *
 * 한가운데를 쓰는 이유가 있다. 겹침의 경계에서 자르면 두 장이 선 하나만
 * 공유해 맞춤 표시를 양쪽에 남길 자리가 없다. 한가운데에서 자르면 겹침의
 * 절반이 두 장에 모두 남아, 같은 도안 좌표에 찍은 마름모가 포갤 때 겹친다.
 * A4 3열이면 A1은 도안 0~194를, A2는 189~378을 담아 189~194가 겹친다.
 *
 * 마름모를 선 위에 얹되 용지 가장자리에서는 떨어뜨린다. 여백 8mm는 프린터
 * 비인쇄 영역 몫이라 거기까지 뻗으면 잘려 나갈 수 있다.
 */
export function joinMarksFor(pagination: Pagination, page: Page): JoinMark[] {
  const labelAt = (row: number, col: number) =>
    pagination.pages.find((p) => p.row === row && p.col === col)?.gridLabel;

  const halfMm = PAGE_OVERLAP_MM / 2;
  const leftMm = PAGE_MARGIN_MM;
  const topMm = PAGE_MARGIN_MM;
  const rightMm = pagination.pageWidthMm - PAGE_MARGIN_MM;
  const bottomMm = pagination.pageHeightMm - PAGE_MARGIN_MM;

  const vertical = (xMm: number, edge: JoinEdge, neighborLabel: string): JoinMark => ({
    edge,
    x1Mm: xMm,
    y1Mm: topMm,
    x2Mm: xMm,
    y2Mm: bottomMm,
    isCut: edge === 'left',
    diamonds: DIAMOND_STOPS.map((t) => ({ xMm, yMm: topMm + (bottomMm - topMm) * t })),
    arrowXMm: xMm,
    arrowYMm: topMm + (bottomMm - topMm) * ARROW_STOP,
    neighborLabel,
    // 라벨은 남기는 쪽에 둔다. 자르는 왼쪽 선은 오른쪽이, 오른쪽 선은 왼쪽이 남는다.
    // 글자가 왼쪽 기준으로 그려지므로 왼쪽에 놓을 때는 글자 폭만큼 더 물린다.
    labelXMm: edge === 'left' ? xMm + JOIN_DIAMOND_MM + 1 : xMm - JOIN_DIAMOND_MM - JOIN_LABEL_WIDTH_MM,
    labelYMm: topMm + (bottomMm - topMm) * 0.25 - JOIN_DIAMOND_MM - 2,
  });

  const horizontal = (yMm: number, edge: JoinEdge, neighborLabel: string): JoinMark => ({
    edge,
    x1Mm: leftMm,
    y1Mm: yMm,
    x2Mm: rightMm,
    y2Mm: yMm,
    isCut: edge === 'top',
    diamonds: DIAMOND_STOPS.map((t) => ({ xMm: leftMm + (rightMm - leftMm) * t, yMm })),
    arrowXMm: leftMm + (rightMm - leftMm) * ARROW_STOP,
    arrowYMm: yMm,
    neighborLabel,
    labelXMm: leftMm + (rightMm - leftMm) * 0.25 + JOIN_DIAMOND_MM + 1,
    // 자르는 위쪽 선은 아래가, 아래쪽 선은 위가 남는다.
    labelYMm: edge === 'top' ? yMm + JOIN_DIAMOND_MM + 4 : yMm - JOIN_DIAMOND_MM - 2,
  });

  const marks: JoinMark[] = [];
  const left = labelAt(page.row, page.col - 1);
  const right = labelAt(page.row, page.col + 1);
  const above = labelAt(page.row - 1, page.col);
  const below = labelAt(page.row + 1, page.col);

  if (left !== undefined) marks.push(vertical(leftMm + halfMm, 'left', left));
  if (right !== undefined) marks.push(vertical(rightMm - halfMm, 'right', right));
  if (above !== undefined) marks.push(horizontal(topMm + halfMm, 'top', above));
  if (below !== undefined) marks.push(horizontal(bottomMm - halfMm, 'bottom', below));

  return marks;
}

/**
 * 칸 번호를 찍을 자리 (페이지 프레임 좌표, mm).
 *
 * 잘라내는 쪽에 두면 이어 붙이는 순간 번호가 사라진다. 자르는 선이 있는
 * 방향으로 겹침의 절반만큼 들여 놓는다. 자를 데가 없는 첫 칸은 그대로 둔다.
 */
export function gridLabelPointMm(pagination: Pagination, page: Page): { xMm: number; yMm: number } {
  const cuts = joinMarksFor(pagination, page).filter((m) => m.isCut);
  const halfMm = PAGE_OVERLAP_MM / 2;
  const trimLeftMm = cuts.some((m) => m.edge === 'left') ? halfMm : 0;
  const trimTopMm = cuts.some((m) => m.edge === 'top') ? halfMm : 0;
  return {
    xMm: PAGE_MARGIN_MM + trimLeftMm + 2,
    yMm: PAGE_MARGIN_MM + trimTopMm + 6,
  };
}

/**
 * pdf-lib이 쓰는 0~1 실수 색으로 바꾼다. 값 자체는 core/colors.ts에 있다.
 *
 * 그 파일은 pdf-lib을 부르지 않는다. 첫 화면에 바로 뜨는 preview.ts가 색을
 * 꺼내 쓰므로, 색 파일이 rgb를 끌어오면 PDF 생성기 1.1MB가 첫 화면 조각으로
 * 딸려 온다. 감싸는 일은 여기서 한다.
 *
 * 이 저장소에서 rgb()를 부르는 자리는 여기 하나뿐이다. pdf.ts와 round/pdf.ts가
 * 이 함수를 가져다 쓴다 — tests/color-source.test.ts가 지킨다.
 */
export function pdfColor(hex: string) {
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}

export const MARK = pdfColor(MARK_COLOR);
export const SCALE = pdfColor(SCALE_COLOR);
/** 맞춤 마름모. 도안 선과 섞이지 않도록 빨강을 쓴다. */
export const JOIN_DIAMOND = pdfColor(JOIN_DIAMOND_COLOR);

/*
 * 도안에 찍는 세 줄의 바탕 크기(pt)와 줄 간격(mm). 여기에 배율을 곱해 쓴다.
 * 셋의 비율이 위계를 만든다 — 계정이 이름보다, 이름이 권유보다 크다.
 */
const TITLE_SIZE = 11;
const MESSAGE_SIZE = 8;
const HANDLE_SIZE = 15;
const MESSAGE_OFFSET_MM = 6;
const HANDLE_OFFSET_MM = 14;

/*
 * 키우고 싶은 만큼. 종이만 따로 돌아다닐 때 멀리서도 계정이 읽히려면
 * 이 정도는 되어야 한다.
 */
export const TITLE_SCALE_MAX = 2.25;

/** 문구와 앞판 경계 사이에 남길 여백 (mm). */
export const TITLE_MARGIN_MM = 1.5;

/**
 * 앞판 높이가 허락하는 배율.
 *
 * 문구는 앞판 한가운데 들어가는데 앞판 높이는 `높이 - 2*시접`이라, 낮은
 * 파우치에서는 자리가 얼마 없다. 필통(높이 50)이면 30mm뿐이다. 무조건
 * 키우면 문구가 앞판을 넘어 바닥 밴드를 침범하고, 그러면 재단선을 읽는 데
 * 방해가 된다.
 *
 * 1보다 작아지지는 않는다. 자리가 없다고 예전보다 작게 찍으면 지금 쓰던
 * 사람에게는 고친 게 아니라 망가뜨린 것이 된다.
 */
export function titleScale(frontHeightMm: number, blockMm: number): number {
  if (blockMm <= 0) return 1;
  const room = frontHeightMm - 2 * TITLE_MARGIN_MM;
  return Math.min(TITLE_SCALE_MAX, Math.max(1, room / blockMm));
}

export interface PageContext {
  readonly pdfPage: PDFPage;
  readonly pagination: Pagination;
  readonly page: Page;
}

/**
 * 페이지 프레임 좌표(mm, 페이지 자체 기준) → PDF 좌표(pt).
 * 전개도 원점 오프셋 없이 y축 뒤집기(페이지 좌상단 원점 → PDF 좌하단 원점)만 적용한다.
 * 이 파일에서 y 반전식은 이 함수 안에만 있고, 나머지 좌표 계산은 모두 이 함수
 * (또는 이를 감싸는 toPagePoint)를 통과한다.
 */
export function toFramePoint(pagination: Pagination, xMm: number, yMm: number): { x: number; y: number } {
  return {
    x: xMm * MM_TO_PT,
    y: (pagination.pageHeightMm - yMm) * MM_TO_PT,
  };
}

/** 전개도 좌표(mm) → PDF 좌표(pt). 페이지 원점 오프셋을 얹은 뒤 toFramePoint로 뒤집는다. */
export function toPagePoint(pagination: Pagination, page: Page, xMm: number, yMm: number): { x: number; y: number } {
  const localXMm = xMm - page.originXMm + PAGE_MARGIN_MM;
  const localYMm = yMm - page.originYMm + PAGE_MARGIN_MM;
  return toFramePoint(pagination, localXMm, localYMm);
}

export function drawAlignmentMarks(ctx: PageContext, font: PDFFont) {
  const { pagination, page } = ctx;
  const armPt = 4 * MM_TO_PT;
  const corners: readonly { xMm: number; yMm: number }[] = [
    { xMm: PAGE_MARGIN_MM, yMm: PAGE_MARGIN_MM },
    { xMm: pagination.pageWidthMm - PAGE_MARGIN_MM, yMm: PAGE_MARGIN_MM },
    { xMm: PAGE_MARGIN_MM, yMm: pagination.pageHeightMm - PAGE_MARGIN_MM },
    { xMm: pagination.pageWidthMm - PAGE_MARGIN_MM, yMm: pagination.pageHeightMm - PAGE_MARGIN_MM },
  ];

  for (const corner of corners) {
    const { x, y } = toFramePoint(pagination, corner.xMm, corner.yMm);
    ctx.pdfPage.drawLine({
      start: { x: x - armPt, y },
      end: { x: x + armPt, y },
      thickness: 0.5,
      color: MARK,
    });
    ctx.pdfPage.drawLine({
      start: { x, y: y - armPt },
      end: { x, y: y + armPt },
      thickness: 0.5,
      color: MARK,
    });
  }

  const labelMm = gridLabelPointMm(pagination, page);
  const labelPoint = toFramePoint(pagination, labelMm.xMm, labelMm.yMm);
  ctx.pdfPage.drawText(page.gridLabel, {
    x: labelPoint.x,
    y: labelPoint.y,
    size: 12,
    font,
    color: MARK,
  });
}

/**
 * 이어 붙임 안내선. 잘라낼 자리를 긴 점선으로 긋고, 버릴 쪽을 향한 ▼와
 * 그 너머로 이어지는 이웃 칸 번호를 붙인다.
 *
 * 색은 맞춤표·칸 번호와 같은 MARK_COLOR를 쓴다. 도안 선(재단선 검정 실선,
 * 완성선 2,2 점선, 접힘선 연회색 4,4 점선)이 아니라 조립 표시라는 걸
 * 색과 점선 간격으로 함께 가른다.
 *
 * ▼는 글자가 아니라 선으로 그린다. 서브셋 폰트에 없는 글자를 쓰면 그
 * 자리가 비어 나오기 때문이다. 글자는 이웃 칸 번호(A~Z, 0~9)뿐이다.
 */
export function drawJoinMarks(ctx: PageContext, font: PDFFont) {
  const { pagination, page } = ctx;
  const armMm = JOIN_ARM_MM;

  for (const mark of joinMarksFor(pagination, page)) {
    ctx.pdfPage.drawLine({
      start: toFramePoint(pagination, mark.x1Mm, mark.y1Mm),
      end: toFramePoint(pagination, mark.x2Mm, mark.y2Mm),
      thickness: 0.5,
      color: MARK,
      dashArray: [6, 3],
    });

    // 맞춤 마름모. 마주 보는 장의 같은 자리에도 찍히므로 포개면 겹친다.
    for (const d of mark.diamonds) {
      const corners = [
        { xMm: d.xMm, yMm: d.yMm - JOIN_DIAMOND_MM },
        { xMm: d.xMm + JOIN_DIAMOND_MM, yMm: d.yMm },
        { xMm: d.xMm, yMm: d.yMm + JOIN_DIAMOND_MM },
        { xMm: d.xMm - JOIN_DIAMOND_MM, yMm: d.yMm },
      ];
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i]!;
        const b = corners[(i + 1) % corners.length]!;
        ctx.pdfPage.drawLine({
          start: toFramePoint(pagination, a.xMm, a.yMm),
          end: toFramePoint(pagination, b.xMm, b.yMm),
          thickness: 0.6,
          color: JOIN_DIAMOND,
        });
      }
    }

    // ▼는 실제로 잘라내는 선에만. 꼭짓점이 버리는 쪽을 가리킨다.
    if (mark.isCut) {
      const isLeft = mark.edge === 'left';
      const apex = isLeft
        ? { xMm: mark.arrowXMm - armMm, yMm: mark.arrowYMm }
        : { xMm: mark.arrowXMm, yMm: mark.arrowYMm - armMm };
      const wings = isLeft
        ? [{ xMm: mark.arrowXMm, yMm: mark.arrowYMm - armMm }, { xMm: mark.arrowXMm, yMm: mark.arrowYMm + armMm }]
        : [{ xMm: mark.arrowXMm - armMm, yMm: mark.arrowYMm }, { xMm: mark.arrowXMm + armMm, yMm: mark.arrowYMm }];

      for (const wing of wings) {
        ctx.pdfPage.drawLine({
          start: toFramePoint(pagination, apex.xMm, apex.yMm),
          end: toFramePoint(pagination, wing.xMm, wing.yMm),
          thickness: 0.5,
          color: MARK,
        });
      }
    }

    const labelPoint = toFramePoint(pagination, mark.labelXMm, mark.labelYMm);
    ctx.pdfPage.drawText(mark.neighborLabel, {
      x: labelPoint.x,
      y: labelPoint.y,
      size: 9,
      font,
      color: MARK,
    });
  }
}

/** 로케일이 쓰는 PDF 폰트 종류. 표준 폰트로 그릴 수 있으면 표준, 아니면 서브셋. */
type FontKind = 'korean' | 'latin' | 'tc' | 'sc' | 'jp';

/** 로케일 → 폰트 종류. Locale을 하나 늘리면 여기 빠진 일이 타입 에러로 즉시 드러난다. */
export const FONT_KIND: Readonly<Record<Locale, FontKind>> = {
  ko: 'korean',
  en: 'latin',
  'zh-TW': 'tc',
  'zh-CN': 'sc',
  ja: 'jp',
};

/** 축척 확인용 네모 하나의 자리·크기, 그리고 옆에 적을 문구의 카탈로그 키. */
export interface ScaleSquare {
  readonly xMm: number;
  readonly yMm: number;
  readonly sizeMm: number;
  readonly labelKey: 'pdf.testSquareMetric' | 'pdf.testSquareImperial';
}

/**
 * 축척 확인용 네모 둘의 자리와 크기 (mm). 첫 도안 장 오른쪽 위에 나란히 둔다.
 * 1인치(왼쪽)와 30mm(오른쪽 플러시). 자를 고르게 하지 않고 둘 다 인쇄해,
 * 어느 자를 쓰는 사람이든 축척이 맞는지 잴 수 있게 한다.
 */
export function scaleSquareRectsMm(pagination: Pagination): readonly [ScaleSquare, ScaleSquare] {
  const yMm = PAGE_MARGIN_MM + 10;
  const rightMm = pagination.pageWidthMm - PAGE_MARGIN_MM - 2;
  const metricXMm = rightMm - SCALE_SQUARE_MM;
  const inchXMm = metricXMm - SQUARE_GAP_MM - INCH_SQUARE_MM;
  return [
    { xMm: inchXMm, yMm, sizeMm: INCH_SQUARE_MM, labelKey: 'pdf.testSquareImperial' },
    { xMm: metricXMm, yMm, sizeMm: SCALE_SQUARE_MM, labelKey: 'pdf.testSquareMetric' },
  ];
}

/** 도안 장 아래쪽 강조 문구. 실치수로 뽑아야 한다는 걸 인쇄물에서도 알 수 있게 한다. */
export function drawPatternNote(ctx: PageContext, boldFont: PDFFont, locale: Locale) {
  const { pagination } = ctx;
  const note = t(locale, 'pdf.printNote');
  const point = patternNotePointMm(pagination);
  const size = 9;
  const widthPt = boldFont.widthOfTextAtSize(note, size);
  const anchor = toFramePoint(pagination, point.xMm, point.yMm);

  ctx.pdfPage.drawText(note, {
    x: anchor.x - widthPt / 2,
    y: anchor.y,
    size,
    font: boldFont,
    color: SCALE,
  });
}

/**
 * 배율 100%로 인쇄됐는지 자로 확인하는 네모. 도면 선과 헷갈리지 않도록
 * 빨간색으로만 그린다. 라벨은 로케일별 문구를 쓴다.
 */
export function drawScaleSquares(page: PDFPage, pagination: Pagination, font: PDFFont, locale: Locale) {
  for (const rect of scaleSquareRectsMm(pagination)) {
    const topLeft = toFramePoint(pagination, rect.xMm, rect.yMm);
    const sidePt = rect.sizeMm * MM_TO_PT;

    page.drawRectangle({
      x: topLeft.x,
      y: topLeft.y - sidePt,
      width: sidePt,
      height: sidePt,
      borderColor: SCALE,
      borderWidth: 1,
    });

    page.drawText(t(locale, rect.labelKey), {
      x: rect.xMm * MM_TO_PT,
      y: topLeft.y + 3,
      size: 9,
      font,
      color: SCALE,
    });
  }
}

/**
 * 로케일별 폰트를 문서에 심는다. ko/zh/ja는 서브셋(글리프를 통째로 심음),
 * en은 표준 폰트(심지 않아도 되어 가볍고 검색·복사도 된다). CJK·ko는
 * sub셋에 없는 글자를 그리지 못하니 문구를 바꾸면 서브셋도 다시 만든다.
 */
export async function loadFonts(
  doc: PDFDocument,
  locale: Locale,
): Promise<{ font: PDFFont; boldFont: PDFFont }> {
  doc.registerFontkit(fontkit);
  switch (FONT_KIND[locale] ?? FONT_KIND[DEFAULT_LOCALE]) {
    case 'korean':
      return {
        font: await doc.embedFont(decodeBase64(KOREAN_FONT_BASE64)),
        boldFont: await doc.embedFont(decodeBase64(KOREAN_BOLD_FONT_BASE64)),
      };
    case 'latin':
      return {
        font: await doc.embedFont(StandardFonts.Helvetica),
        boldFont: await doc.embedFont(StandardFonts.HelveticaBold),
      };
    case 'tc': {
      const font = await doc.embedFont(decodeBase64(ZH_TW_FONT_BASE64));
      return { font, boldFont: font };
    }
    case 'sc': {
      const font = await doc.embedFont(decodeBase64(ZH_CN_FONT_BASE64));
      return { font, boldFont: font };
    }
    case 'jp': {
      const font = await doc.embedFont(decodeBase64(JA_FONT_BASE64));
      return { font, boldFont: font };
    }
  }
}

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
  locale: Locale,
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
      color: MARK,
      ...(opacity === undefined ? {} : { opacity }),
    });
  };

  draw(title, TITLE_SIZE * scale, titleYMm);
  // 권유 한 줄은 계정보다 작게. 옅어 보이는 일은 색이 아니라
  // 투명도가 맡는다 — 색까지 옅으면 인쇄에서 사라진다.
  draw(t(locale, 'pdf.watermark'), MESSAGE_SIZE * scale, titleYMm + MESSAGE_OFFSET_MM * scale, WATERMARK_OPACITY);
  // 계정은 이름보다도 크게. 여기가 강조하고 싶은 자리다.
  draw(WATERMARK_HANDLE, HANDLE_SIZE * scale, titleYMm + HANDLE_OFFSET_MM * scale, WATERMARK_OPACITY);
}
