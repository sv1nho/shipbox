import type { LabelPayload } from "../types/index.js";

export interface FormElements {
  form: HTMLFormElement;
  output: HTMLDivElement;
  submitButton: HTMLButtonElement;
  senderFirstname: HTMLInputElement;
  senderLastname: HTMLInputElement;
  senderCompany: HTMLInputElement;
  senderAddress: HTMLInputElement;
  senderPostal: HTMLInputElement;
  senderCity: HTMLInputElement;
  senderRandomNameBtn: HTMLButtonElement;
  senderIsCompany: HTMLInputElement;
  senderPersonFields: HTMLDivElement;
  senderCompanyFields: HTMLDivElement;
  senderCountry: HTMLSelectElement;
  recipientFirstname: HTMLInputElement;
  recipientLastname: HTMLInputElement;
  recipientCompany: HTMLInputElement;
  recipientAddress: HTMLInputElement;
  recipientPostal: HTMLInputElement;
  recipientCity: HTMLInputElement;
  recipientIsCompany: HTMLInputElement;
  recipientPersonFields: HTMLDivElement;
  recipientCompanyFields: HTMLDivElement;
  carrier: HTMLSelectElement;
  trackingNumber: HTMLInputElement;
  labelLanguage: HTMLSelectElement;
  recipientCountry: HTMLSelectElement;
}

export const getFormElements = (): FormElements => {
  const form = document.getElementById("labelForm");
  const output = document.getElementById("output");
  const submitButton = form?.querySelector("button[type='submit']");

  const senderFirstname = document.getElementById("sender_firstname");
  const senderLastname = document.getElementById("sender_lastname");
  const senderCompany = document.getElementById("sender_company");
  const senderAddress = document.getElementById("sender_address");
  const senderPostal = document.getElementById("sender_postal");
  const senderCity = document.getElementById("sender_city");
  const senderRandomNameBtn = document.getElementById("senderRandomNameBtn");
  const senderIsCompany = document.getElementById("sender_isCompany");
  const senderPersonFields = document.getElementById("senderPersonFields");
  const senderCompanyFields = document.getElementById("senderCompanyFields");
  const senderCountry = document.getElementById("sender_country");

  const recipientFirstname = document.getElementById("recipient_firstname");
  const recipientLastname = document.getElementById("recipient_lastname");
  const recipientCompany = document.getElementById("recipient_company");
  const recipientAddress = document.getElementById("recipient_address");
  const recipientPostal = document.getElementById("recipient_postal");
  const recipientCity = document.getElementById("recipient_city");
  const recipientIsCompany = document.getElementById("recipient_isCompany");
  const recipientPersonFields = document.getElementById(
    "recipientPersonFields",
  );
  const recipientCompanyFields = document.getElementById(
    "recipientCompanyFields",
  );
  const recipientCountry = document.getElementById("recipient_country");

  const carrier = document.getElementById("carrier");
  const trackingNumber = document.getElementById("tracking_number");
  const labelLanguage = document.getElementById("label_language");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Form #labelForm not found.");
  }
  if (!(output instanceof HTMLDivElement)) {
    throw new Error("Div #output not found.");
  }
  if (!(submitButton instanceof HTMLButtonElement)) {
    throw new Error("Submit button not found.");
  }
  if (!(senderFirstname instanceof HTMLInputElement)) {
    throw new Error("Sender firstname field not found.");
  }
  if (!(senderLastname instanceof HTMLInputElement)) {
    throw new Error("Sender lastname field not found.");
  }
  if (!(senderCompany instanceof HTMLInputElement)) {
    throw new Error("Sender company field not found.");
  }
  if (!(senderAddress instanceof HTMLInputElement)) {
    throw new Error("Sender address field not found.");
  }
  if (!(senderPostal instanceof HTMLInputElement)) {
    throw new Error("Sender postal field not found.");
  }
  if (!(senderCity instanceof HTMLInputElement)) {
    throw new Error("Sender city field not found.");
  }
  if (!(senderRandomNameBtn instanceof HTMLButtonElement)) {
    throw new Error("Sender random name button not found.");
  }
  if (!(senderIsCompany instanceof HTMLInputElement)) {
    throw new Error("Sender is company checkbox not found.");
  }
  if (!(senderPersonFields instanceof HTMLDivElement)) {
    throw new Error("Sender person fields container not found.");
  }
  if (!(senderCompanyFields instanceof HTMLDivElement)) {
    throw new Error("Sender company fields container not found.");
  }
  if (!(recipientFirstname instanceof HTMLInputElement)) {
    throw new Error("Recipient firstname field not found.");
  }
  if (!(recipientLastname instanceof HTMLInputElement)) {
    throw new Error("Recipient lastname field not found.");
  }
  if (!(recipientCompany instanceof HTMLInputElement)) {
    throw new Error("Recipient company field not found.");
  }
  if (!(recipientAddress instanceof HTMLInputElement)) {
    throw new Error("Recipient address field not found.");
  }
  if (!(recipientPostal instanceof HTMLInputElement)) {
    throw new Error("Recipient postal field not found.");
  }
  if (!(recipientCity instanceof HTMLInputElement)) {
    throw new Error("Recipient city field not found.");
  }
  if (!(recipientIsCompany instanceof HTMLInputElement)) {
    throw new Error("Recipient is company checkbox not found.");
  }
  if (!(recipientPersonFields instanceof HTMLDivElement)) {
    throw new Error("Recipient person fields container not found.");
  }
  if (!(recipientCompanyFields instanceof HTMLDivElement)) {
    throw new Error("Recipient company fields container not found.");
  }
  if (!(recipientCountry instanceof HTMLSelectElement)) {
    throw new Error("Recipient country select not found.");
  }
  if (!(carrier instanceof HTMLSelectElement)) {
    throw new Error("Carrier select not found.");
  }
  if (!(trackingNumber instanceof HTMLInputElement)) {
    throw new Error("Tracking number field not found.");
  }
  if (!(labelLanguage instanceof HTMLSelectElement)) {
    throw new Error("Label language select not found.");
  }

  if (!(senderCountry instanceof HTMLSelectElement)) {
    throw new Error("Sender country select not found.");
  }

  return {
    form,
    output,
    submitButton,
    senderFirstname,
    senderLastname,
    senderCompany,
    senderAddress,
    senderPostal,
    senderCity,
    senderRandomNameBtn,
    senderIsCompany,
    senderPersonFields,
    senderCompanyFields,
    recipientFirstname,
    recipientLastname,
    recipientCompany,
    recipientAddress,
    recipientPostal,
    recipientCity,
    recipientIsCompany,
    recipientPersonFields,
    recipientCompanyFields,
    carrier,
    trackingNumber,
    labelLanguage,
    senderCountry,
    recipientCountry,
  };
};

