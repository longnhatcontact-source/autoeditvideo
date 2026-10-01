"""Bộ 2: tổng hợp thêm SFX theo danh mục sounds.json (những âm tổng hợp được bằng code)."""
import numpy as np, os
exec(open(os.path.join(os.path.dirname(__file__), "synth-sfx.py")).read().split("import os; os.makedirs")[0])  # dùng lại hàm của bộ 1
os.makedirs("out", exist_ok=True)
def save2(name, x, db=-3):
    x = norm(x, db); fade = int(SR * 0.004); x[-fade:] *= np.linspace(1, 0, fade)
    wavfile.write(f"out/{name}.wav", SR, (np.stack([x, x], 1) * 32767).astype(np.int16)); print(name, round(len(x) / SR, 2))
def tone(f, d, dec=None, partials=((1, 1),)):
    t = t_(d); x = sum(a * np.sin(2 * np.pi * f * m * t) for m, a in partials)
    return x * (np.exp(-t / dec) if dec else 1) * np.minimum(1, t / .003)
def seq(parts, d):  # [(at, signal)]
    x = np.zeros(int(SR * d))
    for at, s in parts:
        i = int(SR * at); x[i:i + len(s)] += s[:len(x) - i]
    return x
BELL = ((1, 1), (2.0, .5), (3.0, .25), (4.2, .12))

# --- chuyển cảnh ---
def glitch():
    d = .45; x = np.zeros(int(SR * d)); i = 0
    while i < len(x):
        n = int(SR * rng.uniform(.01, .045)); k = rng.integers(3)
        seg = (np.sign(np.sin(2 * np.pi * rng.uniform(80, 1800) * t_(n / SR))) * .6 if k == 0 else
               bp(rng.standard_normal(n), 1500, 9000) if k == 1 else np.zeros(n))
        m = min(len(seg), len(x) - i); x[i:i + m] = seg[:m]; i += n
    return x
def rewind():
    d = .9; t = t_(d); f = 300 + 2600 * (t / d) ** 1.3
    chirps = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + .5 * np.sign(np.sin(2 * np.pi * (14 + 30 * t / d) * t)))
    return bp(chirps + rng.standard_normal(len(t)) * .25, 300, 6000) * np.minimum(1, t / .05) * np.exp(-np.maximum(0, t - .75) / .05)
def page_flip():
    d = .4; t = t_(d); n = len(t)
    swish = whoosh(.3, 800, 5000, 2500, peak=.6)
    flap = bp(rng.standard_normal(n), 400, 3000) * env(n, .001, .03)
    return seq([(0, swish * .7), (.27, flap)], d)
def zoom_whoosh():
    return whoosh(.6, 200, 6000, 400, peak=.75) + whoosh(.6, 150, 1200, 200, peak=.75) * .6

# --- chữ & số liệu ---
def ding(): return tone(2637, 1.0, .35, BELL)
def coin():
    return seq([(0, tone(3951, .5, .12, ((1, 1), (2.7, .4)))), (.07, tone(5274, .6, .2, ((1, 1), (2.3, .3))))], .8)
def counter():
    clicks = [bp(rng.standard_normal(int(SR * .012)), 2500, 9000) * env(int(SR * .012), .0002, .002) for _ in range(20)]
    return seq([(i * .06, c) for i, c in enumerate(clicks)], 1.3)
def notification():
    return seq([(0, tone(1568, .4, .12, BELL)), (.11, tone(2093, .6, .2, BELL))], .8)

# --- hook / hồi hộp ---
def boom():
    d = 1.4; t = t_(d); n = len(t)
    return np.sin(2 * np.pi * (40 + 70 * np.exp(-t / .05)) * t) * env(n, .002, .45) + bp(rng.standard_normal(n), 60, 900) * env(n, .001, .12) * .5
def heartbeat():
    def beat(): d = .18; t = t_(d); return np.sin(2 * np.pi * (55 + 30 * np.exp(-t / .02)) * t) * env(len(t), .003, .05)
    return seq([(0, beat()), (.22, beat() * .7), (.85, beat()), (1.07, beat() * .7)], 1.6)
def alert():
    t = t_(1.0); f = np.where((t * 4).astype(int) % 2 == 0, 880, 660)
    return np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .5 * np.exp(-np.maximum(0, t - .8) / .06)
