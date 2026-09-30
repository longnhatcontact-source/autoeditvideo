// Tên kênh / logo hiện trên mọi video (cài 1 lần trong Cài đặt)
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";

export const BRAND_DIR = path.join(ROOT, "assets", "brand");
const BRAND_FILE = path.join(ROOT, "brand.json");
const IMG_EXT = /\.(png|jpe?g|webp)$/i;
export const BRAND_POSITIONS = ["duoi-video", "tren-phai", "tren-trai"];

const DEFAULT = { enabled: false, text: "@nhatrealproperty", logo: "", position: "duoi-video" };

export function getBrand() {
  try {
    const b = { ...DEFAULT, ...JSON.parse(fs.readFileSync(BRAND_FILE, "utf-8")) };
    if (b.logo && !fs.existsSync(path.join(BRAND_DIR, b.logo))) b.logo = "";
    return b;
  } catch {
    return { ...DEFAULT };
  }
}

export function saveBrand(patch) {
  const cur = getBrand();
  const next = {
    enabled: patch.enabled != null ? Boolean(patch.enabled) : cur.enabled,
    text: typeof patch.text === "string" ? patch.text.slice(0, 40) : cur.text,
    logo: cur.logo,
    position: BRAND_POSITIONS.includes(patch.position) ? patch.position : cur.position,
  };
  fs.writeFileSync(BRAND_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function setBrandLogo(srcFile) {
  const cur = getBrand();
  fs.mkdirSync(BRAND_DIR, { recursive: true });
  if (cur.logo) fs.rmSync(path.join(BRAND_DIR, cur.logo), { force: true });
  let logo = "";
  if (srcFile) {
    if (!IMG_EXT.test(srcFile)) throw new Error("Logo phải là ảnh png/jpg/webp");
    if (!fs.existsSync(srcFile)) throw new Error("Không thấy file: " + srcFile);
    logo = `logo-${Date.now()}${path.extname(srcFile).toLowerCase()}`;
    fs.copyFileSync(srcFile, path.join(BRAND_DIR, logo));
  }
  fs.writeFileSync(BRAND_FILE, JSON.stringify({ ...cur, logo }, null, 2), "utf-8");
  return getBrand();
}
