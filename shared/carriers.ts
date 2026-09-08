export type TrackingTarget = {
  carrier: CarrierId
  trackingNumber: string
  recipientPostalCode: string
  recipientCountry: string
}

export type CarrierConfig = {
  label: string
  pattern: RegExp
  patternHint: string
  placeholder: string
  buildTrackingUrl: (target: TrackingTarget, lang: string) => string
}

const segment = (value: string): string => encodeURIComponent(value)

export const CARRIERS = {
  bpost: {
    label: 'bpost',
    pattern: /^(3232|3299)\d{20}$/,
    patternHint: '24 digits starting with 3232 or 3299',
    placeholder: '24 digits for bpost',
    buildTrackingUrl: (target, lang) =>
      `https://track.bpost.cloud/btr/web/#/search?lang=${segment(lang)}&itemCode=${segment(target.trackingNumber)}&postalCode=${segment(target.recipientPostalCode)}`,
  },
  postnl: {
    label: 'PostNL',
    pattern: /^[23]S[A-Z]{1,4}\d{6,9}$/,
    patternHint: '2S or 3S followed by 1-4 letters and 6-9 digits',
    placeholder: 'e.g. 3SDDRL000000409',
    buildTrackingUrl: (target) =>
      `https://jouw.postnl.be/track-and-trace/${segment(target.trackingNumber)}-${segment(target.recipientCountry)}-${segment(target.recipientPostalCode)}`,
  },
} as const satisfies Record<string, CarrierConfig>

export type CarrierId = keyof typeof CARRIERS

export const CARRIER_IDS = Object.keys(CARRIERS) as CarrierId[]

export const isCarrierId = (value: unknown): value is CarrierId =>
  typeof value === 'string' && Object.hasOwn(CARRIERS, value)

export function getTrackingUrl (target: TrackingTarget, lang: string): string {
  return CARRIERS[target.carrier].buildTrackingUrl(target, lang)
}
