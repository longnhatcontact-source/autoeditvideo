// Dùng chung cho server (Node), giao diện và composition Remotion — không import module Node
export const SWITCH_CAPTIONS_EVERY_MS = 1200;

const PUNCT = /^[\s.,!?;:"“”'…()-]+|[\s.,!?;:"“”'…()-]+$/g;
export const normWord = (s) => s.replace(PUNCT, "").toLowerCase();

// Whisper words -> Caption[] cho @remotion/captions
export function wordsToCaptions(words) {
  return words.map((w) => ({
    text: " " + w.word,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: w.prob ?? null,
  }));
}

// Chữ mới trong khoảng [startMs, endMs], chia đều thời gian
export function spreadWords(words, startMs, endMs) {
  const span = Math.max(1, endMs - startMs);
  return words.map((word, k) => {
    const s = Math.round(startMs + (span * k) / words.length);
    const e = Math.round(startMs + (span * (k + 1)) / words.length);
    return { text: " " + word, startMs: s, endMs: e, timestampMs: Math.round((s + e) / 2), confidence: 1 };
  });
}

export function parseFixRules(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("=>"))
    .map((l) => l.split("=>").map((s) => s.trim()))
    .filter(([from]) => from)
    .map(([from, to]) => ({ from: from.split(/\s+/).map(normWord), to: (to || "").split(/\s+/).filter(Boolean) }))
    .sort((a, b) => b.from.length - a.from.length);
}

// Thay cụm chữ sai (có thể nhiều chữ) bằng chữ đúng
export function applyFixes(captions, rules) {
  let out = captions;
  for (const rule of rules) {
    const n = rule.from.length;
    const next = [];
    for (let i = 0; i < out.length; ) {
      const match = i + n <= out.length && rule.from.every((f, k) => normWord(out[i + k].text) === f);
      if (!match) {
        next.push(out[i++]);
        continue;
      }
      const last = out[i + n - 1];
      const trail = last.text.trim().match(/[.,!?;:…]+$/)?.[0] ?? "";
      const words = [...rule.to];
      if (words.length) words[words.length - 1] += trail;
      next.push(...spreadWords(words, out[i].startMs, last.endMs));
      i += n;
    }
    out = next;
  }
  return out;
}

// Mỗi câu tối đa ~1 dòng để mọi câu cùng 1 cỡ chữ (không câu to câu nhỏ)
export const MAX_PAGE_CHARS = 16;
const GAP_MS = 600; // ngừng nói lâu hơn -> sang ý mới
const MAX_PHRASE_MS = 3000;

/** Cụm nhiều chữ không được tách (vd tên dự án) lấy từ danh sách từ khoá */
export function keepPhrases(vocab) {
  return (Array.isArray(vocab) ? vocab : (vocab || "").split(/\r?\n/))
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && /\s/.test(l))
    .map((l) => l.split(/\s+/).map(normWord));
}

// Chia 1 ý (danh sách chữ) thành các câu ≤ maxChars, dài đều nhau, không cắt giữa cụm giữ nguyên
function balancedChunks(words, glued, maxChars) {
  // gộp chữ dính nhau thành khối
  const blocks = [];
  words.forEach((w, k) => {
    if (k > 0 && glued[k]) blocks[blocks.length - 1].push(w);
    else blocks.push([w]);
  });
  const len = (bs) => bs.reduce((s, b) => s + b.reduce((t, w) => t + w.length, 0) + b.length, 0) - 1;
  const total = len(blocks);
  const n = Math.max(1, Math.ceil(total / maxChars));
  const target = total / n;
  const chunks = [];
  let cur = [];
  for (const b of blocks) {
    const next = [...cur, b];
    const remaining = n - chunks.length;
    const closer = remaining > 1 && Math.abs(len(cur) - target) < Math.abs(len(next) - target);
    if (cur.length && (len(next) > maxChars || closer)) {
      chunks.push(cur);
      cur = [b];
    } else cur = next;
  }
  if (cur.length) chunks.push(cur);
  return chunks.map((bs) => bs.flat().length);
}

/**
 * Chia chữ thành câu hiển thị (kiểu TikTokPage của @remotion/captions) + vị trí [from, to) trong captions.
 * B1: tách ý theo dấu . , ? ! , chỗ ngừng nói, hoặc ý quá dài. B2: chia mỗi ý thành câu ≤ MAX_PAGE_CHARS, dài đều.
 */
