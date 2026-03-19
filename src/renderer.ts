import type { GeneratedLabel, LabelPayload } from "./types/index.js";
import {
  getFormElements,
  updateSenderFields,
  updateRecipientFields,
  updateTrackingValidation,
  showLoading,
  showResult,
  showError,
  loadTestDataIntoForm,
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

let currentSvg = "";
let isTestMode = false;
let electronApiRef: Window["electronAPI"] | undefined;

const initializeForm = (): void => {
  const elements = getFormElements();

  updateSenderFields(elements);
  updateRecipientFields(elements);
  updateTrackingValidation(elements);

  window.setTimeout(() => {
    void (async () => {
      try {
        let electronApi = (window as { electronAPI?: Window["electronAPI"] })
          .electronAPI;
        let attempts = 0;
        while (!electronApi && attempts < 10) {
          await new Promise((resolve) => window.setTimeout(resolve, 100));
          electronApi = (window as { electronAPI?: Window["electronAPI"] })
            .electronAPI;
          attempts += 1;
        }

        if (!electronApi) {
          return;
        }

        if (typeof electronApi.isTestMode !== "function") {
          return;
        }

        const isTest = await electronApi.isTestMode();
        isTestMode = isTest;
        electronApiRef = electronApi;

        if (isTest) {
          const carrier = elements.carrier.value as "postnl" | "bpost";
          const testData = await electronApi.loadTestData(carrier);
          loadTestDataIntoForm(elements, testData);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error.";
        showError(elements.output, message);
      }
    })();
  }, 100);

  elements.senderIsCompany.addEventListener("change", (): void => {
    updateSenderFields(elements);
  });

  elements.recipientIsCompany.addEventListener("change", (): void => {
    updateRecipientFields(elements);
  });

  elements.carrier.addEventListener("change", (): void => {
    updateTrackingValidation(elements);

    if (isTestMode && electronApiRef) {
      void (async () => {
        const carrier = elements.carrier.value as "postnl" | "bpost";
        const testData = await electronApiRef.loadTestData(
          carrier
        );
        elements.trackingNumber.value = testData["tracking_number"] ?? "";
      })();
    }
  });

  elements.senderRandomNameBtn.addEventListener("click", (event): void => {
    event.preventDefault();
    const electronAPI = (window as { electronAPI?: Window["electronAPI"] })
      .electronAPI;
    if (!electronAPI) {
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

        currentSvg = maybeGenerated.svg;
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

  const downloadPdfBtn = document.getElementById("downloadPdfBtn");
  if (downloadPdfBtn instanceof HTMLButtonElement) {
    downloadPdfBtn.addEventListener("click", (): void => {
      void (async (): Promise<void> => {
        if (!currentSvg) {
          showError(elements.output, "No label generated yet.");
          return;
        }

        downloadPdfBtn.disabled = true;
        try {
          const electronApi = (
            window as { electronAPI?: Window["electronAPI"] }
          ).electronAPI;
          if (
            electronApi === undefined ||
            typeof electronApi.generateLabelPdf !== "function"
          ) {
            throw new Error(
              "Electron bridge unavailable. Close and restart the application with npm run start.",
            );
          }

          await electronApi.generateLabelPdf(currentSvg);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Unexpected error.";
          if (message !== "Save dialog was canceled.") {
            showError(elements.output, message);
          }
        } finally {
          downloadPdfBtn.disabled = false;
        }
      })();
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeForm);
} else {
  initializeForm();
}
