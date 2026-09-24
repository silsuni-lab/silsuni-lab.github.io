// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

/*
 * 네모네모 손잡이 파우치 화면. round-pouch/main.ts와 같은 흐름이다 — 치수를
 * 읽어 검사하고, 완성 예상 그림과 전개도 미리보기를 그리고, PDF를 내려준다.
 *
 * 다른 점은 둘이다. 한국어 한 벌뿐이라 언어 드롭다운이 없고, 뒷면 비율
 * 선택지가 치수를 따라 잠긴다(경첩이 가로보다 길 수 없다).
 *
 * 다운로드 기록(trackDownload)은 부르지 않는다. silbap으로 넘길 도구라
 * 여기서 기록을 쌓을 일이 없다 — tests/pages.test.ts가 지킨다.
 */
import { PAGE_WARN_THRESHOLD, SEAM_MM, SQUARE_PRESETS } from '../src/core/constants';
import {
  BACK_RATIO_DEFAULT,
  SQUARE_FIELDS,
  squareBackRatioChoices,
  squareBackRatioFallback,
  squareCornerChoices,
  squareCornerFallback,
  squarePatternFileName,
  validateSquareDimensions,
} from '../src/core/square/dimensions';
import { buildSquareLayout } from '../src/core/square/layout';
import { paginate, type PaperSize } from '../src/core/tiling';
import { currentLocale } from '../src/core/i18n/locales';
import { t } from '../src/core/i18n/messages';
import {
  readInputs,
  renderChoice,
  renderInputs,
  renderPaperOptions,
  renderPresetButtons,
  renderSeamOption,
  setPaperCount,
  writeInputValues,
} from '../src/ui/form';
import { describePagination } from '../src/ui/preview';
import { renderSquarePreviewSvg, squareLegendItems } from '../src/ui/square/preview';
import { renderSquareShapeSvg } from '../src/ui/square/shape';
import { isStaleChunkError, keepState, takeState, type ScreenState } from '../src/stale';
import '../src/style.css';

const locale = currentLocale();

const presetsEl = document.getElementById('presets')!;
const inputsEl = document.getElementById('inputs')!;
const papersEl = document.getElementById('papers')!;
const backFieldEl = document.getElementById('back-field')!;
const cornerFieldEl = document.getElementById('corner-field')!;
const seamFieldEl = document.getElementById('seam-field')!;
const legendEl = document.getElementById('legend')!;
const previewEl = document.getElementById('preview')!;
const shapeEl = document.getElementById('shape')!;
const summaryEl = document.getElementById('preview-summary')!;
const errorEl = document.getElementById('error')!;
const downloadBtn = document.getElementById('download') as HTMLButtonElement;

const kept = takeState('square');

let paper: PaperSize = kept?.paper ?? 'a4';
let addSeam = kept?.addSeam ?? true;
let backRatio = kept?.backRatio ?? BACK_RATIO_DEFAULT;
// 기본은 각지게. 둥글리는 건 고르는 사람 몫이다.
let cornerRadiusMm = kept?.cornerRadiusMm ?? 0;

function showError(messages: readonly string[]): void {
  errorEl.hidden = messages.length === 0;
  errorEl.textContent = messages.join(' ');
}

/**
 * 모서리 선택지를 지금 폭에 맞춰 다시 그린다. 폭을 줄여 고른 반지름이 안
 * 되면 되는 것 중 가장 큰 값으로 내린다. 뒷면 비율이 이 값에 딸려 있으므로
 * 뒷면보다 먼저 그린다.
 */
function renderCornerChoice(): void {
  const depthMm = Number(readInputs(SQUARE_FIELDS).depthMm);
  const dims = Number.isInteger(depthMm) && depthMm > 0 ? { depthMm } : undefined;
  if (dims !== undefined) cornerRadiusMm = squareCornerFallback(dims, cornerRadiusMm);
  renderChoice(
    cornerFieldEl, 'corner-radius', t(locale, 'square.control.corner'),
    squareCornerChoices(locale, dims), cornerRadiusMm,
    (next) => {
      cornerRadiusMm = next;
      refresh();
    },
  );
}

/**
 * 뒷면 비율 선택지를 지금 치수에 맞춰 다시 그린다.
 *
 * 폭을 키우다 30%가 잠기면 고른 값을 되는 것 중 가장 큰 값으로 내린다.
 * 그대로 두면 치수는 멀쩡한데 오류가 떠서, 무엇을 고쳐야 하는지 알기 어렵다.
 * 가로나 폭이 아직 올바르지 않으면 잠그지 않고 다섯을 모두 연다.
 */
