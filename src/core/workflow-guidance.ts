/**
 * Model-facing copy for the agent-workflow surface (policy file + board +
 * per-task scratch spaces). Mirrors core/guidance.ts of the memory half.
 */

/** Session-start announcement for the workflow surface. */
export const WORKFLOW_GUIDANCE =
  '本机已安装 dsh-agent-workflow（工作流规范，开关开启中）：本项目使用 AGENT_WORKFLOW.md（策略：并发上限 / 任务隔离 / 开工与收尾钩子 / 证据门槛 / 凭据与危险动作边界）、' +
  'STATUS.md（状态看板：进行中 / 阻塞 / 完成 + 证据指针 + 需要用户决定的事项）与 _work/<YYYYMMDD-短名>/（每任务隔离目录：notes.md、run.log、evidence/、backup/）。' +
  '工作流：开工前先读 AGENT_WORKFLOW.md 与 STATUS.md，建立/进入任务目录（bash _work/new-task.sh <任务id> "<标题>"）；' +
  '过程用 bash _work/log.sh <任务id> "<动作>" "<结果>" 记日志、证据放 _work/<任务id>/evidence/ 并在 run.log 登记复现命令；' +
  '收尾更新 STATUS.md 与记忆、清理临时物。完成的口径是「可复现命令 + 输出证据 + 影响面说明」；' +
  '危险动作（删除/覆盖、改系统状态、外发网络、推送、花钱）必须先备份并先问用户；凭据禁止写入任何文件或日志。'

/** Turn-end workflow self-check steer (only sent when the checks find something). */
export const WORKFLOW_CHECK_PROMPT_PREFIX =
  '（dsh-agent-workflow 收尾自检）检测到本轮工作流项未完成：'

/** Runtime-skill description shown in the skill catalog. */
export const WORKFLOW_SKILL_DESCRIPTION =
  '代理工作流规范（策略进仓库 + 状态看板 + 每任务隔离工作区 + 证据门槛 + 凭据与危险动作边界），由 dsh-agent-workflow 插件自动铺开并自检。' +
  '当用户要求"建立/查看工作流规范 / 任务看板 / 建任务目录 / 记录证据 / 自检工作流"或提到 AGENT_WORKFLOW.md、STATUS.md、_work/ 时，先加载本技能再行动。'

/** Runtime-skill whenToUse guidance. */
export const WORKFLOW_SKILL_WHEN_TO_USE =
  '用户要求为任意项目建立或维护代理工作流（策略文件 + 状态看板 + 每任务隔离目录 + 证据门槛），或要求按工作流自检时。'
