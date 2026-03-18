export interface FormElements {
  form: HTMLFormElement;
  output: HTMLDivElement;
  submitButton: HTMLButtonElement;
  senderFirstname: HTMLInputElement;
  senderLastname: HTMLInputElement;
  senderCompany: HTMLInputElement;
  senderRandomNameBtn: HTMLButtonElement;
  senderIsCompany: HTMLInputElement;
  senderPersonFields: HTMLDivElement;
  senderCompanyFields: HTMLDivElement;
  recipientFirstname: HTMLInputElement;
  recipientLastname: HTMLInputElement;
  recipientCompany: HTMLInputElement;
  recipientIsCompany: HTMLInputElement;
  recipientPersonFields: HTMLDivElement;
  recipientCompanyFields: HTMLDivElement;
  carrier: HTMLSelectElement;
  trackingNumber: HTMLInputElement;
}

export const getFormElements = (): FormElements => {
  const form = document.getElementById("labelForm");
  const output = document.getElementById("output");
  const submitButton = form?.querySelector("button[type='submit']");

  const senderFirstname = document.getElementById("sender_firstname");
  const senderLastname = document.getElementById("sender_lastname");
  const senderCompany = document.getElementById("sender_company");
  const senderRandomNameBtn = document.getElementById("senderRandomNameBtn");
  const senderIsCompany = document.getElementById("sender_isCompany");
  const senderPersonFields = document.getElementById("senderPersonFields");
  const senderCompanyFields = document.getElementById("senderCompanyFields");

  const recipientFirstname = document.getElementById("recipient_firstname");
  const recipientLastname = document.getElementById("recipient_lastname");
  const recipientCompany = document.getElementById("recipient_company");
  const recipientIsCompany = document.getElementById("recipient_isCompany");
  const recipientPersonFields = document.getElementById(
    "recipientPersonFields",
  );
  const recipientCompanyFields = document.getElementById(
    "recipientCompanyFields",
  );

  const carrier = document.getElementById("carrier");
  const trackingNumber = document.getElementById("tracking_number");

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
  if (!(recipientIsCompany instanceof HTMLInputElement)) {
    throw new Error("Recipient is company checkbox not found.");
  }
  if (!(recipientPersonFields instanceof HTMLDivElement)) {
    throw new Error("Recipient person fields container not found.");
  }
  if (!(recipientCompanyFields instanceof HTMLDivElement)) {
    throw new Error("Recipient company fields container not found.");
  }
  if (!(carrier instanceof HTMLSelectElement)) {
    throw new Error("Carrier select not found.");
  }
  if (!(trackingNumber instanceof HTMLInputElement)) {
    throw new Error("Tracking number field not found.");
  }

  return {
    form,
    output,
    submitButton,
    senderFirstname,
    senderLastname,
    senderCompany,
    senderRandomNameBtn,
    senderIsCompany,
    senderPersonFields,
    senderCompanyFields,
    recipientFirstname,
    recipientLastname,
    recipientCompany,
    recipientIsCompany,
    recipientPersonFields,
    recipientCompanyFields,
    carrier,
    trackingNumber,
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
};

export const showError = (output: HTMLDivElement, message: string): void => {
  output.innerHTML = `
    <div class="alert alert-danger" role="alert">
      Processing failed: ${message}
    </div>
  `;
};
