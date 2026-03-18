import bwipjs from "bwip-js";
import fs from "node:fs/promises";
import path from "node:path";
import type { LabelPayload } from "../types/index.js";
import { BASE_DIR } from "../path.js";

export interface BuildLabelResult {
  svg: string;
  trackingShown: string;
}

const BARCODE_WITH_TEXT_CONFIG = {
  bcid: "code128",
  scale: 3,
  height: 12,
  includetext: false,
  textxalign: "center",
} as const;

const POSTAL_ZONES = [
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

const resolveCountry = (payload: LabelPayload): string => {
  const language = (payload["label_language"] ?? "fr").toLowerCase();
  return language === "nl"
    ? "Belgie"
    : language === "en"
      ? "Belgium"
      : "Belgique";
};

const postalCityWithGap = (
  postal: string,
  city: string,
  gapCount: number,
): string => {
  const safePostal = postal.trim();
  const safeCity = city.trim();
  const gap = gapCount > 0 ? "\u2003".repeat(gapCount) : " ";
  if (safePostal.length === 0) {
    return safeCity;
  }
  if (safeCity.length === 0) {
    return safePostal;
  }
  return `${safePostal}${gap}${safeCity}`;
};

const zoneFromPostal = (postalRaw: string): string => {
  const digits = postalRaw.replace(/\D/g, "");
  if (digits.length < 4) {
    return "";
  }

  const postal = Number.parseInt(digits.slice(0, 4), 10);
  if (Number.isNaN(postal)) {
    return "";
  }

  const match = POSTAL_ZONES.find(
    (zone) => postal >= zone.min && postal <= zone.max,
  );
  return match?.code ?? "";
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const getRandomDigit = (except?: string): string => {
  let nextDigit = String(Math.floor(Math.random() * 10));
  while (except !== undefined && nextDigit === except) {
    nextDigit = String(Math.floor(Math.random() * 10));
  }
  return nextDigit;
};

const randomizeTrackingFromIndex = (
  tracking: string,
  endIndexCount: number,
): string => {
  const chars = tracking.split("");
  const digitIndexes: number[] = [];

  for (let i = 0; i < chars.length; i += 1) {
    if (/\d/.test(chars[i] ?? "")) {
      digitIndexes.push(i);
    }
  }

  const startDigitIndex = Math.max(0, digitIndexes.length - endIndexCount);
  const mutableIndexes = digitIndexes.slice(startDigitIndex);

  if (mutableIndexes.length === 0) {
    return tracking;
  }

  const targetChanges = Math.min(
    mutableIndexes.length,
    Math.max(1, Math.floor(mutableIndexes.length / 2)),
  );

  for (let change = 0; change < targetChanges; change += 1) {
    const randomPoolIndex = Math.floor(Math.random() * mutableIndexes.length);
    const charIndex = mutableIndexes.splice(randomPoolIndex, 1)[0];
    if (charIndex === undefined) {
      continue;
    }
    const current = chars[charIndex] ?? "0";
    chars[charIndex] = getRandomDigit(current);
  }

  return chars.join("");
};

const senderNameLine = (payload: LabelPayload): string =>
  `${payload["sender_firstname"] ?? ""} ${payload["sender_lastname"] ?? ""}`.trim();

const senderDetailLines = (
  payload: LabelPayload,
  withGap: boolean = true,
): string[] =>
  [
    payload["sender_address"] ?? "",
    postalCityWithGap(
      payload["sender_postal"] ?? "",
      payload["sender_city"] ?? "",
      withGap ? 2 : 0,
    ),
  ].filter((line) => line.length > 0);

const senderDetailLinesWithCountry = (
  payload: LabelPayload,
  withGap: boolean = true,
  uppercaseCountry: boolean = false,
): string[] => {
  const country =
    (payload["recipient_country"] ?? "").trim() || resolveCountry(payload);
  return [
    payload["sender_address"] ?? "",
    postalCityWithGap(
      payload["sender_postal"] ?? "",
      payload["sender_city"] ?? "",
      withGap ? 2 : 0,
    ),
    uppercaseCountry ? country.toUpperCase() : country,
  ].filter((line) => line.length > 0);
};

const recipientNameLine = (payload: LabelPayload): string =>
  `${payload["recipient_firstname"] ?? ""} ${payload["recipient_lastname"] ?? ""}`.trim();

const recipientDetailLines = (
  payload: LabelPayload,
  uppercase: boolean = false,
  withGap: boolean = true,
): string[] => {
  const apply = (value: string) => (uppercase ? value.toUpperCase() : value);

  return [
    payload["recipient_address"] ?? "",
    postalCityWithGap(
      apply(payload["recipient_postal"] ?? ""),
      apply(payload["recipient_city"] ?? ""),
      withGap ? 5 : 0,
    ),
    apply(
      (payload["recipient_country"] ?? "").trim() || resolveCountry(payload),
    ),
  ].filter((line) => line.length > 0);
};

const linesToTspans = (
  lines: string[],
  options: { x: number; startY: number; lineHeight: number },
): string =>
  lines
    .map((line, index) => {
      const y = options.startY + index * options.lineHeight;
      const xText = String(options.x);
      const yText = String(y);
      const safeText = escapeXml(line);
      return `<tspan x="${xText}" y="${yText}">${safeText}</tspan>`;
    })
    .join("");

export const buildLabelSvg = async (
  payload: LabelPayload,
): Promise<BuildLabelResult> => {
  const carrier = (payload["carrier"] ?? "bpost").toLowerCase();
  const templatePath = path.join(
    BASE_DIR(),
    "assets",
    "models",
    `${carrier}.svg`,
  );
  const template = await fs.readFile(templatePath, "utf8");

  const originalTracking = (payload["tracking_number"] ?? "").trim();

  if (originalTracking.length === 0) {
    throw new Error("Tracking number is required.");
  }

  const barcodeBuffer = await bwipjs.toBuffer({
    ...BARCODE_WITH_TEXT_CONFIG,
    text: originalTracking,
  });
  const barcodeBase64 = barcodeBuffer.toString("base64");

  const postalZone = zoneFromPostal(payload["recipient_postal"] ?? "");

  let trackingShown: string;
  let overlay: string;

  if (carrier === "postnl") {
    trackingShown = randomizeTrackingFromIndex(originalTracking, 9);
    const senderInfoLines = linesToTspans([senderNameLine(payload)], {
      x: 50,
      startY: 60,
      lineHeight: 10,
    });

    const senderDetailsUpperLines = linesToTspans(
      senderDetailLinesWithCountry(payload, false, true),
      {
        x: 50,
        startY: 78,
        lineHeight: 18,
      },
    );

    const recipientNameTspans = linesToTspans([recipientNameLine(payload)], {
      x: 60,
      startY: 365,
      lineHeight: 25,
    });

    const recipientDetailsBoldLines = recipientDetailLines(payload, true, false)
      .map((line, index) => {
        const y = 388 + index * 25;
        const isAddress = index === 0;
        const fontWeight = isAddress ? "400" : "700";
        return `<text x="60" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="${fontWeight}" fill="black" text-anchor="start" direction="ltr">${escapeXml(line)}</text>`;
      })
      .join("");

    overlay = `
  <g id="dynamic-label-overlay">
    <text x="50" y="40" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="400" fill="black" text-anchor="start" direction="ltr">Afzender:</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="400" fill="black" text-anchor="start" direction="ltr" xml:space="preserve">${senderInfoLines}</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="400" fill="black" text-anchor="start" direction="ltr" xml:space="preserve">${senderDetailsUpperLines}</text>
    <text x="50" y="200" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="black" text-anchor="start" direction="ltr">AD</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="black" text-anchor="start" direction="ltr" xml:space="preserve">${recipientNameTspans}</text>
    ${recipientDetailsBoldLines}
    <image x="50" y="580" width="500" height="140" href="data:image/png;base64,${barcodeBase64}"/>
    <text x="306" y="750" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="400" fill="black">${escapeXml(trackingShown)}</text>
  </g>`;
  } else {
    trackingShown = randomizeTrackingFromIndex(originalTracking, 8);

    const senderNameText = linesToTspans([senderNameLine(payload)], {
      x: 280,
      startY: 84,
      lineHeight: 20,
    });

    const senderDetailsText = linesToTspans(senderDetailLines(payload), {
      x: 280,
      startY: 124,
      lineHeight: 22,
    });

    const recipientNameText = linesToTspans([recipientNameLine(payload)], {
      x: 120,
      startY: 415,
      lineHeight: 20,
    });

    const recipientDetailsText = linesToTspans(recipientDetailLines(payload), {
      x: 120,
      startY: 461,
      lineHeight: 22,
    });

    overlay = `
  <g id="dynamic-label-overlay">
    <text x="280" y="60" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="400" fill="black" text-anchor="start" direction="ltr">Expéditeur/Afzender:</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="400" fill="black" text-anchor="start" direction="ltr" xml:space="preserve">${senderNameText}</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="400" fill="black" text-anchor="start" direction="ltr" xml:space="preserve">${senderDetailsText}</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="black" text-anchor="start" direction="ltr" xml:space="preserve">${recipientNameText}</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="black" text-anchor="start" direction="ltr" xml:space="preserve">${recipientDetailsText}</text>
    <image x="146" y="245" width="320" height="90" href="data:image/png;base64,${barcodeBase64}"/>
    <text x="306" y="342" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="400" fill="black">${escapeXml(trackingShown)}</text>
    <text x="301" y="600" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700" fill="black">${escapeXml(postalZone.toUpperCase())}</text>
  </g>`;
  }

  const finalSvg = template.replace("</svg>", `${overlay}\n</svg>`);
  return { svg: finalSvg, trackingShown };
};