export function makePages(captions, keep = []) {
  const words = captions.map((c) => c.text.trim());
  // glued[i] = chữ i dính với chữ i-1 (cùng 1 cụm giữ nguyên)
  const glued = new Array(words.length).fill(false);
  for (const phrase of keep) {
    for (let i = 0; i + phrase.length <= words.length; i++) {
      if (phrase.every((p, k) => normWord(words[i + k]) === p)) for (let k = 1; k < phrase.length; k++) glued[i + k] = true;
    }
  }

  const phrases = [];
  let cur = null;
  captions.forEach((c, i) => {
    if (!words[i]) return;
    const prev = captions[i - 1];
    const split =
      !cur ||
      (!glued[i] &&
        (/[.,?!…;:]$/.test(prev?.text.trim() ?? "") ||
          c.startMs - (prev?.endMs ?? c.startMs) > GAP_MS ||
          c.startMs - captions[cur[0]].startMs > MAX_PHRASE_MS));
    if (split) phrases.push((cur = []));
    cur.push(i);
  });

  const pages = [];
  for (const idx of phrases) {
    const sizes = balancedChunks(idx.map((i) => words[i]), idx.map((i) => glued[i]), MAX_PAGE_CHARS);
    let k = 0;
    for (const size of sizes) {
      const part = idx.slice(k, k + size);
      k += size;
      const tokens = part.map((i, j) => ({ text: (j ? " " : "") + words[i], fromMs: captions[i].startMs, toMs: captions[i].endMs }));
      pages.push({
        text: tokens.map((t) => t.text).join(""),
        startMs: captions[part[0]].startMs,
        durationMs: captions[part[part.length - 1]].endMs - captions[part[0]].startMs,
        tokens,
        from: part[0],
        to: part[part.length - 1] + 1,
      });
    }
  }
  return pages;
}

// Đơn vị đi sau con số: "98 triệu", "3,5 tỷ", "68 m²", "34 tầng"...
const NUMBER_UNITS = new Set(["tỷ", "tỉ", "triệu", "tr", "nghìn", "ngàn", "k", "m2", "m²", "mét", "%", "năm", "tầng", "pn", "phòng", "căn", "usd", "đồng"]);

/** Chữ nào trong câu là số liệu (tô màu riêng): có chữ số, hoặc là đơn vị ngay sau chữ số */
export function numberFlags(texts) {
  return texts.map((t, i) => {
    const w = normWord(t);
    if (/\d/.test(w)) return true;
    return i > 0 && /\d/.test(normWord(texts[i - 1])) && NUMBER_UNITS.has(w.split("/")[0]);
  });
}

export const ZOOM_SCALE = 1.08;
const ZOOM_MIN_GAP_MS = 3000;

/**
 * Chỗ zoom nhẹ (punch-in): câu có số liệu, hoặc câu mở đầu ý mới (sau dấu . ? !).
 * Cách nhau ít nhất 3s cho đỡ chóng mặt. Trả về [{startMs, endMs}].
 */
export function zoomMoments(pages) {
  const out = [];
  let lastEnd = -Infinity;
  pages.forEach((p, i) => {
    const texts = p.tokens.map((t) => t.text);
    const hasNumber = numberFlags(texts).some(Boolean);
    const prevText = pages[i - 1]?.text.trim() ?? "";
    const sentenceStart = i > 0 && /[.?!…]$/.test(prevText);
    if (!(hasNumber || sentenceStart)) return;
    if (p.startMs - lastEnd < ZOOM_MIN_GAP_MS) return;
    const endMs = pageEndMs(pages, i);
    out.push({ startMs: p.startMs, endMs });
    lastEnd = endMs;
  });
  return out;
}

/** Thời điểm câu biến mất: khi câu sau bắt đầu, hoặc 0.6s sau chữ cuối */
export function pageEndMs(pages, i) {
  const p = pages[i];
  const lastEnd = p.tokens[p.tokens.length - 1]?.toMs ?? p.startMs + 1000;
  return Math.min(pages[i + 1]?.startMs ?? Infinity, lastEnd + 600);
}

/** Câu phụ đề + vị trí chữ [from, to) trong mảng captions */
export function toPages(captions, durationSec = Infinity, keep = []) {
  const pages = makePages(captions, keep);
  return pages.map((p, i) => ({
    from: p.from,
    to: p.to,
    start: p.startMs / 1000,
    end: Math.min(pageEndMs(pages, i), durationSec * 1000) / 1000,
    text: p.text,
  }));
}

/** Sửa chữ 1 câu: thay các chữ [from, to) bằng chữ mới, giữ nguyên khung thời gian câu */
export function replacePageText(captions, page, newText) {
  const words = newText.trim().split(/\s+/).filter(Boolean);
  const startMs = captions[page.from].startMs;
  const endMs = captions[page.to - 1].endMs;
  return [...captions.slice(0, page.from), ...spreadWords(words, startMs, endMs), ...captions.slice(page.to)];
}
