import { describe, it, expect } from "vitest";
import { ShapeSchema, CharacterSchema, PanelSchema, ScriptSchema } from "../src/schema.js";

const circle = { t: "circle", cx: 50, cy: 50, r: 20, fill: "beige" };

describe("ShapeSchema", () => {
  it("接受合法圆形", () => {
    expect(ShapeSchema.safeParse(circle).success).toBe(true);
  });

  it("拒绝色值 fill —— 只接受颜色名", () => {
    const r = ShapeSchema.safeParse({ ...circle, fill: "#FF0000" });
    expect(r.success).toBe(false);
  });

  it("拒绝未知图形类型（例如渐变根本不存在）", () => {
    expect(ShapeSchema.safeParse({ t: "gradient", from: "red" }).success).toBe(false);
  });

  it("拒绝多余字段（例如自己加描边）", () => {
    const r = ShapeSchema.safeParse({ ...circle, "stroke-width": 2 });
    expect(r.success).toBe(false);
  });

  it("polygon 顶点超过 6 个被拒绝", () => {
    const pts = Array.from({ length: 7 }, (_, i) => [i, i]);
    expect(ShapeSchema.safeParse({ t: "polygon", pts }).success).toBe(false);
  });
});

describe("CharacterSchema", () => {
  const baseChar = {
    id: "dog-man",
    name: "Dog Man",
    viewBox: [0, 0, 100, 150],
    poses: { idle: [circle], happy: [circle], shocked: [circle], angry: [circle] },
  };

  it("接受四姿势齐全的角色", () => {
    expect(CharacterSchema.safeParse(baseChar).success).toBe(true);
  });

  it("缺少任一姿势即拒绝", () => {
    const { angry, ...rest } = baseChar.poses;
    const r = CharacterSchema.safeParse({ ...baseChar, poses: rest });
    expect(r.success).toBe(false);
  });

  it("单个姿势超过 12 个图形被拒绝，并指出是哪个姿势", () => {
    const tooMany = Array.from({ length: 13 }, () => circle);
    const r = CharacterSchema.safeParse({
      ...baseChar,
      poses: { ...baseChar.poses, shocked: tooMany },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("shocked");
    }
  });
});

describe("PanelSchema", () => {
  const basePanel = {
    id: "ch1-p1-01",
    shapes: [circle],
    cast: [{ id: "dog-man", pose: "idle", x: 150, y: 60, scale: 1 }],
  };

  it("接受合法画面", () => {
    expect(PanelSchema.safeParse(basePanel).success).toBe(true);
  });

  it("scale 缺省为 1", () => {
    const r = PanelSchema.safeParse({
      ...basePanel,
      cast: [{ id: "dog-man", pose: "idle", x: 0, y: 0 }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cast[0]?.scale).toBe(1);
  });

  it("shapes 超过 20 个被拒绝", () => {
    const shapes = Array.from({ length: 21 }, () => circle);
    expect(PanelSchema.safeParse({ ...basePanel, shapes }).success).toBe(false);
  });

  it("出场角色超过 3 个被拒绝", () => {
    const cast = Array.from({ length: 4 }, () => ({ id: "x", pose: "idle", x: 0, y: 0 }));
    expect(PanelSchema.safeParse({ ...basePanel, cast }).success).toBe(false);
  });

  it("未知姿势被拒绝", () => {
    const r = PanelSchema.safeParse({
      ...basePanel,
      cast: [{ id: "dog-man", pose: "jumping", x: 0, y: 0 }],
    });
    expect(r.success).toBe(false);
  });
});

describe("ScriptSchema", () => {
  const panel = (id: string) => ({
    id, shot: "wide", description: "a dog", cast: ["dog-man"], dialogue: [],
  });
  const page = { number: 1, layout: "2x2", panels: ["a", "b", "c", "d"].map(panel) };
  const chapter = { number: 1, title: "Ch1", pages: [page, page, page, page] };
  const script = { title: "T", tone: "funny", chapters: [chapter, chapter, chapter, chapter] };

  it("接受合法剧本", () => {
    const r = ScriptSchema.safeParse(script);
    expect(r.success).toBe(true);
  });

  it("格数与版式不符时拒绝", () => {
    const bad = {
      ...script,
      chapters: [{ ...chapter, pages: [{ ...page, layout: "2x3" }, page, page, page] }],
    };
    const r = ScriptSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/2x3/);
    }
  });

  it("台词超过 12 个单词被拒绝", () => {
    const longLine = Array.from({ length: 13 }, () => "WORD").join(" ");
    const bad = {
      ...script,
      chapters: [{
        ...chapter,
        pages: [{
          ...page,
          panels: [
            { ...panel("a"), dialogue: [{ speaker: "dog-man", text: longLine }] },
            panel("b"), panel("c"), panel("d"),
          ],
        }, page, page, page],
      }],
    };
    expect(ScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("章数少于 4 被拒绝", () => {
    expect(ScriptSchema.safeParse({ ...script, chapters: [chapter] }).success).toBe(false);
  });
});
