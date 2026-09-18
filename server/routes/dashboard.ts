import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import * as dashboard from '../services/dashboard.js'
import { requireUser, currentUser } from '../auth/require-user.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

export const dashboardRouter = Router()

dashboardRouter.use(requireUser)

dashboardRouter.get(
  '/',
  handle(async (req, res) => {
    res.json(await dashboard.summary(currentUser(req).id))
  })
)
