import type { CarrierId } from '../../shared/carriers.js'
import { today } from '../../shared/time.js'

export const labelFileName = (carrier: CarrierId): string => `label-${carrier}-${today()}.pdf`
