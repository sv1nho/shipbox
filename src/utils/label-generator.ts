import bwipjs from "bwip-js";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  BuildLabelResult,
  Carrier,
  LabelPayload,
} from "../types/index.js";
import type { CarrierConfig } from "../types/config.js";
import { BASE_DIR } from "../path.js";
import {
  BARCODE_WITH_TEXT_CONFIG,
  COUNTRY_NAMES,
  POSTAL_ZONES,
  SVG_TEXT_CONFIG,
} from "./variables.js";

const resolveCountry = (
  payload: LabelPayload,
  isSender: boolean = isForSender(payload),
): string => {
  const language = payload.label_language;
  const country = isSender ? payload.sender_country : payload.recipient_country;
  return COUNTRY_NAMES[country][language].toUpperCase();
};

const zoneFromPostal = (postalRaw: string): string => {
  const digits = postalRaw.replace(/\D/g, "");

  const postal = Number.parseInt(digits.slice(0, 4), 10);
  if (digits.length < 4 || Number.isNaN(postal)) {
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

const wrapText = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      lines.push(word);
      currentLine = "";
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

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

const isForSender = (payload: LabelPayload): boolean =>
  payload.sender_firstname.length > 0 || payload.sender_lastname.length > 0;

const getSenderOrRecipientName = (
  payload: LabelPayload,
  isSender: boolean,
): string => {
  if (isSender) {
    return `${payload.sender_firstname} ${payload.sender_lastname}`;
  }
  return `${payload.recipient_firstname} ${payload.recipient_lastname}`;
};

const getSenderOrRecipientAddress = (
  payload: LabelPayload,
  isSender: boolean,
): {
  address: string;
  postal: string;
  city: string;
  gapCount: number;
  maxLineLength: number;
} => {
  if (isSender) {
    return {
      address: payload.sender_address,
      postal: payload.sender_postal,
      city: payload.sender_city,
      gapCount: 2,
      maxLineLength: 45,
    };
  }
  return {
    address: payload.recipient_address,
    postal: payload.recipient_postal,
    city: payload.recipient_city,
    gapCount: 5,
    maxLineLength: 35,
  };
};

const nameLine = (
  payload: LabelPayload,
  isSender: boolean = isForSender(payload),
): string[] =>
  wrapText(getSenderOrRecipientName(payload, isSender), isSender ? 40 : 35);

const detailLines = (
  payload: LabelPayload,
  isSender: boolean = isForSender(payload),
): string[] => {
  const addressData = getSenderOrRecipientAddress(payload, isSender);
  const country = resolveCountry(payload, isSender);
  const gap =
    addressData.gapCount > 0 ? "\u2003".repeat(addressData.gapCount) : " ";
  const postalCity = `${addressData.postal}${gap}${addressData.city.toUpperCase()}`;

  return [
    ...wrapText(addressData.address, addressData.maxLineLength),
    ...wrapText(postalCity, addressData.maxLineLength),
    ...wrapText(country, addressData.maxLineLength),
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

const wrapTextByPixelWidth = (
  lines: string[],
  maxPixelWidth: number,
  fontSize: number,
): string[] => {
  const charWidth = (fontSize / 22) * 12;
  const maxCharCount = Math.floor(maxPixelWidth / charWidth);

  const wrappedLines: string[] = [];

  for (const line of lines) {
    if (line.length <= maxCharCount) {
      wrappedLines.push(line);
    } else {
      const words = line.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length <= maxCharCount) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            wrappedLines.push(currentLine);
          }
          currentLine = word;
        }
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    }
  }

  return wrappedLines;
};

const createRecipientBox = (options: {
  x: number;
  startY: number;
  boxWidth: number;
  boxHeight: number;
  padding: number;
  strokeWidth: number;
}): string => {
  const { x, startY, boxWidth, boxHeight, padding, strokeWidth } = options;
  const rectX = x - padding;
  const rectY = startY - padding;

  return `<rect x="${String(rectX)}" y="${String(rectY)}" width="${String(boxWidth)}" height="${String(boxHeight)}" fill="none" stroke="black" stroke-width="${String(strokeWidth)}" rx="2" ry="2"/>`;
};

const CARRIER_CONFIGS: Record<Carrier, CarrierConfig> = {
  postnl: {
    trackingRandomizeIndex: 9,
    sender: {
      nameX: 50,
      nameStartY: 60,
      nameLineHeight: 10,
      detailsX: 50,
      detailsStartY: 78,
      detailsLineHeight: 18,
      fontSize: 14,
    },
    recipient: {
      boxDimension: 510,
      fontSize: 22,
      boxStartY: 350,
      boxStrokeWidth: 2,
      boxPadding: 8,
      boxHeight: 220,
      nameStartY: 365,
      nameLineHeight: 25,
      detailsStartY: 388,
      detailsLineHeight: 25,
      nameX: 60,
      detailsX: 60,
    },
    barcode: {
      x: 60,
      y: 580,
      width: 500,
      height: 140,
    },
    tracking: {
      x: 306,
      y: 730,
    },
    senderLabel: "Afzender:",
  },
  bpost: {
    trackingRandomizeIndex: 8,
    sender: {
      nameX: 280,
      nameStartY: 84,
      nameLineHeight: 20,
      detailsX: 280,
      detailsStartY: 124,
      detailsLineHeight: 22,
      fontSize: 18,
    },
    recipient: {
      boxDimension: 380,
      fontSize: 22,
      boxStartY: 380,
      boxStrokeWidth: 4,
      boxPadding: 8,
      boxHeight: 170,
      nameStartY: 400,
      nameLineHeight: 20,
      detailsStartY: 425,
      detailsLineHeight: 27,
      nameX: 120,
      detailsX: 120,
    },
    barcode: {
      x: 146,
      y: 245,
      width: 320,
      height: 90,
    },
    tracking: {
      x: 306,
      y: 342,
    },
    zone: {
      x: 301,
      y: 600,
      fontSize: 48,
    },
    senderLabel: "Expéditeur/Afzender:",
  },
};

const createTextElement = (
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontWeight: string = "400",
  textAnchor: string = "start",
): string =>
  `<text x="${x}" y="${y}" font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${textAnchor}" direction="${SVG_TEXT_CONFIG.direction}">${text}</text>`;

export const buildLabelSvg = async (
  payload: LabelPayload,
): Promise<BuildLabelResult> => {
  const carrier = payload.carrier;
  const config = CARRIER_CONFIGS[carrier];

  const templatePath = path.join(
    BASE_DIR(),
    "assets",
    "models",
    `${carrier}.svg`,
  );
  const template = await fs.readFile(templatePath, "utf8");

  const originalTracking = payload.tracking_number;
  const barcodeBuffer = await bwipjs.toBuffer({
    ...BARCODE_WITH_TEXT_CONFIG,
    text: originalTracking,
  });
  const barcodeBase64 = barcodeBuffer.toString("base64");

  const trackingShown = randomizeTrackingFromIndex(
    originalTracking,
    config.trackingRandomizeIndex,
  );
  const postalZone = zoneFromPostal(payload.recipient_postal);

  // Sender info
  const senderNameLines = nameLine(payload, true);
  const senderDetailsLines = detailLines(payload, true);
  const senderNameTspans = linesToTspans(senderNameLines, {
    x: config.sender.nameX,
    startY: config.sender.nameStartY,
    lineHeight: config.sender.nameLineHeight,
  });
  const senderDetailsTspans = linesToTspans(senderDetailsLines, {
    x: config.sender.detailsX,
    startY: config.sender.detailsStartY,
    lineHeight: config.sender.detailsLineHeight,
  });

  // Recipient info
  const recipientNameLines = nameLine(payload, false);
  const recipientDetailsLines = detailLines(payload, false);

  const wrappedRecipientNameLines = wrapTextByPixelWidth(
    recipientNameLines,
    config.recipient.boxDimension,
    config.recipient.fontSize,
  );
  const wrappedRecipientDetailsLines = wrapTextByPixelWidth(
    recipientDetailsLines,
    config.recipient.boxDimension,
    config.recipient.fontSize,
  );

  // Calculate address line count for styling
  const addressLinesCount = wrapText(payload.recipient_address, 35).filter(
    (l) => l.length > 0,
  ).length;

  const recipientNameTspans = linesToTspans(wrappedRecipientNameLines, {
    x: config.recipient.nameX,
    startY: config.recipient.nameStartY,
    lineHeight: config.recipient.nameLineHeight,
  });

  const recipientDetailsText = wrappedRecipientDetailsLines
    .map((line, index) => {
      const y =
        config.recipient.detailsStartY +
        index * config.recipient.detailsLineHeight;
      const fontWeight = index < addressLinesCount ? "400" : "700";
      return `<text x="${config.recipient.detailsX}" y="${y}" font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.recipient.fontSize}" font-weight="${fontWeight}" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}">${escapeXml(line)}</text>`;
    })
    .join("");

  const recipientBox = createRecipientBox({
    x: config.recipient.nameX,
    startY: config.recipient.boxStartY,
    boxWidth: config.recipient.boxDimension,
    boxHeight: config.recipient.boxHeight,
    padding: config.recipient.boxPadding,
    strokeWidth: config.recipient.boxStrokeWidth,
  });

  const overlay = `
  <g id="dynamic-label-overlay">
    ${createTextElement(config.senderLabel, config.sender.nameX, 40, config.sender.fontSize)}
    <text font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.sender.fontSize}" font-weight="400" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}" xml:space="preserve">${senderNameTspans}</text>
    <text font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.sender.fontSize}" font-weight="400" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}" xml:space="preserve">${senderDetailsTspans}</text>
    ${carrier === "postnl" ? `${createTextElement("AD", 50, 200, 72, "700")}` : ""}
    ${recipientBox}
    <text font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.recipient.fontSize}" font-weight="400" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}" xml:space="preserve">${recipientNameTspans}</text>
    ${recipientDetailsText}
    <image x="${config.barcode.x}" y="${config.barcode.y}" width="${config.barcode.width}" height="${config.barcode.height}" href="data:image/png;base64,${barcodeBase64}"/>
    ${createTextElement(escapeXml(trackingShown), config.tracking.x, config.tracking.y, 20, "400", "middle")}
    ${config.zone ? createTextElement(escapeXml(postalZone.toUpperCase()), config.zone.x, config.zone.y, config.zone.fontSize, "700", "middle") : ""}
  </g>`;

  const finalSvg = template.replace("</svg>", `${overlay}\n</svg>`);
  return { svg: finalSvg, trackingShown };
};
