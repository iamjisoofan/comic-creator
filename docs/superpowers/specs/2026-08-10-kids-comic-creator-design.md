# 儿童漫画创作系统 — 设计文档

日期：2026-08-10
状态：已确认，待实施

---

## 1. 这是什么

一个让 9 岁小朋友当"作者"的漫画创作系统。他提供角色和故事想法，系统把它变成一本 Dog Man 风格的彩色漫画书，可以在浏览器里读。

**核心目标不是产出漫画，是让他体验"我创作了一本书"。** 因此系统必须让他拥有自己的角色库和连载历史——这些数据属于他，跨书累积。

副作用目标：漫画画法足够简单，他想照着画在纸上时画得出来。

## 2. 关键决策与理由

| 决策 | 选择 | 理由 |
|---|---|---|
| 出图方案 | 本地 Draw Things (SDXL) | 无限免费出图，才敢反复迭代重画；云 API 按张计费会让人舍不得改 |
| 硬件 | M4 Mac mini / 16GB | SDXL 约 25s/张可接受；Flux 会 swap，放弃；本地训 LoRA 不现实，放弃 |
| 角色一致性 | 文字锚点 + IPAdapter 参考图 | 16GB 训不了 LoRA；双锚点已足够，尤其 Dog Man 造型极简 |
| 画风 | 固定 Dog Man 风格，不每本重选 | 系统的视觉身份；且 9 岁说不清"画风"但说得清"要好笑的" |
| 文字渲染 | SD 不画字，文字由 SVG 叠加 | SD 画不出可读文字；分层顺带解决改台词不用重画 |
| 流水线 | 先出剧本（快、可改），再后台按章渲染 | 把便宜的决策和昂贵的执行分开，让作者在最便宜时行使创作权 |
| 入口 | Claude Code skill（家长代为输入） | 9 岁用不了终端；先验证玩法，接口留干净，之后再做网页创作台 |
| 存储 | 纯文件，无服务无数据库 | 大人能随时手动兜底改任何一句台词 |
| 语言 | 英文 | 用户指定 |
| 成品 | 彩色 | 用户指定；线稿导出不做 |

## 3. 规模

- 一本书 4–5 章
- 一章 4–5 页
- 一页 4–6 格
- **合计约 64–150 格**，本地渲染约 27–62 分钟

这个规模决定了两件事：必须先有全书大纲（不能靠单次 prompt 生成长篇），以及必须按章渲染 + 断点续渲（不能让人干等一小时）。

## 4. 文件结构

系统没有服务、没有数据库，所有状态都是可直接打开的纯文本和图片。

```
comics/
  characters/                 # 角色库 —— 跨书共享，小朋友的资产
    dog-man.md                #   性格、口头禅、关系、外貌锚点
    dog-man.png               #   定妆图，IPAdapter 参考
  books/
    01-the-lost-bone/
      book.md                 #   书名 + 大纲 + 每章一句话
      script.json             #   全书分镜
      panels/                 #   ch1-p1-01.png ... 彩色成品图
      index.html              #   双击即读的成书（自包含）
  history.md                  # 连载记忆：出过哪些书、角色经历了什么
```

设计要点：

- **角色库独立于书**：同一角色能出现在第 1 本和第 5 本。这个目录就是他攒下的家当。
- **每本书自包含**：整个文件夹可拷贝、可删除，没有隐藏状态。
- **`history.md` 是 AI 的长期记忆**：开新书前先读，所以 AI 记得上一本发生了什么，连载感来源于此。

## 5. 角色机制

一个角色 = 一个 md + 一张定妆图，分别解决两个不同问题。

`characters/dog-man.md`：

```markdown
# 狗狗警长 (Dog Man)

## 故事设定          ← 给写剧本的 Claude 读
性格：勇敢但笨笨的，容易分心，闻到骨头走不动路
口头禅：「汪！交给我！」
关系：猫咪坏蛋是死对头 / 小机器人是好朋友
经历：第1本学会开警车，第2本怕水

## 外貌锚点          ← 给出图的 Draw Things 读
appearance: a dog head on a police officer body, brown floppy ears,
big round black eyes, blue police uniform, gold badge, red tongue out
```

**双锚点缺一不可：**

- **文字锚点**（`appearance`）原样拼进每一格的出图 prompt。第 1 格和第 137 格用同一串字，基础特征不漂。
- **图片锚点**（定妆图）作为 IPAdapter 参考，锁住说不清的东西——脸的比例、线条手感。

