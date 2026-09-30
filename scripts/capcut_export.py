# -*- coding: utf-8 -*-
"""
Tạo draft CapCut chỉnh sửa được từ video đã chuẩn bị.
Dùng: python capcut_export.py <spec.json>
spec = {draftName, videoPath, pages:[{start,end,text}], info:{tenDuAn,gia,dienTich,phongNgu,diaChi},
        music:{path,volume}?, sfx:[{path,at,volume}]}
In JSON: {"ok":true, "draftName", "draftDir", "durationSec"}
"""
import copy
import os
import re
import sys
import json
import unicodedata

from pycapcut import (
    DraftFolder, TrackType, VideoSegment, VideoMaterial, TextSegment, AudioSegment, AudioMaterial,
    TextStyle, TextBorder, TextBackground, Timerange, ClipSettings,
    KeyframeProperty, SEC,
)
from pycapcut.metadata.effect_meta import EffectMeta

WHITE = (1.0, 1.0, 1.0)
BLACK = (0.0, 0.0, 0.0)
GOLD = (0.788, 0.635, 0.294)  # #C9A24B
GOLD_SOFT = (0.894, 0.808, 0.576)  # #E4CE93
W, H, FPS = 1080, 1920, 30


def us(sec):
    return int(round(sec * SEC))


def draft_root():
    """Thư mục draft CapCut đang dùng (CapCut cho đổi trong Cài đặt)."""
    cfg = os.path.expandvars(r"%LOCALAPPDATA%\CapCut\User Data\Config\globalSetting")
    try:
        with open(cfg, encoding="utf-8", errors="ignore") as f:
            m = re.search(r"^currentCustomDraftPath=(.+)$", f.read(), re.M)
        if m:
            p = m.group(1).strip().replace("\\\\", "\\")
            if os.path.isdir(p):
                return p
    except OSError:
        pass
    return os.path.expandvars(r"%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft")


def finalize_meta(root, name):
    d = os.path.join(root, name)
    meta_path = os.path.join(d, "draft_meta_info.json")
    if not os.path.isfile(meta_path):
        return
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    meta["draft_name"] = name
    meta["draft_fold_path"] = d.replace("\\", "/")
    meta["draft_root_path"] = root.replace("\\", "/")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=4)


class RichText(TextSegment):
    """Ô chữ nhiều kiểu: runs = [(chữ, cỡ, màu RGB 0..1)]. CapCut đếm range theo ký tự UTF-16."""

    def __init__(self, runs, timerange, **kw):
        runs = [(unicodedata.normalize("NFC", t), size, color) for t, size, color in runs if t]
        super().__init__("".join(t for t, _, _ in runs), timerange, **kw)
        self.runs = runs

    def export_material(self):
        ret = super().export_material()
        content = json.loads(ret["content"])
        base = content["styles"][0]
        styles, pos = [], 0
        for t, size, color in self.runs:
            n = len(t.encode("utf-16-le")) // 2
            s = copy.deepcopy(base)
            s["range"] = [pos, pos + n]
            s["size"] = size
            s["fill"]["content"]["solid"]["color"] = list(color)
            styles.append(s)
            pos += n
        content["styles"] = styles
        ret["content"] = json.dumps(content, ensure_ascii=False)
        return ret


# Khớp bản xuất MP4: in hoa, trắng, viền đen dày, chữ đang đọc màu xanh #39E508
SUB_SIZE = 12.5
NUMBER_COLOR = (1.0, 0.824, 0.247)  # #FFD23F — số liệu, giống bản MP4

# Font Montserrat ExtraBold của kho CapCut (giống bản MP4); FontType.Montserrat chỉ là bản thường
FONT_XB = EffectMeta("Montserrat-ExtraBold", False, "7202893635614937601", "7202893635614937601",
                     "d4863b8abfe5d0c90e9ac0128f2e5d65", [])


class _Font:
    value = FONT_XB


