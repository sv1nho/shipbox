export interface LabelPayload {
  sender_firstname: string;
  sender_lastname: string;
  sender_company: string;
  sender_address: string;
  sender_postal: string;
  sender_city: string;
  sender_country: Country;
  recipient_firstname: string;
  recipient_lastname: string;
  recipient_company: string;
  recipient_address: string;
  recipient_postal: string;
  recipient_city: string;
  recipient_country: Country;
  carrier: Carrier;
  tracking_number: string;
  label_language: Language;
}

export interface GeneratedLabel {
  svg: string;
  trackingShown: string;
}

export interface RandomName {
  firstname: string;
  lastname: string;
  lang: Language;
}

export interface ElectronAPI {
  genBarcode: (tracking: string) => Promise<string>;
  generateLabelSvg: (payload: LabelPayload) => Promise<GeneratedLabel>;
  generateLabelPdf: (svg: string) => Promise<void>;
  loadTestData: (carrier: Carrier) => Promise<LabelPayload>;
  isTestMode: () => Promise<boolean>;
  generateRandomName: () => RandomName;
}

export type Country = "BE" | "NL" | "DE";
export type Language = "en" | "fr" | "nl";
export type Carrier = "postnl" | "bpost";

export interface BuildLabelResult {
  svg: string;
  trackingShown: string;
}

export type { CarrierConfig } from "./config.js";
