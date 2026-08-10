# 儿童漫画创作系统 v1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成一条流水线，把 Claude 产出的结构化 JSON（角色姿势 + 每格画面 + 剧本）渲染成一个自包含的 `index.html` 漫画书。

**Architecture:** Claude 只产出受 Zod schema 约束的 JSON，永远不碰 SVG 字符串。渲染器统一施加描边、解析颜色名、摆放角色，因此违反画风规范在结构上不可表达。`renderPanelSvg()` 是系统枢纽，将来会被网页创作台复用。

**Tech Stack:** TypeScript / Node.js 22 LTS+ / tsx / Vitest / Zod。生成物是纯静态 HTML + CSS Grid + 约 20 行原生 JS。

## Global Constraints

- **画布尺寸**：一格 `400 × 300`；角色 viewBox 默认 `[0, 0, 100, 150]`
- **描边**：`stroke="#000000"`, `stroke-width="6"`, `stroke-linecap="round"`, `stroke-linejoin="round"` —— 由渲染器统一施加，JSON 中不得出现描边字段
- **调色板**（`fill` 只接受这些名字，不接受色值）：
  `white #FFFFFF` / `beige #F5D9B0` / `red #E63946` / `blue #4A90D9` / `yellow #F5C518` / `green #5FA85F` / `black #000000`
- **图形预算**：角色单姿势 ≤ 12 shapes；单格 `shapes` ≤ 20；单格 `cast` ≤ 3；`polyline`/`polygon` 顶点 ≤ 6
- **姿势**：固定四个 `idle` / `happy` / `shocked` / `angry`，全部必填
- **版式**：`2x2`(4) / `1-2-1`(4) / `1-2-2`(5) / `2-1-2`(5) / `2x3`(6) / `3x2`(6)
- **规模**：一书 4–5 章；一章 4–5 页；一页 4–6 格
- **台词**：单个气泡 ≤ 12 个单词
- **`index.html` 绝对不能用 `fetch()` 读本地文件** —— `file://` 下会被 CORS 拦截。所有数据必须内联
- **所有 import 写 `.js` 后缀**（`import { x } from "./layout.js"`），兼容 ESM 解析
- 规范细节见 [`comic.md`](../../../comic.md)，设计依据见 [`../specs/2026-08-10-kids-comic-creator-design.md`](../specs/2026-08-10-kids-comic-creator-design.md)

---

### Task 1: 项目骨架 + 调色板 + 版式

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`
- Create: `src/palette.ts`, `src/layout.ts`
- Test: `tests/layout.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `PALETTE: Record<ColorName, string>`、`STROKE: { color: string; width: number }`（`src/palette.ts`）
  - `type LayoutName = "2x2" | "1-2-1" | "1-2-2" | "2-1-2" | "2x3" | "3x2"`
  - `interface LayoutSpec { columns: number; rows: number; areas: string[] }`
  - `LAYOUT_SPECS: Record<LayoutName, LayoutSpec>`
  - `panelCount(name: LayoutName): number`
  - `areas` 元素是 CSS `grid-area` 值，格式 `"rowStart / colStart / rowEnd / colEnd"`

- [ ] **Step 1: 初始化项目并安装依赖**

```bash
cd /Users/tony/githubproject/comic-creator
npm init -y
npm pkg set type=module private=true
npm pkg set scripts.test="vitest run"
npm pkg set scripts.check="tsx src/cli.ts check"
npm pkg set scripts.build="tsx src/cli.ts build"
npm install zod
npm install -D tsx vitest typescript
```

不手写版本号，让 npm 装当前版本。

- [ ] **Step 2: 确认 Zod 大版本与 API**

```bash
node -p "require('./package.json').dependencies.zod"
```

记下版本。**Zod 4 中 `.strict()` 已弃用但仍可用**；若装到的是 4.x 且运行时报 `.strict is not a function`，把所有 `z.object({...}).strict()` 换成 `z.strictObject({...})`，其余代码不变。这一步是"先验证再写"，不要凭记忆假设。

- [ ] **Step 3: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: 写 .gitignore**

```
node_modules/
comics/books/*/index.html
```

`index.html` 是生成物，不入库；`comics/` 下的 JSON 和 md 是小朋友的资产，要入库。

- [ ] **Step 5: 写失败的测试**

创建 `tests/layout.test.ts`：

```ts
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
```

- [ ] **Step 6: 运行测试确认失败**

Run: `npx vitest run tests/layout.test.ts`
Expected: FAIL — `Cannot find module '../src/layout.js'`

- [ ] **Step 7: 写 src/palette.ts**

