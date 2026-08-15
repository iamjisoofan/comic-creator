import { describe, it, expect } from "vitest";
import { LAYOUT_SPECS, panelCount, type LayoutName } from "../src/layout.js";

describe("layout", () => {
  it("每种版式的格数正确", () => {
    expect(panelCount("2x2")).toBe(4);
    expect(panelCount("2x3")).toBe(6);
    expect(panelCount("3x2")).toBe(6);
  });

  // 通栏格已被删除（见 layout.ts 的注释）：一格是固定 4:3，通栏格宽一倍就得高一倍
  // 或者留白，两头都不能要。这条守着"别再把通栏版式加回来"。
  it("只有格子全等的版式：每格正好占一行一列", () => {
    for (const name of Object.keys(LAYOUT_SPECS) as LayoutName[]) {
      const { columns, rows, areas } = LAYOUT_SPECS[name];
      expect(areas.length, `${name}`).toBe(columns * rows);
      for (const area of areas) {
        const [r1, c1, r2, c2] = area.split("/").map((n) => Number(n.trim()));
        expect(r2! - r1!, `${name} 的 "${area}" 跨了多行`).toBe(1);
        expect(c2! - c1!, `${name} 的 "${area}" 跨了多列（通栏格）`).toBe(1);
      }
    }
  });

  // 原来这里断言 areas.length === panelCount()，而 panelCount() 就是 areas.length —— 恒真。
  // 真正该守的不变量是：这些 grid-area 正好铺满 columns × rows，不越界、不重叠、不漏格。
  it("每种版式的 areas 正好铺满 columns × rows，无重叠无空缺", () => {
    for (const name of Object.keys(LAYOUT_SPECS) as LayoutName[]) {
      const { columns, rows, areas } = LAYOUT_SPECS[name];
      const covered = new Set<string>();
      for (const area of areas) {
        const [r1, c1, r2, c2] = area.split("/").map((n) => Number(n.trim()));
        expect([r1, c1, r2, c2].every(Number.isInteger), `${name} 的 area "${area}"`).toBe(true);
        expect(r1! >= 1 && r2! <= rows + 1, `${name} 的行越界：${area}`).toBe(true);
        expect(c1! >= 1 && c2! <= columns + 1, `${name} 的列越界：${area}`).toBe(true);
        for (let r = r1!; r < r2!; r++) {
          for (let c = c1!; c < c2!; c++) {
            const key = `${r},${c}`;
            expect(covered.has(key), `${name} 的格子 ${key} 被两格占用`).toBe(false);
            covered.add(key);
          }
        }
      }
      expect(covered.size, `${name} 有空格子`).toBe(columns * rows);
      expect(areas.length).toBe(panelCount(name));
    }
  });

  it("3x2 是两行三列", () => {
    expect(LAYOUT_SPECS["3x2"].columns).toBe(3);
    expect(LAYOUT_SPECS["3x2"].rows).toBe(2);
  });
});
