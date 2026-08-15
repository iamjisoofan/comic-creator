# wiki.md — codebase 知识

> 结构、模块、接口、怎么运行/测试、易踩的坑。设计理由见 [`project.md`](./project.md)。

## 怎么跑

```bash
npm test                 # vitest run，7 个测试文件
npm run typecheck        # tsc --noEmit —— tsx 只运行不查类型，这一步不能省
npx tsx src/cli.ts check <book-dir>    # 只校验，不写文件
npx tsx src/cli.ts build <book-dir>    # 重建 <book-dir>/index.html
```

`<book-dir>` 可以是任意路径（相对 cwd 解析）。**角色库不跟 cwd 走**：它固定是仓库里的 `comics/characters/`，由 `src/cli.ts` 从模块位置推导。

退出码：`0` 成功 / `1` 校验或渲染失败（stderr 打 `✗ 原因`）/ `2` 参数不对（打用法）。

环境：Node 22 LTS+（`package.json` 的 `engines`）。依赖只有 `zod`（运行时）和 `tsx` / `vitest` / `typescript` / `@types/node`（开发）。

## 目录

```
src/
  palette.ts   调色板、描边常量、画布尺寸（400×300）
  layout.ts    3 种版式 → CSS Grid（columns / rows / areas），只有格子全等的版式
  schema.ts    Zod 定义：shape / character / panel / script，外加 BookData 接口
  render.ts    renderPanelSvg()：panel JSON + 角色库 → SVG 字符串
  load.ts      loadBook()：读盘 + 校验 + 跨文件核对
  build.ts     buildHtml()：整本书 → 单个自包含 HTML
  cli.ts       命令行入口
tests/         每个模块一个 + cli.test.ts（子进程跑真 CLI）+ smoke.test.ts（跑真示例数据）
comics/        characters/（跨书角色库）、books/<dir>/（script.json + panels/ + index.html）
comic.md       绘画运行时契约（作画前必读）
.claude/skills/comic/SKILL.md   驱动 Claude 的流程说明
```

依赖方向是单向的：`palette → layout → schema → render → build → cli`，`load` 只依赖 `schema`。
**`BookData` 住在 `schema.ts`**，不在 `build.ts`——将来网页创作台要复用 `render.ts` + `schema.ts`，不能把 HTML 生成器拖进类型图。

## 关键接口

```ts
renderPanelSvg(panel: Panel, characters: Map<string, Character>): string
```
系统枢纽，将来原样搬进浏览器。吃的是**一整格**，不是单个姿势——想预览一个姿势，把它包进一个用完即扔的 panel（`cast: [{ id, pose, x, y, scale }]`）。未知角色 id 直接抛错。

```ts
loadBook(bookDir: string, charactersDir: string): Promise<BookData>
```
读 `script.json` + `characters/*.json` + `panels/*.json`，逐个过 Zod，然后做三项**跨文件**核对：

1. 角色库空或不存在 → 报错（一本没有角色的书不是真实状态）
2. panel 的 `cast[].id` 必须在角色库里
3. panel 的 `id`（= 文件名）必须出现在 `script.json` 里 —— 否则是**孤儿格**，永远不会被渲染，却会把"已作画 N 格"顶高

所以 **`check` 通过就意味着 `build` 会成功**。`panels/` 目录不存在是合法的（新书第一天），当作一格没画。

```ts
buildHtml(book: BookData): string
bubbleSide(speaker, index, drawn, characters): "left" | "right"
```

## 页面排版（改 CSS 前先读）

- 每页是一个 CSS Grid，列和行都是 `1fr`，加上两条写在行内样式里的关键属性：
  `aspect-ratio: 列×4 / 行×3` 和 `width: min(100%, calc(var(--page-fit) * 列×4 / 行×3))`。
  前者让页面按版式定形（格子全等 + 每格 4:3，比例才这么算），后者把页高封顶在
  `--page-fit`（`:root` 里 = 92vh），于是浏览器自己把整页等比缩进一屏。
- **页高本来就不等，别去追等高。** 目标是"按一次方向键正好翻过一整页"，不是像素等高；
  等高 + 满格 + 不同行列数三者不可能同时成立，理由见 `project.md`。
- 画面 SVG `width:100% height:100%`，**不写 `preserveAspectRatio`**：格子已经是 4:3，
  默认的 `meet` 不会留出可见白边。写死 `--row` 行高 + `meet` 是上一版的做法，
  会让每一格都变成信箱条（实测留白 30%/66%），别改回去。
- 实测（Chrome headless 1280×800，900px 书宽）：`2x2` 852×639、`2x3` 654×736、
  `3x2` 852×426，都不超视口；格子分别是 408×301 / 309×229 / 268×195，残留留白 1.9%–4.7%。
  改 `--page-fit`、`--gap` 或书宽之后**要重新量**（浏览器实测，别推）。
- 气泡：第一条贴上沿、第二条贴下沿（schema 限死最多 2 条）；左右由 `speaker` 在画面里的横向位置决定，尾巴同侧。
- **上沿是三样东西抢地方：旁白（左上）、拟声词（右上）、上沿气泡。**
  有旁白的格子带 `captioned`，有拟声词的带 `sfxed`，上沿气泡分别下移 44px / 64px 让开。
  两条规则特异性相同（都是 3 个类），靠**书写顺序**让 `.sfxed` 赢，两样都有时取大的那个——
  调整时别把 `.sfxed` 那行挪到 `.captioned` 前面。64px 是量出来的：拟声词 30px 字号
  加 ±15° 倾斜，最长的 `WHOOSH!` 外接框底边离格子上沿 62px。

## 易踩的坑

- **描边宽 6，沿轮廓内外各压 3。** 填色图形半径 < 8 会被黑边吃光（`r:6` 的圆渲染出来就是个黑点）。第一版的金色警徽就这么消失过。眼睛瞳孔这类本来就是黑点的除外。
- **`index.html` 绝不能用 `fetch()` 读本地 JSON** —— `file://` 下被 CORS 拦死，页面一片空白。所有数据和 SVG 必须内联。有一条测试守着这件事。
- **成品里的文字必须是英文**（占位符也算），成品是要发给爷爷奶奶的。
- **`check` 全绿不等于画得对。** 造完角色一定要渲图看：`qlmanage -t -s 800 -o <outdir> <file.svg>` 转 PNG 再用 Read 工具看。垂耳画得跟头等高会变成一副耳罩，`angry` 的填色三角形会胀成脸上一个叉——这两个都是测试全过、人一看就发现的问题。
- **改 `comic.md` 时注意别说谎**：只有 schema 真拦得住的规则才能写"超了会拒绝"。管不住的（背景元素个数、细节层、透视、光影）归第 3 节。
- 一页的格数必须与 `layout` 匹配（`2x2`=4、`2x3`=6、`3x2`=6），`ScriptPageSchema` 的 `superRefine` 会查。**只有这三种版式**，`LayoutSchema` 从 `LAYOUT_SPECS` 的键推导，加减版式只改 `layout.ts` 一处。
- `tsx` 不做类型检查。提交前 `npm test` **和** `npm run typecheck` 都要绿。
