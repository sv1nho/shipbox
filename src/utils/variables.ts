import type { Country, Language } from "../types/index.js";

export const POSTAL_ZONES = [
  { code: "A20A", min: 2000, max: 2499 },
  { code: "A25A", min: 2500, max: 2999 },
  { code: "A35A", min: 3500, max: 3999 },
  { code: "A80G", min: 8000, max: 8499 },
  { code: "A85G", min: 8500, max: 8999 },
  { code: "A90G", min: 9000, max: 9499 },
  { code: "A95G", min: 9500, max: 9999 },
  { code: "B10B", min: 1000, max: 1299 },
  { code: "B15B", min: 1500, max: 1699 },
  { code: "B17B", min: 1700, max: 1999 },
  { code: "A30B", min: 3000, max: 3499 },
  { code: "C13C", min: 1300, max: 1499 },
  { code: "C50C", min: 5000, max: 5999 },
  { code: "C60C", min: 6000, max: 6599 },
  { code: "C70C", min: 7000, max: 7499 },
  { code: "C75C", min: 7500, max: 7999 },
  { code: "C40L", min: 4000, max: 4499 },
  { code: "C45L", min: 4500, max: 4999 },
  { code: "C66L", min: 6600, max: 6999 },
];

export const COUNTRY_NAMES: Record<Country, Record<Language, string>> = {
  BE: {
    en: "Belgium",
    fr: "Belgique",
    nl: "België",
  },
  NL: {
    en: "The Netherlands",
    fr: "Pays-Bas",
    nl: "Nederland",
  },
  DE: {
    en: "Germany",
    fr: "Allemagne",
    nl: "Duitsland",
  },
};

export const BARCODE_WITH_TEXT_CONFIG = {
  bcid: "code128",
  scale: 3,
  height: 12,
  includetext: false,
  textxalign: "center",
} as const;

export const SVG_TEXT_CONFIG = {
  fontFamily: "Arial, Helvetica, sans-serif",
  fill: "black",
  textAnchor: "start" as const,
  direction: "ltr" as const,
};
