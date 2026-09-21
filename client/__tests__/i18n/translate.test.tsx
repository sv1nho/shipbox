import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LocaleProvider, fill, translate, useLocale } from '../../i18n/context.js'
import { LanguageToggle } from '../../i18n/LanguageToggle.js'
import { STORAGE_KEY, isLocale, preferredLocale } from '../../i18n/locale.js'
import { FRENCH } from '../../i18n/fr.js'

const Sample = () => {
  const { locale, t } = useLocale()

  return (
    <>
      <p>{t('Go to the form')}</p>
      <p>{`locale:${locale}`}</p>
      <LanguageToggle />
    </>
  )
}

const renderSample = () => render(<LocaleProvider><Sample /></LocaleProvider>)

beforeEach(() => {
  globalThis.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('picking a language', () => {
  it('takes the one already chosen over anything the browser says', () => {
    expect(preferredLocale('fr', ['en-GB'])).toBe('fr')
  })

  it('follows the browser when nothing was chosen', () => {
    expect(preferredLocale(null, ['fr-BE', 'nl-BE'])).toBe('fr')
  })

  it('falls back to English for a language it does not speak', () => {
    expect(preferredLocale(null, ['nl-BE'])).toBe('en')
  })

  it('ignores a stored value that is not a language it knows', () => {
    expect(preferredLocale('klingon', ['en'])).toBe('en')
    expect(isLocale('klingon')).toBe(false)
  })
})

describe('translating', () => {
  it('leaves English alone, since English is what the source says', () => {
    expect(translate('en', 'Go to the form')).toBe('Go to the form')
  })

  it('looks the phrase up in French', () => {
    expect(translate('fr', 'Go to the form')).toBe('Aller au formulaire')
  })

  it('falls back to English rather than showing a blank or a key', () => {
    expect(translate('fr', 'Nobody has translated this yet')).toBe('Nobody has translated this yet')
  })

  it.each([
    ['fills a placeholder', 'Read this site in {language}', { language: 'English' }, 'Read this site in English'],
    ['leaves a placeholder it was given nothing for', 'Read this site in {language}', {}, 'Read this site in {language}'],
  ])('%s', (_case, phrase, vars, expected) => {
    expect(fill(phrase, vars)).toBe(expected)
  })

  it('every French phrase answers a phrase the source can ask for', () => {
    for (const [english, french] of Object.entries(FRENCH)) {
      expect(french.trim()).not.toBe('')
      expect(french).not.toBe(english)
    }
  })
})

describe('the toggle', () => {
  it('offers the other language, and switches to it', async () => {
    renderSample()

    expect(screen.getByText('locale:en')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /read this site in français/i }))

    expect(screen.getByText('locale:fr')).toBeInTheDocument()
    expect(screen.getByText('Aller au formulaire')).toBeInTheDocument()
  })

  it('remembers the choice for the next visit', async () => {
    renderSample()

    await userEvent.click(screen.getByRole('button', { name: /français/i }))

    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('fr')
  })

  it('still switches when the browser refuses to store anything', async () => {
    const denied = () => { throw new Error('storage is off') }

    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(denied)
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(denied)

    renderSample()

    await userEvent.click(screen.getByRole('button', { name: /français/i }))

    expect(screen.getByText('locale:fr')).toBeInTheDocument()
  })
})

describe('a component rendered outside the provider', () => {
  it('reads as English instead of crashing', async () => {
    render(<Sample />)

    expect(screen.getByText('Go to the form')).toBeInTheDocument()
    expect(screen.getByText('locale:en')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /français/i }))

    expect(screen.getByText('locale:en')).toBeInTheDocument()
  })
})
