# @linxin666/dsh-project-memory

[English](README.md) | 中文

把「project-memory」人读版项目记忆技能做成 DSH 插件：全局开关 + 每会话开关，
开启后每个项目默认使用记忆模板（`MEMORY.md` 索引 + `memory/YYYY-MM-DD.md`
每日详情）自动记忆并分类。

## 是什么

- **GUI 插件配置**：设置 → 插件配置 → Web UI 插件 卡片内有「项目记忆」设置卡
  （任务看板式折叠卡片，默认收起、点击展开），四个开关（主开关 / 自动初始化 /
  自动收尾 / 向 Agent 注入指引），保存后即时生效。
- **每会话开关**：每个会话底部（输入框上方）有「项目记忆」开关，默认折叠成一行
  （标签 + 当前状态 + 展开箭头），点击展开可切换；关掉该会话即不自动初始化与
  收尾；只在主开关开启时生效。
- **自动行为**（主开关开启时）：
  - 会话开始按项目目录自动初始化 `MEMORY.md` + `memory/_TEMPLATE.md` +
    `memory/YYYY-MM-DD.md`（幂等，不覆盖已有文件）；
  - 每轮有实际工作的任务结束自动收尾：写/更新当日记忆（背景/改动/结论/关联）并更新
    `MEMORY.md` 索引（#标签 分类、日期倒序只加不删、摘要 ≤3 条）；
  - 通过 `ctx.skills` 注册 `project-memory` 运行时技能；技能与模板优先读
    `~/.dsh/skills/project-memory/`（唯一事实源），缺失时用包内副本。
- 配置持久化在 `~/.dsh/dsh-project-memory.json`（0600），经
  `/api/dsh-project-memory/config` 与 `/api/dsh-project-memory/session`
  路由读写（loopback-only）。

## 安装

```sh
# 在 dsh 安装目录执行
node lib/bin.js plugin --profile web add link:<本仓库路径>/packages/dsh-project-memory
```

安装后重启 `dsh web` 生效。

## 开发

```sh
pnpm --filter @linxin666/dsh-project-memory typecheck
pnpm --filter @linxin666/dsh-project-memory test
pnpm --filter @linxin666/dsh-project-memory build
```

## 说明

- 自动收尾只对顶层 agent、有实际工具调用的 turn 触发一次；无可沉淀内容时模型
  直接回复「本轮无需沉淀」。
- 与 `dsh-memoir`（机器记忆）并行不冲突：本插件写人读版记忆。
- 卸载：`node lib/bin.js plugin --profile web remove @linxin666/dsh-project-memory`。
