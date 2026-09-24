import { describe, it, expect, vi, afterEach } from 'vitest'
import { recallDraft, rememberDraft } from '../../utils/label-draft.js'

afterEach(() => {
  globalThis.localStorage.clear()
  vi.restoreAllMocks()
})

describe('the draft of the label form', () => {
  it('gives back what was written', () => {
    rememberDraft({ sender_firstname: 'Marie', carrier: 'postnl' })

    expect(recallDraft()).toEqual({ sender_firstname: 'Marie', carrier: 'postnl' })
  })

  it('starts from nothing when no one has written yet', () => {
    expect(recallDraft()).toEqual({})
  })

  it('ignores a stored value that is not a form', () => {
    globalThis.localStorage.setItem('shipbox.label-draft', '"a string"')

    expect(recallDraft()).toEqual({})
  })

  it('ignores stored text that is not json at all', () => {
    globalThis.localStorage.setItem('shipbox.label-draft', '{oops')

    expect(recallDraft()).toEqual({})
  })

  it('reads nothing when the browser refuses storage', () => {
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => { throw new Error('denied') })

    expect(recallDraft()).toEqual({})
  })

  it('lets the form work on when the browser refuses to store', () => {
    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => { throw new Error('denied') })

    expect(() => { rememberDraft({ sender_city: 'Liège' }) }).not.toThrow()
  })
})
