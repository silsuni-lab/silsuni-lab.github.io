// SPDX-License-Identifier: MIT
// Copyright (C) 2026 choisuing

import type { FieldSpec, PresetOf } from '../core/constants';
import { t } from '../core/i18n/messages';
import type { Locale } from '../core/i18n/locales';
import type { PaperSize } from '../core/tiling';

/*
 * 입력칸을 그리고 읽는 부분은 사각·원통이 함께 쓴다. 치수 칸 이름만 다르고
 * 하는 일은 같아서, 칸 한 벌(FieldSpec)을 받아 돌게 해 두었다. 종류마다
 * 같은 코드를 두 벌 두면 한쪽만 고쳤을 때 두 화면이 다르게 군다.
 *
 * 표시 문구는 전부 카탈로그에서 온다 — 칸 이름은 `spec.labelPrefix`가,
 * 프리셋 이름은 `spec.presetPrefix`가 만드는 키로 t()가 찾는다. 구간 안내는
 * 사각·원통이 같은 `field.range`를 쓴다.
 */

/** 프리셋 버튼에 적을 문구. 치수는 spec.order 순으로 늘어놓는다. */
export function formatPresetLabel<F extends string>(
  spec: FieldSpec<F>,
  preset: PresetOf<F>,
  locale: Locale,
): string {
  const sizes = spec.order.map((field) => preset[field]).join('*');
  return `${t(locale, `${spec.presetPrefix}.${preset.id}` as never)} ${sizes}`;
}

export function renderPresetButtons<F extends string>(
  container: HTMLElement,
  spec: FieldSpec<F>,
  presets: readonly PresetOf<F>[],
  locale: Locale,
  onPick: (preset: PresetOf<F>) => void,
): void {
  container.innerHTML = '';
  presets.forEach((preset, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `preset preset-${index + 1}`;
    button.textContent = formatPresetLabel(spec, preset, locale);
    button.addEventListener('click', () => onPick(preset));
    container.append(button);
  });
}

export function renderInputs<F extends string>(
  container: HTMLElement,
  spec: FieldSpec<F>,
  locale: Locale,
  onChange: () => void,
): void {
  container.innerHTML = '';
  for (const field of spec.order) {
    const { min, max } = spec.ranges[field];
    const wrapper = document.createElement('label');
    wrapper.className = 'input-row';

    const name = document.createElement('span');
    name.className = 'input-name';
    name.textContent = t(locale, `${spec.labelPrefix}.${field}` as never);

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `field-${field}`;
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.inputMode = 'numeric';
    input.addEventListener('input', onChange);

    const hint = document.createElement('span');
    hint.className = 'input-hint';
    hint.textContent = t(locale, 'field.range' as never, min, max);

    wrapper.append(name, input, hint);
    container.append(wrapper);
  }
}

export function renderPaperOptions(
  container: HTMLElement,
  selected: PaperSize,
  onChange: (paper: PaperSize) => void,
): void {
  container.innerHTML = '';
  for (const paper of ['a4', 'a3'] as const) {
    const label = document.createElement('label');
    label.className = 'paper-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'paper';
    radio.value = paper;
    radio.checked = paper === selected;
    radio.addEventListener('change', () => onChange(paper));

    const text = document.createElement('span');
    text.textContent = paper.toUpperCase();

    const count = document.createElement('span');
    count.className = 'paper-count';
    count.id = `paper-count-${paper}`;

    label.append(radio, text, count);
    container.append(label);
  }
}

export function readInputs<F extends string>(spec: FieldSpec<F>): Record<F, unknown> {
  const values = {} as Record<F, unknown>;
  for (const field of spec.order) {
    const input = document.getElementById(`field-${field}`) as HTMLInputElement | null;
    values[field] = input?.value ?? '';
  }
  return values;
}

