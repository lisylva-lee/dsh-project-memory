/**
 * Unit tests for dsh home resolution ($DSH_HOME with a homedir fallback).
 */
import { homedir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { dshHome } from '../src/core/home.ts'

const ORIGINAL = process.env.DSH_HOME

describe('dshHome', () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = ORIGINAL
  })

  it('honors $DSH_HOME when set', () => {
    process.env.DSH_HOME = 'D:/custom-home'
    expect(dshHome()).toBe('D:/custom-home')
  })

  it('falls back to the OS home directory when $DSH_HOME is unset', () => {
    delete process.env.DSH_HOME
    expect(dshHome()).toBe(homedir())
  })
})