export const updateSenderFields = (elements: FormElements): void => {
  const isCompany = elements.senderIsCompany.checked;
  if (isCompany) {
    elements.senderPersonFields.style.display = "none";
    elements.senderCompanyFields.style.display = "block";
    elements.senderFirstname.removeAttribute("required");
    elements.senderLastname.removeAttribute("required");
    elements.senderCompany.setAttribute("required", "");
  } else {
    elements.senderPersonFields.style.display = "block";
    elements.senderCompanyFields.style.display = "none";
    elements.senderFirstname.setAttribute("required", "");
    elements.senderLastname.setAttribute("required", "");
    elements.senderCompany.removeAttribute("required");
  }
};

export const updateRecipientFields = (elements: FormElements): void => {
  const isCompany = elements.recipientIsCompany.checked;
  if (isCompany) {
    elements.recipientPersonFields.style.display = "none";
    elements.recipientCompanyFields.style.display = "block";
    elements.recipientFirstname.removeAttribute("required");
    elements.recipientLastname.removeAttribute("required");
    elements.recipientCompany.setAttribute("required", "");
  } else {
    elements.recipientPersonFields.style.display = "block";
    elements.recipientCompanyFields.style.display = "none";
    elements.recipientFirstname.setAttribute("required", "");
    elements.recipientLastname.setAttribute("required", "");
    elements.recipientCompany.removeAttribute("required");
  }
};

export const updateTrackingValidation = (elements: FormElements): void => {
  const carrier = elements.carrier.value;

  if (carrier === "bpost") {
    elements.trackingNumber.setAttribute("pattern", "[0-9]{24}");
    elements.trackingNumber.setAttribute("placeholder", "24 digits for Bpost");
    elements.trackingNumber.setAttribute("maxlength", "24");
  } else if (carrier === "postnl") {
    elements.trackingNumber.setAttribute("pattern", "[0-9][A-Z]{5}[0-9]{9}");
    elements.trackingNumber.setAttribute(
      "placeholder",
      "1 digit, 5 letters, 9 digits for PostNL",
    );
    elements.trackingNumber.setAttribute("maxlength", "15");
  }
};