def scratch():
    d = .5; t = t_(d); spd = np.sin(np.pi * t / d * 2.2) ** 2 * np.sign(np.sin(np.pi * t / d * 2.2))
    src = np.cumsum(rng.standard_normal(len(t)))  # tiếng nhạc giả
    idx = np.clip((np.cumsum(spd) * 1.5 + len(t) / 2).astype(int), 0, len(t) - 1)
    return bp(src[idx] - np.convolve(src[idx], np.ones(50) / 50, "same"), 300, 5000) * np.minimum(1, t / .01)
def drone():
    d = 3.0; t = t_(d)
    x = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * a for f, a in [(55, 1), (55.6, .8), (82.4, .5), (110.7, .3)])
    x += lp(rng.standard_normal(len(t)), 300) * .3
    return x * np.minimum(1, t / 1.0) * np.minimum(1, (d - t) / .5)

# --- tiết lộ ---
def magic(): return seq([(0, riser(.6) * .6), (.55, shimmer() * 1.2)], 1.6)
def success():
    return seq([(0, tone(1047, .5, .15, BELL)), (.1, tone(1319, .5, .15, BELL)), (.2, tone(1568, .9, .35, BELL))], 1.2)

# --- CTA ---
def bell(): return tone(1760, 1.6, .6, ((1, 1), (2.76, .5), (5.4, .25), (8.9, .1)))
def phone():
    t = t_(.4); b = (np.sin(2 * np.pi * 1300 * t) + np.sin(2 * np.pi * 1700 * t)) * (np.sin(2 * np.pi * 20 * t) > 0)
    return seq([(0, b), (.55, b)], 1.0) * .6
def msg_pop(): return seq([(0, pop()), (.06, tone(1760, .3, .08, BELL) * .6)], .5)
def coin_drop():
    hits = [tone(rng.uniform(3500, 5500), .25, .05, ((1, 1), (2.4, .4))) * a for a in [1, .7, .5, .35, .25, .15]]
    times = np.cumsum([0, .18, .13, .09, .065, .045])
    return seq(list(zip(times, hits)), 1.0)
def jingle():
    notes = [(0, 784), (.12, 988), (.24, 1175), (.36, 1568)]
    return seq([(a, tone(f, .9, .3, BELL)) for a, f in notes] + [(.36, tone(784, 1.2, .5, BELL) * .5)], 1.6)
def whoosh_ding(): return seq([(0, whoosh(.35, 400, 4000, 1200, peak=.6)), (.3, ding() * .6)], 1.3)
def elevator(): return seq([(0, tone(1319, 1.2, .5, ((1, 1), (2, .3)))), (.0, tone(1047, 1.2, .5) * 0)], 1.2)

# --- hài ---
def boing():
    d = .6; t = t_(d); f = 220 + 160 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / .25) + 120 * t
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, .25)
def womp():
    def note(f0, f1, d):
        t = t_(d); f = np.linspace(f0, f1, len(t)) * (1 + .02 * np.sin(2 * np.pi * 6 * t))
        saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
        return lp(saw, 1400) * np.minimum(1, t / .03) * np.minimum(1, (d - t) / .08)
    return seq([(0, note(233, 228, .38)), (.42, note(220, 215, .38)), (.84, note(208, 203, .38)), (1.26, note(196, 175, 1.1))], 2.5)

for name, fn, db in [("fx-glitch", glitch, -6), ("fx-rewind", rewind, -6), ("fx-page-flip", page_flip, -4), ("fx-zoom-whoosh", zoom_whoosh, -3),
                     ("fx-ding", ding, -8), ("fx-coin", coin, -8), ("fx-counter-tick", counter, -5), ("fx-notification", notification, -8),
                     ("fx-boom", boom, -2), ("fx-heartbeat", heartbeat, -3), ("fx-alert", alert, -12), ("fx-record-scratch", scratch, -4),
                     ("fx-suspense-drone", drone, -6), ("fx-magic-reveal", magic, -6), ("fx-success", success, -8),
                     ("fx-bell", bell, -8), ("fx-phone-ring", phone, -10), ("fx-message-pop", msg_pop, -6), ("fx-coin-drop", coin_drop, -8),
                     ("fx-outro-jingle", jingle, -8), ("fx-whoosh-ding", whoosh_ding, -4), ("fx-elevator-ding", elevator, -9),
                     ("fx-boing", boing, -5), ("fx-womp-womp", womp, -8)]:
    save2(name, fn(), db)
