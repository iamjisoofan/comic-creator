export type LayoutName = "2x2" | "2x3" | "3x2";

export interface LayoutSpec {
  columns: number;
  rows: number;
  /** CSS grid-area，格式 "rowStart / colStart / rowEnd / colEnd" */
  areas: string[];
}

/**
 * 只保留**格子全等**的版式。
 *
 * 曾经还有 `1-2-1` / `1-2-2` / `2-1-2` 三种混排通栏格的版式，已删除：通栏格宽一倍，
 * 画面是固定 4:3，于是要么把格子撑成两倍高（页高失控、翻页失效），要么把画面居中留白
 * （每一格都被压小、浮在白边中间）。两头都不能要，所以砍掉通栏格——
 * 一页之内所有格子同形，画面才能满格铺开。理由详见 project.md。
 */
export const LAYOUT_SPECS: Record<LayoutName, LayoutSpec> = {
  "2x2": {
    columns: 2,
    rows: 2,
    areas: ["1 / 1 / 2 / 2", "1 / 2 / 2 / 3", "2 / 1 / 3 / 2", "2 / 2 / 3 / 3"],
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
