---
name: project-memory
description: 人读版项目记忆体系（手工 MEMORY.md 主索引 + memory/YYYY-MM-DD.md 每日详情），与 dsh-memoir 插件构成双重记忆。当用户要求"使用记忆模板 / 创建项目记忆 / 初始化记忆 / 维护记忆 / 更新 MEMORY.md / 写每日记忆 / 人眼查看项目记忆"或提到 F:\xiangmu\记忆模板 时，先加载本技能再行动。
whenToUse: 用户要求为任意项目建立或维护人读版记忆体系（MEMORY.md + memory/），或要求记忆可被肉眼查看/提交 git 时。
---

# 人读版项目记忆体系（记忆模板）

与 dsh-memoir（机器记忆插件）并行的**人读版记忆**：主记忆 `MEMORY.md` 是 Wiki 索引，`memory/YYYY-MM-DD.md` 是每日详情，人类可直接打开阅读、用 grep 检索、提交 git。机器记忆交给 dsh-memoir（`~/.dsh/dsh-memoir.json` + `PROJECT_MEMORY.md` 投影），本技能负责**给人看的记忆**。

## 双重记忆分工
| 层 | 载体 | 用途 |
| --- | --- | --- |
| 机器记忆（插件 dsh-memoir） | `~/.dsh/dsh-memoir.json` + 项目内 `PROJECT_MEMORY.md` | Hot Memory 自动注入 system prompt、跨会话继承、BM25 排序召回 |
| 人读记忆（本技能） | 项目根 `MEMORY.md` + `memory/YYYY-MM-DD.md` | 人类肉眼浏览、git 提交、grep 定位、结构化每日记录 |

## 目录结构（目标项目内）
- `MEMORY.md` — 主记忆（Wiki 索引）：项目概况 + 索引表 + 最近摘要（≤3 条）。只存"去哪找 + 是什么"，恒 ≤10K。
- `memory/YYYY-MM-DD.md` — 每日详情：背景 / 改动 / 结论 / 关联。模板见 `memory/_TEMPLATE.md`。

## 初始化新项目（首次）
1. 目标目录 = 会话工作区（或用户指定）；项目名 = 目录名（或用户指定）。
2. 从本技能资源目录 `templates/` 复制 `MEMORY.md` → `<目标>/MEMORY.md`：
   - 删除开头 `> **使用说明（首次使用时整段删除）：**` 段；
   - 替换 `{项目名}`、`{YYYY-MM-DD}`（今天）、`{一句话说明项目要做什么}` →（待补充）、`{如有}` →（待补充）等占位符；
   - 索引表保留一行初始化记录，摘要写一行结论。
3. 复制 `templates/memory/_TEMPLATE.md` → `<目标>/memory/_TEMPLATE.md`。
4. 创建 `<目标>/memory/YYYY-MM-DD.md`（今天）：从 _TEMPLATE 复制并替换日期，标题"初始化项目记忆"。
5. 若环境已安装快捷命令，也可直接运行：`init-memory [目标目录] [项目名]`（`--force` 覆盖已有 MEMORY.md）。脚本位于本技能资源目录 `init-memory.sh`。

## 每次任务工作流
① 读 `MEMORY.md` → 了解背景 + 最近进展（省 token：只读索引和摘要）
② 执行任务
③ 写 `memory/YYYY-MM-DD.md` → 记录详情（背景/改动/结论/关联）；当天多次任务合并到一个文件、分节记录
④ 更新 `MEMORY.md` → 索引表加一行 + 更新最近摘要（最多 3 条）

## 规则
- 主记忆 ≤ 10K：只存规则 + 索引 + 摘要；细节一律写 `memory/YYYY-MM-DD.md`。
- 关键词用 `#标签`，便于 grep 秒级定位。
- 索引按日期倒序、只加不删。
- 主记忆超 10K：把最旧条目压缩为"关键词 + 一行结论"，详情文件保留不删。
- 迷你模式（小项目）：只用 `MEMORY.md` 单文件即可。
- 与 dsh-memoir 并行维护：同一工作完成后，既调用 memoir_record 沉淀机器记忆，也按本技能写人读记忆。

## 插件化（dsh-project-memory）

本技能已由 dsh-project-memory 插件接管：插件开关开启时，会话开始自动初始化模板、每轮结束自动收尾写记忆，无需再手动要求。本 SKILL.md 是插件注册运行时技能的内容来源（优先读 ~/.dsh/skills/project-memory/SKILL.md，此处为包内兜底副本）。
