import bwipjs from "bwip-js";
import type { IpcMain } from "electron";
import { buildLabelSvg } from "./utils/label-generator.js";
import type { LabelPayload } from "./types/index.js";

const BARCODE_CONFIG = {
  bcid: "code128",
  scale: 3,
  height: 10,
  includetext: true,
  textxalign: "center",
} as const;

export const registerIpcHandlers = (ipcMain: IpcMain): void => {
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
};
