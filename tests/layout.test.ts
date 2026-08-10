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

  it("areas 数量等于格数", () => {
    for (const name of Object.keys(LAYOUT_SPECS) as LayoutName[]) {
      expect(LAYOUT_SPECS[name].areas.length).toBe(panelCount(name));
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
