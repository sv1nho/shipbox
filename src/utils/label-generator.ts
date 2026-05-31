import JsBarcode from "jsbarcode";
import type { LabelPayload } from "../types/index.js";
import type { CarrierConfig } from "../types/config.js";
import { COUNTRY_NAMES, POSTAL_ZONES, SVG_TEXT_CONFIG } from "./variables.js";

const resolveCountry = (payload: LabelPayload, isSender: boolean): string => {
  const country = isSender ? payload.sender_country : payload.recipient_country;
  return COUNTRY_NAMES[country][payload.label_language].toUpperCase();
};

export const zoneFromPostal = (postalRaw: string): string => {
  const digits = postalRaw.replace(/\D/g, "");
  const postal = Number.parseInt(digits.slice(0, 4), 10);
  if (digits.length < 4 || Number.isNaN(postal)) return "";
  return POSTAL_ZONES.find((zone) => postal >= zone.min && postal <= zone.max)?.code ?? "";
};

export const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const wrapText = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
};

const wrapTextByPixelWidth = (
  lines: string[],
  maxPixelWidth: number,
  fontSize: number,
): string[] => {
  const maxCharCount = Math.floor(maxPixelWidth / ((fontSize / 22) * 12));
  return lines.flatMap((line) => wrapText(line, maxCharCount));
};

const getRandomDigit = (except?: string): string => {
  let digit = String(Math.floor(Math.random() * 10));
  while (except !== undefined && digit === except) {
    digit = String(Math.floor(Math.random() * 10));
  }
  return digit;
};

export const obfuscateTracking = (tracking: string, tailDigitCount: number): string => {
  const chars = tracking.split("");
  const digitIndexes: number[] = [];

  for (let i = 0; i < chars.length; i += 1) {
    if (/\d/.test(chars[i] ?? "")) digitIndexes.push(i);
  }

  const mutableIndexes = digitIndexes.slice(Math.max(0, digitIndexes.length - tailDigitCount));
  if (mutableIndexes.length === 0) return tracking;

  const targetChanges = Math.min(
    mutableIndexes.length,
    Math.max(1, Math.floor(mutableIndexes.length / 2)),
  );

  for (let change = 0; change < targetChanges; change += 1) {
    const randomPoolIndex = Math.floor(Math.random() * mutableIndexes.length);
    const charIndex = mutableIndexes.splice(randomPoolIndex, 1)[0];
    if (charIndex === undefined) continue;
    chars[charIndex] = getRandomDigit(chars[charIndex] ?? "0");
  }

  return chars.join("");
};

const nameLines = (payload: LabelPayload, isSender: boolean): string[] => {
  const name = isSender
    ? `${payload.sender_firstname} ${payload.sender_lastname}`
    : `${payload.recipient_firstname} ${payload.recipient_lastname}`;
  return wrapText(name, isSender ? 40 : 35);
};

const addressLines = (payload: LabelPayload, isSender: boolean): string[] => {
  const address = isSender ? payload.sender_address : payload.recipient_address;
  const postal = isSender ? payload.sender_postal : payload.recipient_postal;
  const city = isSender ? payload.sender_city : payload.recipient_city;
  const maxLen = isSender ? 45 : 35;
  const postalCity = `${postal} ${city.toUpperCase()}`;
  const country = resolveCountry(payload, isSender);

  return [
    ...wrapText(address, maxLen),
    ...wrapText(postalCity, maxLen),
    ...wrapText(country, maxLen),
  ].filter((line) => line.length > 0);
};