def sub_size(text):
    # thu nhỏ câu dài cho vừa 1 dòng (~90% bề ngang), giống fitText bên Remotion
    est = len(text) * 0.045 * SUB_SIZE / 12.2
    return round(SUB_SIZE * min(1.0, 0.9 / est), 2) if est > 0 else SUB_SIZE


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def add_subtitles(script, pages, total, font, sub_style=None):
    sub_style = sub_style or {}
    highlight = hex_rgb(sub_style.get("highlight", "#39E508"))
    # giống Page.tsx: màu đang đọc là vàng thì số liệu dùng cam
    number_color = (1.0, 0.624, 0.110) if sub_style.get("highlight", "").upper() == "#FFD23F" else NUMBER_COLOR
    style = TextStyle(size=SUB_SIZE, bold=True, color=WHITE, align=1, auto_wrapping=True, max_line_width=0.95)
    box = bool(sub_style.get("box"))
    border = None if box else TextBorder(color=BLACK, width=100.0)
    background = TextBackground(color="#000000", alpha=0.62, round_radius=0.4, height=0.2, width=0.1) if box else None
    # "thap" khớp bottom 350px, "cao" khớp bottom 560px bên Remotion
    clip = ClipSettings(transform_y=-0.34 if sub_style.get("position") == "cao" else -0.56)
    # 1 cỡ cho cả video theo câu dài nhất (giống bản xuất MP4), không câu to câu nhỏ
    longest = max((" ".join(w["text"] for w in p.get("words", [])) for p in pages), key=len, default="")
    size = sub_size(longest.upper())
    count = 0
    for p in pages:
        st = max(0.0, float(p["start"]))
        en = min(total, float(p["end"]))
        words = [w for w in p.get("words", []) if w["text"].strip()]
        if en - st < 0.05 or not words:
            continue
        upper = [w["text"].upper() for w in words]
        # mỗi chữ 1 đoạn: cả câu, riêng chữ đang đọc tô xanh
        for k, w in enumerate(words):
            a = st if k == 0 else max(st, float(w["start"]))
            b = en if k == len(words) - 1 else min(en, float(words[k + 1]["start"]))
            if b - a < 0.02:
                continue
            runs = []
            for j, t in enumerate(upper):
                color = highlight if j == k else number_color if words[j].get("num") else WHITE
                runs.append((("" if j == 0 else " ") + t, size, color))
            script.add_segment(RichText(runs, Timerange(us(a), us(b - a)), font=font, style=style,
                                        border=border, background=background, clip_settings=clip),
                               track_name="phu_de")
            count += 1
    return count


def add_overlays(script, overlays, total):
    """Ảnh/clip minh hoạ: vừa khung giữa 960x740 (khớp Overlays.tsx), bật vào + mờ ra."""
    tracks = []  # thời điểm kết thúc đoạn cuối trên mỗi track
    for o in sorted(overlays or [], key=lambda x: float(x["at"])):
        if not os.path.isfile(o["path"]):
            continue
        at = max(0.0, float(o["at"]))
        sec = min(float(o["sec"]), total - at)
        if sec < 0.3:
            continue
        w, h = float(o.get("w") or 1080), float(o.get("h") or 1080)
        # CapCut đặt media vừa khung (contain) rồi mới co theo scale
        dw, dh = (W, W * h / w) if w / h > W / H else (H * w / h, H)
        scale = min(960 / dw, 740 / dh)
        slot = next((k for k, end in enumerate(tracks) if end <= at), None)
        if slot is None:
            slot = len(tracks)
            tracks.append(0.0)
            script.add_track(TrackType.video, f"anh_chen_{slot + 1}")
        tracks[slot] = at + sec
        mat = VideoMaterial(o["path"])
        tr = Timerange(us(at), us(sec))
        kw = {"source_timerange": Timerange(0, us(sec)), "volume": 0.0} if o.get("kind") == "video" else {}
        seg = VideoSegment(mat, tr, clip_settings=ClipSettings(scale_x=scale, scale_y=scale, transform_y=0.031), **kw)
        K = KeyframeProperty
        seg.add_keyframe(K.alpha, "0s", 0.0)
        seg.add_keyframe(K.alpha, "0.2s", 1.0)
        seg.add_keyframe(K.uniform_scale, "0s", scale * 0.85)
        seg.add_keyframe(K.uniform_scale, "0.3s", scale)
        if sec > 0.6:
            seg.add_keyframe(K.alpha, f"{sec - 0.25:.2f}s", 1.0)
            seg.add_keyframe(K.alpha, f"{sec:.2f}s", 0.0)
        script.add_segment(seg, track_name=f"anh_chen_{slot + 1}")


# vị trí tên kênh, khớp Brand.tsx (toạ độ CapCut: giữa = 0, lên trên = dương)
BRAND_POS = {"duoi-video": (0.0, -0.385), "tren-phai": (0.55, 0.4), "tren-trai": (-0.55, 0.4)}


