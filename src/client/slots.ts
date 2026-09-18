/**
 * Client-side `slots` service contract.
 *
 * The shell's client composition provides a `slots` service: the slot registry
 * core from `@deepseek-ai/dsh-client-ui-slots`, wrapped by the runtime Service
 * that adds `inject` (declaration-lifetime effects) on top of `register`.
 *
 * The package that used to publish this contract — `@deepseek-ai/dsh-client-runtime`
 * — stopped shipping with the 0.1.5 cohort (its last release is 0.1.1-rc.2),
 * while the runtime service itself is alive: family plugins built for the
 * current shell still call `ctx.slots.inject(...)` / `ctx.slots.register(...)`.
 * An out-of-tree plugin therefore declares the surface it consumes instead of
 * importing a dead facade.
 * @module @lisylva-lee/dsh-project-memory/client/slots
 */
import type { SlotCore, SlotMap } from '@deepseek-ai/dsh-client-ui-slots'

/** What an injection callback may return: one disposer, an iterable of them, or nothing. */
export type SlotInjectionEffect = (() => void) | Iterable<() => void> | void

/** The slots service as the client composition exposes it: registry core plus injection lifetimes. */
export interface SlotsService extends SlotCore {
  /**
   * Install an effect for each declaration lifetime of a slot. The callback runs
   * synchronously when the declaration already exists; otherwise it runs inside
   * the declaring `register()` call after the declaration is committed, and a
   * later re-declaration runs it again.
   * @param key - declared SlotMap key to depend on.
   * @param callback - creates one disposer or an iterable of disposers.
   * @returns an idempotent disposer for the wait and the active effect.
   */
  inject(key: keyof SlotMap & string, callback: () => SlotInjectionEffect): () => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Slot registry service provided by the shell's client composition. */
    slots: SlotsService
  }
}
