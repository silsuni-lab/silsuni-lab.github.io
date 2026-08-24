// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import { PAGE_WARN_THRESHOLD, ROUND_PRESETS, SEAM_MM, type RoundPreset } from '../src/core/constants';
import {
  BACK_RATIO_CHOICES,
  BACK_RATIO_DEFAULT,
  ROUND_FIELDS,
  roundPatternFileName,
  validateRoundDimensions,
} from '../src/core/round/dimensions';
import { buildRoundLayout } from '../src/core/round/layout';
import { paginate, type PaperSize } from '../src/core/tiling';
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
import { renderRoundPreviewSvg, roundLegendItems } from '../src/ui/round/preview';
import { renderRoundShapeSvg } from '../src/ui/round/shape';
import { trackDownload } from '../src/track';
import { isStaleChunkError, keepState, takeState, type ScreenState } from '../src/stale';
import '../src/style.css';

const presetsEl = document.getElementById('presets')!;
const inputsEl = document.getElementById('inputs')!;
const papersEl = document.getElementById('papers')!;
const backFieldEl = document.getElementById('back-field')!;
const seamFieldEl = document.getElementById('seam-field')!;
const legendEl = document.getElementById('legend')!;
const previewEl = document.getElementById('preview')!;
const shapeEl = document.getElementById('shape')!;
const summaryEl = document.getElementById('preview-summary')!;
const errorEl = document.getElementById('error')!;
const downloadBtn = document.getElementById('download') as HTMLButtonElement;

/*
 * 배포가 지나가 스스로 다시 부른 화면이면 맡겨 둔 상태가 남아 있다.
 * 선언보다 먼저 꺼내야 아래 초기값과 첫 그리기가 한 번에 맞는다.
 */
const kept = takeState('round');

let paper: PaperSize = kept?.paper ?? 'a4';
// 기본은 시접 포함. 무심코 시접 없는 도안을 뽑아 원단을 버리는 일을 막는다.
let addSeam = kept?.addSeam ?? true;
// 뒷면은 절대 길이가 아니라 둘레 비율로 뜻이 정해진다 — round/dimensions.ts 참고.
let backRatio = kept?.backRatio ?? BACK_RATIO_DEFAULT;

function showError(messages: readonly string[]): void {
  if (messages.length === 0) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = messages.join(' ');
}

function refresh(): void {
  const result = validateRoundDimensions(readInputs(ROUND_FIELDS), backRatio);

  if (!result.ok) {
    showError(result.errors.map((e) => e.message));
    previewEl.innerHTML = '';
    shapeEl.innerHTML = '';
    summaryEl.textContent = '';
    legendEl.innerHTML = '';
    downloadBtn.disabled = true;
    setPaperCount('a4', null);
    setPaperCount('a3', null);
    return;
  }

  showError([]);
  shapeEl.innerHTML = renderRoundShapeSvg(result.value);

  const layout = buildRoundLayout(result.value, addSeam ? SEAM_MM : 0, backRatio);

  // 용지별 장수를 둘 다 보여줘야 해서 어차피 A4·A3을 모두 계산한다.
  // 고른 용지 것을 여기서 꺼내 쓰면 같은 계산을 한 번 덜 한다.
  const byPaper = { a4: paginate(layout, 'a4'), a3: paginate(layout, 'a3') };
  const pagination = byPaper[paper];

  previewEl.innerHTML = renderRoundPreviewSvg(layout, pagination);
  summaryEl.textContent = describePagination(pagination);
  downloadBtn.disabled = false;

  // 견본 색은 CSS가 아니라 roundLegendItems가 준다. 도면에 그린 색과 같은
  // 출처라 범례가 딴 색을 가리킬 수 없다.
  legendEl.innerHTML = roundLegendItems(layout)
    .map((item) => {
      const style = item.fill === undefined
        ? `border-top-color: ${item.color}`
        : `border-color: ${item.color}; background: ${item.fill}`;
      return `<li><span class="swatch ${item.swatch}" style="${style}"></span>${item.text}</li>`;
    })
    .join('');

  setPaperCount('a4', byPaper.a4.pages.length);
  setPaperCount('a3', byPaper.a3.pages.length);
}

/** 새로 부르기 전에 맡길 화면 상태. 사람이 고르고 친 것만 모은다. */
function currentState(): ScreenState {
  const values = readInputs(ROUND_FIELDS);
  return {
    kind: 'round',
    values: {
      diameterMm: String(values.diameterMm ?? ''),
      sideHeightMm: String(values.sideHeightMm ?? ''),
      lidHeightMm: String(values.lidHeightMm ?? ''),
    },
    paper,
    addSeam,
    backRatio,
  };
}

