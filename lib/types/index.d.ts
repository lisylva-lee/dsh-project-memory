/**
 * dsh-project-memory — host half.
 *
 * 把「project-memory」人读版项目记忆技能做成插件，带全局开关 + 每会话开关：
 *
 *   - 全局 enabled（总闸，默认 true）：关闭时本插件的全部表面（运行时技能、
 *     指引注入、自动初始化、自动收尾）一并停用。
 *   - autoInit / autoMaintain / announceToAgent：细分开关。
 *   - 每会话覆盖（sessions.<id>.enabled）：只在总闸开启时生效，关掉某个会话
 *     即该会话不自动记忆。
 *   - agent/session-start 按会话 cwd 自动初始化 MEMORY.md + memory/_TEMPLATE.md
 *     + memory/YYYY-MM-DD.md（幂等，不覆盖已有文件）。
 *   - agent/turn-stopping 每轮有实际工具的 turn 结束时 steer 一步收尾引导：
 *     写/更新 memory/YYYY-MM-DD.md（背景/改动/结论/关联）并更新 MEMORY.md 索引
 *     （#标签 分类、日期倒序只加不删、摘要 ≤3 条）。
 *   - 通过 ctx.skills.register 把 project-memory 注册为运行时技能。
 *   - /api/dsh-project-memory/config + /session 路由：GUI 插件配置卡片与
 *     每会话开关读写 ~/.dsh/dsh-project-memory.json。
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable cordis plugin name. */
export declare const name = "project-memory";
/** Services required before the plugin surfaces can mount. */
export declare const inject: string[];
/** Scan the tail of a session log for one turn's tool activity. */
export declare function turnActivity(events: readonly unknown[], turn: number): {
    worked: boolean;
};
/** Subagent sessions (and any nested delegation) never get auto-init/maintain. */
export declare function isSubagentSession(agent: {
    session?: {
        header?: {
            origin?: string;
            delegationDepth?: number;
        };
    };
} | undefined): boolean;
/** Apply the host half. */
export declare function apply(ctx: Context, config?: Record<string, unknown>): void;
