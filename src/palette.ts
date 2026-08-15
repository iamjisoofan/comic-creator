export const PALETTE = {
  white: "#FFFFFF",
  beige: "#F5D9B0",
  red: "#E63946",
  blue: "#4A90D9",
  yellow: "#F5C518",
  green: "#5FA85F",
  black: "#000000",
} as const;

export type ColorName = keyof typeof PALETTE;

export const STROKE = {
  color: "#000000",
  width: 6,
  linecap: "round",
  linejoin: "round",
} as const;

export const PANEL_WIDTH = 400;
export const PANEL_HEIGHT = 300;
