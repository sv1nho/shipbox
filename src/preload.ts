import { contextBridge, ipcRenderer } from "electron";
import { faker as fakerFR } from "@faker-js/faker/locale/fr_BE";
import { faker as fakerNL } from "@faker-js/faker/locale/nl_BE";
import type { Carrier, ElectronAPI, LabelPayload } from "./types/index.js";

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
  generateLabelPdf: (svg: string): Promise<void> =>
    ipcRenderer.invoke("generate-label-pdf", svg) as Promise<void>,
  loadTestData: (carrier: Carrier): Promise<LabelPayload> =>
    ipcRenderer.invoke("load-test-data", carrier) as Promise<LabelPayload>,
  isTestMode: (): Promise<boolean> =>
    ipcRenderer.invoke("is-test-mode") as Promise<boolean>,
  generateRandomName,
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