export const showLoading = (output: HTMLDivElement): void => {
  output.innerHTML = `
    <div class="d-flex align-items-center gap-2" role="status" aria-live="polite">
      <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
      <span>Processing request...</span>
    </div>
  `;
};

export const showResult = (
  output: HTMLDivElement,
  svgDataUrl: string,
  trackingShown: string,
): void => {
  output.innerHTML = `
    <h5>Generated Label</h5>
    <p><strong>Number displayed under barcode:</strong> ${trackingShown}</p>
    <img src="${svgDataUrl}" style="max-width: 100%; border: 1px solid #ddd;" />
  `;

  const downloadBtn = document.getElementById("downloadPdfBtn");
  if (downloadBtn) {
    downloadBtn.style.display = "inline-block";
  }
};

export const showError = (output: HTMLDivElement, message: string): void => {
  output.innerHTML = `
    <div class="alert alert-danger" role="alert">
      Processing failed: ${message}
    </div>
  `;
};

export const validateFormAndShowErrors = (elements: FormElements): boolean => {
  const errors: string[] = [];

  // Validate sender fields
  if (!elements.senderIsCompany.checked) {
    if (elements.senderFirstname.value.trim() === "") {
      errors.push("Sender first name is required");
    }
    if (elements.senderLastname.value.trim() === "") {
      errors.push("Sender last name is required");
    }
  } else {
    if (elements.senderCompany.value.trim() === "") {
      errors.push("Sender company is required");
    }
  }

  if (elements.senderAddress.value.trim() === "") {
    errors.push("Sender address is required");
  }
  if (elements.senderPostal.value.trim() === "") {
    errors.push("Sender postal is required");
  }
  if (elements.senderCity.value.trim() === "") {
    errors.push("Sender city is required");
  }
  if (!elements.senderCountry.value) {
    errors.push("Sender country is required");
  }

  // Validate recipient fields
  if (!elements.recipientIsCompany.checked) {
    if (elements.recipientFirstname.value.trim() === "") {
      errors.push("Recipient first name is required");
    }
    if (elements.recipientLastname.value.trim() === "") {
      errors.push("Recipient last name is required");
    }
  } else {
    if (elements.recipientCompany.value.trim() === "") {
      errors.push("Recipient company is required");
    }
  }

  if (elements.recipientAddress.value.trim() === "") {
    errors.push("Recipient address is required");
  }
  if (elements.recipientPostal.value.trim() === "") {
    errors.push("Recipient postal is required");
  }
  if (elements.recipientCity.value.trim() === "") {
    errors.push("Recipient city is required");
  }
  if (!elements.recipientCountry.value) {
    errors.push("Recipient country is required");
  }

  // Validate tracking number
  if (elements.trackingNumber.value.trim() === "") {
    errors.push("Tracking number is required");
  }

  // Validate carrier
  if (!elements.carrier.value) {
    errors.push("Carrier is required");
  }

  // Validate label language
  if (!elements.labelLanguage.value) {
    errors.push("Label language is required");
  }

  // Display errors or return success
  if (errors.length > 0) {
    showError(elements.output, `Validation failed:\n${errors.join("\n")}`);
    return false;
  }

  return true;
};

export const loadTestDataIntoForm = (
  elements: FormElements,
  testData: LabelPayload,
): void => {
  elements.senderFirstname.value = testData.sender_firstname;
  elements.senderLastname.value = testData.sender_lastname;
  elements.senderCompany.value = testData.sender_company;
  elements.senderAddress.value = testData.sender_address;
  elements.senderPostal.value = testData.sender_postal;
  elements.senderCity.value = testData.sender_city;
  elements.senderCountry.value = testData.sender_country;
  elements.recipientFirstname.value = testData.recipient_firstname;
  elements.recipientLastname.value = testData.recipient_lastname;
  elements.recipientCompany.value = testData.recipient_company;
  elements.recipientAddress.value = testData.recipient_address;
  elements.recipientPostal.value = testData.recipient_postal;
  elements.recipientCity.value = testData.recipient_city;
  elements.carrier.value = testData.carrier;
  elements.trackingNumber.value = testData.tracking_number;
  elements.labelLanguage.value = testData.label_language;
  elements.recipientCountry.value = testData.recipient_country;
};