function renderBackChoice(): void {
  const values = readInputs(SQUARE_FIELDS);
  const widthMm = Number(values.widthMm);
  const depthMm = Number(values.depthMm);
  const known = Number.isInteger(widthMm) && Number.isInteger(depthMm) && widthMm > 0 && depthMm > 0 && depthMm <= widthMm;
  const dims = known ? { widthMm, depthMm } : undefined;
  if (dims !== undefined) backRatio = squareBackRatioFallback(dims, backRatio, cornerRadiusMm);
  renderChoice(
    backFieldEl, 'back-ratio', t(locale, 'round.control.backRatio'),
    squareBackRatioChoices(locale, dims, cornerRadiusMm), backRatio,
    (next) => {
      backRatio = next;
      refresh();
    },
  );
}

function refresh(): void {
  renderCornerChoice();
  renderBackChoice();
  const result = validateSquareDimensions(readInputs(SQUARE_FIELDS), backRatio, locale, cornerRadiusMm);

  if (!result.ok) {
    showError(result.errors.map((e) => e.message));
    previewEl.innerHTML = '';
    shapeEl.innerHTML = '';
    summaryEl.textContent = '';
    legendEl.innerHTML = '';
    downloadBtn.disabled = true;
    setPaperCount(locale, 'a4', null);
    setPaperCount(locale, 'a3', null);
    return;
  }

  showError([]);
  shapeEl.innerHTML = renderSquareShapeSvg(result.value, locale, cornerRadiusMm);

  const layout = buildSquareLayout(result.value, addSeam ? SEAM_MM : 0, backRatio, cornerRadiusMm);
  const byPaper = { a4: paginate(layout, 'a4'), a3: paginate(layout, 'a3') };
  const pagination = byPaper[paper];

  previewEl.innerHTML = renderSquarePreviewSvg(layout, pagination, locale);
  summaryEl.textContent = describePagination(pagination, locale);
  downloadBtn.disabled = false;

  legendEl.innerHTML = squareLegendItems(layout, locale)
    .map((item) => {
      const style = item.fill === undefined
        ? `border-top-color: ${item.color}`
        : `border-color: ${item.color}; background: ${item.fill}`;
      return `<li><span class="swatch ${item.swatch}" style="${style}"></span>${item.text}</li>`;
    })
    .join('');

  setPaperCount(locale, 'a4', byPaper.a4.pages.length);
  setPaperCount(locale, 'a3', byPaper.a3.pages.length);
}

function currentState(): ScreenState {
  const values = readInputs(SQUARE_FIELDS);
  return {
    kind: 'square',
    values: {
      widthMm: String(values.widthMm ?? ''),
      depthMm: String(values.depthMm ?? ''),
      sideHeightMm: String(values.sideHeightMm ?? ''),
      lidHeightMm: String(values.lidHeightMm ?? ''),
    },
    paper,
    addSeam,
    backRatio,
    cornerRadiusMm,
  };
}

async function download(): Promise<void> {
  const result = validateSquareDimensions(readInputs(SQUARE_FIELDS), backRatio, locale, cornerRadiusMm);
  if (!result.ok) return;

  const layout = buildSquareLayout(result.value, addSeam ? SEAM_MM : 0, backRatio, cornerRadiusMm);
  const pagination = paginate(layout, paper);

  if (pagination.pages.length > PAGE_WARN_THRESHOLD) {
    if (!window.confirm(t(locale, 'confirm.manySheets', pagination.pages.length))) return;
  }

  downloadBtn.disabled = true;
  try {
    // PDF 생성기는 폰트를 끌고 와 무겁다. 버튼을 누른 뒤에 받아온다.
    const { buildSquarePdf } = await import('../src/core/square/pdf');
    const bytes = await buildSquarePdf(layout, pagination, locale);
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = squarePatternFileName(result.value, paper, layout.seamMm, cornerRadiusMm);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    // 배포가 지나가 PDF 조각을 못 찾으면 치던 치수를 맡기고 새로 부른다. 한 번만.
    if (isStaleChunkError(error) && keepState(currentState())) {
      showError([t(locale, 'error.stale')]);
      location.reload();
      return;
    }
    showError([t(locale, 'error.pdfFailed', error instanceof Error ? error.message : String(error))]);
  } finally {
    downloadBtn.disabled = false;
  }
}

renderPresetButtons(presetsEl, SQUARE_FIELDS, SQUARE_PRESETS, locale, (preset) => {
  writeInputValues(SQUARE_FIELDS, preset);
  refresh();
});
renderInputs(inputsEl, SQUARE_FIELDS, locale, refresh);
renderSeamOption(seamFieldEl, locale, addSeam, (next) => {
  addSeam = next;
  refresh();
});
renderPaperOptions(papersEl, paper, (next) => {
  paper = next;
  refresh();
});
downloadBtn.addEventListener('click', () => void download());

// 첫 화면은 사진 속 크기(화장품 파우치)로 채운다. 되살린 화면이면 치던 값을 되돌린다.
if (kept === undefined) writeInputValues(SQUARE_FIELDS, SQUARE_PRESETS[1]!);
else writeInputValues(SQUARE_FIELDS, kept.values);
refresh();
