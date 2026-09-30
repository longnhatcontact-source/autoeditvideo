import { loadFont as loadDancingScript } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily, waitUntilDone } = loadMontserrat("normal", {
  weights: ["800", "900"],
  subsets: ["vietnamese", "latin", "latin-ext"],
});

// chữ viết tay cho "chữ nhấn" (Callouts)
const script = loadDancingScript("normal", {
  weights: ["700"],
  subsets: ["vietnamese", "latin", "latin-ext"],
});

export const TheBoldFont = fontFamily;
export const ScriptFont = script.fontFamily;

export const loadFont = async (): Promise<void> => {
  await Promise.all([waitUntilDone(), script.waitUntilDone()]);
};
