/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { globSync, readFileSync } from 'node:fs'
import { FRENCH } from '../../i18n/fr.js'

const SOURCES = globSync('client/**/*.{ts,tsx}')
  .filter((path) => !path.includes('__tests__') && !path.includes('i18n'))

const PHRASE = String.raw`'((?:[^'\\]|\\.)*)'`

const CALL = new RegExp(String.raw`\bt\(\s*${PHRASE}((?:\s*\+\s*${PHRASE})*)`, 'g')
const PART = new RegExp(PHRASE, 'g')

const unescape = (raw: string): string => raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

const phrasesAskedFor = (): Set<string> => {
  const asked = new Set<string>()

  for (const path of SOURCES) {
    const source = readFileSync(path, 'utf8')

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