def add_brand(script, brand, total, font):
    if not brand:
        return
    bx, by = BRAND_POS.get(brand.get("position"), BRAND_POS["duoi-video"])
    tr = Timerange(0, us(total))
    logo = brand.get("logo") or ""
    if logo and os.path.isfile(logo):
        from PIL import Image
        with Image.open(logo) as im:
            w, h = im.size
        shown_h = min(H, W * h / w)  # CapCut đặt ảnh vừa khung rồi mới co
        scale = 56 / shown_h
        dx = -0.12 if brand.get("text") else 0.0
        script.add_track(TrackType.video, "logo")
        script.add_segment(VideoSegment(VideoMaterial(logo), tr, clip_settings=ClipSettings(
            scale_x=scale, scale_y=scale, transform_x=bx + dx, transform_y=by)), track_name="logo")
    if brand.get("text"):
        script.add_track(TrackType.text, "ten_kenh")
        script.add_segment(TextSegment(brand["text"], tr, font=font,
                                       style=TextStyle(size=6.5, bold=True, color=WHITE, align=1, alpha=0.9),
                                       background=TextBackground(color="#000000", alpha=0.35, round_radius=1.0,
                                                                 height=0.3, width=0.15),
                                       clip_settings=ClipSettings(transform_x=bx + (0.08 if logo else 0.0),
                                                                  transform_y=by)),
                           track_name="ten_kenh")


def slide_in(seg, dur):
    K = KeyframeProperty
    seg.add_keyframe(K.alpha, "0s", 0.0)
    seg.add_keyframe(K.alpha, "0.3s", 1.0)
    seg.add_keyframe(K.position_x, "0s", -0.6)
    seg.add_keyframe(K.position_x, "0.4s", 0.0)
    if dur > 1.0:
        seg.add_keyframe(K.alpha, f"{dur - 0.3:.2f}s", 1.0)
        seg.add_keyframe(K.alpha, f"{dur:.2f}s", 0.0)