async function download(): Promise<void> {
  const result = validateRoundDimensions(readInputs(ROUND_FIELDS), backRatio);
  if (!result.ok) return;

  const layout = buildRoundLayout(result.value, addSeam ? SEAM_MM : 0, backRatio);
  const pagination = paginate(layout, paper);

  if (pagination.pages.length > PAGE_WARN_THRESHOLD) {
    const ok = window.confirm(
      `${pagination.pages.length}장이 출력됩니다. 계속할까요?`,
    );
    if (!ok) return;
  }

  downloadBtn.disabled = true;
  try {
    // PDF 생성기는 한글 폰트와 fontkit을 끌고 와 첫 로딩을 무겁게 만든다.
    // 버튼을 누른 뒤에 받아오면 화면은 가볍게 뜨고 기능은 그대로다.
    const { buildRoundPdf } = await import('../src/core/round/pdf');
    const bytes = await buildRoundPdf(layout, pagination);
    // TS 5.7+에서 bare Uint8Array는 Uint8Array<ArrayBufferLike>로 추론되어
    // BlobPart(ArrayBufferView<ArrayBuffer>)에 그대로 대입되지 않는다.
    // @types/node를 추가하지 않고(불필요한 의존성) 여기서만 단언으로 좁힌다.
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = roundPatternFileName(result.value, paper, layout.seamMm);
    link.click();
    // click() 직후 바로 거두면 브라우저가 아직 읽는 중일 수 있다. Chrome은
    // 견디지만 표준이 보장하는 동작은 아니다. 다음 차례로 미뤄 둔다.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // 파일이 실제로 나간 뒤에만 센다. 만들다 실패한 시도까지 세면
    // "몇 명이 받았나"가 아니라 "몇 번 눌렀나"가 된다.
    trackDownload({
      kind: 'round',
      /*
       * 원통도 치수 칸 셋을 그대로 쓴다 — w에 지름, h에 옆면, d에 뚜껑이다.
       * 열을 새로 만들면 두 종류가 서로 빈 칸을 만들어 피벗이 지저분해진다.
       * 열 이름이 원통에는 안 맞지만 kind를 보면 무슨 값인지 알 수 있다.
       */
      widthMm: result.value.diameterMm,
      heightMm: result.value.sideHeightMm,
      depthMm: result.value.lidHeightMm,
      paper,
      seamMm: layout.seamMm,
      // 원통에는 골선접기가 없다.
      foldHalf: false,
    });
  } catch (error) {
    /*
     * 배포가 지나가 PDF 조각을 못 찾는 경우다. 화면을 새로 부르면 새 이름을
     * 부르게 되어 저절로 낫는다. 치던 치수는 맡겼다가 되돌려준다.
     *
     * keepState가 거절하면 이미 한 번 다시 불러 본 뒤다. 또 부르면 끝없이
     * 도는 화면이 되므로, 그때는 아래로 내려가 오류를 보여 준다.
     */
    if (isStaleChunkError(error) && keepState(currentState())) {
      showError(['새 버전이 올라왔습니다. 화면을 다시 불러옵니다…']);
      location.reload();
      return;
    }
    showError([`PDF를 만들지 못했습니다: ${error instanceof Error ? error.message : String(error)}`]);
  } finally {
    downloadBtn.disabled = false;
  }
}

renderPresetButtons(presetsEl, ROUND_FIELDS, ROUND_PRESETS, (preset: RoundPreset) => {
  writeInputValues(ROUND_FIELDS, preset);
  refresh();
});
renderInputs(inputsEl, ROUND_FIELDS, refresh);
renderSeamOption(seamFieldEl, addSeam, (next) => {
  addSeam = next;
  refresh();
});
renderChoice(backFieldEl, 'back-ratio', '뒷면', BACK_RATIO_CHOICES, backRatio, (next) => {
  backRatio = next;
  refresh();
});
renderPaperOptions(papersEl, paper, (next) => {
  paper = next;
  refresh();
});
downloadBtn.addEventListener('click', () => void download());

// 첫 화면은 첫 번째 프리셋으로 채운다. 되살린 화면이면 치던 값을 되돌린다.
if (kept === undefined) writeInputValues(ROUND_FIELDS, ROUND_PRESETS[0]!);
else writeInputValues(ROUND_FIELDS, kept.values);
refresh();
