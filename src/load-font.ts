import { loadFont as loadDancingScript } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadLeagueSpartan } from "@remotion/google-fonts/LeagueSpartan";
import { loadFont as loadLexend } from "@remotion/google-fonts/Lexend";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadWhisper } from "@remotion/google-fonts/Whisper";

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
  ]);
};
