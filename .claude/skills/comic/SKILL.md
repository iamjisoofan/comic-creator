---
name: comic
description: 儿童漫画创作系统。当用户要开新漫画、造角色、画某一章、或阅读成书时使用。支持 new / character / draw / read 四个动作。
---

# 漫画创作

**开工前必须先读 [`comic.md`](../../../comic.md)** —— 它是画风的硬约束，不是建议。

数据都在 `comics/` 下：`characters/`（跨书共享的角色库）、`books/<n>-<slug>/`（每本书）、`history.md`（连载记忆）。已经有一个跑通的完整例子可以参考：角色 `comics/characters/dog-man.json`（+ 同名 `.md`）和书 `comics/books/00-hello/`。拿不准某个文件该长什么样时，去看这两个例子，比猜格式靠谱。

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
- 每个 panel 的 `cast` 在 `script.json` 里只是**角色 id 字符串数组**（如 `["dog-man"]`），不带姿势和坐标——那些是 `/comic draw` 阶段才决定、写进 panel 作画文件的事，参考 `comics/books/00-hello/script.json`

## /comic character —— 造新角色

1. 追问：叫什么名字？好人还是坏人？有什么特别的？
2. 写 `comics/characters/<id>.md`（性格、口头禅、关系、标志物）和 `comics/characters/<id>.json`（`viewBox` 固定 `[0, 0, 100, 150]`，四个姿势 `idle`/`happy`/`shocked`/`angry`）
3. **先只画 `idle` 一个姿势。** 通过 `check` 只说明它合乎 schema，**不说明画得对不对**——这一步必须亲眼看图：
   - 写一个用完即删的小脚本（放 scratchpad，不进仓库），调用 `src/render.ts` 的 `renderPanelSvg`，把这个 `idle` 姿势渲成一个独立 `.svg` 文件
   - 用 `qlmanage -t -s 800 -o <outdir> <file.svg>` 把它转成 PNG，读图检查：标志物有没有被描边吃掉？五官会不会糊成一坨？整体认得出画的是谁吗？
   - Task 6 就是这样抓出三个 assertion 完全测不出来的问题：警徽因为半径太小被描边吃得只剩一个点、垂耳画得太靠上像耳机、`shocked` 两只眼睛的描边挨在一起糊成了一条黑杠。**光靠 `check` 通过是发现不了这些的。**
   - 自己确认没问题后，再把结果讲给孩子听，问他「像你想的吗？」
4. 像 → 补齐 `happy` / `shocked` / `angry`（同样各看一遍图）；不像 → 改了重来

每个姿势 ≤12 个图形。靠**颜色 + 一两个标志物**区分角色，不靠脸型细节。**任何填色图形半径要 ≥8**（矩形最短边 ≥16）——描边宽 6，往内吃掉一半，画小了会直接被吃没，参考 `comic.md` 第 2 节。

## /comic draw [章号] —— 画一章

1. 读 `script.json`，找出该章**尚未存在**的 panel JSON
   （已存在的**一律跳过** —— 可能是小朋友喜欢的，或家长手改过的）
2. 逐格产出 `panels/<id>.json`：`shapes` ≤20 个，`cast` ≤3 个，格式参考 `comics/books/00-hello/panels/ch1-p1-01.json`。
   注意这里的 `cast` 和 `script.json` 里的不是一回事——是对象数组 `{id, pose, x, y, scale}`，姿势和位置都在这里定，不在 script 里。
   **画之前确认 `cast` 里每个 id 在 `comics/characters/` 下真的有对应文件**——`check` 不会替你查这个（见下方"常见错误"），等 `build` 才会报错
3. 全部画完后运行 `npx tsx src/cli.ts build comics/books/<slug>`
4. 告诉用户画了几格、跳过几格

不写章号则画下一个未完成的章。

## /comic read —— 阅读

```bash
npx tsx src/cli.ts build comics/books/<slug>   # index.html 是生成物，不进仓库，读之前先保证它是最新的
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
| `build` 报 `未知角色 "X"（出现在画面 Y）`，但 `check` 明明通过了 | `check` 只逐个校验单个文件是否合乎 schema，**不会跨文件核对 `cast` 里的角色 id 是否在 `comics/characters/` 下真的有文件**。id 写错、或者角色还没造，`check` 照样过，等 `build` 真正渲染这一格时才会炸。`check` 通过不等于 `build` 会成功——画完一格前自己确认一下角色文件存在 |

