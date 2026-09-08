import type { CarrierId } from './carriers.js'

export type Country = 'BE' | 'NL' | 'DE'
export type Language = 'en' | 'fr' | 'nl'
export type Carrier = CarrierId

export type LabelPayload = {
  sender_firstname: string;
  sender_lastname: string;
  sender_company: string;
  sender_address: string;
  sender_postal: string;
  sender_city: string;
  sender_country: Country;
  sender_isCompany: boolean;
  recipient_firstname: string;
  recipient_lastname: string;
  recipient_company: string;
  recipient_address: string;
  recipient_postal: string;
  recipient_city: string;
  recipient_country: Country;
  recipient_isCompany: boolean;
  label_language: Language;
  carrier: Carrier;
  tracking_number: string;
}

export const CURRENT_PAYLOAD_VERSION = 1
