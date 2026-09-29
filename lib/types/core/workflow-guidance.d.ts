/**
 * Model-facing copy for the agent-workflow surface (policy file + board +
 * per-task scratch spaces). Mirrors core/guidance.ts of the memory half.
 */
/** Session-start announcement for the workflow surface. */
export declare const WORKFLOW_GUIDANCE: string;
/** Turn-end workflow self-check steer (only sent when the checks find something). */
export declare const WORKFLOW_CHECK_PROMPT_PREFIX = "\uFF08dsh-agent-workflow \u6536\u5C3E\u81EA\u68C0\uFF09\u68C0\u6D4B\u5230\u672C\u8F6E\u5DE5\u4F5C\u6D41\u9879\u672A\u5B8C\u6210\uFF1A";
/** Runtime-skill description shown in the skill catalog. */
export declare const WORKFLOW_SKILL_DESCRIPTION: string;
/** Runtime-skill whenToUse guidance. */
export declare const WORKFLOW_SKILL_WHEN_TO_USE = "\u7528\u6237\u8981\u6C42\u4E3A\u4EFB\u610F\u9879\u76EE\u5EFA\u7ACB\u6216\u7EF4\u62A4\u4EE3\u7406\u5DE5\u4F5C\u6D41\uFF08\u7B56\u7565\u6587\u4EF6 + \u72B6\u6001\u770B\u677F + \u6BCF\u4EFB\u52A1\u9694\u79BB\u76EE\u5F55 + \u8BC1\u636E\u95E8\u69DB\uFF09\uFF0C\u6216\u8981\u6C42\u6309\u5DE5\u4F5C\u6D41\u81EA\u68C0\u65F6\u3002";
