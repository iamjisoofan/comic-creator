---
name: comic
description: 儿童漫画创作系统。当用户要开新漫画、造角色、画某一章、或阅读成书时使用。支持 new / character / draw / read 四个动作。
---

# 漫画创作

**开工前必须先读 [`comic.md`](../../../comic.md)** —— 它是画风的硬约束，不是建议。

数据都在 `comics/` 下：`characters/`（跨书共享的角色库）、`books/<book-dir>/`（每本书）、`history.md`（连载记忆）。

**书目录怎么命名**：`comics/books/<两位序号>-<英文小写连字符书名>`，序号按现有目录顺延（已有 `00-hello`，下一本就是 `01-`）。例：《The Lost Bone》→ `comics/books/01-the-lost-bone/`。下文所有 `<book-dir>` 都指这个目录名（如 `01-the-lost-bone`），命令里写全 `comics/books/01-the-lost-bone`。目录由你新建，里面放 `book.md`（书名+大纲）、`script.json`、`panels/`。

已经有一个跑通的完整例子可以参考：角色 `comics/characters/dog-man.json`（+ 同名 `.md`）和书 `comics/books/00-hello/`。拿不准某个文件该长什么样时，去看这两个例子，比猜格式靠谱。

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
5. 运行 `npx tsx src/cli.ts check comics/books/<book-dir>` 直到通过

**写剧本时的约束：**
- 每章 4–5 页，**只有三种 `layout`，格数必须对上**：

  | layout | 格数 | 什么时候用 |
  |---|---|---|
  | `2x2` | 4 | 默认。格子最大，画面最清楚 |
  | `2x3` | 6 | 一页要讲的事多（追逐、来回对话） |
  | `3x2` | 6 | 快节奏的连续小动作（一步、一步、一步） |

  没有通栏格：一格画面是固定 4:3，通栏格要么撑高页面要么留白，所以删掉了。
  `3x2` 的格子最小（约 268×195），`2x3` 次之。**别在这两种页上写长台词**——
  两句 10 词以上的台词加一个拟声词就摆不下；长旁白（`THE NEXT DAY...`）配长拟声词
  （`WHOOSH!`）也会在上沿挨上。台词长的戏放 `2x2`。
- `description` 只写画面，**绝不含台词文字**
- 台词单个气泡 ≤12 个单词，全大写，口语化；**一格最多 2 个气泡**（schema 强制），说不完就拆成两格
- **只写画得出来的动作** —— 角色只有 4 个姿势，复杂动作靠速度线等符号表达。
  想不出怎么画的情节，改情节，不要硬写
- 每个 panel 的 `cast` 在 `script.json` 里只是**角色 id 字符串数组**（如 `["dog-man"]`），不带姿势和坐标——那些是 `/comic draw` 阶段才决定、写进 panel 作画文件的事，参考 `comics/books/00-hello/script.json`

## /comic character —— 造新角色

1. 追问：叫什么名字？好人还是坏人？有什么特别的？
2. 写 `comics/characters/<id>.md`（性格、口头禅、关系、标志物）和 `comics/characters/<id>.json`（`viewBox` 固定 `[0, 0, 100, 150]`，四个姿势 `idle`/`happy`/`shocked`/`angry`）
3. **先只画 `idle` 一个姿势。** 通过 `check` 只说明它合乎 schema，**不说明画得对不对**——这一步必须亲眼看图：
   - 写一个用完即删的小脚本（放 scratchpad，不进仓库），调用 `src/render.ts` 的 `renderPanelSvg`，把这个 `idle` 姿势渲成一个独立 `.svg` 文件。
     `renderPanelSvg(panel, characters)` 吃的是**一整格**，不是单个姿势，所以要**把姿势包进一个用完即扔的 panel**：

     ```ts
     const panel = PanelSchema.parse({
       id: "preview", shapes: [],
       cast: [{ id: "<角色 id>", pose: "idle", x: 150, y: 60, scale: 1.2 }],
     });
     writeFileSync("preview.svg", renderPanelSvg(panel, new Map([[character.id, character]])));
     ```
   - 用 `qlmanage -t -s 800 -o <outdir> <file.svg>` 把它转成 PNG，读图检查：标志物有没有被描边吃掉？五官会不会糊成一坨？整体认得出画的是谁吗？
   - 这一步抓过四个 assertion 完全测不出来的问题：警徽因为半径太小被描边吃得只剩一个点、`shocked` 两只眼睛的描边挨在一起糊成一条黑杠、垂耳画得跟头等高变成**一副耳罩**（这个一直漏到最终评审才被发现——`check` 全绿、测试全过，就是看不出是狗）、`angry` 的黑三角眉毛胀成脸上一个叉。**光靠 `check` 通过是发现不了这些的，必须看图。**
   - 自己确认没问题后，再把结果讲给孩子听，问他「像你想的吗？」
4. 像 → 补齐 `happy` / `shocked` / `angry`（同样各看一遍图）；不像 → 改了重来

每个姿势 ≤12 个图形。靠**颜色 + 一两个标志物**区分角色，不靠脸型细节。**任何填色图形半径要 ≥8**（矩形最短边 ≥16）——描边宽 6，往内吃掉一半，画小了会直接被吃没，参考 `comic.md` 第 2 节。

## /comic draw [章号] —— 画一章

1. 读 `script.json`，找出该章**尚未存在**的 panel JSON
   （已存在的**一律跳过** —— 可能是小朋友喜欢的，或家长手改过的）
2. 逐格产出 `panels/<id>.json`：`shapes` ≤20 个，`cast` ≤3 个，格式参考 `comics/books/00-hello/panels/ch1-p1-01.json`。
   注意这里的 `cast` 和 `script.json` 里的不是一回事——是对象数组 `{id, pose, x, y, scale}`，姿势和位置都在这里定，不在 script 里。
   **文件名必须等于 `script.json` 里的 `id`**，`cast` 里的角色也必须在 `comics/characters/` 下真的有文件——这两条 `check` 现在都会替你核对，写错会当场报错（不再拖到 `build`）
3. 全部画完后运行 `npx tsx src/cli.ts build comics/books/<book-dir>`
4. 告诉用户画了几格、跳过几格。`build` 会打印 `已作画 M/N 格`，M=N 就是这本书画完了

不写章号则画下一个未完成的章。

## /comic read —— 阅读

```bash
npx tsx src/cli.ts build comics/books/<book-dir>   # index.html 是生成物，不进仓库，读之前先保证它是最新的
open comics/books/<book-dir>/index.html
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
| `check` 报 `用了未知角色 "X"` | panel 的 `cast` 里写了角色库里没有的 id（拼错，或者角色还没造）。`check` 会跨文件核对，所以这个错在作画阶段就会被拦下 |
| `check` 报 `不在 script.json 的任何一页里` | panel 文件名（= `id`）在剧本里找不到，多半是文件名打错了。这种"孤儿格"永远不会被渲染，所以宁可报错也不放行 |
| `check` 报 `角色库 ... 不存在或没有任何 .json` | 角色库空的或路径不对。先 `/comic character` 造角色 |
| `check` 报 `最多 2 个气泡` | 一格写了三句台词。拆成两格 |

