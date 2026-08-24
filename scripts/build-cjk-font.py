#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (C) 2026 choisuing
"""
PDF에 중국어·일본어를 찍기 위한 서브셋 폰트를 만든다.

Noto Sans SC/TC/JP에서 이 앱이 실제로 쓰는 글자만 추려낸 서브셋을 만들어
src/core/cjk-fonts.ts에 base64로 박는다. 외부에서 받아오지 않으므로 앱은
네트워크 요청을 하지 않는다.

    python3 scripts/build-cjk-font.py

PDF에 쓰는 문구를 바꾸면 이 스크립트를 다시 돌려야 한다. 새 글자가 서브셋에
없으면 그 자리가 빈칸으로 인쇄된다. tests/cjk-font.test.ts가 그런 경우를
먼저 잡는다. 각 로케일 문구는 src/core/i18n/{zh-TW,zh-CN,ja}.ts의 pdf.* 와
같아야 한다.

필요:
    python3 -m pip install -r scripts/requirements.txt
"""

import base64
import pathlib
import subprocess
import sys
import tempfile

try:
    from fontTools.subset import Options, Subsetter
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
except ModuleNotFoundError as exc:  # pragma: no cover
    sys.stderr.write(
        "fontTools가 없습니다. 먼저 설치하세요:\n"
        "    python3 -m pip install -r scripts/requirements.txt\n"
    )
    raise SystemExit(1) from exc

# Noto Sans SC/TC/JP, SIL Open Font License 1.1
# 원본을 커밋으로 고정해 바이트 재현을 지킨다. 브랜치를 따라가면 구글이 폰트를
# 갱신한 날 서브셋이 소리 없이 달라진다. build-korean-font.py와 같은 커밋이다.
GOOGLE_FONTS_COMMIT = "ec626514f79f831f1ab848a82114a0ce7e2d6372"
RAW = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}/ofl"
FONT_URLS = {
    "ZH_TW": f"{RAW}/notosanstc/NotoSansTC%5Bwght%5D.ttf",
    "ZH_CN": f"{RAW}/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    "JA": f"{RAW}/notosansjp/NotoSansJP%5Bwght%5D.ttf",
}

# PDF에 등장하는 그 로케일의 문구. src/core/i18n/zh-TW.ts 등의 pdf.* 와 같아야 한다.
# 서브셋 폰트 하나만(굵기 없이) 쓰므로 도안 하단 강조 문구까지 이 목록에 담는다.
LOCALE_TEXT = {
    "ZH_TW": "方形拉鍊筆袋無縫份縫製愉快！對摺線3公分確認！1inch 確認！請以實際尺寸(100%)列印！圓筒拉鍊袋前面上段前面下段蓋·底後面張",
    "ZH_CN": "方形拉链笔袋无缝份缝制愉快！对折线3厘米确认！1inch 确认！请以实际尺寸(100%)打印！圆筒拉链袋前面上段前面下段盖·底后面张",
    "JA": "スクエアファスナーポーチ縫い代なし楽しく縫いましょう！折り線3cmを確認！1inch 確認！実際のサイズ(100%)で印刷してください！円筒ファスナーポーチ前面上段前面下段蓋・底後面枚",
}

# 숫자·도안 칸 번호(A, B, C…)·계정(@silsuni_lab)·치수 표기(*), 공백·문장부호.
# korean-font.ts의 본문용과 같은 폭이다.
ASCII_SAFE = " !*@_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

CHARS = {name: "".join(dict.fromkeys(ASCII_SAFE + text)) for name, text in LOCALE_TEXT.items()}

# 예약 글꼴 이름('Noto'·'Source')을 서브셋(수정 폰트)에 남기지 않도록 이름을
# 다듬는다. 원 저작권과 라이선스는 name 테이블의 0·13·14에 그대로 남긴다.
STYLE_NAME = {"ZH_TW": "Traditional Chinese Subset", "ZH_CN": "Simplified Chinese Subset", "JA": "Japanese Subset"}
PS = {"ZH_TW": "TraditionalChineseSubset", "ZH_CN": "SimplifiedChineseSubset", "JA": "JapaneseSubset"}

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src" / "core" / "cjk-fonts.ts"

HEADER = """/*
 * PDF에 중국어·일본어를 찍기 위한 폰트. Noto Sans TC/SC/JP에서 이 앱이
 * 실제로 쓰는 글자만 추려낸 서브셋이다. zh-TW/zh-CN/ja 각 한 벌이다.
 *
 * 이 파일은 scripts/build-cjk-font.py가 만든다. 직접 고치지 말 것.
 * PDF 문구를 바꿨다면 그 스크립트를 다시 돌린다.
 *
 * 아래 base64는 글꼴 데이터이며 이 저장소의 MIT 라이선스가 아니라
 * SIL Open Font License 1.1을 따른다. 원 저작권 문구는 글꼴 바이너리
 * 안에 그대로 보존되어 있다.
 *
 * 전문은 THIRD-PARTY-NOTICES.md 참고.
 */
/* SPDX-License-Identifier: OFL-1.1 */
"""


def build_subset(source: pathlib.Path, chars: str, ps_name: str, style_name: str, tmp: str) -> bytes:
    font = TTFont(source)
    # 가변 폰트라 그대로 두면 기본값(Thin)으로 그려진다. 본문 굵기로 고정한다.
    instancer.instantiateVariableFont(font, {"wght": 400}, inplace=True)

    options = Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # 저작권·라이선스 유지
    options.layout_closure = False
    subsetter = Subsetter(options=options)
    subsetter.populate(text=chars)
    subsetter.subset(font)

    # GPOS/GSUB를 남기면 fontkit이 위치 조정을 적용해 자간이 벌어진다.
    for table in ("GPOS", "GSUB", "GDEF"):
        if table in font:
            del font[table]

    for record in font["name"].names:
        if record.nameID == 1:
            record.string = style_name
        elif record.nameID == 2:
            record.string = "Regular"
        elif record.nameID == 4:
            record.string = f"{style_name} Regular"
        elif record.nameID == 6:
            record.string = f"{ps_name}-Regular"

    target = pathlib.Path(tmp) / f"{ps_name}.ttf"
    font.save(target)
    data = target.read_bytes()

    cmap = TTFont(target).getBestCmap()
    missing = sorted({c for c in chars if c != " " and ord(c) not in cmap})
    if missing:
        raise SystemExit(f"{ps_name}에 글자가 빠졌다: {missing}")
    return data


def to_export(name: str, data: bytes) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    chunks = [encoded[i:i + 100] for i in range(0, len(encoded), 100)]
    body = "\n".join(f"  '{chunk}' +" for chunk in chunks[:-1])
    body += f"\n  '{chunks[-1]}';\n"
    return f"export const {name} =\n{body}"


def to_chars(name: str, chars: str) -> str:
    return f"\nexport const {name}: ReadonlySet<string> = new Set(\n  {chars!r},\n);\n"


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for key, url in FONT_URLS.items():
            source = pathlib.Path(tmp) / f"{key}.ttf"
            print(f"내려받는 중: {url}")
            subprocess.run(["curl", "-sL", "-o", str(source), url], check=True)
            data = build_subset(source, CHARS[key], PS[key], STYLE_NAME[key], tmp)
            parts.append(to_export(f"{key}_FONT_BASE64", data))
            parts.append(to_chars(f"{key}_FONT_CHARS", CHARS[key]))
            print(f"  {key}: 글리프 {len(set(CHARS[key]))}자 · {len(data):,}바이트")

    OUTPUT.write_text(HEADER + "\n" + "\n".join(parts))
    print(f"기록: {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
