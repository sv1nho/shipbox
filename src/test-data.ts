import type { LabelPayload } from "./types/index.js";

const TEST_DATA_BASE: LabelPayload = {
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
  carrier: "bpost",
  tracking_number: "323200000000000000004050",
};

export const getTestData = (carrier?: "postnl" | "bpost"): LabelPayload => {
  const safeCarrier = carrier ?? "bpost";
  const testData: LabelPayload = { ...TEST_DATA_BASE, carrier: safeCarrier };

  if (safeCarrier === "postnl") {
    testData["tracking_number"] = "3SDDRL000000409";
  }

  return testData;
};

export const TEST_DATA = getTestData();
