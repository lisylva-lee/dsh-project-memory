/**
 * The project-memory plugin-config card, rendered inside the Web UI Plugins
 * group (web-ui.plugin.item). Uses the family-shared collapsible card chrome
 * (PluginSettingsCard) and the shared BooleanField control, exactly like the
 * task-board / desktop-launcher cards — no custom styling. Unlike those
 * cards, the values are read/written through the plugin's own config routes
 * (~/.dsh/dsh-project-memory.json) instead of a settings namespace, so the
 * card adapts the route state onto the shared chrome's CardShell contract.
 */
import { useEffect, useState, type ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  fetchConfig,
  updateConfig,
  type GlobalConfigPatch,
  type MemoryConfigView,
  type WorkflowConfigView,
} from './api.ts'
import { BooleanField, PluginSettingsCard } from './PluginSettingsCard.tsx'
import type { CardShell, FieldState } from './settings-form.ts'

/** Composed props of the card: the group slot's runtime share + this plugin's locale. */
export type SettingsCardProps = PropsRuntime<'web-ui.plugin.item'> & PropsLocale<'dsh-project-memory'>

/** The boolean fields this card edits. */
const FIELD_IDS = ['enabled', 'autoInit', 'autoMaintain', 'announceToAgent', 'autoCompress'] as const
type FieldId = typeof FIELD_IDS[number]

/** Read one boolean field off the config. */
function valueOf(config: MemoryConfigView, id: FieldId): boolean {
  return config[id]
}

/** The workflow sub-switches this card edits (agent-workflow surface). */
const WORKFLOW_IDS = ['enabled', 'autoScaffold', 'turnCheck', 'boardInject'] as const
type WorkflowId = typeof WORKFLOW_IDS[number]

/** Defaults used when the host predates the workflow sub-switches. */
const WORKFLOW_DEFAULTS: WorkflowConfigView = {
  enabled: true,
  autoScaffold: true,
  turnCheck: true,
  boardInject: true,
}

/** Read the workflow sub-switches with a safe fallback for old hosts. */
function workflowOf(config: MemoryConfigView): WorkflowConfigView {
  return config.workflow ?? WORKFLOW_DEFAULTS
}