只有文字锚点，画到第 50 格会慢慢变成另一只狗；只有图片锚点，换角度就崩。

**新角色诞生流程**：小朋友描述 → AI 追问（名字/好坏/特点）→ 写 md → **先只出一张定妆图确认**（25 秒）→ 像则入库，不像则改。这一步决定后面 100 格长什么样，值得单独卡一次。

## 6. 剧本阶段

### 第一步：大纲（给人看）

AI 先读 `history.md` 和 `characters/`，带着记忆开口问三个问题：

1. **角色** —— 列出已有角色让他挑，也可以说要新的
2. **故事** —— 一句话也行（"狗狗的骨头被偷了"）
3. **气氛** —— 搞笑 / 冒险 / 温馨 / 有点吓人（**不问画风**）

然后生成 4–5 章骨架，**用大白话讲给小朋友听**（不给他看 JSON），他确认或修改。这是他行使作者权最便宜也最有效的时刻，必须过这一关。

### 第二步：分镜（给机器看）

大纲敲定后展开成 `script.json`。这一步不需要小朋友确认（100 格他看不完），家长可扫一眼。

```json
{
  "title": "The Lost Bone",
  "tone": "funny",
  "characters": ["dog-man", "robo-buddy"],
  "chapters": [
    {
      "number": 1,
      "title": "Where's My Bone?!",
      "pages": [
        {
          "number": 1,
          "layout": "2x2",
          "panels": [
            {
              "id": "ch1-p1-01",
              "shot": "wide",
              "description": "Dog Man sleeping in bed, big bone under the bed, morning sun through window",
              "characters": ["dog-man"],
              "dialogue": [],
              "sfx": "ZZZZZ..."
            },
            {
              "id": "ch1-p1-02",
              "shot": "close-up",
              "description": "Dog Man looking under the bed, shocked face, empty floor",
              "characters": ["dog-man"],
              "dialogue": [{ "speaker": "dog-man", "text": "MY BONE!!" }],
              "sfx": "GASP!"
            }
          ]
        }
      ]
    }
  ]
}
```

字段规则：

- **`description` 只描述画面，绝不含任何文字内容**。它会拼上角色 `appearance` 变成出图 prompt。
- **`dialogue` / `sfx` 不进 SD**，由 `index.html` 用 SVG 叠加。改台词不用重画图。
- **`layout` 用预设值**，覆盖 4–6 格，CSS Grid 实现，不做自由排版：

  | 值 | 格数 | 版式 |
  |---|---|---|
  | `2x2` | 4 | 两行两列 |
  | `1-2-1` | 4 | 通栏 / 两格 / 通栏 |
  | `1-2-2` | 5 | 通栏 / 两格 / 两格 |
  | `2-1-2` | 5 | 两格 / 通栏 / 两格 |
  | `2x3` | 6 | 三行两列 |
  | `3x2` | 6 | 两行三列 |
- **`id` 即文件名**：`ch1-p1-02` → `panels/ch1-p1-02.png`。删掉某张图即可单独重画。

### 修改入口

- **渲染前**：改大纲 → 重新展开分镜。适合"不喜欢这个结局"。
- **渲染后**：直接改 `script.json` 台词 → 刷新网页。零成本，因为字不在图里。

## 7. 渲染阶段

### Prompt 拼接（机械拼接，AI 不参与）

```
[固定风格前缀] + [角色外貌锚点] + [本格 description]
```

- **风格前缀**：`children's comic book style, thick black marker outlines, flat bright colors, simple shapes, crude hand-drawn look`
- **角色锚点**：从本格 `characters` 列出的每个角色的 md 中原样取 `appearance`
- **本格描述**：`script.json` 的 `description`

**负向 prompt 是刚需**：`text, words, letters, speech bubble, signature, watermark`。必须明确禁止 SD 画字，否则画面会被扭曲的假字母毁掉。

**参考图**：本格出现的每个角色的定妆图作为 IPAdapter 输入。

### 调用方式

Draw Things 开启本地 HTTP API server，skill 通过 HTTP POST 调用（A1111 兼容的 `/sdapi/v1/txt2img` 风格接口）。

> **实施第一步必须先实际打一发请求验证接口的确切字段和响应格式**，不凭记忆写死。整个渲染层依赖此接口，假设错了后面全错。

