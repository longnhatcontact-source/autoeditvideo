// Chế độ web (BDS_WEB=1): nhiều người dùng qua Cloudflare Tunnel + Cloudflare Access.
// - Người dùng = email Cloudflare Access gắn vào header (server chỉ nghe 127.0.0.1 nên header không giả được từ ngoài).
// - Dự án của mỗi người có tiền tố riêng trong tên thư mục; chỉ thấy / sửa được dự án của mình.
// - Không nhận đường dẫn file trên máy chủ từ trình duyệt: mọi file phải tải lên qua /api/upload.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";

export const WEB_MODE = process.env.BDS_WEB === "1";
export const UPLOAD_DIR = path.join(ROOT, "uploads");
const ADMINS = (process.env.BDS_ADMINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
// chỉ để thử trên máy: giả lập 1 người dùng khi không có Cloudflare
const DEV_USER = (process.env.BDS_DEV_USER || "").trim().toLowerCase();

const SEP = "--";

export function emailOf(req) {
  if (!WEB_MODE) return "local";
  const h = String(req.headers["cf-access-authenticated-user-email"] || "").trim().toLowerCase();
  if (h) return h;
  if (DEV_USER) return String(req.headers["x-dev-user"] || DEV_USER).trim().toLowerCase();
  return "";
}

/** tiền tố thư mục dự án của 1 người: u-<phần trước @>-<4 ký tự băm> */
export function prefixOf(email) {
  if (!WEB_MODE) return "";
  const local = email.split("@")[0].normalize("NFD").replace(/[^\w]/g, "").slice(0, 16) || "user";
  const h = crypto.createHash("sha1").update(email).digest("hex").slice(0, 4);
  return `u-${local}-${h}${SEP}`;
}

export const isAdmin = (email) => !WEB_MODE || ADMINS.includes(email);

/** Tên hiển thị: bỏ tiền tố người dùng */
export const displayName = (name) => String(name).replace(/^u-[\w-]+?--/, "");

export function userUploadDir(email) {
  const d = path.join(UPLOAD_DIR, prefixOf(email).replace(SEP, "") || "local");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Ở chế độ web: đường dẫn file do trình duyệt gửi phải nằm trong thư mục tải lên của chính người đó */
export function checkUserFile(email, p) {
  if (!WEB_MODE) return p;
  const dir = path.resolve(userUploadDir(email)) + path.sep;
  const full = path.resolve(String(p || ""));
  if (!full.startsWith(dir) || !fs.existsSync(full)) throw new Error("File không hợp lệ, hãy tải lên lại");
  return full;
}

const safeFile = (name) =>
  (String(name || "file")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-80) || "file");

const MAX_UPLOAD = 3 * 1024 ** 3; // 3GB / file

/** Nhận file tải lên (body thô), lưu vào thư mục của người dùng, trả đường dẫn trên máy chủ */
export function receiveUpload(req, email) {
  return new Promise((resolve, reject) => {
    const name = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}-${safeFile(req.query.name)}`;
    const dest = path.join(userUploadDir(email), name);
    const out = fs.createWriteStream(dest);
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD) {
        req.destroy();
        out.destroy();
        fs.rmSync(dest, { force: true });
        reject(new Error("File quá lớn (tối đa 3GB)"));
      }
    });
    req.pipe(out);
    out.on("finish", () => resolve({ path: dest, name: safeFile(req.query.name), size }));
    out.on("error", reject);
    req.on("error", reject);
  });
}
