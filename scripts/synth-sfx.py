"""Tổng hợp bộ SFX cho chữ nổi bật (gõ phím, click, vút, pop, ting, dập dấu, neon, riser). Tự viết bằng numpy -> không vướng bản quyền."""
# Chạy: python3 scripts/synth-sfx.py -> ghi WAV vào ./out, rồi đổi sang MP3 (ffmpeg -b:a 192k) và chép vào assets/sfx/ với cùng tên.
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 48000
rng = np.random.default_rng(7)
t_ = lambda d: np.arange(int(SR * d)) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "highpass", fs=SR, output="sos"), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, "lowpass", fs=SR, output="sos"), x)
def env(n, a, d):  # attack / exp decay (giây)
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def pad(x, d): y = np.zeros(int(SR * d)); y[:min(len(x), len(y))] += x[:len(y)]; return y
def norm(x, db=-3):
    x = x - x.mean(); return x / (np.abs(x).max() + 1e-9) * 10 ** (db / 20)
def save(name, x, db=-3):
    x = norm(x, db); fade = int(SR * 0.004); x[-fade:] *= np.linspace(1, 0, fade)
    wavfile.write(f"out/{name}.wav", SR, (np.stack([x, x], 1) * 32767).astype(np.int16)); print(name, round(len(x) / SR, 2))

def key(seed):
    r = np.random.default_rng(seed); n = int(SR * .09)
    tr = bp(r.standard_normal(n), 1800 + r.uniform(-300, 600), 7000, 2) * env(n, .0004, .006)       # tiếng "tách" của nắp phím
    th = np.sin(2 * np.pi * r.uniform(170, 240) * t_(.09)) * env(n, .001, .018) * .7                 # tiếng "thock" thân phím
    body = bp(r.standard_normal(n), 400, 1400) * env(n, .0008, .012) * .5
    rel = np.zeros(n); k = int(SR * r.uniform(.035, .05)); m = n - k                                 # nhả phím
    rel[k:] = bp(r.standard_normal(m), 2500, 8000) * env(m, .0003, .004) * .35
    return (tr + th + body + rel) * r.uniform(.75, 1)

def typing(nkeys, gap=1 / 15):
    d = nkeys * gap + .15; x = np.zeros(int(SR * d)); t = 0.0
    for i in range(nkeys):
        k = key(100 + i); s = int(SR * t); x[s:s + len(k)] += k[:len(x) - s]
        t += gap * rng.uniform(.8, 1.2)
    return x

def mouse():
    n = int(SR * .12); x = np.zeros(n)
    for at, f, a in [(0, 3200, 1), (.055, 4200, .55)]:
        m = int(SR * .02); s = int(SR * at)
        x[s:s + m] += (bp(rng.standard_normal(m), f * .6, f * 1.8) * env(m, .0002, .0025) + np.sin(2 * np.pi * 900 * t_(.02)) * env(m, .0003, .003) * .4) * a
    return x

def whoosh(d, f0, f1, f2, peak=.45, bright=1.0):
    n = int(SR * d); t = np.arange(n) / SR; p = t / d
    noise = rng.standard_normal(n); out = np.zeros(n); blk = 256
    fc = np.where(p < peak, f0 + (f1 - f0) * (p / peak) ** 1.4, f1 + (f2 - f1) * ((p - peak) / (1 - peak)))
    zi = None
    for i in range(0, n, blk):   # lọc thông dải trượt tần số theo từng khối
        f = fc[min(i + blk // 2, n - 1)]; seg = noise[i:i + blk]
        out[i:i + blk] = bp(np.concatenate([noise[max(0, i - 2048):i], seg]), f * .55, min(f * 1.8 * bright, 20000))[-len(seg):]
    e = np.where(p < peak, (p / peak) ** 2.2, np.exp(-(p - peak) / (1 - peak) * 4))
    return out * e

def pop():
    d = .12; t = t_(d); f = 380 + 700 * (1 - np.exp(-t / .012))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(len(t), .001, .03) + hp(rng.standard_normal(len(t)), 3000) * env(len(t), .0002, .002) * .25

def ting(f=2093, d=1.1):
    t = t_(d); x = np.zeros_like(t)
    for mult, a, dec in [(1, 1, .45), (2.76, .35, .18), (5.4, .18, .08), (8.9, .08, .04)]:
        x += a * np.sin(2 * np.pi * f * mult * t) * np.exp(-t / dec)
    return x * np.minimum(1, t / .002)

def stamp():
    d = .5; t = t_(d); n = len(t)
    thud = np.sin(2 * np.pi * (48 + 60 * np.exp(-t / .03)) * t) * env(n, .001, .12)
    crack = bp(rng.standard_normal(n), 800, 6000) * env(n, .0003, .015) * .8
    paper = bp(rng.standard_normal(n), 2000, 9000) * env(n, .002, .05) * .2
    return thud + crack + paper

def neon():
    d = .55; t = t_(d); n = len(t)
    buzz = np.sign(np.sin(2 * np.pi * 100 * t)) * .5 + np.sin(2 * np.pi * 200 * t) * .3
    buzz = bp(buzz + rng.standard_normal(n) * .15, 90, 3000)
    gate = np.zeros(n)
    for a, b in [(0, .03), (.07, .09), (.14, .2), (.25, .27), (.3, .55)]:
        gate[int(a * SR):int(b * SR)] = 1
    gate = lp(gate, 400); clicks = np.zeros(n)
    for a in [0, .07, .14, .25, .3]:
        s = int(a * SR); m = int(SR * .01); clicks[s:s + m] += bp(rng.standard_normal(m), 2000, 9000) * env(m, .0002, .002)
    return buzz * gate * np.exp(-np.maximum(0, t - .3) / .12) * .6 + clicks

def riser(d=.7):
    n = int(SR * d); t = np.arange(n) / SR; p = t / d
    tone = np.sin(2 * np.pi * np.cumsum(300 + 1500 * p ** 2) / SR) * .25
    return (whoosh(d, 300, 5000, 6000, peak=.97) + tone) * (p ** 1.5)

def shimmer():
    d = 1.0; t = t_(d); x = np.zeros_like(t)
    for i, f in enumerate([2637, 3136, 3951, 4699, 5274, 6272]):
        s = i * .045; m = t >= s; tt = t[m] - s
        x[m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / .35) * (1 - i * .08)
    return x + whoosh(d, 3000, 9000, 6000, peak=.25) * .15

import os; os.makedirs("out", exist_ok=True)
for k in [6, 10, 14, 20, 28]: save(f"cn-typing-{k:02d}", typing(k), -4)
save("cn-key", pad(key(5), .1), -4)
save("cn-click", mouse(), -3)
save("cn-whoosh-soft", whoosh(.55, 250, 2400, 700), -3)
save("cn-whoosh-fast", whoosh(.28, 500, 4500, 1500, peak=.55), -3)
save("cn-pop", pop(), -4)
save("cn-ting", ting(), -8)
save("cn-stamp", stamp(), -2)
save("cn-neon", neon(), -5)
save("cn-riser", riser(), -4)
save("cn-shimmer", shimmer(), -8)
