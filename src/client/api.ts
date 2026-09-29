/**
 * Browser-side API client for /api/dsh-project-memory — plain same-origin
 * fetch, the only data path the settings card and the per-session switch use.
 */

/** One session-level override. */
export interface SessionOverride {
  enabled?: boolean
  compressEnabled?: boolean
  workflowEnabled?: boolean
}

/** The workflow sub-switches (agent-workflow surface). */
export interface WorkflowConfigView {
  enabled: boolean
  autoScaffold: boolean
  turnCheck: boolean
  boardInject: boolean
}

/** The config view the GUI renders. */
export interface MemoryConfigView {
  enabled: boolean
  autoInit: boolean
  autoMaintain: boolean
  announceToAgent: boolean
  autoCompress: boolean
  compressInterval: number
  sessions: Record<string, SessionOverride>
  /** Present since the agent-workflow surface shipped; absent on very old hosts. */
  workflow?: WorkflowConfigView
}

/** Global switches a PUT may patch. */
export type GlobalConfigPatch = Partial<Pick<
  MemoryConfigView,
  'enabled' | 'autoInit' | 'autoMaintain' | 'announceToAgent' | 'autoCompress' | 'compressInterval'
>> & {
  /** Nested workflow sub-switch patch. */
  workflow?: Partial<WorkflowConfigView>
}

const API_PREFIX = '/api/dsh-project-memory'

/** Read the route's JSON error message when present. */
function errorOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error
  }
  return undefined
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('HTTP ' + response.status + ': invalid JSON response')
  }
  if (!response.ok) {
    throw new Error(errorOf(body) ?? 'HTTP ' + response.status)
  }
  return body as T
}

/** Read the full config. */
export function fetchConfig(): Promise<MemoryConfigView> {
  return request<MemoryConfigView>(API_PREFIX + '/config')
}

/** Patch the global switches. */
export function updateConfig(patch: GlobalConfigPatch): Promise<MemoryConfigView> {
  return request<MemoryConfigView>(API_PREFIX + '/config', {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

/** Set (true/false) one session memory override. */
export function updateSession(sessionId: string, enabled: boolean): Promise<MemoryConfigView> {
  return request<MemoryConfigView>(API_PREFIX + '/session', {
    method: 'PUT',
    body: JSON.stringify({ sessionId, enabled }),
  })
}

/** Set (true/false) one session compression override. */
export function updateSessionCompress(sessionId: string, enabled: boolean): Promise<MemoryConfigView> {
  return request<MemoryConfigView>(API_PREFIX + '/session', {
    method: 'PUT',
    body: JSON.stringify({ sessionId, compress: enabled }),
  })
}
