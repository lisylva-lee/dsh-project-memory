# dsh-project-memory

[English](README.md) | 中文

把「project-memory」人读版项目记忆技能做成 DSH 插件：全局开关 + 每会话开关，
开启后每个项目默认使用记忆模板（`MEMORY.md` 索引 + `memory/YYYY-MM-DD.md`
每日详情）自动记忆并分类。

## 是什么

- **GUI 插件配置**：设置 → 插件配置 → Web UI 插件 卡片内有「项目记忆」设置卡
  （全家桶共享折叠卡片，默认收起、点击展开），五个开关（主开关 / 自动初始化 /
  自动收尾 / 向 Agent 注入指引 / 自动压缩），保存后即时生效。
- **每会话开关**：每个会话底部（输入框上方）有「项目记忆」开关，默认折叠成一行
  （标签 + 当前状态 + 展开箭头），点击展开有「项目记忆」与「记忆压缩」两个开关；
  关掉记忆即该会话不自动初始化与收尾，关掉压缩即该会话不自动压缩；都只在主开关
  开启时生效。
- **自动行为**（主开关开启时）：
  - 会话开始按项目目录自动初始化 `MEMORY.md` + `memory/_TEMPLATE.md` +
    `memory/YYYY-MM-DD.md`（幂等，不覆盖已有文件）；
  - 每轮有实际工作的任务结束自动收尾：写/更新当日记忆（背景/改动/结论/关联）并更新
    `MEMORY.md` 索引（#标签 分类、日期倒序只加不删、摘要 ≤3 条）；
  - 通过 `ctx.skills` 注册 `project-memory` 运行时技能；技能与模板优先读
    `~/.dsh/skills/project-memory/`（唯一事实源），缺失时用包内副本；
  - **自动压缩**（主开关开启且该会话压缩开启时）：按项目统计会话次数，每
    `compressInterval`（默认 5）次会话压缩一次——`MEMORY.md` 索引保留最近 10 行、
    更旧的行折叠成「[压缩]」摘要行；`memory/` 目录保留最近 5 个文件、更旧的折叠成
    一行结论摘要。
- 配置持久化在 `~/.dsh/dsh-project-memory.json`（0600），经
  `/api/dsh-project-memory/config`、`/api/dsh-project-memory/session`、
  `/api/dsh-project-memory/count` 与 `/api/dsh-project-memory/compress-now`
  路由读写（loopback-only）。

## 安装

图形界面安装：**设置 → 插件 → 工坊市场**（或插件管理）里搜索
`@lisylva-lee/dsh-project-memory`。

命令行安装——下面是 DSH Desktop v0.3.23 内置运行时里的 CLI 用法（原生
`dsh web` 安装则直接用 `dsh plugin ...`）：

```sh
# DSH Desktop v0.3.23：内置 node + 内置 dsh 宿主
NODE="D:/deepseek-harness/DeepSeek Harness/resources/runtime/node/node.exe"
BIN="D:/deepseek-harness/DeepSeek Harness/resources/runtime/host/node_modules/@deepseek-ai/dsh/lib/bin.js"

# 方式一：从 GitHub 安装（lib/ 已随仓库提交，装完即用，无需在安装时构建）
"$NODE" "$BIN" plugin --profile web add github:lisylva-lee/dsh-project-memory

# 方式二：本地 link 安装（开发调试用）
"$NODE" "$BIN" plugin --profile web add link:<本仓库路径>/dsh-project-memory
```

安装后重启桌面端（或 `dsh web`）生效。

要求宿主 `dsh >= 0.1.5-rc.1`（写在 `dsh.engines.dsh` 里，插件管理器会据此判定
兼容性）；本仓库的客户端模块表与 0.1.5-rc.1 外壳一致（见
`build/web-platform.ts`）。

## 开发

仓库自带完整构建配置（`build/tsdown.client.ts` + `build/web-platform.ts`），
**不依赖任何 monorepo**：

```sh
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build        # tsc 出 lib/types，tsdown 出 lib/index.js 与 lib/client.js
```

## 说明

- 自动收尾只对顶层 agent、有实际工具调用的 turn 触发一次；无可沉淀内容时模型
  直接回复「本轮无需沉淀」。
- 与 `dsh-memoir`（机器记忆）并行不冲突：本插件写人读版记忆。
- 卸载：`"$NODE" "$BIN" plugin --profile web remove @lisylva-lee/dsh-project-memory`
  （或在插件管理界面里关掉/移除）。
## Agent workflow（agent-workflow 子模块，0.3 起）

除记忆之外，插件还带一层执行纪律（可单独关掉）：

- 会话开始时把 AGENT_WORKFLOW.md 的规范与 STATUS.md 看板的未完成项摘要注入系统提示；
- 幂等铺开项目内三件套：AGENT_WORKFLOW.md（策略）、STATUS.md（看板）、_work/（每任务隔离目录 + new-task.sh / log.sh / sanitize-env.sh + checks/）；
- 每轮结束跑一次廉价自检（未完成任务缺证据 / 阻塞未写原因 / 项目根散落临时文件），仅在发现缺项时提醒一次；
- 通过 ctx.skills.register 注册 agent-workflow 运行时技能。

开关（配置文件 ~/.dsh/dsh-project-memory.json 的 workflow 小节，也可由 PUT /api/dsh-project-memory/config 写入）：

| 开关 | 默认 | 作用 |
| --- | --- | --- |
| workflow.enabled | true | 工作流总闸（技能/指引/铺开/自检） |
| workflow.autoScaffold | true | 会话开始幂等铺开三件套 |
| workflow.turnCheck | true | 每轮结束自检，仅在发现缺项时提醒 |
| workflow.boardInject | true | 把看板未完成项注入系统提示 |

不需要插件时也可单独安装这套模板：bash assets/workflow/install-workflow.sh <目标项目> [--force]。
GUI 卡片上的四个开关（Workflow 小节）为下一步；当前可直接编辑配置文件或调用上述 PUT 接口。
数据只放项目内文件：插件不拥有工作流数据，卸载或崩溃都不影响可读性与可移植性。
