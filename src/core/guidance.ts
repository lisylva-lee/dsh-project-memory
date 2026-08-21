/**
 * Model-facing copy for dsh-project-memory: the announcement, the turn-end
 * auto-maintain steering prompt, and the runtime-skill metadata.
 */

/** Model-facing announcement: the project default memory workflow. */
export const GUIDANCE =
  '本机已安装 dsh-project-memory 插件（项目记忆，开关开启中）：本项目默认使用 project-memory ' +
  '记忆模板做记忆并分类——项目根 MEMORY.md 是 Wiki 索引（项目概况/索引表/最近摘要，恒 ≤10K），' +
  'memory/YYYY-MM-DD.md 是每日详情（背景/改动/结论/关联），会话开始时已按模板自动初始化。' +
  '工作流：开始任务前先读项目根 MEMORY.md 了解背景与最近进展（省 token：只读索引和摘要）；' +
  '任务结束后按模板写/更新 memory/YYYY-MM-DD.md（当天多次任务合并到一个文件、分节记录），' +
  '并更新 MEMORY.md 索引表（#标签 关键词分类、日期倒序只加不删、最近摘要最多 3 条，超了压缩最旧条目）。' +
  '用户提到「项目记忆 / 记忆模板 / 更新 MEMORY.md / 写每日记忆 / 初始化记忆 / 人眼查看项目记忆」时按此执行；' +
  '插件开关关闭时，仅在用户明确要求时才使用记忆模板。'

/** Turn-end auto-maintain steering prompt (kept stable across versions). */
export const MAINTAIN_PROMPT =
  '（dsh-project-memory 自动收尾）本轮工作已结束，请把本轮沉淀进本项目的人读版记忆：\n' +
  '1. 若本轮有实质产出、踩坑结论或下一步安排：在 memory/YYYY-MM-DD.md 追加/创建本轮的' +
  '「背景 / 改动 / 结论 / 关联」小节（当天合并到同一文件、分节记录），并更新 MEMORY.md 索引表' +
  '（日期倒序加一行、只加不删，关键词用 #标签 分类）与最近记录摘要（最多 3 条）；\n' +
  '2. 若本轮已写过记忆、或没有值得沉淀的内容，直接回复「本轮无需沉淀」，不要调用任何工具。\n' +
  '最终回复保持一句话以内，不要展开。'

/** Runtime-skill description shown in the skill catalog. */
export const SKILL_DESCRIPTION =
  '人读版项目记忆体系（手工 MEMORY.md 主索引 + memory/YYYY-MM-DD.md 每日详情），由 dsh-project-memory 插件自动初始化并维护。当用户要求"使用记忆模板 / 创建项目记忆 / 初始化记忆 / 维护记忆 / 更新 MEMORY.md / 写每日记忆 / 人眼查看项目记忆"或提到 F:\\xiangmu\\记忆模板 时，先加载本技能再行动。'

/** Runtime-skill whenToUse guidance. */
export const SKILL_WHEN_TO_USE =
  '用户要求为任意项目建立或维护人读版记忆体系（MEMORY.md + memory/），或要求记忆可被肉眼查看/提交 git 时。'
