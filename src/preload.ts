import { contextBridge, ipcRenderer } from "electron";
import { faker as fakerFR } from "@faker-js/faker/locale/fr_BE";
import { faker as fakerNL } from "@faker-js/faker/locale/nl_BE";
import type { ElectronAPI, LabelPayload } from "./types/index.js";

const generateRandomName = (): {
  firstname: string;
  lastname: string;
  lang: "nl" | "fr";
} => {
  const lang = Math.random() > 0.5 ? "fr" : "nl";
  return {
    firstname:
      lang === "fr" ? fakerFR.person.firstName() : fakerNL.person.firstName(),
    lastname:
      lang === "fr" ? fakerFR.person.lastName() : fakerNL.person.lastName(),
    lang,
  };
};

const electronAPI: ElectronAPI = {
  genBarcode: (tracking: string): Promise<string> =>
    ipcRenderer.invoke("generate-barcode", tracking) as Promise<string>,
  generateLabelSvg: (payload: LabelPayload) =>
    ipcRenderer.invoke("generate-label-svg", payload),
  generateRandomName,
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
