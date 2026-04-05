import JsBarcode from "jsbarcode";
import type { LabelPayload } from "../types/index.js";
import type { CarrierConfig } from "../types/config.js";
import { COUNTRY_NAMES, POSTAL_ZONES, SVG_TEXT_CONFIG } from "./variables.js";

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
      gapCount: 0,
      maxLineLength: 45,
    };
  }
  return {
    address: payload.recipient_address,
    postal: payload.recipient_postal,
    city: payload.recipient_city,
    gapCount: 0,
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

const CARRIER_CONFIGS: Record<string, CarrierConfig> = {
  postnl: {
    trackingRandomizeIndex: 9,
    sender: {
      x: 25,
      startY: 30,
      lineHeight: 12,
      fontSize: 10,
    },
    recipient: {
      boxDimension: 255,
      fontSize: 11,
      boxStartY: 175,
      boxStrokeWidth: 1,
      boxPadding: 4,
      boxHeight: 110,
      nameStartY: 182.5,
      nameLineHeight: 12.5,
      detailsStartY: 194,
      detailsLineHeight: 12.5,
      nameX: 30,
      detailsX: 30,
    },
    barcode: {
      x: 30,
      y: 280,
      width: 250,
      height: 70,
    },
    tracking: {
      x: 100,
      y: 355,
    },
    senderLabel: "Afzender:",
  },
  bpost: {
    trackingRandomizeIndex: 8,
    sender: {
      x: 140,
      startY: 42,
      lineHeight: 12,
      fontSize: 10,
    },
    recipient: {
      boxDimension: 190,
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
    barcode: {
      x: 50,
      y: 110,
      width: 210,
      height: 70,
    },
    tracking: {
      x: 75,
      y: 180,
    },
    zone: {
      x: 150.5,
      y: 300,
      fontSize: 24,
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
    console.error("Barcode generation failed:", error);
    throw new Error("Failed to generate barcode");
  }
};

export const buildLabelSvg = (
  payload: LabelPayload,
  svgTemplate: string,
): { svg: string; trackingShown: string } => {
  const carrier = payload.carrier;
  const config = CARRIER_CONFIGS[carrier];

  const template = svgTemplate;

  // Générer le barcode
  const barcodeBase64 = generateBarcodeBase64(payload.tracking_number);

  const trackingShown = randomizeTrackingFromIndex(
    payload.tracking_number,
    config.trackingRandomizeIndex,
  );
  const postalZone = zoneFromPostal(payload.recipient_postal);

  // Sender info
  const senderNameLines = nameLine(payload, true);
  const senderDetailsLines = detailLines(payload, true);
  const senderAllLines = [...senderNameLines, ...senderDetailsLines];

  const senderTspans = linesToTspans(senderAllLines, {
    x: config.sender.x,
    startY: config.sender.startY,
    lineHeight: config.sender.lineHeight,
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
    ${carrier === "bpost" ? `<image x="257" y="3" width="40" height="22" href="/assets/bpost-logo.jpg"/>` : ""}
    ${createTextElement(config.senderLabel, config.sender.x, config.sender.startY - 14, config.sender.fontSize)}
    <text font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.sender.fontSize}" font-weight="400" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}" xml:space="preserve">${senderTspans}</text>
    ${carrier === "postnl" ? `${createTextElement("AD", 25, 110, 36, "700")}` : ""}
    ${recipientBox}
    <text font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${config.recipient.fontSize}" font-weight="400" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${SVG_TEXT_CONFIG.textAnchor}" direction="${SVG_TEXT_CONFIG.direction}" xml:space="preserve">${recipientNameTspans}</text>
    ${recipientDetailsText}
    <image x="${config.barcode.x}" y="${config.barcode.y}" width="${config.barcode.width}" height="${config.barcode.height}" href="data:image/png;base64,${barcodeBase64}"/>
    ${createTextElement(escapeXml(trackingShown), config.tracking.x, config.tracking.y, 12)}
    ${config.zone ? createTextElement(escapeXml(postalZone), config.zone.x, config.zone.y, config.zone.fontSize, "700", "middle") : ""}
  </g>`;

  const finalSvg = template.replace("</svg>", `${overlay}\n</svg>`);
  return { svg: finalSvg, trackingShown };
};
