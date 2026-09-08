import { prisma } from '../server/prisma.js'
import { CURRENT_PAYLOAD_VERSION } from '../shared/label-payload.js'
import type { LabelPayload } from '../shared/label-payload.js'

const MIDNIGHT_UTC = (offsetDays: number): Date => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offsetDays))
}

const id = (suffix: number): string =>
  `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

type SeedShipment = {
  id: string
  trackingNumber: string
  carrier: 'bpost' | 'postnl'
  recipientPostalCode: string
  recipientCountry: string
  status: 'pending' | 'dropped_off' | 'received' | 'refunded' | 'rejected'
  amountCents: number
  store: string
  createdAgo: number
  dropoffAgo?: number
  receivedAgo?: number
  decisionAgo?: number
  orderNumber?: string
  note?: string
}

const SHIPMENTS: SeedShipment[] = [
  {
    id: id(1),
    trackingNumber: '323200000000000000000001',
    carrier: 'bpost',
    recipientPostalCode: '2000',
    recipientCountry: 'BE',
    status: 'pending',
    amountCents: 4999,
    store: 'Zalando',
    createdAgo: 2,
    orderNumber: 'ZAL-2026-0001',
  },
  {
    id: id(2),
    trackingNumber: '3SDDRL278573402',
    carrier: 'postnl',
    recipientPostalCode: '5145RC',
    recipientCountry: 'NL',
    status: 'pending',
    amountCents: 2350,
    store: 'Zalando BE',
    createdAgo: 16,
    note: 'Waiting for a free afternoon to drop it off.',
  },
  {
    id: id(3),
    trackingNumber: '323200000000000000000003',
    carrier: 'bpost',
    recipientPostalCode: '1000',
    recipientCountry: 'BE',
    status: 'dropped_off',
    amountCents: 1999,
    store: 'H&M',
    createdAgo: 6,
    dropoffAgo: 3,
  },
  {
    id: id(4),
    trackingNumber: '3SDDRL278573404',
    carrier: 'postnl',
    recipientPostalCode: '1101CM',
    recipientCountry: 'NL',
    status: 'dropped_off',
    amountCents: 8990,
    store: 'Zara',
    createdAgo: 24,
    dropoffAgo: 20,
    orderNumber: 'ZR-884512',
  },
  {
    id: id(5),
    trackingNumber: '329900000000000000000005',
    carrier: 'bpost',
    recipientPostalCode: '9000',
    recipientCountry: 'BE',
    status: 'received',
    amountCents: 12500,
    store: 'Decathlon',
    createdAgo: 40,
    dropoffAgo: 34,
    receivedAgo: 28,
  },
  {
    id: id(6),
    trackingNumber: '323200000000000000000006',
    carrier: 'bpost',
    recipientPostalCode: '4000',
    recipientCountry: 'BE',
    status: 'received',
    amountCents: 7499,
    store: 'Nike',
    createdAgo: 8,
    dropoffAgo: 5,
    receivedAgo: 2,
  },
  {
    id: id(7),
    trackingNumber: '3SDDRL278573407',
    carrier: 'postnl',
    recipientPostalCode: '3011AA',
    recipientCountry: 'NL',
    status: 'refunded',
    amountCents: 5999,
    store: 'Zalando',
    createdAgo: 45,
    dropoffAgo: 40,
    receivedAgo: 35,
    decisionAgo: 30,
  },
  {
    id: id(8),
    trackingNumber: '323200000000000000000008',
    carrier: 'bpost',
    recipientPostalCode: '8000',
    recipientCountry: 'BE',
    status: 'refunded',
    amountCents: 3450,
    store: 'Bol.com',
    createdAgo: 20,
    dropoffAgo: 15,
    decisionAgo: 10,
    note: 'Entered after the fact, the reception date was never known.',
  },
  {
    id: id(9),
    trackingNumber: '3SDDRL000000409',
    carrier: 'postnl',
    recipientPostalCode: '5145RC',
    recipientCountry: 'NL',
    status: 'rejected',
    amountCents: 6790,
    store: 'Zara',
    createdAgo: 35,
    dropoffAgo: 30,
    receivedAgo: 25,
    decisionAgo: 18,
    note: 'Refused: worn item according to the store.',
  },
  {
    id: id(10),
    trackingNumber: '329900000000000000000010',
    carrier: 'bpost',
    recipientPostalCode: '2600',
    recipientCountry: 'BE',
    status: 'rejected',
    amountCents: 2999,
    store: 'H&M',
    createdAgo: 16,
    dropoffAgo: 12,
    decisionAgo: 5,
    note: 'Refused, returned outside the 30 day window.',
  },
]

const LABELLED = new Set([id(1), id(5), id(7)])

const payloadFor = (shipment: SeedShipment): LabelPayload => ({
  sender_firstname: 'Alex',
  sender_lastname: 'Nintunze',
  sender_company: '',
  sender_address: 'Rue de la Loi 16',
  sender_postal: '1000',
  sender_city: 'Bruxelles',
  sender_country: 'BE',
  sender_isCompany: false,
  recipient_firstname: '',
  recipient_lastname: '',
  recipient_company: 'Returns Handling BV',
  recipient_address: 'Logistiekweg 4',
  recipient_postal: shipment.recipientPostalCode,
  recipient_city: shipment.recipientCountry === 'NL' ? 'Rotterdam' : 'Antwerpen',
  recipient_country: shipment.recipientCountry === 'NL' ? 'NL' : 'BE',
  recipient_isCompany: true,
  label_language: 'fr',
  carrier: shipment.carrier,
  tracking_number: shipment.trackingNumber,
})

const users = await prisma.user.findMany({ select: { id: true, email: true }, take: 2 })

if (users.length === 0) {
  console.error('No user in the database. Sign in once at http://localhost:5173/login, then seed again.')
  await prisma.$disconnect()
  process.exit(1)
}

if (users.length > 1) {
  console.error('More than one user found. Seeding would have to guess which one owns the data.')
  await prisma.$disconnect()
  process.exit(1)
}

const owner = users[0]

for (const shipment of SHIPMENTS) {
  const data = {
    userId: owner.id,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    recipientPostalCode: shipment.recipientPostalCode,
    recipientCountry: shipment.recipientCountry,
    status: shipment.status,
    amountCents: shipment.amountCents,
    store: shipment.store,
    createdAt: MIDNIGHT_UTC(shipment.createdAgo),
    dropoffDate: shipment.dropoffAgo === undefined ? null : MIDNIGHT_UTC(shipment.dropoffAgo),
    receivedDate: shipment.receivedAgo === undefined ? null : MIDNIGHT_UTC(shipment.receivedAgo),
    decisionDate: shipment.decisionAgo === undefined ? null : MIDNIGHT_UTC(shipment.decisionAgo),
    orderNumber: shipment.orderNumber ?? null,
    note: shipment.note ?? null,
    archivedAt: null,
  }

  await prisma.shipment.upsert({
    where: { id: shipment.id },
    create: { id: shipment.id, ...data },
    update: data,
  })

  if (LABELLED.has(shipment.id)) {
    const label = {
      payload: payloadFor(shipment),
      payloadVersion: CURRENT_PAYLOAD_VERSION,
    }

    await prisma.label.upsert({
      where: { shipmentId: shipment.id },
      create: { shipmentId: shipment.id, ...label },
      update: label,
    })
  }
}

console.log(`Seeded ${String(SHIPMENTS.length)} shipments and ${String(LABELLED.size)} labels for ${owner.email}`)

await prisma.$disconnect()
