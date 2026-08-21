/**
 * dsh-project-memory browser-half dictionaries. The zh dictionary is the key
 * source; en mirrors the full key set. Includes the family-shared card
 * chrome vocabulary (settings.collapse ... settings.off) so the plugin-config
 * card renders exactly like the task-board / desktop-launcher cards.
 */

/** Chinese copy (key source). */
export const zh = {
  // shared card chrome + BooleanField vocabulary
  'settings.collapse': '收起设置',
  'settings.expand': '展开设置',
  'settings.notExposed': '当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。',
  'settings.unsaved': '未保存',
  'settings.readOnly': '当前部署的设置只读。',
  'settings.saveFailed': '部署未接受这些值，已保留供你修改。',
  'settings.discard': '放弃',
  'settings.save': '保存',
  'settings.saving': '保存中…',
  'settings.overridden': '已覆盖',
  'settings.reset': '恢复默认',
  'settings.invalidNumber': '请输入数字，留空则使用默认值。',
  'settings.inherit': '继承',
  'settings.on': '开',
  'settings.off': '关',
  // plugin copy
  'settings.title': '项目记忆 (project-memory)',
  'settings.description': '人读版项目记忆：每个项目默认使用记忆模板（MEMORY.md + memory/YYYY-MM-DD.md）自动记忆并分类。',
  'settings.loading': '加载中...',
  'settings.enabled': '主开关',
  'settings.enabledHint': '关闭后技能注册、指引注入、自动初始化与自动收尾全部停用。',
  'settings.autoInit': '自动初始化',
  'settings.autoInitHint': '会话开始时自动创建 MEMORY.md 与 memory/ 模板（幂等，不覆盖已有文件）。',
  'settings.autoMaintain': '自动收尾',
  'settings.autoMaintainHint': '每轮实际工作结束后引导模型写/更新当日记忆并更新索引。',
  'settings.announce': '向 Agent 注入指引',
  'settings.announceHint': '在系统提示中注入"本项目默认使用记忆模板"的工作流。',
  // per-session switch copy
  'switch.label': '项目记忆',
  'switch.on': '已开启',
  'switch.off': '已关闭',
  'switch.hintOn': '本会话启用项目记忆（自动初始化 + 自动收尾）',
  'switch.hintOff': '本会话已关闭项目记忆',
  'switch.error': '读写配置失败',
}

/** English copy (full key-set mirror). */
export const en: Record<keyof typeof zh, string> = {
  'settings.collapse': 'Hide settings',
  'settings.expand': 'Show settings',
  'settings.notExposed': 'This DSH version does not expose this plugin\'s settings namespace to the configuration page, so the form is unavailable. Edit ~/.dsh/settings.yaml directly, or add the namespace to dsh-host-apiproxy\'s WEB_SETTINGS_NAMESPACES allowlist and restart.',
  'settings.unsaved': 'Unsaved',
  'settings.readOnly': 'This deployment stores settings read-only.',
  'settings.saveFailed': 'The deployment did not accept these values; they were left for you to correct.',
  'settings.discard': 'Discard',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.overridden': 'Overridden',
  'settings.reset': 'Reset to default',
  'settings.invalidNumber': 'Enter a number, or leave blank to use the default.',
  'settings.inherit': 'Inherit',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.title': 'Project Memory (project-memory)',
  'settings.description': 'Human-readable per-project memory: every project uses the memory template (MEMORY.md + memory/YYYY-MM-DD.md) by default, auto-remembered and categorized.',
  'settings.loading': 'Loading...',
  'settings.enabled': 'Master switch',
  'settings.enabledHint': 'Off disables skill registration, guidance, auto-init and auto-maintain entirely.',
  'settings.autoInit': 'Auto-init',
  'settings.autoInitHint': 'Create MEMORY.md and the memory/ templates at session start (idempotent, never overwrites).',
  'settings.autoMaintain': 'Auto-maintain',
  'settings.autoMaintainHint': 'Steer the model to write/update the daily memory and the index after each worked turn.',
  'settings.announce': 'Announce to agent',
  'settings.announceHint': 'Inject the "this project uses the memory template by default" workflow into the system prompt.',
  'switch.label': 'Project memory',
  'switch.on': 'On',
  'switch.off': 'Off',
  'switch.hintOn': 'This session uses project memory (auto-init + auto-maintain)',
  'switch.hintOff': 'Project memory is off for this session',
  'switch.error': 'Failed to read/write config',
}

/** Union of dictionary keys (the LocaleNamespaceMap value). */
export type ProjectMemoryKey = keyof typeof zh

/** Locale namespace owned by the browser half. */
export const NS = 'dsh-project-memory'

/** Registered dictionaries. */
export const dictionaries = { zh, en }