def build(spec):
    root = spec.get("draftRoot") or draft_root()
    name = spec["draftName"]
    font = _Font

    folder = DraftFolder(root)
    script = folder.create_draft(name, W, H, fps=FPS, allow_replace=True)
    script.add_track(TrackType.video, "video")
    script.add_track(TrackType.text, "phu_de")
    script.add_track(TrackType.text, "ten_du_an")
    script.add_track(TrackType.text, "the_gia")
    script.add_track(TrackType.text, "tieu_de")
    script.add_track(TrackType.audio, "nhac_nen")

    mat = VideoMaterial(spec["videoPath"])
    total = mat.duration / SEC
    vseg = VideoSegment(mat, Timerange(0, mat.duration))
    # zoom nhẹ (punch-in) giống bản MP4: phóng vào 0.2s, giữ, thu về 0.3s
    zs = float(spec.get("zoomScale", 1.08))
    last = -1.0
    for z in spec.get("zooms", []):
        a, s, e, b = max(0.0, z["start"] - 0.2), z["start"], z["end"], min(total - 0.01, z["end"] + 0.3)
        if a <= last or not (a < s < e < b):
            continue
        for t, v in ((a, 1.0), (s, zs), (e, zs), (b, 1.0)):
            vseg.add_keyframe(KeyframeProperty.uniform_scale, f"{t:.3f}s", v)
        last = b
    script.add_segment(vseg, track_name="video")

    add_subtitles(script, spec.get("pages", []), total, font, spec.get("subStyle"))

    hook = spec.get("hook") or {}
    hook_sec = 0.0
    if hook.get("text", "").strip():
        hook_sec = min(float(hook.get("sec", 2.5)), total)
        # "*chữ*" = tô vàng, giống bản MP4
        runs = [(p.strip("*").upper(), 16.0, NUMBER_COLOR if p.startswith("*") and p.endswith("*") else WHITE)
                for p in re.split(r"(\*[^*]+\*)", hook["text"]) if p]
        seg = RichText(runs, Timerange(0, us(hook_sec)), font=font,
                       style=TextStyle(size=16.0, bold=True, color=WHITE, align=1, auto_wrapping=True,
                                       max_line_width=0.8, line_spacing=1),
                       border=TextBorder(color=BLACK, width=60.0),
                       background=TextBackground(color="#14080A", alpha=0.72, round_radius=0.4,
                                                 height=0.3, width=0.12))
        K = KeyframeProperty
        seg.add_keyframe(K.uniform_scale, "0s", 0.6)
        seg.add_keyframe(K.uniform_scale, "0.25s", 1.05)
        seg.add_keyframe(K.uniform_scale, "0.4s", 1.0)
        if hook_sec > 0.6:
            seg.add_keyframe(K.alpha, f"{hook_sec - 0.25:.2f}s", 1.0)
            seg.add_keyframe(K.alpha, f"{hook_sec:.2f}s", 0.0)
        script.add_segment(seg, track_name="tieu_de")

    add_overlays(script, spec.get("overlays"), total)
    add_brand(script, spec.get("brand"), total, font)

    info = spec.get("info", {}) or {}
    if info.get("tenDuAn"):
        script.add_segment(
            TextSegment(info["tenDuAn"], Timerange(0, us(total)), font=font,
                        style=TextStyle(size=10.0, bold=True, color=WHITE, align=1),
                        border=TextBorder(color=(0.165, 0.055, 0.075), width=30.0),
                        background=TextBackground(color="#2A0E13", alpha=0.85, round_radius=1.0,
                                                  height=0.5, width=0.2),
                        clip_settings=ClipSettings(transform_y=0.87)),
            track_name="ten_du_an")

    if info.get("gia"):
        runs = [("Giá chỉ từ\n", 8.0, GOLD_SOFT), (info["gia"], 20.0, GOLD)]
        extra = " · ".join(x for x in [info.get("dienTich"), info.get("phongNgu")] if x)
        if extra:
            runs.append(("\n" + extra, 10.0, WHITE))
        if info.get("diaChi"):
            runs.append(("\n" + info["diaChi"], 8.5, GOLD_SOFT))
        # giống bản MP4: vào lúc 0.5s sau tiêu đề mở đầu, ở ~5.5s
        card_in = 0.5 + hook_sec
        dur = min(5.9, total - card_in)
        seg = RichText(runs, Timerange(us(card_in), us(dur)), font=font,
                       style=TextStyle(size=10.0, bold=True, color=GOLD, align=0, line_spacing=1),
                       background=TextBackground(color="#5E1420", alpha=0.92, round_radius=0.3,
                                                 height=0.25, width=0.25),
                       clip_settings=ClipSettings(transform_x=-0.3, transform_y=0.6))
        slide_in(seg, dur)
        script.add_segment(seg, track_name="the_gia")

    music = spec.get("music") or {}
    if music.get("path") and os.path.isfile(music["path"]):
        mmat = AudioMaterial(music["path"])
        t, i = 0, 0
        # lặp nhạc cho đủ dài video
        while t < mat.duration and i < 50:
            length = min(mmat.duration, mat.duration - t)
            script.add_segment(AudioSegment(mmat, Timerange(t, length), source_timerange=Timerange(0, length),
                                            volume=float(music.get("volume", 0.25))), track_name="nhac_nen")
            t += length
            i += 1

    # 1 track CapCut không cho 2 đoạn chồng nhau -> SFX chồng thì sang track sfx_2, sfx_3...
    sfx_tracks = []  # thời điểm kết thúc của đoạn cuối trên mỗi track
    for s in sorted(spec.get("sfx", []), key=lambda x: float(x["at"])):
        if not os.path.isfile(s["path"]):
            continue
        smat = AudioMaterial(s["path"])
        at = us(max(0.0, float(s["at"])))
        if at >= mat.duration:
            continue
        length = min(smat.duration, mat.duration - at)
        slot = next((k for k, end in enumerate(sfx_tracks) if end <= at), None)
        if slot is None:
            slot = len(sfx_tracks)
            sfx_tracks.append(0)
            script.add_track(TrackType.audio, f"sfx_{slot + 1}")
        sfx_tracks[slot] = at + length
        script.add_segment(AudioSegment(smat, Timerange(at, length), source_timerange=Timerange(0, length),
                                        volume=float(s.get("volume", 0.6))), track_name=f"sfx_{slot + 1}")

    script.save()
    finalize_meta(root, name)
    return {"ok": True, "draftName": name,
            "draftDir": os.path.join(root, name).replace("\\", "/"),
            "durationSec": round(total, 2)}


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        spec = json.load(f)
    try:
        print(json.dumps(build(spec), ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({"ok": False, "error": str(e),
                          "trace": traceback.format_exc()[-800:]}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
