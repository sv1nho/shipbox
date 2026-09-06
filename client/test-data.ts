import type { Carrier, LabelPayload } from './types/index.js'

export const getTestData = (carrier: Carrier): LabelPayload => {
  const testData: LabelPayload = {
    sender_firstname: 'Jean',
    sender_lastname: 'Dupond',
    sender_company: 'Entreprise SA',
    sender_isCompany: false,
    sender_address: 'Rue de la Poste 12',
    sender_postal: '1000',
    sender_city: 'Bruxelles',
    sender_country: 'BE',
    recipient_firstname: 'Marie',
    recipient_lastname: 'Martin',
    recipient_address: 'Avenue Centrale 45',
    recipient_postal: '4000',
    recipient_city: 'Liège',
    recipient_company: 'Société SPRL',
    recipient_isCompany: false,
    recipient_country: 'BE',
    label_language: 'fr',
    carrier,
    tracking_number:
      carrier === 'postnl' ? '3SDDRL000000409' : '323200000000000000004050',
  }

  return testData
}