/** The plugin-config card (family chrome, collapsed by default). */
export function SettingsCard(props: SettingsCardProps): ReactElement | null {
  const { t } = props
  const [config, setConfig] = useState<MemoryConfigView | null>(null)
  const [draft, setDraft] = useState<MemoryConfigView | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | undefined>()

  useEffect(() => {
    let alive = true
    fetchConfig()
      .then((value) => {
        if (!alive) return
        setConfig(value)
        setDraft(value)
      })
      .catch((cause: unknown) => {
        if (alive) setFailed(cause instanceof Error ? cause.message : String(cause))
      })
    return () => { alive = false }
  }, [])

  // The shared chrome renders nothing until the form is available (the same
  // contract the settings-scope cards follow while their namespace loads).
  if (config === null || draft === null) return null

  const dirty =
    FIELD_IDS.some(id => valueOf(draft, id) !== valueOf(config, id)) ||
    WORKFLOW_IDS.some(id => workflowOf(draft)[id] !== workflowOf(config)[id])

  const shell: CardShell = {
    available: true,
    exposed: true,
    writable: true,
    dirty,
    invalid: false,
    saving: busy,
    failed: failed !== undefined,
    ...(failed !== undefined ? { failedReason: failed } : {}),
  }

  const fieldProps = {
    overriddenLabel: t('settings.overridden'),
    resetLabel: t('settings.reset'),
    invalidLabel: t('settings.invalidNumber'),
    disabled: busy,
  }

  const fieldState = (id: FieldId): FieldState => ({
    text: String(valueOf(draft, id)),
    overridden: false,
    invalid: false,
  })

  const onEdit = (id: FieldId) => (text: string): void => {
    setFailed(undefined)
    setDraft({ ...draft, [id]: text === 'false' ? false : true })
  }

  const onReset = (id: FieldId) => (): void => {
    setFailed(undefined)
    setDraft({ ...draft, [id]: true })
  }

  const workflowState = (id: WorkflowId): FieldState => ({
    text: String(workflowOf(draft)[id]),
    overridden: false,
    invalid: false,
  })

  const workflowEdit = (id: WorkflowId) => (text: string): void => {
    setFailed(undefined)
    setDraft({ ...draft, workflow: { ...workflowOf(draft), [id]: text === 'false' ? false : true } })
  }

  const workflowReset = (id: WorkflowId) => (): void => {
    setFailed(undefined)
    setDraft({ ...draft, workflow: { ...workflowOf(draft), [id]: true } })
  }

  const save = async (): Promise<void> => {
    if (busy || !dirty) return
    setBusy(true)
    setFailed(undefined)
    try {
      const next = await updateConfig({
        enabled: draft.enabled,
        autoInit: draft.autoInit,
        autoMaintain: draft.autoMaintain,
        announceToAgent: draft.announceToAgent,
        autoCompress: draft.autoCompress,
        workflow: workflowOf(draft),
      } satisfies GlobalConfigPatch)
      setConfig(next)
      setDraft(next)
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const discard = (): void => {
    setDraft(config)
    setFailed(undefined)
  }

  return (
    <PluginSettingsCard
      t={t}
      titleKey="settings.title"
      descriptionKey="settings.description"
      defaultOpen={false}
      state={shell}
      onSave={() => { void save() }}
      onDiscard={discard}
    >
      <BooleanField
        id="settings-project-memory-enabled"
        label={t('settings.enabled')}
        hint={t('settings.enabledHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...fieldState('enabled')}
        onEdit={onEdit('enabled')}
        onReset={onReset('enabled')}
      />
      <BooleanField
        id="settings-project-memory-auto-init"
        label={t('settings.autoInit')}
        hint={t('settings.autoInitHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...fieldState('autoInit')}
        onEdit={onEdit('autoInit')}
        onReset={onReset('autoInit')}
      />
      <BooleanField
        id="settings-project-memory-auto-maintain"
        label={t('settings.autoMaintain')}
        hint={t('settings.autoMaintainHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...fieldState('autoMaintain')}
        onEdit={onEdit('autoMaintain')}
        onReset={onReset('autoMaintain')}
      />
      <BooleanField
        id="settings-project-memory-announce"
        label={t('settings.announce')}
        hint={t('settings.announceHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...fieldState('announceToAgent')}
        onEdit={onEdit('announceToAgent')}
        onReset={onReset('announceToAgent')}
      />
      <BooleanField
        id="settings-project-memory-auto-compress"
        label={t('settings.autoCompress')}
        hint={t('settings.autoCompressHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...fieldState('autoCompress')}
        onEdit={onEdit('autoCompress')}
        onReset={onReset('autoCompress')}
      />
      <BooleanField
        id="settings-project-memory-workflow-enabled"
        label={t('settings.workflowEnabled')}
        hint={t('settings.workflowEnabledHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...workflowState('enabled')}
        onEdit={workflowEdit('enabled')}
        onReset={workflowReset('enabled')}
      />
      <BooleanField
        id="settings-project-memory-workflow-auto-scaffold"
        label={t('settings.workflowAutoScaffold')}
        hint={t('settings.workflowAutoScaffoldHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...workflowState('autoScaffold')}
        onEdit={workflowEdit('autoScaffold')}
        onReset={workflowReset('autoScaffold')}
      />
      <BooleanField
        id="settings-project-memory-workflow-turn-check"
        label={t('settings.workflowTurnCheck')}
        hint={t('settings.workflowTurnCheckHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...workflowState('turnCheck')}
        onEdit={workflowEdit('turnCheck')}
        onReset={workflowReset('turnCheck')}
      />
      <BooleanField
        id="settings-project-memory-workflow-board-inject"
        label={t('settings.workflowBoardInject')}
        hint={t('settings.workflowBoardInjectHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...workflowState('boardInject')}
        onEdit={workflowEdit('boardInject')}
        onReset={workflowReset('boardInject')}
      />
    </PluginSettingsCard>
  )
}