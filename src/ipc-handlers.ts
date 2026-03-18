import bwipjs from "bwip-js";
import type { BrowserWindow, Dialog, IpcMain } from "electron";
import puppeteer from "puppeteer";
import { buildLabelSvg } from "./utils/label-generator.js";
import { TEST_DATA } from "./test-data.js";
import type { LabelPayload } from "./types/index.js";

const BARCODE_CONFIG = {
  bcid: "code128",
  scale: 3,
  height: 10,
  includetext: true,
  textxalign: "center",
} as const;

export const registerIpcHandlers = (
  ipcMain: IpcMain,
  dialog: Dialog,
  mainWindow: BrowserWindow,
): void => {
  ipcMain.handle(
    "generate-barcode",
    async (_event, tracking: string): Promise<string> => {
      const cleanTracking = tracking.trim();
      if (cleanTracking.length === 0) {
        throw new Error("Tracking number is required.");
      }

      const buffer = await bwipjs.toBuffer({
        ...BARCODE_CONFIG,
        text: cleanTracking,
      });

      return buffer.toString("base64");
    },
  );

  ipcMain.handle(
    "generate-label-svg",
    async (
      _event,
      payload: LabelPayload,
    ): Promise<{ svg: string; trackingShown: string }> =>
      buildLabelSvg(payload),
  );

  ipcMain.handle(
    "generate-label-pdf",
    async (_event, svg: string): Promise<void> => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Save PDF Label",
        defaultPath: "label.pdf",
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });

      if (result.canceled || !result.filePath) {
        throw new Error("Save dialog was canceled.");
      }

      const browser = await puppeteer.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          `<!doctype html><html><body style="margin:0; padding:0;">${svg}</body></html>`,
          { waitUntil: "networkidle0" },
        );

        await page.pdf({
          path: result.filePath,
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
    },
  );

  ipcMain.handle("load-test-data", (): LabelPayload => TEST_DATA);

  ipcMain.handle(
    "is-test-mode",
    (): boolean => process.env["NODE_ENV"] === "test",
  );
};
