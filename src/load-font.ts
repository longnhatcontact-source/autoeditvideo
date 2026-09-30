import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily, waitUntilDone } = loadMontserrat("normal", {
  weights: ["800", "900"],
  subsets: ["vietnamese", "latin", "latin-ext"],
});

export const TheBoldFont = fontFamily;

export const loadFont = async (): Promise<void> => {
  await waitUntilDone();
};
