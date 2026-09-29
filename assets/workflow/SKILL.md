---
name: agent-workflow
description: 代理工作流规范：AGENT_WORKFLOW.md（策略：并发上限/任务隔离/生命周期钩子/证据门槛/凭据与危险动作边界）+ STATUS.md（状态看板）+ _work/<任务>/（每任务隔离目录）。由 dsh-agent-workflow 插件自动铺开并做每轮自检。当用户要求"建立/查看工作流规范 / 任务看板 / 建任务目录 / 记录证据 / 自检工作流"或提到 AGENT_WORKFLOW.md、STATUS.md、_work/ 时，先加载本技能再行动。
whenToUse: 用户要求为任意项目建立或维护代理工作流（策略文件 + 状态看板 + 每任务隔离目录 + 证据门槛），或要求按工作流自检时。
disable-model-invocation: true
---

# 代理工作流规范（agent-workflow）

与 dsh-project-memory（记忆）并行的**执行纪律**层：记忆管"发生过什么"，本技能管"怎么做"。
两者数据都只放项目内文件；插件只负责自动铺开与自检，不拥有数据。

## 三层归属（重要）
| 层 | 载体 | 说明 |
| --- | --- | --- |
| 每项目 | `AGENT_WORKFLOW.md`、`STATUS.md` | 策略与看板，随项目版本化、可 grep、可 git |
| 每任务 | `_work/<YYYYMMDD-短名>/` | notes.md、run.log、evidence/、backup/、archive/ |
| 每机器 | 插件开关 + `_work/{new-task,log,sanitize-env}.sh`、`_work/checks/*.sh` | 凭据边界、危险动作门槛、自检脚本 |

## 目录与文件
```
<项目根>/
├─ AGENT_WORKFLOW.md   策略（并发/隔离/钩子/证据/凭据/危险动作/权限/命名）
├─ STATUS.md           看板（进行中/阻塞/完成 + 证据指针 + 需用户决定）
└─ _work/
   ├─ README.md        规则速查
   ├─ new-task.sh      建任务目录（幂等）
   ├─ log.sh           追加 run.log
   ├─ sanitize-env.sh  剥离凭据后执行命令
   ├─ checks/          三个自检脚本（证据/看板/临时文件）
   └─ _template/       任务目录模板
```

## 开工（before_run）
1. 读 `AGENT_WORKFLOW.md` 与 `STATUS.md`（必要时读记忆）；
2. `bash _work/new-task.sh <任务id> "<标题>"`（任务 id：`YYYYMMDD-短名`）；
3. 在 `_work/<任务id>/notes.md` 写目标、验收标准、风险、备份方案；
4. 在 `STATUS.md` 建/更新行（状态 + 下一步）；
5. `bash _work/log.sh <任务id> "开始" "<依据>"`。

## 收尾（after_run）
1. 证据进 `_work/<任务id>/evidence/`（`NN-简述.扩展名`），并在 run.log 登记复现命令；
2. 更新 `STATUS.md`（状态 / 证据指针 / 需用户决定）；
3. 更新记忆（人读版 + 机器记忆）；
4. 交付物归位；5. 清理临时物；6. `bash _work/log.sh <任务id> "收尾" "<结论与遗留>"`；
7. 汇报：结论 / 证据 / 影响面 / 遗留风险。

## 证据门槛（完成的口径）
- 完成 = **可复现命令 + 输出证据 + 影响面说明**；三者缺一不算完成。
- 允许的证据：命令与原始输出、A/B 对照数据、文件哈希、截图/OCR、日志时间线、第三方状态查询。
- 不允许："应该可以了"；也不允许只给结论不给命令。未达成时必须显式写「未完成 + 卡在哪 + 下一步选项」。

## 凭据与危险动作
- 凭据只存在于宿主环境变量/已认证 CLI；**禁止写入任何文件**（含记忆、日志、交付物、脚本）。
- 派发给子代理或外部进程的命令先剥离：`bash _work/sanitize-env.sh -- <命令>`。
- 危险动作（删除/覆盖、`rm -rf`、改注册表/服务/hosts/计划任务、外发网络、`git push`、安装卸载、花钱）**必须先备份 + 先问用户**，并优先可逆方案。

## 自检（每轮可选执行）
```
bash _work/checks/check-evidence.sh   # 未完成任务是否有证据文件
bash _work/checks/check-status.sh     # 阻塞项是否写了「需要用户决定」
bash _work/checks/check-tempfiles.sh  # 项目根是否散落临时文件
```
插件在每轮结束时自动跑等价检查，仅在发现缺项时提醒一次。
