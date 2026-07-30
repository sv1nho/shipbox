export type CarrierConfig = {
  trackingTailDigitCount: number;
  sender: {
    x: number;
    startY: number;
    lineHeight: number;
    fontSize: number;
  };
  recipient: {
    boxWidth: number;
    fontSize: number;
    boxStartY: number;
    boxStrokeWidth: number;
    boxPadding: number;
    boxHeight: number;
    nameStartY: number;
    nameLineHeight: number;
    detailsStartY: number;
    detailsLineHeight: number;
    x: number;
  };
  barcode: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tracking: {
    x: number;
    y: number;
  };
  zone?: {
    x: number;
    y: number;
    fontSize: number;
  };
  extraMark?: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontWeight?: string;
  };
  senderLabel: string;
  uppercaseCityCountry: boolean;
}