/**
 * 치수 칸에 값을 그대로 써 넣는다. 프리셋은 숫자를 주지만 되살린 화면은
 * 사람이 치던 글자를 그대로 준다 — 숫자로 바꿔 버리면 지우다 만 빈칸이
 * 0이 되어 화면에 없던 값이 생긴다.
 */
export function writeInputValues<F extends string>(
  spec: FieldSpec<F>,
  values: Readonly<Record<F, string | number>>,
): void {
  for (const field of spec.order) {
    const input = document.getElementById(`field-${field}`) as HTMLInputElement | null;
    if (input) input.value = String(values[field]);
  }
}

export function setPaperCount(locale: Locale, paper: PaperSize, sheets: number | null): void {
  const el = document.getElementById(`paper-count-${paper}`);
  if (el) el.textContent = sheets === null ? '' : ` · ${t(locale, 'paper.sheets', sheets)}`;
}

/**
 * 출력 방식 체크박스 하나. 골선접기와 시접 추가가 같은 모양을 쓴다.
 * 둘 다 "도안을 어떻게 뽑을지" 정하는 것이라 나란히 놓인다.
 */
function renderCheckbox(
  container: HTMLElement,
  id: string,
  labelText: string,
  checked: boolean,
  onChange: (next: boolean) => void,
): void {
  container.innerHTML = '';

  const label = document.createElement('label');
  label.className = 'fold-option';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.id = id;
  box.checked = checked;
  box.addEventListener('change', () => onChange(box.checked));

  const text = document.createElement('span');
  text.textContent = labelText;

  label.append(box, text);
  container.append(label);
}

/**
 * 골선접기. 켜면 전개도의 위쪽 절반만 내보내 인쇄 장수가 대략 반으로 준다.
 * 원단을 접어 그 변에 대고 재단하면 펼쳤을 때 온전한 한 장이 된다. 원통에는 없다.
 */
export function renderFoldOption(
  container: HTMLElement,
  locale: Locale,
  checked: boolean,
  onChange: (next: boolean) => void,
): void {
  renderCheckbox(container, 'fold-half', t(locale, 'control.foldHalf'), checked, onChange);
}

/**
 * 시접 추가. 끄면 완성 치수 그대로 뜬다. 재단하면서 손으로 시접을 더하거나
 * 완성선을 따라 그릴 도안이 필요할 때 쓴다. 기본은 켜짐 — 무심코 시접 없는
 * 도안을 뽑아 원단을 버리는 일을 막는다.
 */
export function renderSeamOption(
  container: HTMLElement,
  locale: Locale,
  checked: boolean,
  onChange: (next: boolean) => void,
): void {
  renderCheckbox(container, 'seam-add', t(locale, 'control.addSeam'), checked, onChange);
}

/**
 * 고르기 하나. 원통의 뒷면 비율이 쓴다.
 *
 * 체크박스(.fold-option)와 같은 자리에 서므로 겉모양을 맞춘다. 고를 값·라벨은
 * 부르는 쪽이 로케일별로 준다 — 이 함수는 무슨 값인지 모르는 편이 낫다.
 */
export function renderChoice<T>(
  container: HTMLElement,
  id: string,
  labelText: string,
  choices: readonly { readonly value: T; readonly label: string }[],
  selected: T,
  onChange: (next: T) => void,
): void {
  container.innerHTML = '';

  const label = document.createElement('label');
  label.className = 'fold-option';

  const text = document.createElement('span');
  text.textContent = labelText;

  const select = document.createElement('select');
  select.id = id;
  select.className = 'choice-select';
  choices.forEach((choice, index) => {
    const option = document.createElement('option');
    // 값은 글자로만 오간다. 자리 번호를 담아 두면 어떤 타입이든 되돌릴 수 있다.
    option.value = String(index);
    option.textContent = choice.label;
    option.selected = choice.value === selected;
    select.append(option);
  });
  select.addEventListener('change', () => {
    const picked = choices[Number(select.value)];
    if (picked !== undefined) onChange(picked.value);
  });

  label.append(text, select);
  container.append(label);
}
