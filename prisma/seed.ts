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
  amountCents: number
  store: string
  createdAgo: number
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
    amountCents: 4999,
    store: 'Zalando',
    createdAgo: 0,
    orderNumber: 'ZAL-2026-0001',
  },
  {
    id: id(2),
    trackingNumber: '3SDDRL278573402',
    carrier: 'postnl',
    recipientPostalCode: '5145RC',
    recipientCountry: 'NL',
    amountCents: 2350,
    store: 'Zalando BE',
    createdAgo: 2,
  },
  {
    id: id(3),
    trackingNumber: '323200000000000000000003',
    carrier: 'bpost',
    recipientPostalCode: '1000',
    recipientCountry: 'BE',
    amountCents: 1999,
    store: 'H&M',
    createdAgo: 5,
    orderNumber: 'HM-55120',
  },
  {
    id: id(4),
    trackingNumber: '3SDDRL278573404',
    carrier: 'postnl',
    recipientPostalCode: '1101CM',
    recipientCountry: 'NL',
    amountCents: 8990,
    store: 'Zara',
    createdAgo: 8,
    note: 'Waiting for a free afternoon to drop it off.',
  },
  {
    id: id(5),
    trackingNumber: '329900000000000000000005',
    carrier: 'bpost',
    recipientPostalCode: '9000',
    recipientCountry: 'BE',
    amountCents: 12500,
    store: 'Decathlon',
    createdAgo: 15,
    orderNumber: 'DK-2026-77431',
  },
  {
    id: id(6),
    trackingNumber: '323200000000000000000006',
    carrier: 'bpost',
    recipientPostalCode: '4000',
    recipientCountry: 'BE',
    amountCents: 7499,
    store: 'Nike',
    createdAgo: 23,
  },
  {
    id: id(7),
    trackingNumber: '3SDDRL278573407',
    carrier: 'postnl',
    recipientPostalCode: '3011AA',
    recipientCountry: 'NL',
    amountCents: 5999,
    store: 'Bol.com',
    createdAgo: 26,
    note: 'Keeps slipping down the list.',
  },
  {
    id: id(8),
    trackingNumber: '329900000000000000000008',
    carrier: 'bpost',
    recipientPostalCode: '2600',
    recipientCountry: 'BE',
    amountCents: 3450,
    store: 'Snipes',
    createdAgo: 29,
    orderNumber: 'SNP-0099',
  },
]

const LABELLED = new Set([id(1), id(5), id(8)])

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

const removed = await prisma.shipment.deleteMany({ where: { userId: owner.id } })

for (const shipment of SHIPMENTS) {
  await prisma.shipment.create({
    data: {
      id: shipment.id,
      userId: owner.id,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      recipientPostalCode: shipment.recipientPostalCode,
      recipientCountry: shipment.recipientCountry,
      status: 'pending',
      amountCents: shipment.amountCents,
      store: shipment.store,
      createdAt: MIDNIGHT_UTC(shipment.createdAgo),
      dropoffDate: null,
      receivedDate: null,
      decisionDate: null,
      orderNumber: shipment.orderNumber ?? null,
      note: shipment.note ?? null,
      archivedAt: null,
      ...(LABELLED.has(shipment.id)
        ? {
            label: {
              create: {
                payload: payloadFor(shipment),
                payloadVersion: CURRENT_PAYLOAD_VERSION,
              },
            },
          }
        : {}),
    },
  })
}

console.log(
  `Replaced ${String(removed.count)} shipments with ${String(SHIPMENTS.length)} pending ones ` +
  `and ${String(LABELLED.size)} labels for ${owner.email}`
)

await prisma.$disconnect()
