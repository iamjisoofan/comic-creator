import { describe, it, expect } from "vitest";
import { renderShape, renderPanelSvg } from "../src/render.js";
import { CharacterSchema, PanelSchema } from "../src/schema.js";

const dogMan = CharacterSchema.parse({
  id: "dog-man",
  name: "Dog Man",
  viewBox: [0, 0, 100, 150],
  poses: {
    idle: [{ t: "circle", cx: 50, cy: 35, r: 28, fill: "beige" }],
    happy: [{ t: "circle", cx: 50, cy: 35, r: 28, fill: "beige" }],
    shocked: [{ t: "ellipse", cx: 50, cy: 35, rx: 30, ry: 26, fill: "beige" }],
    angry: [{ t: "circle", cx: 50, cy: 35, r: 28, fill: "beige" }],
  },
});
const characters = new Map([["dog-man", dogMan]]);

describe("renderShape", () => {
  it("圆形：颜色名解析成色值", () => {
    const svg = renderShape({ t: "circle", cx: 10, cy: 20, r: 5, fill: "red" });
    expect(svg).toContain('cx="10"');
    expect(svg).toContain('fill="#E63946"');
  });

  it("省略 fill 时不填充", () => {
    const svg = renderShape({ t: "line", x1: 0, y1: 0, x2: 10, y2: 10 });
    expect(svg).toContain('fill="none"');
  });

  it("rect 的圆角映射到 rx", () => {
    const svg = renderShape({ t: "rect", x: 1, y: 2, w: 3, h: 4, r: 2 });
    expect(svg).toContain('rx="2"');
  });

  it("polygon 顶点序列化成 points 属性", () => {
    const svg = renderShape({ t: "polygon", pts: [[0, 0], [10, 0], [5, 8]] });
    expect(svg).toContain('points="0,0 10,0 5,8"');
  });
});

describe("renderPanelSvg", () => {
  const panel = PanelSchema.parse({
    id: "ch1-p1-01",
    shapes: [{ t: "line", x1: 0, y1: 240, x2: 400, y2: 240 }],
    cast: [{ id: "dog-man", pose: "shocked", x: 150, y: 60, scale: 1.2 }],
  });

  it("输出带正确 viewBox 的 svg", () => {
    const svg = renderPanelSvg(panel, characters);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 400 300"');
  });

  it("描边由渲染器统一施加，JSON 里没有描边字段也会出现", () => {
    const svg = renderPanelSvg(panel, characters);
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('stroke-width="6"');
    expect(svg).toContain('stroke-linecap="round"');
  });

  it("角色按 x/y/scale 摆放，并渲染指定姿势", () => {
    const svg = renderPanelSvg(panel, characters);
    expect(svg).toContain('transform="translate(150 60) scale(1.2)"');
    expect(svg).toContain("<ellipse"); // shocked 姿势用的是 ellipse
  });

  it("同一角色同一姿势渲染两次结果完全相同", () => {
    const a = renderPanelSvg(panel, characters);
    const b = renderPanelSvg(panel, characters);
    expect(a).toBe(b);
  });

  it("未知角色抛错并指出 id", () => {
    const bad = PanelSchema.parse({
      id: "x", shapes: [], cast: [{ id: "ghost", pose: "idle", x: 0, y: 0 }],
    });
    expect(() => renderPanelSvg(bad, characters)).toThrow(/ghost/);
  });

  it("不写 preserveAspectRatio —— 格子是 4:3，画面满格铺开，不该有留白设定", () => {
    const svg = renderPanelSvg(panel, characters);
    expect(svg).not.toContain("preserveAspectRatio");
    expect(svg).toContain('viewBox="0 0 400 300"');
  });

  // 绊线（tripwire）：shape 词表里没有 text 类型，所以今天不可能失败。
  // 留着是为了在有人给词表加 text 时立刻响 —— 文字必须留在 HTML 层，改台词才不用重画。
  it("绊线：画面里不出现任何 text 元素", () => {
    const svg = renderPanelSvg(panel, characters);
    expect(svg).not.toContain("<text");
  });
});
