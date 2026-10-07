#!/usr/bin/env python3
"""Chèn cảnh bổ trợ (B-roll) phủ lên video người nói, giữ nguyên tiếng.
Dùng: broll.py <video-nen.mp4> <plan.json> <ra.mp4>
plan.json: [{"start":7.15,"end":10.7,"clip":"broll/toa2.mp4","in":"slide"|"fade"}, ...] (giây trên video nền, xếp tăng dần)
- Chuyển cảnh: mờ chồng 0.3s ("fade") hoặc trượt từ dưới lên ("slide"); 2 cảnh liền nhau thì cảnh sau mờ chồng lên cảnh trước.
- Clip ngang: cắt dọc 9:16 và lia ngang chậm. Không chớp, không zoom giật.
"""
import json, subprocess, sys
base, plan, out = sys.argv[1:4]
S = json.load(open(plan)); D = 0.3
def landscape(p):
    w, h = map(int, subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0",p],capture_output=True,text=True).stdout.strip().split(",")[:2])
    return w > h
ins = ["-i", base]; f = []; last = "0:v"
for i, s in enumerate(S):
    a, b = s["start"], s["end"]
    nxt = i + 1 < len(S) and abs(S[i+1]["start"] - b) < 0.01
    dur = b - a + (D if nxt else 0)
    ins += ["-ss", "0.4", "-t", f"{dur+0.2:.2f}", "-i", s["clip"]]
    sc = (f"scale=-2:1920,crop=1080:1920:'(iw-1080)*(0.25+0.5*t/{dur:.2f})':0" if landscape(s["clip"])
          else "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920")
    fi = f",fade=t=in:st=0:d={D}:alpha=1" if s.get("in", "fade") == "fade" else ""
    fo = "" if nxt else f",fade=t=out:st={dur-D:.2f}:d={D}:alpha=1"
    f.append(f"[{i+1}:v]fps=30,{sc},format=yuva420p,trim=0:{dur:.2f}{fi}{fo},setpts=PTS-STARTPTS+{a}/TB[b{i}]")
    y = f"'if(lt(t-{a},0.35),H*pow(1-(t-{a})/0.35,3),0)'" if s.get("in") == "slide" else "0"
    f.append(f"[{last}][b{i}]overlay=0:{y}:eof_action=pass:enable='between(t,{a},{a+dur:.2f})'[o{i}]"); last = f"o{i}"
subprocess.run(["ffmpeg","-y","-v","error",*ins,"-filter_complex",";".join(f),"-map",f"[{last}]","-map","0:a?","-r","30",
                "-c:v","libx264","-preset","fast","-crf","16","-pix_fmt","yuv420p","-c:a","copy",out], check=True)
