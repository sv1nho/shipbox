import type { GeneratedLabel, LabelPayload } from "./types/index.js";
import {
  getFormElements,
  updateSenderFields,
  updateRecipientFields,
  updateTrackingValidation,
  showLoading,
  showResult,
  showError,
} from "./utils/dom.js";

const isGeneratedLabel = (value: unknown): value is GeneratedLabel => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<GeneratedLabel>;
  return (
    typeof candidate.svg === "string" &&
    typeof candidate.trackingShown === "string"
  );
};

const getFormDataFromDom = (form: HTMLFormElement): LabelPayload => {
  const browserFormData = new FormData(form);
  const formData: Record<string, string> = {};

  browserFormData.forEach((value, key) => {
    const strValue = typeof value === "string" ? value : value.name;
    if (strValue !== undefined) {
      formData[key] = strValue;
    }
  });

  return formData as LabelPayload;
};

const initializeForm = (): void => {
  const elements = getFormElements();

  updateSenderFields(elements);
  updateRecipientFields(elements);
  updateTrackingValidation(elements);

  elements.senderIsCompany.addEventListener("change", (): void => {
    updateSenderFields(elements);
  });

  elements.recipientIsCompany.addEventListener("change", (): void => {
    updateRecipientFields(elements);
  });

  elements.carrier.addEventListener("change", (): void => {
    updateTrackingValidation(elements);
  });

  elements.senderRandomNameBtn.addEventListener("click", (event): void => {
    event.preventDefault();
    const electronAPI = (window as { electronAPI?: Window["electronAPI"] })
      .electronAPI;
    if (!electronAPI) {
      // eslint-disable-next-line no-console
      console.error("Electron API not available");
      return;
    }
    const { firstname, lastname } = electronAPI.generateRandomName();
    elements.senderFirstname.value = firstname;
    elements.senderLastname.value = lastname;
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();

    void (async () => {
      elements.submitButton.disabled = true;
      showLoading(elements.output);

      try {
        const formData = getFormDataFromDom(elements.form);

        if (elements.senderIsCompany.checked) {
          formData["sender_firstname"] = formData["sender_company"] ?? "";
          formData["sender_lastname"] = "";
        }

        if (elements.recipientIsCompany.checked) {
          formData["recipient_firstname"] = formData["recipient_company"] ?? "";
          formData["recipient_lastname"] = "";
        }

        const electronApi = (window as { electronAPI?: Window["electronAPI"] })
          .electronAPI;
        if (
          electronApi === undefined ||
          typeof electronApi.generateLabelSvg !== "function"
        ) {
          throw new Error(
            "Electron bridge unavailable. Close and restart the application with npm run start.",
          );
        }

        const maybeGenerated = await electronApi.generateLabelSvg(formData);
        if (!isGeneratedLabel(maybeGenerated)) {
          throw new Error("Invalid response for SVG generation.");
        }

        const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(maybeGenerated.svg)}`;
        showResult(elements.output, svgDataUrl, maybeGenerated.trackingShown);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unexpected error.";
        showError(elements.output, message);
      } finally {
        elements.submitButton.disabled = false;
      }
    })();
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeForm);
} else {
  initializeForm();
}
