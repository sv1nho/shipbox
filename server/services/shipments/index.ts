import { prisma } from '../../prisma.js'
import { AppError } from '../../errors.js'
import { today, toUtcDate } from './dates.js'
import type { IsoDate } from './dates.js'
import {
  assertChronology,
  assertDates,
  assertStatusHasItsDate,
  planRevert,
  planTransition,
} from './status.js'
import type { DatedShipment, ShipmentState } from './status.js'
import type { TransitionAction } from '../../../shared/transitions.js'
import { normalizeCountry, normalizePostalCode, normalizeTrackingNumber } from '../../../shared/normalize.js'
import { storeIdFor } from './stores.js'
import { toShipmentDto, toShipmentState } from './mapper.js'
import type { ShipmentRow } from './mapper.js'
import type {
  CorrectIdentityInput,
  CreateShipmentInput,
  ExistsResult,
  ListParams,
  ListResult,
  ShipmentDto,
  SortKey,
  UpdateShipmentInput,
} from './types.js'
import type { CarrierId } from '../../../shared/carriers.js'
import type { LabelPayload } from '../../../shared/label-payload.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_PAGE_SIZE = 100

const DEFAULT_PAGE_SIZE = 25

const ROW_INCLUDE = {
  label: { select: { shipmentId: true } },
  store: { select: { name: true, supportEmail: true } },
} as const

const notFound = (): AppError => new AppError('NOT_FOUND', 'Shipment not found.')

const isUniqueViolation = (cause: unknown): boolean =>
  typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002'

const alreadyRegistered = (): AppError =>
  new AppError('CONFLICT', 'This tracking number is already registered.')

const asDate = (value: IsoDate | null): Date | null =>
  value === null ? null : toUtcDate(value)

type ShipmentWrite = {
  status?: ShipmentState['status']
  carrier?: string
  trackingNumber?: string
  recipientPostalCode?: string
  recipientCountry?: string
  amountCents?: number
  storeId?: string
  orderNumber?: string | null
  note?: string | null
  rejectionReason?: string | null
  requestedDate?: Date
  dropoffDate?: Date | null
  receivedDate?: Date | null
  decisionDate?: Date | null
  archivedAt?: Date | null
}

const stateWrite = (next: ShipmentState): ShipmentWrite => ({
  status: next.status,
  rejectionReason: next.rejectionReason,
  dropoffDate: asDate(next.dropoffDate),
  receivedDate: asDate(next.receivedDate),
  decisionDate: asDate(next.decisionDate),
})

async function writeOwned (id: string, data: ShipmentWrite, now: IsoDate): Promise<ShipmentDto> {
  const updated = await prisma.shipment.update({ where: { id }, include: ROW_INCLUDE, data })
  return toShipmentDto(updated, now)
}

async function editableRow (userId: string, id: string): Promise<ShipmentRow> {
  const row = await ownedRow(userId, id)

  if (row.archivedAt !== null) {
    throw new AppError('CONFLICT', 'This shipment is archived. Put it back in the list first.')
  }

  return row
}

async function ownedRow (userId: string, id: string): Promise<ShipmentRow> {
  if (!UUID.test(id)) throw notFound()

  const row = await prisma.shipment.findFirst({
    where: { id, userId },
    include: ROW_INCLUDE,
  })

  if (!row) throw notFound()
  return row
}

const orderByOf = (sort: SortKey, direction: 'asc' | 'desc') => {
  switch (sort) {
    case 'waitingDays':
      return { receivedDate: { sort: direction === 'desc' ? 'asc' : 'desc', nulls: 'last' } } as const
    case 'updatedAt':
      return { updatedAt: direction }
    case 'dropoffDate':
      return { dropoffDate: { sort: direction, nulls: 'last' } } as const
    case 'receivedDate':
      return { receivedDate: { sort: direction, nulls: 'last' } } as const
    case 'decisionDate':
      return { decisionDate: { sort: direction, nulls: 'last' } } as const
    case 'amountCents':
      return { amountCents: direction }
    case 'store':
      return { store: { name: direction } }
    default:
      return { createdAt: direction }
  }
}

