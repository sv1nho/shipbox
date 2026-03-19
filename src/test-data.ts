import type { LabelPayload } from "./types/index.js";

export const getTestData = (carrier: "postnl" | "bpost"): LabelPayload => {
  const testData: LabelPayload = {
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
      carrier === "postnl" ? "3SDDRL000000409" : "323200000000000000004050",
  };

  return testData;
};
