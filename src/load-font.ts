import { loadFont as loadDancingScript } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadLeagueSpartan } from "@remotion/google-fonts/LeagueSpartan";
import { loadFont as loadLexend } from "@remotion/google-fonts/Lexend";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadWhisper } from "@remotion/google-fonts/Whisper";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBeVietnam } from "@remotion/google-fonts/BeVietnamPro";
import { loadFont as loadPattaya } from "@remotion/google-fonts/Pattaya";
import { loadFont as loadLobster } from "@remotion/google-fonts/Lobster";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";

const { fontFamily, waitUntilDone } = loadMontserrat("normal", {
  weights: ["800", "900"],
  subsets: ["vietnamese", "latin", "latin-ext"],
});

// chữ viết tay cho "chữ nhấn" (Callouts)
const script = loadDancingScript("normal", {
  weights: ["700"],
  subsets: ["vietnamese", "latin", "latin-ext"],
});

// bộ chữ mẫu "chữ ký + chữ khối" (Callouts kiểu city/bigyellow/...): thay cho 1FTV VIP Bacalisties,
// UTM American Sans, SVN-Avobold — các font đó có bản quyền riêng, đây là font Google miễn phí gần giống nhất
const sign = loadWhisper("normal", { weights: ["400"], subsets: ["vietnamese", "latin", "latin-ext"] });
const heavy = loadLeagueSpartan("normal", { weights: ["900"], subsets: ["vietnamese", "latin", "latin-ext"] });
const geo = loadLexend("normal", { weights: ["300", "500", "700"], subsets: ["vietnamese", "latin", "latin-ext"] });

// bộ mẫu chữ mở rộng (50 mẫu): đều có bộ chữ tiếng Việt
const VI = { subsets: ["vietnamese", "latin", "latin-ext"] as ("vietnamese" | "latin" | "latin-ext")[] };
const anton = loadAnton("normal", { weights: ["400"], ...VI });
const serif = loadPlayfair("normal", { weights: ["900"], ...VI });
const viet = loadBeVietnam("normal", { weights: ["800"], ...VI });
const brush = loadPattaya("normal", { weights: ["400"], ...VI });
const retro = loadLobster("normal", { weights: ["400"], ...VI });
const cond = loadOswald("normal", { weights: ["700"], ...VI });
export const AntonFont = anton.fontFamily;
export const SerifFont = serif.fontFamily;
export const VietFont = viet.fontFamily;
export const BrushFont = brush.fontFamily;
export const RetroFont = retro.fontFamily;
export const CondFont = cond.fontFamily;

export const SignFont = sign.fontFamily;
export const HeavyFont = heavy.fontFamily;
export const GeoFont = geo.fontFamily;
export const TheBoldFont = fontFamily;
export const ScriptFont = script.fontFamily;

export const loadFont = async (): Promise<void> => {
  await Promise.all([
    waitUntilDone(),
    script.waitUntilDone(),
    sign.waitUntilDone(),
    heavy.waitUntilDone(),
    geo.waitUntilDone(),
    ...[anton, serif, viet, brush, retro, cond].map((f) => f.waitUntilDone()),
  ]);
};
