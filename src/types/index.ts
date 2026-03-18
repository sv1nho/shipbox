export type LabelPayload = Record<string, string>;

export interface GeneratedLabel {
  svg: string;
  trackingShown: string;
}

export interface RandomName {
  firstname: string;
  lastname: string;
  lang: "nl" | "fr";
}

export interface ElectronAPI {
  genBarcode: (tracking: string) => Promise<string>;
  generateLabelSvg: (payload: LabelPayload) => Promise<GeneratedLabel>;
  generateRandomName: () => RandomName;
}
