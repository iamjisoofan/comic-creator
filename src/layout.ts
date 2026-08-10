export type LayoutName = "2x2" | "1-2-1" | "1-2-2" | "2-1-2" | "2x3" | "3x2";

export interface LayoutSpec {
  columns: number;
  rows: number;
  /** CSS grid-area，格式 "rowStart / colStart / rowEnd / colEnd" */
  areas: string[];
}

export const LAYOUT_SPECS: Record<LayoutName, LayoutSpec> = {
  "2x2": {
    columns: 2,
    rows: 2,
    areas: ["1 / 1 / 2 / 2", "1 / 2 / 2 / 3", "2 / 1 / 3 / 2", "2 / 2 / 3 / 3"],
  },
  "1-2-1": {
    columns: 2,
    rows: 3,
    areas: ["1 / 1 / 2 / 3", "2 / 1 / 3 / 2", "2 / 2 / 3 / 3", "3 / 1 / 4 / 3"],
  },
  "1-2-2": {
    columns: 2,
    rows: 3,
    areas: [
      "1 / 1 / 2 / 3",
      "2 / 1 / 3 / 2", "2 / 2 / 3 / 3",
      "3 / 1 / 4 / 2", "3 / 2 / 4 / 3",
    ],
  },
  "2-1-2": {
    columns: 2,
    rows: 3,
    areas: [
      "1 / 1 / 2 / 2", "1 / 2 / 2 / 3",
      "2 / 1 / 3 / 3",
      "3 / 1 / 4 / 2", "3 / 2 / 4 / 3",
    ],
  },
  "2x3": {
    columns: 2,
    rows: 3,
    areas: [
      "1 / 1 / 2 / 2", "1 / 2 / 2 / 3",
      "2 / 1 / 3 / 2", "2 / 2 / 3 / 3",
      "3 / 1 / 4 / 2", "3 / 2 / 4 / 3",
    ],
  },
  "3x2": {
    columns: 3,
    rows: 2,
    areas: [
      "1 / 1 / 2 / 2", "1 / 2 / 2 / 3", "1 / 3 / 2 / 4",
      "2 / 1 / 3 / 2", "2 / 2 / 3 / 3", "2 / 3 / 3 / 4",
    ],
  },
};

export function panelCount(name: LayoutName): number {
  return LAYOUT_SPECS[name].areas.length;
}