```ts
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
```

- [ ] **Step 8: 写 src/layout.ts**

```ts
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
```

- [ ] **Step 9: 运行测试确认通过**

Run: `npx vitest run tests/layout.test.ts`
Expected: PASS，4 个测试全绿

- [ ] **Step 10: 提交**

```bash
git add package.json package-lock.json tsconfig.json .gitignore src/palette.ts src/layout.ts tests/layout.test.ts
git commit -m "feat: 项目骨架 + 调色板 + 六种版式"
```

---

### Task 2: Zod schema —— 让违规不可表达

**Files:**
- Create: `src/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: `LAYOUT_SPECS`, `panelCount`, `LayoutName`（`src/layout.ts`）；`PALETTE`（`src/palette.ts`，用它的键生成颜色枚举）
- Produces:
  - `ShapeSchema`、`type Shape`
  - `CharacterSchema`、`type Character`（含 `id`, `name`, `viewBox`, `poses`）
  - `PanelSchema`、`type Panel`（含 `id`, `shapes`, `cast`）
  - `ScriptSchema`、`type Script`
  - `type Pose = "idle" | "happy" | "shocked" | "angry"`

这个 task 是整个方案的地基：**画风约束在这里从"规则"变成"不可表达"。**

- [ ] **Step 1: 写失败的测试**

创建 `tests/schema.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — `Cannot find module '../src/schema.js'`

- [ ] **Step 3: 写 src/schema.ts**

