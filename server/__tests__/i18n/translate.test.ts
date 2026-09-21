import { describe, it, expect } from 'vitest'
import { isLocale, localeOf, translate } from '../../i18n/translate.js'
import { FRENCH } from '../../i18n/fr.js'

describe('which language the caller reads', () => {
  it.each([
    ['nothing at all', undefined, 'en'],
    ['an empty header', '', 'en'],
    ['plain French', 'fr', 'fr'],
    ['Belgian French', 'fr-BE', 'fr'],
    ['a weighted list that prefers French', 'fr-BE,fr;q=0.9,en;q=0.8', 'fr'],
    ['a weighted list that prefers English', 'en-GB,en;q=0.9,fr;q=0.8', 'en'],
    ['a language it does not speak', 'nl-BE,de;q=0.8', 'en'],
    ['a language it does not speak before one it does', 'nl-BE,fr;q=0.8', 'fr'],
  ])('reads %s as %s', (_case, header, expected) => {
    expect(localeOf(header)).toBe(expected)
  })

  it('knows which tags it speaks', () => {
    expect(isLocale('fr')).toBe(true)
    expect(isLocale('nl')).toBe(false)
  })
})

describe('saying a refusal', () => {
  it('leaves English alone, since English is what the source says', () => {
    expect(translate('en', 'Shipment not found.')).toBe('Shipment not found.')
  })

  it('looks the phrase up in French', () => {
    expect(translate('fr', 'Shipment not found.')).toBe('Suivi introuvable.')
  })

  it('falls back to English rather than showing nothing', () => {
    expect(translate('fr', 'Nobody has translated this yet.')).toBe('Nobody has translated this yet.')
  })

  it('fills in the value a message was about', () => {
    expect(translate('en', '{date} cannot be in the future.', { date: 'The drop-off date' }))
      .toBe('The drop-off date cannot be in the future.')
  })

  it('translates the value too, so the whole sentence is one language', () => {
    expect(translate('fr', '{date} cannot be in the future.', { date: 'The drop-off date' }))
      .toBe('La date de dépôt ne peut pas être dans le futur.')
  })

  it('leaves a value it has never heard of exactly as it came', () => {
    expect(translate('fr', 'must match the {carrier} format: {hint}', {
      carrier: 'Zalando Post',
      hint: '24 digits starting with 3232 or 3299',
    })).toBe('doit suivre le format Zalando Post : 24 chiffres commençant par 3232 ou 3299')
  })

  it('passes a number through without looking it up', () => {
    expect(translate('fr', '{date} cannot be in the future.', { date: 7 }))
      .toBe('7 ne peut pas être dans le futur.')
  })

  it('leaves a placeholder it was given nothing for', () => {
    expect(translate('en', '{date} cannot be in the future.', {}))
      .toBe('{date} cannot be in the future.')
  })

  it('never answers a phrase with nothing', () => {
    const blank = Object.entries(FRENCH)
      .filter(([, french]) => french.trim() === '')
      .map(([english]) => english)

    expect(blank).toEqual([])
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
