import { describe, it, expect } from "vitest";
import { LAYOUT_SPECS, panelCount, type LayoutName } from "../src/layout.js";

describe("layout", () => {
  it("每种版式的格数正确", () => {
    expect(panelCount("2x2")).toBe(4);
    expect(panelCount("1-2-1")).toBe(4);
    expect(panelCount("1-2-2")).toBe(5);
    expect(panelCount("2-1-2")).toBe(5);
    expect(panelCount("2x3")).toBe(6);
    expect(panelCount("3x2")).toBe(6);
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

  it("1-2-1 的第一格通栏，第二三格各占一列", () => {
    const spec = LAYOUT_SPECS["1-2-1"];
    expect(spec.columns).toBe(2);
    expect(spec.rows).toBe(3);
    expect(spec.areas[0]).toBe("1 / 1 / 2 / 3");
    expect(spec.areas[1]).toBe("2 / 1 / 3 / 2");
    expect(spec.areas[2]).toBe("2 / 2 / 3 / 3");
    expect(spec.areas[3]).toBe("3 / 1 / 4 / 3");
  });

  it("3x2 是两行三列", () => {
    expect(LAYOUT_SPECS["3x2"].columns).toBe(3);
    expect(LAYOUT_SPECS["3x2"].rows).toBe(2);
  });
});
