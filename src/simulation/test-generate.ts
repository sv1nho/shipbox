import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import { buildLabelSvg } from "../utils/label-generator.js";
import type { LabelPayload } from "../types/index.js";
import { BASE_DIR } from "../path.js";

const carrier = process.argv[2] || "bpost";

const samplePayload: LabelPayload = {
  sender_firstname: "Jean",
  sender_lastname: "Dupond",
  sender_address: "Rue de la Poste 12",
  sender_postal: "1000",
  sender_city: "Bruxelles",
  recipient_firstname: "Marie",
  recipient_lastname: "Martin",
  recipient_address: "Avenue Centrale 45",
  recipient_postal: "4000",
  recipient_city: "Liège",
  label_language: "nl",
  carrier,
  tracking_number:
    carrier === "bpost" ? "323211045445004288094050" : "3SDDRL278573409",
};

const main = async (): Promise<void> => {
  const outputDir = path.join(BASE_DIR("src"), "output");
  const pdfPath = path.join(outputDir, "test-label.pdf");

  await fs.mkdir(outputDir, { recursive: true });

  const { svg } = await buildLabelSvg(samplePayload);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<!doctype html><html><body style="margin:0; padding:0;">${svg}</body></html>`,
      { waitUntil: "networkidle0" },
    );

    await page.pdf({
      path: pdfPath,
      width: "612px",
      height: "792px",
      printBackground: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      preferCSSPageSize: false,
      pageRanges: "1",
    });
  } finally {
    await browser.close();
  }

  process.stdout.write(`Generated file: ${pdfPath}\n`);
};

void main();
