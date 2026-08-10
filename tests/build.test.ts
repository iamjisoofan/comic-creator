import { describe, it, expect } from "vitest";
import { buildHtml, type BookData } from "../src/build.js";
import { CharacterSchema, PanelSchema, ScriptSchema } from "../src/schema.js";

const dogMan = CharacterSchema.parse({
  id: "dog-man", name: "Dog Man", viewBox: [0, 0, 100, 150],
  poses: {
    idle: [{ t: "circle", cx: 50, cy: 35, r: 28, fill: "beige" }],
    happy: [], shocked: [], angry: [],
  },
});

const scriptPanel = (id: string, extra: object = {}) => ({
  id, shot: "wide", description: "d", cast: ["dog-man"], dialogue: [], ...extra,
});

const page = {
  number: 1,
  layout: "2x2",
  panels: [
    scriptPanel("ch1-p1-01", {
      dialogue: [{ speaker: "dog-man", text: "MY BONE!!" }],
      sfx: "GASP!",
      caption: "MEANWHILE...",
    }),
    scriptPanel("ch1-p1-02"),
    scriptPanel("ch1-p1-03"),
    scriptPanel("ch1-p1-04"),
  ],
};
const chapter = { number: 1, title: "Where's My Bone?!", pages: [page, page, page, page] };
const script = ScriptSchema.parse({
  title: "The Lost Bone", tone: "funny",
  chapters: [chapter, chapter, chapter, chapter],
});

const drawn = PanelSchema.parse({
  id: "ch1-p1-01",
  shapes: [{ t: "line", x1: 0, y1: 240, x2: 400, y2: 240 }],
  cast: [{ id: "dog-man", pose: "idle", x: 150, y: 60 }],
});

const book: BookData = {
  script,
  panels: new Map([["ch1-p1-01", drawn]]),
  characters: new Map([["dog-man", dogMan]]),
};

describe("buildHtml", () => {
  const html = buildHtml(book);

  it("输出完整 HTML 文档，标题是书名", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>The Lost Bone</title>");
  });

  it("绝不使用 fetch —— file:// 下会被 CORS 拦死", () => {
    expect(html).not.toContain("fetch(");
  });

  it("SVG 内联在文档里，不是外部引用", () => {
    expect(html).toContain("<svg");
    expect(html).not.toContain('<img src=');
  });

  it("按版式设置 CSS Grid 列数", () => {
    expect(html).toContain("grid-template-columns: repeat(2, 1fr)");
  });

  it("台词、拟声词、旁白都以真实文字出现", () => {
    expect(html).toContain("MY BONE!!");
    expect(html).toContain("GASP!");
    expect(html).toContain("MEANWHILE...");
  });

  it("章节标题出现在页面上", () => {
    expect(html).toContain("Where&#39;s My Bone?!");
  });

  it("未作画的格显示占位，不崩溃", () => {
    expect(html).toContain("not-drawn");
  });

  it("HTML 特殊字符被转义", () => {
    const risky: BookData = {
      ...book,
      script: ScriptSchema.parse({
        ...script,
        title: "<script>alert(1)</script>",
      }),
    };
    const out = buildHtml(risky);
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
