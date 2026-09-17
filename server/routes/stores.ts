import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import * as stores from '../services/shipments/stores.js'
import { requireUser, currentUser } from '../auth/require-user.js'
import { parse } from './validate.js'
import { createStoreSchema, storesQuerySchema } from './schemas.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

export const storesRouter = Router()

storesRouter.use(requireUser)

storesRouter.get(
  '/',
  handle(async (req, res) => {
    const query = parse(storesQuerySchema, req.query, 'query')
    const userId = currentUser(req).id

    res.json({ stores: await stores.searchStores(userId, query.q ?? '', query.limit) })
  })
)

storesRouter.post(
  '/',
  handle(async (req, res) => {
    const body = parse(createStoreSchema, req.body, 'body')
    const userId = currentUser(req).id

    res.status(201).json(await stores.addStore(userId, body.name, body.supportEmail))
  })
)
