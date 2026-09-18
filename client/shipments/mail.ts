import { formatDate } from './format.js'
import type { ShipmentDto } from '../../shared/shipment.js'

export type MailLanguage = 'fr' | 'en'

export const MAIL_LANGUAGES: MailLanguage[] = ['fr', 'en']

type MailDraft = {
  subject: string
  body: string
}

type Copy = {
  label: string
  subject: (order: string) => string
  greeting: string
  opening: (order: string) => string
  returned: (date: string) => string
  delivered: (date: string) => string
  and: string
  notReceived: string
  question: string
  thanks: string
  tracking: (trackingNumber: string) => string
}

const COPY: Record<MailLanguage, Copy> = {
  fr: {
    label: 'French',
    subject: (order) => `Concernant le retour de la commande ${order}`,
    greeting: 'Bonjour,',
    opening: (order) => `Je vous contacte concernant la commande ${order}`,
    returned: (date) => `retournée le ${date}`,
    delivered: (date) => `livrée à votre entrepôt le ${date}`,
    and: ' et ',
    notReceived: 'En consultant le suivi, le colis n’a toujours pas été réceptionné.',
    question: 'Avez-vous des nouvelles de ce retour ?',
    thanks: 'Merci.',
    tracking: (trackingNumber) => `Numéro de suivi : ${trackingNumber}`,
  },
  en: {
    label: 'English',
    subject: (order) => `About the return of order ${order}`,
    greeting: 'Hello,',
    opening: (order) => `I am writing about order ${order}`,
    returned: (date) => `returned on ${date}`,
    delivered: (date) => `received at your warehouse on ${date}`,
    and: ' and ',
    notReceived: 'According to the tracking, the parcel has still not been received.',
    question: 'Do you have any news about this return?',
    thanks: 'Thank you.',
    tracking: (trackingNumber) => `Tracking number: ${trackingNumber}`,
  },
}

export function mailLanguageLabel (language: MailLanguage): string {
  return COPY[language].label
}

export function needsMail (shipment: ShipmentDto): boolean {
  return (shipment.needsAction || shipment.shippingLate) && !shipment.awaitingReply
}

export function mailDraft (
  shipment: ShipmentDto,
  language: MailLanguage,
  sender: string
): MailDraft {
  const copy = COPY[language]

  const clauses = [
    shipment.dropoffDate === null ? null : copy.returned(formatDate(shipment.dropoffDate)),
    shipment.receivedDate === null ? null : copy.delivered(formatDate(shipment.receivedDate)),
  ].filter((clause) => clause !== null)

  const opening =
    clauses.length === 0
      ? `${copy.opening(shipment.orderNumber)}.`
      : `${copy.opening(shipment.orderNumber)}, ${clauses.join(copy.and)}.`

  const asked = shipment.shippingLate ? `${copy.notReceived} ${copy.question}` : copy.question
  const signed = sender.trim() === '' ? copy.thanks : `${copy.thanks}\n${sender.trim()}`

  return {
    subject: copy.subject(shipment.orderNumber),
    body: [copy.greeting, opening, asked, signed, copy.tracking(shipment.trackingNumber)].join('\n\n'),
  }
}

export function mailtoLink (address: string | null, draft: MailDraft): string {
  const query = new URLSearchParams({ subject: draft.subject, body: draft.body })

  return `mailto:${address ?? ''}?${query.toString().replaceAll('+', '%20')}`
}