const whereOf = (userId: string, params: ListParams) => {
  const archived = params.archived ?? 'exclude'
  const search = params.search?.trim()

  return {
    userId,
    ...(params.carrier ? { carrier: params.carrier } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.store ? { store: { name: params.store } } : {}),
    ...(archived === 'exclude' ? { archivedAt: null } : {}),
    ...(archived === 'only' ? { archivedAt: { not: null } } : {}),
    ...(search
      ? {
          OR: [
            { trackingNumber: { contains: search, mode: 'insensitive' as const } },
            { store: { name: { contains: search, mode: 'insensitive' as const } } },
            { orderNumber: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
}

export async function listAll (userId: string, params: ListParams = {}): Promise<ShipmentDto[]> {
  const rows = await prisma.shipment.findMany({
    where: whereOf(userId, params),
    include: ROW_INCLUDE,
    orderBy: orderByOf(params.sort ?? 'createdAt', params.direction ?? 'desc'),
  })

  const now = today()
  return rows.map((row) => toShipmentDto(row, now))
}

export async function list (userId: string, params: ListParams = {}): Promise<ListResult> {
  const page = Math.max(1, Math.trunc(params.page ?? 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE)))
  const where = whereOf(userId, params)

  const [rows, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: ROW_INCLUDE,
      orderBy: orderByOf(params.sort ?? 'createdAt', params.direction ?? 'desc'),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shipment.count({ where }),
  ])

  const now = today()

  return {
    items: rows.map((row) => toShipmentDto(row, now)),
    total,
    page,
    pageSize,
  }
}

export async function getById (userId: string, id: string): Promise<ShipmentDto> {
  return toShipmentDto(await ownedRow(userId, id), today())
}

export async function create (userId: string, input: CreateShipmentInput): Promise<ShipmentDto> {
  const now = today()
  const status = input.status ?? 'pending'

  const dates: DatedShipment = {
    requestedDate: input.requestedDate ?? now,
    dropoffDate: input.dropoffDate ?? null,
    receivedDate: input.receivedDate ?? null,
    decisionDate: input.decisionDate ?? null,
  }

  const rejectionReason = status === 'rejected' ? input.rejectionReason ?? null : null

  assertDates(dates, now)
  assertChronology(dates)
  assertStatusHasItsDate({ status, rejectionReason, ...dates })

  const data = {
    userId,
    trackingNumber: normalizeTrackingNumber(input.trackingNumber),
    carrier: input.carrier,
    recipientPostalCode: normalizePostalCode(input.recipientPostalCode),
    recipientCountry: normalizeCountry(input.recipientCountry),
    status,
    amountCents: input.amountCents,
    requestedDate: toUtcDate(dates.requestedDate),
    dropoffDate: asDate(dates.dropoffDate),
    receivedDate: asDate(dates.receivedDate),
    decisionDate: asDate(dates.decisionDate),
    orderNumber: input.orderNumber ?? null,
    note: input.note ?? null,
    rejectionReason,
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const storeId = await storeIdFor(tx, userId, input.store, input.storeSupportEmail)
      const created = await tx.shipment.create({ data: { ...data, storeId } })

      if (input.label) {
        await tx.label.create({
          data: {
            shipmentId: created.id,
            payload: input.label.payload,
            payloadVersion: input.label.payloadVersion,
          },
        })
      }

      return tx.shipment.findFirstOrThrow({
        where: { id: created.id },
        include: ROW_INCLUDE,
      })
    })

    return toShipmentDto(row, now)
  } catch (cause) {
    if (isUniqueViolation(cause)) throw alreadyRegistered()
    throw cause
  }
}

export async function update (
  userId: string,
  id: string,
  patch: UpdateShipmentInput
): Promise<ShipmentDto> {
  const row = await editableRow(userId, id)
  const now = today()
  const current = toShipmentState(row)

  const dates: DatedShipment = {
    requestedDate: patch.requestedDate ?? current.requestedDate,
    dropoffDate: patch.dropoffDate ?? current.dropoffDate,
    receivedDate: patch.receivedDate ?? current.receivedDate,
    decisionDate: patch.decisionDate ?? current.decisionDate,
  }

  assertDates(dates, now)
  assertChronology(dates)

  return writeOwned(
    row.id,
    {
      ...(patch.recipientPostalCode === undefined
        ? {}
        : { recipientPostalCode: normalizePostalCode(patch.recipientPostalCode) }),
      ...(patch.recipientCountry === undefined
        ? {}
        : { recipientCountry: normalizeCountry(patch.recipientCountry) }),
      ...(patch.amountCents === undefined ? {} : { amountCents: patch.amountCents }),
      ...(patch.store === undefined
        ? {}
        : { storeId: await storeIdFor(prisma, userId, patch.store) }),
      ...(patch.orderNumber === undefined ? {} : { orderNumber: patch.orderNumber }),
      ...(patch.note === undefined ? {} : { note: patch.note }),
      requestedDate: toUtcDate(dates.requestedDate),
      dropoffDate: asDate(dates.dropoffDate),
      receivedDate: asDate(dates.receivedDate),
      decisionDate: asDate(dates.decisionDate),
    },
    now
  )
}

export async function correctIdentity (
  userId: string,
  id: string,
  input: CorrectIdentityInput
): Promise<ShipmentDto> {
  const row = await editableRow(userId, id)

  try {
    return await writeOwned(
      row.id,
      { carrier: input.carrier, trackingNumber: normalizeTrackingNumber(input.trackingNumber) },
      today()
    )
  } catch (cause) {
    if (isUniqueViolation(cause)) throw alreadyRegistered()
    throw cause
  }
}

export async function transition (
  userId: string,
  id: string,
  action: TransitionAction,
  date: IsoDate,
  rejectionReason?: string
): Promise<ShipmentDto> {
  const row = await editableRow(userId, id)
  const now = today()

  return writeOwned(
    row.id,
    stateWrite(planTransition(toShipmentState(row), action, date, now, rejectionReason)),
    now
  )
}

export async function revert (userId: string, id: string): Promise<ShipmentDto> {
  const row = await editableRow(userId, id)

  return writeOwned(row.id, stateWrite(planRevert(toShipmentState(row))), today())
}

export async function archive (userId: string, id: string): Promise<ShipmentDto> {
  const row = await ownedRow(userId, id)

  if (row.archivedAt !== null) {
    throw new AppError('CONFLICT', 'This shipment is already archived.')
  }

  return writeOwned(row.id, { archivedAt: new Date() }, today())
}

export async function unarchive (userId: string, id: string): Promise<ShipmentDto> {
  const row = await ownedRow(userId, id)

  if (row.archivedAt === null) {
    throw new AppError('CONFLICT', 'This shipment is not archived.')
  }

  return writeOwned(row.id, { archivedAt: null }, today())
}

export async function remove (userId: string, id: string): Promise<void> {
  const row = await ownedRow(userId, id)
  await prisma.shipment.delete({ where: { id: row.id } })
}

export async function exists (
  userId: string,
  carrier: CarrierId,
  trackingNumber: string
): Promise<ExistsResult> {
  const row = await prisma.shipment.findFirst({
    where: { userId, carrier, trackingNumber: normalizeTrackingNumber(trackingNumber) },
    select: { id: true, archivedAt: true },
  })

  if (!row) return { exists: false }

  return { exists: true, id: row.id, archived: row.archivedAt !== null }
}

export async function getLabelPayload (
  userId: string,
  id: string
): Promise<{ payload: LabelPayload; payloadVersion: number }> {
  await ownedRow(userId, id)

  const label = await prisma.label.findUnique({
    where: { shipmentId: id },
    select: { payload: true, payloadVersion: true },
  })

  if (!label) {
    throw new AppError('NOT_FOUND', 'This shipment has no label to regenerate.')
  }

  return {
    payload: label.payload as unknown as LabelPayload,
    payloadVersion: label.payloadVersion,
  }
}

export { importMany } from './import.js'
