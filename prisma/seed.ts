import { prisma } from '../server/prisma.js'
import { CURRENT_PAYLOAD_VERSION } from '../shared/label-payload.js'
import type { LabelPayload } from '../shared/label-payload.js'
import type { ShipmentStatus } from '../shared/shipment-status.js'

const MIDNIGHT_UTC = (offsetDays: number): Date => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offsetDays))
}

const id = (suffix: number): string =>
  `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

type SeedStore = {
  name: string
  supportEmail: string | null
  prefix: string
  decisionDays: number
}

const STORES: SeedStore[] = [
  { name: 'Zalando', supportEmail: 'service@zalando.be', prefix: 'ZAL', decisionDays: 4 },
  { name: 'Zalando BE', supportEmail: 'service@zalando.be', prefix: 'ZLB', decisionDays: 5 },
  { name: 'H&M', supportEmail: 'kundservice@hm.com', prefix: 'HM', decisionDays: 12 },
  { name: 'Zara', supportEmail: null, prefix: 'ZR', decisionDays: 18 },
  { name: 'Decathlon', supportEmail: 'contact@decathlon.be', prefix: 'DK', decisionDays: 6 },
  { name: 'Nike', supportEmail: 'support@nike.com', prefix: 'NK', decisionDays: 9 },
  { name: 'Bol.com', supportEmail: null, prefix: 'BOL', decisionDays: 21 },
  { name: 'Snipes', supportEmail: 'support@snipes.com', prefix: 'SNP', decisionDays: 7 },
  { name: 'ASOS', supportEmail: 'help@asos.com', prefix: 'AS', decisionDays: 5 },
  { name: 'JBC', supportEmail: null, prefix: 'JBC', decisionDays: 15 },
]

type Ago = {
  requested: number
  dropoff?: number
  received?: number
}

type Recipe = {
  status: ShipmentStatus
  count: number
  ago: (index: number) => Ago
  archived?: boolean
  note?: string
}

const PLAN: Recipe[] = [
  {
    status: 'pending',
    count: 6,
    ago: (index) => ({ requested: 1 + index * 2 }),
  },
  {
    status: 'pending',
    count: 3,
    ago: (index) => ({ requested: 24 + index }),
    note: 'Label about to expire, drop it off this week.',
  },
  {
    status: 'pending',
    count: 2,
    ago: (index) => ({ requested: 32 + index * 4 }),
    note: 'Label expired, a new one has to be asked for.',
  },
  {
    status: 'dropped_off',
    count: 5,
    ago: (index) => ({ requested: 6 + index * 2, dropoff: 4 + index * 2 }),
  },
  {
    status: 'dropped_off',
    count: 4,
    ago: (index) => ({ requested: 20 + index * 4, dropoff: 17 + index * 4 }),
    note: 'Dropped off, the store still has not scanned it in.',
  },
  {
    status: 'received',
    count: 5,
    ago: (index) => ({ requested: 10 + index * 2, dropoff: 8 + index * 2, received: 5 + index * 2 }),
  },
  {
    status: 'received',
    count: 4,
    ago: (index) => ({ requested: 30 + index * 6, dropoff: 27 + index * 6, received: 22 + index * 6 }),
    note: 'Received weeks ago and still no decision.',
  },
  {
    status: 'refunded',
    count: 18,
    ago: (index) => ({ requested: 45 + index * 6, dropoff: 42 + index * 6, received: 38 + index * 6 }),
  },
  {
    status: 'rejected',
    count: 5,
    ago: (index) => ({ requested: 50 + index * 9, dropoff: 47 + index * 9, received: 43 + index * 9 }),
  },
  {
    status: 'refunded',
    count: 2,
    ago: (index) => ({ requested: 210 + index * 20, dropoff: 207 + index * 20, received: 203 + index * 20 }),
    archived: true,
  },
]

const REJECTIONS = [
  'Worn outside, soles are dirty.',
  'Returned after the thirty day window.',
  'The security tag was cut off.',
  'Not the item that was sent out.',
  'Sale item, no refund on those.',
]

type SeedShipment = {
  id: string
  trackingNumber: string
  carrier: 'bpost' | 'postnl'
  recipientPostalCode: string
  recipientCountry: string
  amountCents: number
  store: SeedStore
  status: ShipmentStatus
  orderNumber: string
  requestedAgo: number
  dropoffAgo: number | null
  receivedAgo: number | null
  decisionAgo: number | null
  rejectionReason: string | null
  note: string | null
  archived: boolean
}

const POSTAL_CODES = [
  { code: '2000', country: 'BE' },
  { code: '1000', country: 'BE' },
  { code: '9000', country: 'BE' },
  { code: '4000', country: 'BE' },
  { code: '2600', country: 'BE' },
  { code: '1101CM', country: 'NL' },
  { code: '3011AA', country: 'NL' },
  { code: '5145RC', country: 'NL' },
]

const trackingFor = (carrier: 'bpost' | 'postnl', index: number): string =>
  carrier === 'bpost'
    ? `3232${String(index).padStart(20, '0')}`
    : `3SDDRL${String(278573000 + index)}`

const build = (): SeedShipment[] => {
  const shipments: SeedShipment[] = []
  let rejected = 0

  for (const recipe of PLAN) {
    for (let index = 0; index < recipe.count; index += 1) {
      const rank = shipments.length
      const store = STORES[rank % STORES.length]
      const carrier = rank % 3 === 2 ? 'postnl' : 'bpost'
      const place = POSTAL_CODES[rank % POSTAL_CODES.length]
      const ago = recipe.ago(index)
      const received = ago.received ?? null

      const spread = store.decisionDays + ((rank % 7) - 3)

      const decision =
        received === null || (recipe.status !== 'refunded' && recipe.status !== 'rejected')
          ? null
          : Math.max(0, received - Math.max(1, spread))

      const reason =
        recipe.status === 'rejected' ? REJECTIONS[rejected % REJECTIONS.length] : null

      if (reason !== null) rejected += 1

      shipments.push({
        id: id(rank + 1),
        trackingNumber: trackingFor(carrier, rank + 1),
        carrier,
        recipientPostalCode: place.code,
        recipientCountry: place.country,
        amountCents: 1500 + ((rank * 1370) % 18500),
        store,
        status: recipe.status,
        orderNumber: `${store.prefix}-2026-${String(4100 + rank * 7)}`,
        requestedAgo: ago.requested,
        dropoffAgo: ago.dropoff ?? null,
        receivedAgo: received,
        decisionAgo: decision,
        rejectionReason: reason,
        note: recipe.note ?? null,
        archived: recipe.archived === true,
      })
    }
  }

  return shipments
}

const SHIPMENTS = build()

const LABELLED = new Set(SHIPMENTS.slice(0, 3).map((shipment) => shipment.id))

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
await prisma.store.deleteMany({ where: { userId: owner.id } })

const storeIds = new Map<string, string>()

for (const store of STORES) {
  const row = await prisma.store.create({
    data: { userId: owner.id, name: store.name, supportEmail: store.supportEmail },
    select: { id: true },
  })

  storeIds.set(store.name, row.id)
}

const dateOf = (ago: number | null): Date | null => (ago === null ? null : MIDNIGHT_UTC(ago))

for (const shipment of SHIPMENTS) {
  await prisma.shipment.create({
    data: {
      id: shipment.id,
      userId: owner.id,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      recipientPostalCode: shipment.recipientPostalCode,
      recipientCountry: shipment.recipientCountry,
      status: shipment.status,
      amountCents: shipment.amountCents,
      storeId: storeIds.get(shipment.store.name) ?? '',
      createdAt: MIDNIGHT_UTC(shipment.requestedAgo),
      requestedDate: MIDNIGHT_UTC(shipment.requestedAgo),
      dropoffDate: dateOf(shipment.dropoffAgo),
      receivedDate: dateOf(shipment.receivedAgo),
      decisionDate: dateOf(shipment.decisionAgo),
      orderNumber: shipment.orderNumber,
      note: shipment.note,
      rejectionReason: shipment.rejectionReason,
      archivedAt: shipment.archived ? MIDNIGHT_UTC(shipment.requestedAgo - 1) : null,
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

const count = (status: ShipmentStatus): number =>
  SHIPMENTS.filter((shipment) => shipment.status === status).length

console.log(
  `Replaced ${String(removed.count)} shipments with ${String(SHIPMENTS.length)} across ` +
  `${String(STORES.length)} stores for ${owner.email}: ` +
  `${String(count('pending'))} pending, ${String(count('dropped_off'))} dropped off, ` +
  `${String(count('received'))} received, ${String(count('refunded'))} refunded, ` +
  `${String(count('rejected'))} rejected, ${String(LABELLED.size)} with a label`
)

await prisma.$disconnect()