### 断点续渲

渲染前检查目标 png 是否已存在，存在则跳过。这一条代价极小但带来三个能力：

- 渲到第 80 格崩了 → 重跑，前 80 格秒过
- 想重画某一格 → 删掉那一张重跑
- 一次只渲一章 → 天然实现，就是"只有这章的文件不存在"

一章 16–30 格，约 7–12 分钟。

## 8. 成书 `index.html`

一个静态 HTML 文件，双击打开，不需要任何服务。

- **分格**：CSS Grid 按 `layout` 排版，每格一个 `<img>`
- **气泡**：SVG 覆盖在图片上层，白底黑框圆气泡 + 尾巴指向说话者；`sfx` 用歪斜粗体大字模拟手写拟声词
- **翻页**：向下滚动或左右键

> **必须绕开的坑**：`index.html` **不能**用 `fetch()` 读 `script.json`——`file://` 下 fetch 本地 JSON 被 CORS 拦截，页面会一片空白。生成 HTML 时**把数据内联成 `<script>const BOOK = {...}</script>`**。图片用相对路径 `<img src="panels/...">` 不受此限。

结果：`books/01-the-lost-bone/` 整个文件夹自包含，拷到任何电脑双击都能读。

## 9. 命令

| 命令 | 做什么 | 耗时 |
|---|---|---|
| `/comic new` | 读记忆 → 问三问 → 出大纲 → 讲给小朋友 → 确认后展开 `script.json` | 几分钟，全程互动 |
| `/comic character` | 造新角色：追问 → 出定妆图 → 确认入库 | 约 1 分钟 |
| `/comic render [章号]` | 渲染指定章（省略则渲下一个未渲章） | 7–12 分钟，可走开 |
| `/comic read` | 打开 `index.html` | 秒 |

典型流程：`new`（他参与）→ `render 1`（他去玩）→ `read`（他读第 1 章）→ `render 2` → …… 分几天读完，即为连载。

## 10. 失败处理

| 情况 | 处理 |
|---|---|
| Draw Things 未启动 | **立刻明确报错**并说明如何启动。不静默失败、不假装成功。这是最常见错误，必须一眼看懂 |
| 某几格出图失败 | 记录后继续渲剩余格，最后汇总失败清单并提示重跑该章自动补齐。不因 1 格废掉 99 格 |
| 角色画得不像 | 重出定妆图 → 删掉含该角色的 png → 重渲（断点续渲只重画受影响的格） |
| 故事不满意 | 渲染前改大纲；渲染后改 `script.json` 台词（不重画图） |

## 11. 第一版不做（YAGNI）

接口留干净不挡路，但明确不实现：

- ❌ 网页创作台（让小朋友自己操作）—— 等确认玩法他真的喜欢再做
- ❌ 线稿导出 —— 他要彩色
- ❌ LoRA 训练 —— 16GB 跑不动，IPAdapter 够用
- ❌ PDF / 打印导出 —— 浏览器 Ctrl+P 即可
- ❌ 自由分格排版 —— 只用预设 layout
- ❌ 中文 / 多语言 —— 只做英文
- ❌ 自动追踪角色成长 —— 完本时 AI 往 `history.md` 追加一段即可

## 12. 验收标准

1. `/comic character` 造出新角色 → `characters/` 下 md 和 png 都在，png 是 Dog Man 风格
2. `/comic new` 产出 `script.json` → 章/页/格数在范围内，`description` 中不含任何台词文字
3. `/comic render 1` 渲出第 1 章全部图 → 图中**无文字**，同一角色跨格外观一致
4. 再次 `/comic render 1` → 全部跳过，秒完（断点续渲生效）
5. 双击 `index.html` → `file://` 下不空白，气泡文字清晰可读，分格正确

## 13. 已知风险

| 风险 | 应对 |
|---|---|
| Draw Things API 字段与假设不符 | 实施第一步先实测接口，再写渲染层 |
| 找不到合适的 Dog Man 风格 SDXL 模型/LoRA | 需在 Civitai 上实际筛选验证；风格前缀可能要随选定模型调整 |
| IPAdapter 一致性不足以支撑 150 格 | 先渲一章（16–30 格）评估；若漂移严重则收窄角色造型复杂度 |
| 16GB 内存在长时间批渲中吃紧 | 按章渲染天然分段；必要时降分辨率 |
