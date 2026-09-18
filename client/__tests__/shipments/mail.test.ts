import { describe, it, expect } from 'vitest'
import { MAIL_LANGUAGES, mailDraft, mailLanguageLabel, mailtoLink, needsMail } from '../../shipments/mail.js'
import { makeShipment } from '../fixtures.js'

const noNews = (overrides = {}) => makeShipment({
  status: 'received',
  needsAction: true,
  orderNumber: '402-118843',
  trackingNumber: '323212345678901234',
  dropoffDate: '2026-08-12',
  receivedDate: '2026-08-18',
  daysLeft: -6,
  ...overrides,
})

const notReceived = (overrides = {}) => makeShipment({
  status: 'dropped_off',
  shippingLate: true,
  orderNumber: '402-118843',
  trackingNumber: '323212345678901234',
  dropoffDate: '2026-08-12',
  daysLeft: -3,
  ...overrides,
})

describe('needsMail, the two moments a store has to be chased', () => {
  it('asks for a mail when the store sits on a parcel it received', () => {
    expect(needsMail(noNews())).toBe(true)
  })

  it('asks for a mail when the parcel never reached the store', () => {
    expect(needsMail(notReceived())).toBe(true)
  })

  it('asks for nothing while both deadlines still have time to run', () => {
    expect(needsMail(makeShipment({ status: 'received', daysLeft: 5 }))).toBe(false)
  })

  it('stands down while the store still owes a reply to a mail already sent', () => {
    expect(needsMail(noNews({ awaitingReply: true }))).toBe(false)
    expect(needsMail(notReceived({ awaitingReply: true }))).toBe(false)
  })
})

describe('the message about a return with no news', () => {
  it('names the order in the subject, the reference the store searches by', () => {
    expect(mailDraft(noNews(), 'fr', 'Alex Dupont').subject)
      .toBe('Concernant le retour de la commande 402-118843')
  })

  it('walks the store through both dates, in the order they happened', () => {
    expect(mailDraft(noNews(), 'fr', 'Alex Dupont').body).toBe(
      'Bonjour,\n\n' +
      'Je vous contacte concernant la commande 402-118843, retournée le 12/08/2026 ' +
      'et livrée à votre entrepôt le 18/08/2026.\n\n' +
      'Avez-vous des nouvelles de ce retour ?\n\n' +
      'Merci.\nAlex Dupont\n\n' +
      'Numéro de suivi : 323212345678901234'
    )
  })

  it('drops the clause it has no date for rather than leaving a blank', () => {
    const body = mailDraft(noNews({ dropoffDate: null }), 'fr', 'Alex Dupont').body

    expect(body).toContain('la commande 402-118843, livrée à votre entrepôt le 18/08/2026.')
    expect(body).not.toContain('retournée le')
  })

  it('still reads as a sentence when neither date was ever recorded', () => {
    const body = mailDraft(noNews({ dropoffDate: null, receivedDate: null }), 'fr', 'Alex').body

    expect(body).toContain('Je vous contacte concernant la commande 402-118843.')
  })

  it('says nothing about the tracking, the parcel having arrived', () => {
    expect(mailDraft(noNews(), 'fr', 'Alex').body).not.toContain('En consultant le suivi')
  })
})

describe('the message about a parcel the store never received', () => {
  it('points at the tracking, which is the whole reason for writing', () => {
    expect(mailDraft(notReceived(), 'fr', 'Alex Dupont').body).toBe(
      'Bonjour,\n\n' +
      'Je vous contacte concernant la commande 402-118843, retournée le 12/08/2026.\n\n' +
      'En consultant le suivi, le colis n’a toujours pas été réceptionné. ' +
      'Avez-vous des nouvelles de ce retour ?\n\n' +
      'Merci.\nAlex Dupont\n\n' +
      'Numéro de suivi : 323212345678901234'
    )
  })
})

describe('the english version', () => {
  it('says the same thing, for a store that reads no french', () => {
    const draft = mailDraft(noNews(), 'en', 'Alex Dupont')

    expect(draft.subject).toBe('About the return of order 402-118843')
    expect(draft.body).toBe(
      'Hello,\n\n' +
      'I am writing about order 402-118843, returned on 12/08/2026 ' +
      'and received at your warehouse on 18/08/2026.\n\n' +
      'Do you have any news about this return?\n\n' +
      'Thank you.\nAlex Dupont\n\n' +
      'Tracking number: 323212345678901234'
    )
  })

  it('carries the tracking complaint too', () => {
    expect(mailDraft(notReceived(), 'en', 'Alex').body)
      .toContain('According to the tracking, the parcel has still not been received.')
  })
})

describe('the signature', () => {
  it('trims the name, a stray space being visible in a mail', () => {
    expect(mailDraft(noNews(), 'fr', '  Alex Dupont  ').body).toContain('Merci.\nAlex Dupont')
  })

  it('leaves the line out rather than signing with a blank', () => {
    const body = mailDraft(noNews(), 'fr', '   ').body

    expect(body).toContain('Merci.\n\nNuméro de suivi')
  })
})

describe('mailLanguageLabel', () => {
  it.each(MAIL_LANGUAGES)('gives %s a name a reader recognises', (language) => {
    expect(mailLanguageLabel(language)).toMatch(/^(French|English)$/)
  })
})

describe('mailtoLink', () => {
  it('addresses the store and carries both parts of the message', () => {
    const draft = mailDraft(noNews(), 'fr', 'Alex')
    const link = mailtoLink('service@zalando.be', draft)

    expect(link.startsWith('mailto:service@zalando.be?')).toBe(true)
    expect(link).toContain(`subject=${encodeURIComponent(draft.subject)}`)
    expect(link).toContain(`body=${encodeURIComponent(draft.body)}`)
  })

  it('escapes a space as %20, a plus sign reaching the mail client as a plus sign', () => {
    expect(mailtoLink('a@b.test', mailDraft(noNews(), 'fr', 'Alex'))).not.toContain('+')
  })

  it('opens an empty draft when the store has no address on file', () => {
    expect(mailtoLink(null, mailDraft(noNews(), 'fr', 'Alex')).startsWith('mailto:?')).toBe(true)
  })
})
