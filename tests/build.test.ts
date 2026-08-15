import { describe, it, expect } from "vitest";
import { buildHtml, bubbleSide } from "../src/build.js";
import { CharacterSchema, PanelSchema, ScriptSchema, type BookData } from "../src/schema.js";

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

  it("SVG 内联在文档里：图形本体就在 HTML 里，不是外部引用", () => {
    expect(html).toContain("<svg");
    // 这一格画的是一条地平线；它出现在 HTML 里才说明 SVG 是内联的而不是被引用的
    expect(html).toContain('<line x1="0" y1="240" x2="400" y2="240"');
    expect(html).not.toMatch(/(src|href)="[^"]*\.(svg|png|json)"/);
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

  it("未作画的格显示英文占位（成品是英文的，要发给爷爷奶奶）", () => {
    expect(html).toContain("not drawn yet");
    expect(html).not.toContain("还没画");
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

  it("台词 / 拟声词 / 旁白 / 格 id 里的尖括号引号都被转义", () => {
    const nasty = '</div><img onerror="x">&\'';
    const riskyScript = ScriptSchema.parse({
      ...script,
      chapters: [
        {
          ...chapter,
          pages: [{
            ...page,
            panels: [
              {
                ...scriptPanel(nasty),
                dialogue: [{ speaker: "dog-man", text: nasty }],
                sfx: nasty,
                caption: nasty,
              },
              scriptPanel("b"), scriptPanel("c"), scriptPanel("d"),
            ],
          }, page, page, page],
        },
        chapter, chapter, chapter,
      ],
    });
    // 这一格没画，所以 id 会被印进占位符里 —— 四个入口一次全测到
    const out = buildHtml({ ...book, script: riskyScript, panels: new Map() });
    expect(out).not.toContain("<img onerror=");
    expect(out).not.toContain("</div><img");
    expect(out.split("&lt;/div&gt;&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;").length - 1)
      .toBe(4); // caption + dialogue + sfx + 占位符里的 id
  });
});

/** 只有一页、指定版式的书，用来单独看这一页生成的 CSS */
const pageOf = (layout: "2x2" | "2x3" | "3x2", panels: object[]) => {
  const p = { number: 1, layout, panels };
  const s = ScriptSchema.parse({
    title: "T", tone: "funny",
    chapters: Array.from({ length: 4 }, () => ({ number: 1, title: "C", pages: [p, p, p, p] })),
  });
  return buildHtml({ ...book, script: s, panels: new Map() });
};

describe("翻页：一页按版式定形，整页缩进一屏", () => {
  // 要的不是"每页一样高"——固定 4:3 的格子加上不同的行列数，页高本来就不同。
  // 要的是"按一次方向键正好翻过一整页"，靠 aspect-ratio + 宽度封顶实现。
  const shapes = { "2x2": [2, 2, 4], "2x3": [2, 3, 6], "3x2": [3, 2, 6] } as const;

  it("每页声明 列×4 : 行×3 的 aspect-ratio，并按它把宽度封顶", () => {
    for (const [layout, [cols, rows, n]] of Object.entries(shapes)) {
      const out = pageOf(layout as keyof typeof shapes,
        Array.from({ length: n }, (_, i) => scriptPanel(`p${i}`)));
      expect(out).toContain(`grid-template-columns: repeat(${cols}, 1fr)`);
      expect(out).toContain(`grid-template-rows: repeat(${rows}, 1fr)`);
      expect(out).toContain(`aspect-ratio: ${cols * 4} / ${rows * 3}`);
      expect(out).toContain(`width: min(100%, calc(var(--page-fit) * ${cols * 4} / ${rows * 3}))`);
    }
  });

  it("不再有固定行高 —— 那会把画面压成信箱条", () => {
    const html = buildHtml(book);
    expect(html).not.toContain("--row");
    expect(html).not.toContain("preserveAspectRatio");
  });

  it("画面撑满格子", () => {
    expect(buildHtml(book)).toContain(".panel svg { display: block; width: 100%; height: 100%; }");
  });
});

describe("bubbleSide（F4）：气泡贴在说话人那一侧", () => {
  const characters = new Map([["dog-man", dogMan]]);
  const panelWith = (x: number, scale = 1) => PanelSchema.parse({
    id: "p", shapes: [], cast: [{ id: "dog-man", pose: "idle", x, y: 60, scale }],
  });

  it("说话人在画面左边 → 气泡在左", () => {
    expect(bubbleSide("dog-man", 0, panelWith(20), characters)).toBe("left");
  });

  it("说话人在画面右边 → 气泡在右", () => {
    expect(bubbleSide("dog-man", 0, panelWith(300), characters)).toBe("right");
  });

  it("按角色中心判断，考虑 scale", () => {
    // x=160、scale=2 → 中心 160+100=260，在右半边
    expect(bubbleSide("dog-man", 0, panelWith(160, 2), characters)).toBe("right");
    expect(bubbleSide("dog-man", 0, panelWith(160, 0.5), characters)).toBe("left");
  });

  it("说话人不在这一格里 → 左右交替，两个气泡不会叠在一起", () => {
    expect(bubbleSide("ghost", 0, panelWith(20), characters)).toBe("left");
    expect(bubbleSide("ghost", 1, panelWith(20), characters)).toBe("right");
  });

  it("这一格还没画 → 也走交替", () => {
    expect(bubbleSide("dog-man", 1, undefined, characters)).toBe("right");
  });

  it("两条台词的两个角色分居两侧，且一上一下不重叠", () => {
    const cat = CharacterSchema.parse({ ...dogMan, id: "cat" });
    const twoWay = ScriptSchema.parse({
      ...script,
      chapters: [
        {
          ...chapter,
          pages: [{
            ...page,
            panels: [
              {
                ...scriptPanel("ch1-p1-01"),
                dialogue: [
                  { speaker: "cat", text: "YOU ARE ON THE LEFT!" },
                  { speaker: "dog-man", text: "NO YOU ARE!" },
                ],
              },
              scriptPanel("b"), scriptPanel("c"), scriptPanel("d"),
            ],
          }, page, page, page],
        },
        chapter, chapter, chapter,
      ],
    });
    const drawnTwo = PanelSchema.parse({
      id: "ch1-p1-01",
      shapes: [],
      cast: [
        { id: "dog-man", pose: "idle", x: 260, y: 60 },
        { id: "cat", pose: "idle", x: 20, y: 60 },
      ],
    });
    const out = buildHtml({
      script: twoWay,
      panels: new Map([["ch1-p1-01", drawnTwo]]),
      characters: new Map([["dog-man", dogMan], ["cat", cat]]),
    });
    expect(out).toContain('<div class="bubble top left">YOU ARE ON THE LEFT!</div>');
    expect(out).toContain('<div class="bubble bottom right">NO YOU ARE!</div>');
  });

  it("有旁白时这一格带 captioned 类，气泡让开旁白的位置", () => {
    const html = buildHtml(book);
    expect(html).toContain('class="panel captioned"');
    expect(html).toContain(".captioned .bubble.top { top: 44px; }");
  });
});
