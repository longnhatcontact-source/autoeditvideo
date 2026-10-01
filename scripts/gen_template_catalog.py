"""Sinh lib/template-catalog.mjs từ src/CaptionedVideo/TitleTemplates.tsx (chạy lại mỗi khi thêm/sửa mẫu chữ):
    python scripts/gen_template_catalog.py
"""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "src/CaptionedVideo/TitleTemplates.tsx").read_text(encoding="utf-8")
info = src[src.index("export const TEMPLATE_INFO"):]
base = re.findall(r'^  (\w+): \{ label: "([^"]+)", use: "([^"]+)" \},', info, re.M)
blk = src[src.index("export const PRESETS = {"):src.index("} satisfies Record")]
pres = re.findall(r'^  (\w+): P\(\{ label: "([^"]+)", use: "([^"]+)"(.*)\}\),$', blk, re.M)
items = [dict(id=i, label=l, use=u, group="Gốc", layout="center") for i, l, u in base]
group = "Sang trọng"
for line in blk.splitlines():
    g = re.match(r"\s*// --- (.+?) ---", line)
    if g:
        group = g.group(1).strip().capitalize()
    m = re.match(r'^  (\w+): P\(\{ label: "([^"]+)", use: "([^"]+)"(.*)\}\),$', line)
    if m:
        lay = re.search(r'layout: "(\w+)"', m.group(4))
        items.append(dict(id=m.group(1), label=m.group(2), use=m.group(3), group=group, layout=lay.group(1) if lay else "center"))
lay = src[src.index("export const LAYOUT_INFO"):]
layouts = re.findall(r'^  (\w+): "([^"]+)",', lay[: lay.index("};")], re.M)
out = (
    "// TỰ SINH bởi scripts/gen_template_catalog.py từ src/CaptionedVideo/TitleTemplates.tsx — đừng sửa tay\n"
    f"export const TEMPLATE_CATALOG = {json.dumps(items, ensure_ascii=False, indent=1)};\n"
    "export const TEMPLATE_IDS = TEMPLATE_CATALOG.map((t) => t.id);\n"
    f"export const LAYOUT_CATALOG = {json.dumps([dict(id=a, label=b) for a, b in layouts], ensure_ascii=False, indent=1)};\n"
    "export const LAYOUT_IDS = LAYOUT_CATALOG.map((l) => l.id);\n"
)
(root / "lib/template-catalog.mjs").write_text(out, encoding="utf-8")
print(len(items), "mẫu,", len(layouts), "bố cục")
