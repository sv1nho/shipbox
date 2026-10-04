import type { LabelPayload } from '../types/index.js'

const KEY = 'shipbox.label-draft'

export const recallDraft = (): Partial<LabelPayload> => {
  try {
    const stored = globalThis.localStorage.getItem(KEY)
    if (stored === null) return {}

    const parsed: unknown = JSON.parse(stored)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export const forgetDraft = (): void => {
  try {
    globalThis.localStorage.removeItem(KEY)
  } catch {
    return
  }
}

export const rememberDraft = (draft: Partial<LabelPayload>): void => {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    return
  }
}