const linesToTspans = (
  lines: string[],
  options: { x: number; startY: number; lineHeight: number },
): string =>
  lines
    .map((line, index) => {
      const y = options.startY + index * options.lineHeight;
      return `<tspan x="${options.x}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

const createRecipientBox = (options: {
  x: number;
  startY: number;
  boxWidth: number;
  boxHeight: number;
  padding: number;
  strokeWidth: number;
}): string => {
  const { x, startY, boxWidth, boxHeight, padding, strokeWidth } = options;
  return `<rect x="${x - padding}" y="${startY - padding}" width="${boxWidth}" height="${boxHeight}" fill="none" stroke="black" stroke-width="${strokeWidth}" rx="2" ry="2"/>`;
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

const generateBarcodeBase64 = (tracking: string): string => {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, tracking, {
      format: "CODE128",
      width: 2,
      height: 70,
      displayValue: false,
    });
    return canvas.toDataURL("image/png").split(",")[1] || "";
  } catch (error) {
    throw new Error(
      `Failed to generate barcode, ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const CARRIER_CONFIGS: Record<string, CarrierConfig> = {
  postnl: {
    trackingTailDigitCount: 9,
    sender: { x: 24, startY: 30, lineHeight: 12, fontSize: 10 },
    recipient: {
      boxWidth: 243,
      fontSize: 11,
      boxStartY: 175,
      boxStrokeWidth: 1,
      boxPadding: 4,
      boxHeight: 110,
      nameStartY: 182.5,
      nameLineHeight: 12.5,
      detailsStartY: 194,
      detailsLineHeight: 12.5,
      nameX: 29,
      detailsX: 29,
    },
    barcode: { x: 29, y: 280, width: 238, height: 70 },
    tracking: { x: 95, y: 355 },
    senderLabel: "Afzender:",
  },
  bpost: {
    trackingTailDigitCount: 8,
    sender: { x: 140, startY: 42, lineHeight: 12, fontSize: 10 },
    recipient: {
      boxWidth: 190,
      fontSize: 11,
      boxStartY: 190,
      boxStrokeWidth: 2,
      boxPadding: 4,
      boxHeight: 85,
      nameStartY: 200,
      nameLineHeight: 10,
      detailsStartY: 212.5,
      detailsLineHeight: 13.5,
      nameX: 60,
      detailsX: 60,
    },
    barcode: { x: 50, y: 110, width: 210, height: 70 },
    tracking: { x: 75, y: 180 },
    zone: { x: 150.5, y: 300, fontSize: 24 },
    senderLabel: "Expéditeur/Afzender:",
  },
};

export const buildLabelSvg = (
  payload: LabelPayload,
  svgTemplate: string,
): { svg: string; maskedTracking: string } => {
  const config = CARRIER_CONFIGS[payload.carrier];

  const barcodeBase64 = generateBarcodeBase64(payload.tracking_number);
  const maskedTracking = obfuscateTracking(payload.tracking_number, config.trackingTailDigitCount);
  const postalZone = zoneFromPostal(payload.recipient_postal);

  const senderTspans = linesToTspans(
    [...nameLines(payload, true), ...addressLines(payload, true)],
    { x: config.sender.x, startY: config.sender.startY, lineHeight: config.sender.lineHeight },
  );

  const wrappedRecipientNameLines = wrapTextByPixelWidth(
    nameLines(payload, false),
    config.recipient.boxWidth,
    config.recipient.fontSize,
  );
  const wrappedRecipientDetailsLines = wrapTextByPixelWidth(
    addressLines(payload, false),
    config.recipient.boxWidth,
    config.recipient.fontSize,
  );

  const addressLineCount = wrapText(payload.recipient_address, 35).filter(
    (l) => l.length > 0,
  ).length;

  const recipientNameTspans = linesToTspans(wrappedRecipientNameLines, {
    x: config.recipient.nameX,
    startY: config.recipient.nameStartY,
    lineHeight: config.recipient.nameLineHeight,
  });

  const recipientDetailsText = wrappedRecipientDetailsLines
    .map((line, index) => {
      const y = config.recipient.detailsStartY + index * config.recipient.detailsLineHeight;
      const fontWeight = index < addressLineCount ? "400" : "700";
      return createTextElement(
        escapeXml(line),
        config.recipient.detailsX,
        y,
        config.recipient.fontSize,
        fontWeight,
      );
    })
    .join("");

  const recipientBox = createRecipientBox({
    x: config.recipient.nameX,
    startY: config.recipient.boxStartY,
    boxWidth: config.recipient.boxWidth,
    boxHeight: config.recipient.boxHeight,
    padding: config.recipient.boxPadding,
    strokeWidth: config.recipient.boxStrokeWidth,
  });

  const overlay = `
  <g id="dynamic-label-overlay">
    ${createTextElement(config.senderLabel, config.sender.x, config.sender.startY - 14, config.sender.fontSize)}
    <text font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.sender.fontSize}" font-weight="400" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}" xml:space="preserve">${senderTspans}</text>
    ${payload.carrier === "postnl" ? createTextElement("AD", 24, 110, 36, "700") : ""}
    ${recipientBox}
    <text font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.recipient.fontSize}" font-weight="400" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}" xml:space="preserve">${recipientNameTspans}</text>
    ${recipientDetailsText}
    <image x="${config.barcode.x}" y="${config.barcode.y}" width="${config.barcode.width}" height="${config.barcode.height}" href="data:image/png;base64,${barcodeBase64}"/>
    ${createTextElement(escapeXml(maskedTracking), config.tracking.x, config.tracking.y, 12)}
    ${config.zone ? createTextElement(escapeXml(postalZone), config.zone.x, config.zone.y, config.zone.fontSize, "700", "middle") : ""}
  </g>`;

  return { svg: svgTemplate.replace("</svg>", `${overlay}\n</svg>`), maskedTracking };
};
