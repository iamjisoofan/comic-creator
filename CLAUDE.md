# CLAUDE.md

本文件为 Claude Code 在本仓库工作时提供指引。

## 记忆文件（开工前先读）

- [`project.md`](./project.md) — **项目知识**：目标、核心设计决策、进展、约定、已知缺口。
- [`wiki.md`](./wiki.md) — **codebase 知识**：结构、模块、接口、如何运行/测试、易踩的坑。

做实质改动后，请顺手更新对应文件（改了设计/决策 → `project.md`；改了结构/接口/命令 → `wiki.md`）。两者均**不得含真实持仓数据**（见下方隐私硬规则）。

## 编码规范（必读）

进行任何编码工作（coding work）前，**必须先阅读** [`karpathy_coding_rule.md`](./karpathy_coding_rule.md) 并遵循其中的行为准则（先思考再编码、保持简单、外科手术式改动、目标驱动验证）。