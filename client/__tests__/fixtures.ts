import type { ShipmentDto } from '../../shared/shipment.js'
import type { LabelPayload } from '../../shared/label-payload.js'

export function makeShipment (overrides: Partial<ShipmentDto> = {}): ShipmentDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    trackingNumber: '323200000000000000000001',
    carrier: 'bpost',
    recipientPostalCode: '2000',
    recipientCountry: 'BE',
    status: 'pending',
    amountCents: 4999,
    currency: 'EUR',
    store: 'Zalando',
    storeSupportEmail: null,
    requestedDate: '2026-06-01',
    dropoffDate: null,
    receivedDate: null,
    decisionDate: null,
    orderNumber: null,
    note: null,
    rejectionReason: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    archivedAt: null,
    trackingUrl: 'https://track.bpost.cloud/btr/web/#/search?lang=fr',
    hasLabel: false,
    daysSinceRequested: 0,
    daysSinceDropoff: null,
    daysSinceReceived: null,
    decisionDelayDays: null,
    totalDelayDays: null,
    daysLeft: 30,
    needsAction: false,
    shippingLate: false,
    labelExpiring: false,
    ...overrides,
  }
}

export function makeLabelPayload (overrides: Partial<LabelPayload> = {}): LabelPayload {
  return {
    sender_firstname: 'Jean',
    sender_lastname: 'Dupont',
    sender_company: '',
    sender_isCompany: false,
    sender_address: 'Rue de la Paix 1',
    sender_postal: '1000',
    sender_city: 'Bruxelles',
    sender_country: 'BE',
    recipient_firstname: 'Marie',
    recipient_lastname: 'Martin',
    recipient_company: '',
    recipient_isCompany: false,
    recipient_address: 'Avenue Centrale 45',
    recipient_postal: '4000',
    recipient_city: 'Liège',
    recipient_country: 'BE',
    carrier: 'bpost',
    tracking_number: '323200000000000000004050',
    label_language: 'fr',
    ...overrides,
  }
}