```ts
import { z } from "zod";
import { PALETTE } from "./palette.js";
import { LAYOUT_SPECS, panelCount, type LayoutName } from "./layout.js";

const colorNames = Object.keys(PALETTE) as [keyof typeof PALETTE, ...Array<keyof typeof PALETTE>];
export const ColorSchema = z.enum(colorNames);

const Point = z.tuple([z.number(), z.number()]);

export const ShapeSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("circle"), cx: z.number(), cy: z.number(), r: z.number().positive(), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("ellipse"), cx: z.number(), cy: z.number(), rx: z.number().positive(), ry: z.number().positive(), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("rect"), x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), r: z.number().nonnegative().optional(), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("line"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }).strict(),
  z.object({ t: z.literal("polyline"), pts: z.array(Point).min(2).max(6), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("polygon"), pts: z.array(Point).min(3).max(6), fill: ColorSchema.optional() }).strict(),
]);
export type Shape = z.infer<typeof ShapeSchema>;

export const PoseSchema = z.enum(["idle", "happy", "shocked", "angry"]);
export type Pose = z.infer<typeof PoseSchema>;

const poseShapes = z.array(ShapeSchema).max(12, "一个姿势最多 12 个图形");

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  viewBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  poses: z.object({
    idle: poseShapes,
    happy: poseShapes,
    shocked: poseShapes,
    angry: poseShapes,
  }).strict(),
}).strict();
export type Character = z.infer<typeof CharacterSchema>;

export const CastMemberSchema = z.object({
  id: z.string().min(1),
  pose: PoseSchema,
  x: z.number(),
  y: z.number(),
  scale: z.number().positive().default(1),
}).strict();

export const PanelSchema = z.object({
  id: z.string().min(1),
  shapes: z.array(ShapeSchema).max(20, "一格最多 20 个图形"),
  cast: z.array(CastMemberSchema).max(3, "一格最多 3 个角色"),
}).strict();
export type Panel = z.infer<typeof PanelSchema>;

// ---- 剧本 ----

export const ShotSchema = z.enum(["wide", "medium", "close-up"]);
export const ToneSchema = z.enum(["funny", "adventure", "warm", "spooky"]);
const layoutNames = Object.keys(LAYOUT_SPECS) as [LayoutName, ...LayoutName[]];
export const LayoutSchema = z.enum(layoutNames);

export const DialogueSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1).refine(
    (t) => t.trim().split(/\s+/).length <= 12,
    "一个气泡最多 12 个单词",
  ),
}).strict();

export const ScriptPanelSchema = z.object({
  id: z.string().min(1),
  shot: ShotSchema,
  description: z.string().min(1),
  cast: z.array(z.string()),
  dialogue: z.array(DialogueSchema).default([]),
  sfx: z.string().optional(),
  caption: z.string().optional(),
}).strict();

export const ScriptPageSchema = z.object({
  number: z.number().int().positive(),
  layout: LayoutSchema,
  panels: z.array(ScriptPanelSchema).min(4).max(6),
}).strict().superRefine((page, ctx) => {
  const expected = panelCount(page.layout);
  if (page.panels.length !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `版式 ${page.layout} 需要 ${expected} 格，实际 ${page.panels.length} 格`,
      path: ["panels"],
    });
  }
});

export const ScriptChapterSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  pages: z.array(ScriptPageSchema).min(4).max(5),
}).strict();

export const ScriptSchema = z.object({
  title: z.string().min(1),
  tone: ToneSchema,
  chapters: z.array(ScriptChapterSchema).min(4).max(5),
}).strict();
export type Script = z.infer<typeof ScriptSchema>;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS

若 Zod 版本为 4.x 且 `.strict()` 报错，按 Task 1 Step 2 的说明替换为 `z.strictObject`，然后重跑。

- [ ] **Step 5: 提交**

```bash
git add src/schema.ts tests/schema.test.ts
git commit -m "feat: Zod schema，让违反画风规范在结构上不可表达"
```

---

### Task 3: 渲染器 —— JSON 转 SVG

**Files:**
- Create: `src/render.ts`
- Test: `tests/render.test.ts`

**Interfaces:**
- Consumes: `Shape`, `Panel`, `Character`（`src/schema.ts`）；`PALETTE`, `STROKE`, `PANEL_WIDTH`, `PANEL_HEIGHT`（`src/palette.ts`）
- Produces:
  - `renderShape(shape: Shape): string` —— 单个图形的 SVG 元素字符串
  - `renderPanelSvg(panel: Panel, characters: Map<string, Character>): string` —— 完整 `<svg>` 字符串
  - 未知角色 id 抛 `Error`，消息含该 id

这是系统枢纽，将来会被网页创作台原样复用。

- [ ] **Step 1: 写失败的测试**

创建 `tests/render.test.ts`：

```ts
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

  it("画面里不出现任何 text 元素", () => {
    const svg = renderPanelSvg(panel, characters);
    expect(svg).not.toContain("<text");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/render.test.ts`
Expected: FAIL — `Cannot find module '../src/render.js'`

- [ ] **Step 3: 写 src/render.ts**

```ts
import { PALETTE, STROKE, PANEL_WIDTH, PANEL_HEIGHT } from "./palette.js";
import type { Shape, Panel, Character } from "./schema.js";

function fillOf(shape: { fill?: keyof typeof PALETTE }): string {
  return shape.fill ? PALETTE[shape.fill] : "none";
}

function attrs(pairs: Array<[string, string | number]>): string {
  return pairs.map(([k, v]) => `${k}="${v}"`).join(" ");
}

export function renderShape(shape: Shape): string {
  const fill = fillOf(shape as { fill?: keyof typeof PALETTE });
  switch (shape.t) {
    case "circle":
      return `<circle ${attrs([["cx", shape.cx], ["cy", shape.cy], ["r", shape.r], ["fill", fill]])}/>`;
    case "ellipse":
      return `<ellipse ${attrs([["cx", shape.cx], ["cy", shape.cy], ["rx", shape.rx], ["ry", shape.ry], ["fill", fill]])}/>`;
    case "rect": {
      const pairs: Array<[string, string | number]> = [["x", shape.x], ["y", shape.y], ["width", shape.w], ["height", shape.h]];
      if (shape.r !== undefined) pairs.push(["rx", shape.r]);
      pairs.push(["fill", fill]);
      return `<rect ${attrs(pairs)}/>`;
    }
    case "line":
      return `<line ${attrs([["x1", shape.x1], ["y1", shape.y1], ["x2", shape.x2], ["y2", shape.y2], ["fill", "none"]])}/>`;
    case "polyline":
    case "polygon": {
      const points = shape.pts.map(([x, y]) => `${x},${y}`).join(" ");
      return `<${shape.t} ${attrs([["points", points], ["fill", fill]])}/>`;
    }
  }
}

export function renderPanelSvg(panel: Panel, characters: Map<string, Character>): string {
  const body: string[] = [];

  for (const shape of panel.shapes) {
    body.push(renderShape(shape));
  }

  for (const member of panel.cast) {
    const character = characters.get(member.id);
    if (!character) {
      throw new Error(`未知角色 "${member.id}"（出现在画面 ${panel.id}）`);
    }
    const shapes = character.poses[member.pose].map(renderShape).join("");
    body.push(
      `<g transform="translate(${member.x} ${member.y}) scale(${member.scale})">${shapes}</g>`,
    );
  }

  const strokeAttrs = attrs([
    ["stroke", STROKE.color],
    ["stroke-width", STROKE.width],
    ["stroke-linecap", STROKE.linecap],
    ["stroke-linejoin", STROKE.linejoin],
  ]);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}" ${strokeAttrs}>` +
    body.join("") +
    `</svg>`
  );
}
```

描边写在根 `<svg>` 上由子元素继承，因此 Claude 无论如何都碰不到它。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/render.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/render.ts tests/render.test.ts
git commit -m "feat: 渲染器 —— JSON 转 SVG，统一施加描边与调色板"
```

