/**
 * Per-session memory switch, mounted in the official conversation.input.dock
 * band — a row under the conversation, above the composer. Task-board style:
 * collapsed to a compact disclosure row by default (label + state + chevron),
 * expanding reveals the hint and the switch. It reads the live config through
 * the host routes and writes the session override on toggle.
 */
import { useEffect, useState, type ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { fetchConfig, updateSession, updateSessionCompress } from './api.ts'
import css from './memory.module.css'

/** Composed props: the dock's session/input owner share + this plugin's locale. */
export type SessionMemorySwitchProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'dsh-project-memory'>

/** Chevron used by the disclosure header (mirrors the family card chrome). */
function Chevron(props: { open: boolean }): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.open ? css.chevronOpen : css.chevron}
      aria-hidden="true"
    >
      <path
        d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 9.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** The dock row: collapsible disclosure with the session switch inside. */
export function SessionMemorySwitch(props: SessionMemorySwitchProps): ReactElement | null {
  const { t, session } = props
  const sessionId = session?.sessionId
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [sessionOn, setSessionOn] = useState(true)
  const [compressOn, setCompressOn] = useState(true)
  const [compressInterval, setCompressInterval] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let alive = true
    if (sessionId === undefined) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchConfig()
      .then((config) => {
        if (!alive) return
        setGlobalEnabled(config.enabled)
        setSessionOn(config.sessions[sessionId]?.enabled ?? true)
        setCompressOn(config.sessions[sessionId]?.compressEnabled ?? config.autoCompress)
        setCompressInterval(config.compressInterval)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (!alive) return
        setError(cause instanceof Error ? cause.message : String(cause))
        setLoading(false)
      })
    return () => { alive = false }
  }, [sessionId])

  if (sessionId === undefined || loading) {
    return <div data-dsh-plugin="project-memory" data-dsh-part="session-switch" className={css.dock} />
  }

  const on = globalEnabled && sessionOn

  const toggle = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      const next = await updateSession(sessionId, !sessionOn)
      setSessionOn(next.sessions[sessionId]?.enabled ?? true)
      setGlobalEnabled(next.enabled)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const toggleCompress = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      const next = await updateSessionCompress(sessionId, !compressOn)
      setCompressOn(next.sessions[sessionId]?.compressEnabled ?? next.autoCompress)
      setGlobalEnabled(next.enabled)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-dsh-plugin="project-memory" data-dsh-part="session-switch" className={css.dock}>
      <button
        type="button"
        className={css.dockHeader}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.dockText}>
          <strong>{t('switch.label')}</strong>
          <span className={css.dockState}>{on ? t('switch.on') : t('switch.off')}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open
        ? (
          <div className={css.dockBody}>
            {error !== undefined ? <span className={css.dockError}>{t('switch.error')}: {error}</span> : null}
            <div className={css.dockRows}>
              <label className={css.dockLabel} title={on ? t('switch.hintOn') : t('switch.hintOff')}>
                <span className={css.dockHint}>{on ? t('switch.hintOn') : t('switch.hintOff')}</span>
                <input
                  type="checkbox"
                  role="switch"
                  className={css.switch}
                  checked={on}
                  disabled={!globalEnabled || busy}
                  onChange={() => { void toggle() }}
                />
              </label>
              <label className={css.dockLabel} title={compressOn ? t('switch.compressHintOn', { interval: compressInterval }) : t('switch.compressHintOff')}>
                <span className={css.dockHint}>{compressOn ? t('switch.compressLabel') + ' · ' + t('switch.on') : t('switch.compressLabel') + ' · ' + t('switch.off')}</span>
                <input
                  type="checkbox"
                  role="switch"
                  className={css.switch}
                  checked={compressOn}
                  disabled={!globalEnabled || busy}
                  onChange={() => { void toggleCompress() }}
                />
              </label>
            </div>
          </div>
        )
        : null}
    </div>
  )
}