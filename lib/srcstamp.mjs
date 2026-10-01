// Dấu vân tay nội dung src/ (bỏ khác biệt xuống dòng Windows/Linux) — để biết bản đóng gói sẵn còn khớp code không
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function srcHash(srcDir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(srcDir);
  const h = crypto.createHash("sha1");
  for (const f of files) {
    h.update(path.relative(srcDir, f).split(path.sep).join("/"));
    h.update(fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
  }
  return h.digest("hex").slice(0, 16);
}
