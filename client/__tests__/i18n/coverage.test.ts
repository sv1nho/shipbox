import { describe, it, expect } from 'vitest'
import { FRENCH } from '../../i18n/fr.js'
import { statusLabel, statusDate } from '../../shipments/format.js'
import { TRANSITIONS, TRANSITION_ACTIONS, menuSteps, nextStep, undoLabel } from '../../../shared/transitions.js'
import { SHIPMENT_STATUSES } from '../../../shared/shipment-status.js'
import { makeShipment } from '../fixtures.js'

const SOURCES = Object.values(import.meta.glob<string>(
  ['../../**/*.{ts,tsx}', '!../../**/__tests__/**', '!../../i18n/**'],
  { query: '?raw', import: 'default', eager: true }
))

const PHRASE = String.raw`'((?:[^'\\]|\\.)*)'`

const CALL = new RegExp(String.raw`\bt\(\s*${PHRASE}((?:\s*\+\s*${PHRASE})*)`, 'g')
const PART = new RegExp(PHRASE, 'g')

const unescape = (raw: string): string => raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

const phrasesAskedFor = (): Set<string> => {
  const asked = new Set<string>()

  for (const source of SOURCES) {
    for (const call of source.matchAll(CALL)) {
      const parts = [...`'${call[1]}'${call[2]}`.matchAll(PART)].map((part) => unescape(part[1]))
      asked.add(parts.join(''))
    }
  }

  return asked
}

describe('the French catalogue', () => {
  it('reads the source it is meant to cover', () => {
    expect(SOURCES.length).toBeGreaterThan(15)
    expect(phrasesAskedFor().size).toBeGreaterThan(150)
  })

  it('answers every phrase the source asks for', () => {
    const untranslated = [...phrasesAskedFor()]
      .filter((phrase) => phrase !== '' && !(phrase in FRENCH))
      .sort()

    expect(untranslated).toEqual([])
  })

  it('keeps every placeholder the English phrase carries', () => {
    const placeholders = (phrase: string): string[] =>
      [...phrase.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

    const mismatched = Object.entries(FRENCH)
      .filter(([english, french]) =>
        placeholders(english).join(',') !== placeholders(french).join(','))
      .map(([english]) => english)

    expect(mismatched).toEqual([])
  })
})

const labelsBuiltFromData = (): Set<string> => {
  const labels = new Set<string>()

  for (const action of TRANSITION_ACTIONS) labels.add(TRANSITIONS[action].label)

  for (const status of SHIPMENT_STATUSES) {
    labels.add(statusLabel(status))
    labels.add(statusDate(makeShipment({ status })).label)

    const next = nextStep(status)
    if (next !== null) labels.add(next.label)

    const undo = undoLabel(status)
    if (undo !== null) labels.add(undo)

    for (const step of menuSteps(status)) labels.add(step.label)
  }

  return labels
}

describe('the labels no source file spells out', () => {
  it('answers every status, step and undo the menus build from data', () => {
    const untranslated = [...labelsBuiltFromData()]
      .filter((label) => !(label in FRENCH))
      .sort()

    expect(untranslated).toEqual([])
  })
})