---

### Task 4: 成书构建器

**Files:**
- Create: `src/build.ts`
- Test: `tests/build.test.ts`

**Interfaces:**
- Consumes: `renderPanelSvg`（`src/render.ts`）；`LAYOUT_SPECS`（`src/layout.ts`）；`Script`, `Panel`, `Character`（`src/schema.ts`）
- Produces:
  - `interface BookData { script: Script; panels: Map<string, Panel>; characters: Map<string, Character> }`
  - `buildHtml(book: BookData): string` —— 纯函数，无 IO，返回完整 HTML 文档
  - 缺失的 panel 用占位块表示，不抛错（允许只画了一章就先看）

- [ ] **Step 1: 写失败的测试**

创建 `tests/build.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/build.test.ts`
Expected: FAIL — `Cannot find module '../src/build.js'`

- [ ] **Step 3: 写 src/build.ts**

```ts
import { renderPanelSvg } from "./render.js";
import { LAYOUT_SPECS } from "./layout.js";
import type { Script, Panel, Character } from "./schema.js";

export interface BookData {
  script: Script;
  panels: Map<string, Panel>;
  characters: Map<string, Character>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 确定性的小角度倾斜，让拟声词有手写的随意感（同一文本每次结果相同） */
function tilt(text: string): number {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 31) - 15;
}

const CSS = `
:root { --gap: 12px; }
* { box-sizing: border-box; }
body { margin: 0; background: #333; font-family: "Comic Sans MS", "Chalkboard SE", sans-serif; }
.book { max-width: 900px; margin: 0 auto; padding: 24px; }
h1 { color: #fff; text-align: center; }
h2 { color: #F5C518; margin: 32px 0 8px; }
.page { display: grid; gap: var(--gap); background: #fff; padding: var(--gap);
        border-radius: 8px; margin-bottom: 24px; }
.panel { position: relative; border: 6px solid #000; border-radius: 4px;
         overflow: hidden; background: #fff; }
.panel svg { display: block; width: 100%; height: auto; }
.not-drawn { display: flex; align-items: center; justify-content: center;
             min-height: 160px; color: #999; font-size: 14px; }
.bubble { position: absolute; top: 8px; left: 8px; max-width: 60%;
          background: #fff; border: 4px solid #000; border-radius: 14px;
          padding: 6px 10px; font-weight: bold; font-size: 15px; line-height: 1.2; }
/* 向下的三角尾巴，指向说话的角色 */
.bubble::after { content: ""; position: absolute; bottom: -14px; left: 18px;
                 border: 7px solid transparent; border-top-color: #000; }
.bubble + .bubble { top: auto; bottom: 8px; }
.sfx { position: absolute; top: 10px; right: 10px; font-size: 30px; font-weight: 900;
       color: #F5C518; -webkit-text-stroke: 3px #000; }
.caption { position: absolute; top: 8px; left: 8px; background: #fff;
           border: 4px solid #000; padding: 4px 8px; font-size: 13px; font-weight: bold; }
.caption ~ .bubble { top: auto; bottom: 8px; }
`.trim();

const JS = `
const pages = [...document.querySelectorAll('.page')];
let i = 0;
function go(n) {
  i = Math.max(0, Math.min(pages.length - 1, n));
  pages[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
}
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(i + 1);
  if (e.key === 'ArrowLeft') go(i - 1);
});
`.trim();

export function buildHtml(book: BookData): string {
  const { script, panels, characters } = book;
  const parts: string[] = [];

  for (const chapter of script.chapters) {
    parts.push(`<h2>Chapter ${chapter.number}: ${esc(chapter.title)}</h2>`);

    for (const page of chapter.pages) {
      const spec = LAYOUT_SPECS[page.layout];
      const cells: string[] = [];

      page.panels.forEach((sp, idx) => {
        const area = spec.areas[idx] ?? "auto";
        const drawn = panels.get(sp.id);
        const art = drawn
          ? renderPanelSvg(drawn, characters)
          : `<div class="not-drawn">${esc(sp.id)} 还没画</div>`;

        const overlay: string[] = [];
        if (sp.caption) overlay.push(`<div class="caption">${esc(sp.caption)}</div>`);
        for (const line of sp.dialogue) {
          overlay.push(`<div class="bubble">${esc(line.text)}</div>`);
        }
        if (sp.sfx) {
          overlay.push(
            `<div class="sfx" style="transform: rotate(${tilt(sp.sfx)}deg)">${esc(sp.sfx)}</div>`,
          );
        }

        cells.push(
          `<div class="panel" style="grid-area: ${area}">${art}${overlay.join("")}</div>`,
        );
      });

      parts.push(
        `<div class="page" style="grid-template-columns: repeat(${spec.columns}, 1fr)">` +
        cells.join("") +
        `</div>`,
      );
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(script.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="book">
<h1>${esc(script.title)}</h1>
${parts.join("\n")}
</div>
<script>${JS}</script>
</body>
</html>`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/build.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/build.ts tests/build.test.ts
git commit -m "feat: 成书构建器 —— 内联 SVG + 文字层，单文件自包含"
```

---

### Task 5: 文件加载与 CLI

**Files:**
- Create: `src/load.ts`, `src/cli.ts`
- Test: `tests/load.test.ts`

**Interfaces:**
- Consumes: 全部前序模块
- Produces:
  - `loadBook(bookDir: string, charactersDir: string): Promise<BookData>` —— 读盘 + Zod 校验，失败时抛出含文件路径的错误
  - `formatZodError(filePath: string, error: z.ZodError): string`
  - CLI：`tsx src/cli.ts build <bookDir>` / `tsx src/cli.ts check <path>`

- [ ] **Step 1: 写失败的测试**

创建 `tests/load.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBook } from "../src/load.js";

let root: string;
let bookDir: string;
let charsDir: string;

const character = {
  id: "dog-man", name: "Dog Man", viewBox: [0, 0, 100, 150],
  poses: {
    idle: [{ t: "circle", cx: 50, cy: 35, r: 28, fill: "beige" }],
    happy: [], shocked: [], angry: [],
  },
};

const scriptPanel = (id: string) => ({
  id, shot: "wide", description: "d", cast: ["dog-man"], dialogue: [],
});
const page = { number: 1, layout: "2x2", panels: ["01", "02", "03", "04"].map((n) => scriptPanel(`ch1-p1-${n}`)) };
const chapter = { number: 1, title: "Ch1", pages: [page, page, page, page] };
const script = { title: "T", tone: "funny", chapters: [chapter, chapter, chapter, chapter] };

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "comic-"));
  charsDir = join(root, "characters");
  bookDir = join(root, "book");
  await mkdir(charsDir, { recursive: true });
  await mkdir(join(bookDir, "panels"), { recursive: true });
  await writeFile(join(charsDir, "dog-man.json"), JSON.stringify(character));
  await writeFile(join(bookDir, "script.json"), JSON.stringify(script));
  await writeFile(
    join(bookDir, "panels", "ch1-p1-01.json"),
    JSON.stringify({ id: "ch1-p1-01", shapes: [], cast: [] }),
  );
});

afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe("loadBook", () => {
  it("载入剧本、已画的格、角色", async () => {
    const book = await loadBook(bookDir, charsDir);
    expect(book.script.title).toBe("T");
    expect(book.panels.size).toBe(1);
    expect(book.characters.get("dog-man")?.name).toBe("Dog Man");
  });

  it("忽略未作画的格，不报错", async () => {
    const book = await loadBook(bookDir, charsDir);
    expect(book.panels.has("ch1-p1-02")).toBe(false);
  });

  it("非法 JSON 报错时带上文件路径", async () => {
    const bad = join(bookDir, "panels", "ch1-p1-09.json");
    await writeFile(bad, JSON.stringify({ id: "ch1-p1-09", shapes: [{ t: "gradient" }], cast: [] }));
    await expect(loadBook(bookDir, charsDir)).rejects.toThrow(/ch1-p1-09\.json/);
    await rm(bad);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL — `Cannot find module '../src/load.js'`

- [ ] **Step 3: 写 src/load.ts**

```ts
import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { z } from "zod";
import { ScriptSchema, PanelSchema, CharacterSchema, type Panel, type Character } from "./schema.js";
import type { BookData } from "./build.js";

export function formatZodError(filePath: string, error: z.ZodError): string {
  const lines = error.issues.map((i) => `  · ${i.path.join(".") || "(根)"}：${i.message}`);
  return `${filePath} 不合法：\n${lines.join("\n")}`;
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${filePath} 不是合法 JSON：${(e as Error).message}`);
  }
}

async function parseFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const data = await readJson(filePath);
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(formatZodError(filePath, result.error));
  return result.data;
}

async function listJson(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith(".json")).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function loadBook(bookDir: string, charactersDir: string): Promise<BookData> {
  const script = await parseFile(join(bookDir, "script.json"), ScriptSchema);

  const characters = new Map<string, Character>();
  for (const file of await listJson(charactersDir)) {
    const character = await parseFile(join(charactersDir, file), CharacterSchema);
    characters.set(character.id, character);
  }

  const panelsDir = join(bookDir, "panels");
  const panels = new Map<string, Panel>();
  for (const file of await listJson(panelsDir)) {
    const panel = await parseFile(join(panelsDir, file), PanelSchema);
    if (panel.id !== basename(file, ".json")) {
      throw new Error(`${join(panelsDir, file)} 的 id "${panel.id}" 与文件名不符`);
    }
    panels.set(panel.id, panel);
  }

  return { script, panels, characters };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/load.test.ts`
Expected: PASS

- [ ] **Step 5: 写 src/cli.ts**

```ts
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadBook } from "./load.js";
import { buildHtml } from "./build.js";

const CHARACTERS_DIR = resolve("comics/characters");

function usage(): never {
  console.error(`用法:
  tsx src/cli.ts build <book-dir>   重建 index.html
  tsx src/cli.ts check <book-dir>   只校验，不写文件`);
  process.exit(2);
}

async function main() {
  const [command, target] = process.argv.slice(2);
  if (!command || !target) usage();

  const bookDir = resolve(target);

  if (command === "check") {
    const book = await loadBook(bookDir, CHARACTERS_DIR);
    const total = book.script.chapters.flatMap((c) => c.pages).flatMap((p) => p.panels).length;
    console.log(`✓ 校验通过：${total} 格，已作画 ${book.panels.size} 格，角色 ${book.characters.size} 个`);
    return;
  }

  if (command === "build") {
    const book = await loadBook(bookDir, CHARACTERS_DIR);
    const out = join(bookDir, "index.html");
    await writeFile(out, buildHtml(book), "utf8");
    console.log(`✓ 已生成 ${out}（已作画 ${book.panels.size} 格）`);
    return;
  }

  usage();
}

main().catch((e: unknown) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
```

- [ ] **Step 6: 手动验证 CLI 的错误提示可读**

```bash
npx tsx src/cli.ts
npx tsx src/cli.ts build /tmp/does-not-exist
```

Expected: 第一条打印用法并退出码 2；第二条打印 `✗ ...script.json...` 且退出码 1。**错误信息必须一眼看懂是哪个文件出了什么问题**——看不懂就改。

- [ ] **Step 7: 提交**

```bash
git add src/load.ts src/cli.ts tests/load.test.ts
git commit -m "feat: 文件加载与 CLI —— build / check 两个命令"
```

---

### Task 6: 端到端 —— 一本能读的迷你书

**Files:**
- Create: `comics/characters/dog-man.md`, `comics/characters/dog-man.json`
- Create: `comics/books/00-hello/script.json`
- Create: `comics/books/00-hello/panels/ch1-p1-01.json`
- Create: `comics/history.md`
- Modify: `CLAUDE.md`（修坏链接）

**Interfaces:**
- Consumes: CLI（Task 5）
- Produces: 一个真实可读的 `comics/books/00-hello/index.html`，作为后续开发的参照样例

这个 task 第一次把整条链跑通，也是**唯一能验证画风约束真的管用**的地方。

- [ ] **Step 1: 造角色 —— 严格遵守 comic.md**

先读 [`comic.md`](../../../comic.md)，然后创建 `comics/characters/dog-man.json`。四个姿势，**每个 ≤12 个图形**，只用调色板颜色，viewBox `[0, 0, 100, 150]`。

造型指引（来自 `comic.md` 第 4 节）：头大身小约 1:1.5；眼睛是两个黑圆点；靠标志物区分（金色警徽、蓝色制服、棕色垂耳）。

`idle` 姿势参考骨架（其余三个姿势改眼睛和嘴即可）：

```json
{
  "id": "dog-man",
  "name": "Dog Man",
  "viewBox": [0, 0, 100, 150],
  "poses": {
    "idle": [
      { "t": "rect", "x": 25, "y": 70, "w": 50, "h": 60, "r": 6, "fill": "blue" },
      { "t": "circle", "cx": 50, "cy": 38, "r": 30, "fill": "beige" },
      { "t": "ellipse", "cx": 22, "cy": 40, "rx": 10, "ry": 20, "fill": "beige" },
      { "t": "ellipse", "cx": 78, "cy": 40, "rx": 10, "ry": 20, "fill": "beige" },
      { "t": "circle", "cx": 40, "cy": 34, "r": 4, "fill": "black" },
      { "t": "circle", "cx": 60, "cy": 34, "r": 4, "fill": "black" },
      { "t": "circle", "cx": 50, "cy": 48, "r": 5, "fill": "black" },
      { "t": "circle", "cx": 34, "cy": 84, "r": 6, "fill": "yellow" },
      { "t": "line", "x1": 30, "y1": 130, "x2": 30, "y2": 148 },
      { "t": "line", "x1": 70, "y1": 130, "x2": 70, "y2": 148 }
    ],
    "happy": [],
    "shocked": [],
    "angry": []
  }
}
```

同时写 `comics/characters/dog-man.md`（性格、口头禅、关系、标志物）和一个空的 `comics/history.md`。

- [ ] **Step 2: 写一个最小合法剧本**

创建 `comics/books/00-hello/script.json`。schema 要求 4–5 章、每章 4–5 页、每页格数匹配版式，所以这本"迷你书"仍需 4 章 × 4 页 × 4 格 = 64 格的**剧本条目**——但只画其中一格，其余显示占位。这正好验证"未作画的格不崩溃"。

内容随意（`description` 写 `"placeholder"` 即可），但必须合法。

- [ ] **Step 3: 校验剧本**

Run: `npx tsx src/cli.ts check comics/books/00-hello`
Expected: `✓ 校验通过：64 格，已作画 0 格，角色 1 个`

若报错，按提示改到通过。**这一步是在验证 schema 的错误信息够不够好用**——看不懂就回头改 `formatZodError`。

- [ ] **Step 4: 画第一格**

创建 `comics/books/00-hello/panels/ch1-p1-01.json`，≤20 个图形、≤3 个角色：

```json
{
  "id": "ch1-p1-01",
  "shapes": [
    { "t": "line", "x1": 0, "y1": 250, "x2": 400, "y2": 250 },
    { "t": "circle", "cx": 350, "cy": 50, "r": 30, "fill": "yellow" }
  ],
  "cast": [{ "id": "dog-man", "pose": "idle", "x": 150, "y": 90, "scale": 1 }]
}
```

- [ ] **Step 5: 构建并在浏览器里看**

```bash
npx tsx src/cli.ts build comics/books/00-hello
open comics/books/00-hello/index.html
```

**逐条肉眼验收**（对应设计文档第 13 节）：

- [ ] 页面不是空白（证明没有踩 `file://` 的 CORS 坑）
- [ ] 第一格画出了狗狗警长，线条是粗黑的
- [ ] 其余 63 格显示"还没画"占位，页面没崩
- [ ] 分格是 2×2 网格
- [ ] 按左右方向键能翻页

- [ ] **Step 6: 验证 schema 真的拦得住违规**

临时把 `panels/ch1-p1-01.json` 里的 `"fill": "yellow"` 改成 `"fill": "#FFFF00"`，然后：

Run: `npx tsx src/cli.ts check comics/books/00-hello`
Expected: 失败，错误信息指出 `ch1-p1-01.json` 和具体字段

改回来。**这一步不能跳过**——它是整个方案"让违规不可表达"这个核心主张的唯一实证。

- [ ] **Step 7: 修 CLAUDE.md 的坏链接**

`CLAUDE.md` 里写的是 `karpathy_coding_rule.md`，实际文件名是 `karpathy_code_rule.md`。改成正确的。

- [ ] **Step 8: 全量测试 + 提交**

```bash
npx vitest run
git add comics/ CLAUDE.md
git commit -m "feat: 端到端样例书 + 修正 CLAUDE.md 坏链接"
```

---

### Task 7: Claude Code skill

**Files:**
- Create: `.claude/skills/comic/SKILL.md`

**Interfaces:**
- Consumes: CLI（Task 5）、`comic.md`、样例书（Task 6）
- Produces: `/comic` 技能，四个动作 `new` / `character` / `draw` / `read`

代码到 Task 6 就完整了；这个 task 写的是**驱动 Claude 的指令**——系统真正的"大脑"。

- [ ] **Step 1: 写 .claude/skills/comic/SKILL.md**

````markdown
---
name: comic
description: 儿童漫画创作系统。当用户要开新漫画、造角色、画某一章、或阅读成书时使用。支持 new / character / draw / read 四个动作。
---

# 漫画创作

**开工前必须先读 [`comic.md`](../../../comic.md)** —— 它是画风的硬约束，不是建议。

数据都在 `comics/` 下：`characters/`（跨书共享的角色库）、`books/<n>-<slug>/`（每本书）、`history.md`（连载记忆）。

---

## /comic new —— 开新书

1. 读 `comics/history.md` 和 `comics/characters/*.md`，**带着记忆开口**
   （例：「上次猫咪坏蛋挖地道跑了。这本想让谁出场？」）
2. 问三个问题，一次问一个：
   - **角色** —— 列出已有角色让他挑，也可以说要新的（要新的就转 `/comic character`）
   - **故事** —— 一句话就够
   - **气氛** —— 搞笑 / 冒险 / 温馨 / 有点吓人。**不要问画风**，画风是固定的
3. 生成 4–5 章大纲，**用大白话讲给小朋友听**，不要给他看 JSON
4. 他确认或修改后，展开成 `script.json`
5. 运行 `npx tsx src/cli.ts check comics/books/<slug>` 直到通过

**写剧本时的约束：**
- 每章 4–5 页，每页格数必须与 `layout` 匹配（`2x2`=4、`1-2-2`=5、`2x3`=6 等）
- `description` 只写画面，**绝不含台词文字**
- 台词单个气泡 ≤12 个单词，全大写，口语化
- **只写画得出来的动作** —— 角色只有 4 个姿势，复杂动作靠速度线等符号表达。
  想不出怎么画的情节，改情节，不要硬写

## /comic character —— 造新角色

1. 追问：叫什么名字？好人还是坏人？有什么特别的？
2. 写 `comics/characters/<id>.md`（性格、口头禅、关系、标志物）
3. **先只画 `idle` 一个姿势**，构建后给他看：「像你想的吗？」
4. 像 → 补齐 `happy` / `shocked` / `angry`；不像 → 改了重来

每个姿势 ≤12 个图形。靠**颜色 + 一两个标志物**区分角色，不靠脸型细节。

## /comic draw [章号] —— 画一章

1. 读 `script.json`，找出该章**尚未存在**的 panel JSON
   （已存在的**一律跳过** —— 可能是小朋友喜欢的，或家长手改过的）
2. 逐格产出 `panels/<id>.json`：`shapes` ≤20 个，`cast` ≤3 个
3. 全部画完后运行 `npx tsx src/cli.ts build comics/books/<slug>`
4. 告诉用户画了几格、跳过几格

不写章号则画下一个未完成的章。

## /comic read —— 阅读

```bash
open comics/books/<slug>/index.html
```

## 完本时

往 `comics/history.md` 追加一段：这本书叫什么、发生了什么、角色有什么变化、留了什么悬念。**下次开新书时这段就是记忆。**

---

## 常见错误

| 症状 | 原因 |
|---|---|
| `check` 报格数不符 | 页面的 `layout` 与 `panels` 数量不匹配 |
| `check` 报 fill 非法 | 用了色值而不是颜色名（只能写 `red`，不能写 `#E63946`） |
| `check` 报多余字段 | 试图自己写 `stroke-width` —— 描边由渲染器统一施加，不要碰 |
| 渲染报"未知角色" | `cast` 里的 id 在 `comics/characters/` 下没有对应文件 |
````

- [ ] **Step 2: 实测技能触发与执行**

在新的 Claude Code 会话里运行 `/comic read`，确认它能找到并打开样例书。

若技能没被识别，检查 `.claude/skills/comic/SKILL.md` 的 frontmatter 格式和文件位置。**这一步是实测，不要假设格式正确。**

- [ ] **Step 3: 提交**

```bash
git add .claude/
git commit -m "feat: /comic 技能 —— new / character / draw / read"
```

---

## 完成标志

全部 7 个 task 完成后应满足（对应设计文档第 13 节验收标准）：

1. `npx vitest run` 全绿
2. `check` 能拒绝超预算的角色姿势并指出是哪个姿势 —— Task 2 测试覆盖
3. `check` 能拒绝非法颜色 —— Task 6 Step 6 实证
4. 样例书 `index.html` 在浏览器里能读，未作画的格显示占位不崩溃 —— Task 6 Step 5
5. `/comic` 技能在新会话中可被触发 —— Task 7 Step 2

**尚未验证、需要真人参与的两条**（不在本计划范围，但是项目真正的成败判据）：

- **打印一格给小朋友，让他 2 分钟内照着画完** —— 画不完说明画复杂了，收紧 `comic.md` 重来
- **他愿不愿意接着往下创作** —— 这是设计文档第 14 节里唯一真正的产品风险，只能靠给他看真东西来验证
