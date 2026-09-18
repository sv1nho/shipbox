import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import * as shipments from '../services/shipments/index.js'
import { requireUser, currentUser } from '../auth/require-user.js'
import { parse } from './validate.js'
import { toCsv } from '../../shared/csv.js'
import type { ImportRow } from '../services/shipments/import.js'
import type { ImportOutcome } from '../../shared/shipment.js'
import {
  correctIdentitySchema,
  createShipmentSchema,
  dropOffSchema,
  existsQuerySchema,
  exportQuerySchema,
  idParamSchema,
  importShipmentsSchema,
  listQuerySchema,
  receiveSchema,
  refundSchema,
  rejectSchema,
  updateShipmentSchema,
} from './schemas.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

const idOf = (req: Request): string => parse(idParamSchema, req.params, 'params').id

const userIdOf = (req: Request): string => currentUser(req).id

export const shipmentsRouter = Router()

shipmentsRouter.use(requireUser)

shipmentsRouter.get(
  '/exists',
  handle(async (req, res) => {
    const query = parse(existsQuerySchema, req.query, 'query')
    res.json(await shipments.exists(userIdOf(req), query.carrier, query.trackingNumber))
  })
)

shipmentsRouter.get(
  '/export',
  handle(async (req, res) => {
    const { format, ...filters } = parse(exportQuerySchema, req.query, 'query')
    const items = await shipments.listAll(userIdOf(req), filters)

    if (format === 'csv') {
      res.type('text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="shipments.csv"')
      res.send(toCsv(items))
      return
    }

    res.json({ items, total: items.length })
  })
)

shipmentsRouter.post(
  '/import',
  handle(async (req, res) => {
    const body = parse(importShipmentsSchema, req.body, 'body')
    const rows: ImportRow[] = []
    const refused: ImportOutcome['failures'] = []

    body.shipments.forEach((row, index) => {
      const parsed = createShipmentSchema.safeParse(row)

      if (parsed.success) rows.push({ row: index + 1, input: parsed.data })
      else {
        const first = parsed.error.issues[0]
        refused.push({ row: index + 1, message: `${first.path.join('.')}: ${first.message}` })
      }
    })

    const outcome = await shipments.importMany(shipments.create, userIdOf(req), rows)

    res.json({
      imported: outcome.imported,
      failures: [...refused, ...outcome.failures].sort((a, b) => a.row - b.row),
    })
  })
)

shipmentsRouter.get(
  '/',
  handle(async (req, res) => {
    const query = parse(listQuerySchema, req.query, 'query')
    res.json(await shipments.list(userIdOf(req), query))
  })
)

shipmentsRouter.post(
  '/',
  handle(async (req, res) => {
    const body = parse(createShipmentSchema, req.body, 'body')
    res.status(201).json(await shipments.create(userIdOf(req), body))
  })
)

shipmentsRouter.get(
  '/:id',
  handle(async (req, res) => {
    res.json(await shipments.getById(userIdOf(req), idOf(req)))
  })
)

shipmentsRouter.get(
  '/:id/label',
  handle(async (req, res) => {
    res.json(await shipments.getLabelPayload(userIdOf(req), idOf(req)))
  })
)

shipmentsRouter.patch(
  '/:id',
  handle(async (req, res) => {
    const body = parse(updateShipmentSchema, req.body, 'body')
    res.json(await shipments.update(userIdOf(req), idOf(req), body))
  })
)

shipmentsRouter.post(
  '/:id/correct-identity',
  handle(async (req, res) => {
    const body = parse(correctIdentitySchema, req.body, 'body')
    res.json(await shipments.correctIdentity(userIdOf(req), idOf(req), body))
  })
)

shipmentsRouter.post(
  '/:id/drop-off',
  handle(async (req, res) => {
    const body = parse(dropOffSchema, req.body, 'body')
    res.json(await shipments.transition(userIdOf(req), idOf(req), 'drop_off', body.dropoffDate))
  })
)

shipmentsRouter.post(
  '/:id/receive',
  handle(async (req, res) => {
    const body = parse(receiveSchema, req.body, 'body')
    res.json(await shipments.transition(userIdOf(req), idOf(req), 'receive', body.receivedDate))
  })
)

shipmentsRouter.post(
  '/:id/refund',
  handle(async (req, res) => {
    const body = parse(refundSchema, req.body, 'body')
    res.json(
      await shipments.transition(userIdOf(req), idOf(req), 'refund', body.decisionDate, {
        neverReceived: body.neverReceived,
      })
    )
  })
)

shipmentsRouter.post(
  '/:id/reject',
  handle(async (req, res) => {
    const body = parse(rejectSchema, req.body, 'body')
    res.json(
      await shipments.transition(userIdOf(req), idOf(req), 'reject', body.decisionDate, {
        rejectionReason: body.rejectionReason,
        neverReceived: body.neverReceived,
      })
    )
  })
)

shipmentsRouter.post(
  '/:id/revert',
  handle(async (req, res) => {
    res.json(await shipments.revert(userIdOf(req), idOf(req)))
  })
)

shipmentsRouter.post(
  '/:id/archive',
  handle(async (req, res) => {
    res.json(await shipments.archive(userIdOf(req), idOf(req)))
  })
)

shipmentsRouter.post(
  '/:id/chase',
  handle(async (req, res) => {
    res.json(await shipments.chase(userIdOf(req), idOf(req)))
  })
)

shipmentsRouter.post(
  '/:id/unarchive',
  handle(async (req, res) => {
    res.json(await shipments.unarchive(userIdOf(req), idOf(req)))
  })
)

shipmentsRouter.delete(
  '/:id',
  handle(async (req, res) => {
    await shipments.remove(userIdOf(req), idOf(req))
    res.status(204).end()
  })
)
