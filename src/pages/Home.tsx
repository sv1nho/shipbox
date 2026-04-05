import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import type {
  LabelPayload,
  Carrier,
  Language,
  Country,
} from "../types/index.js";
import { buildLabelSvg } from "../utils/label-generator.js";
import { loadSvgTemplate } from "../utils/svg-loader.js";
import { svgToPdf } from "../utils/pdf-generator.js";
import { getTestData } from "../test-data.js";

interface FormData {
  sender_firstname: string;
  sender_lastname: string;
  sender_company: string;
  sender_address: string;
  sender_postal: string;
  sender_city: string;
  sender_country: Country;
  sender_isCompany: boolean;
  recipient_firstname: string;
  recipient_lastname: string;
  recipient_company: string;
  recipient_address: string;
  recipient_postal: string;
  recipient_city: string;
  recipient_country: Country;
  recipient_isCompany: boolean;
  label_language: Language;
  carrier: Carrier;
  tracking_number: string;
}

export function Home() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      sender_country: "BE",
      recipient_country: "BE",
      label_language: "fr",
      carrier: "bpost",
      sender_isCompany: false,
      recipient_isCompany: false,
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingShown, setTrackingShown] = useState<string | null>(null);

  const senderIsCompany = watch("sender_isCompany");
  const recipientIsCompany = watch("recipient_isCompany");
  const carrier = watch("carrier");
  
  useEffect(() => {
    const isTestMode = import.meta.env.VITE_TEST_MODE === "true";
    if (isTestMode) {
      const testData = getTestData(carrier);

      setValue("sender_firstname", testData.sender_firstname);
      setValue("sender_lastname", testData.sender_lastname);
      setValue("sender_company", testData.sender_company);
      setValue("sender_address", testData.sender_address);
      setValue("sender_postal", testData.sender_postal);
      setValue("sender_city", testData.sender_city);
      setValue("sender_country", testData.sender_country);

      setValue("recipient_firstname", testData.recipient_firstname);
      setValue("recipient_lastname", testData.recipient_lastname);
      setValue("recipient_company", testData.recipient_company);
      setValue("recipient_address", testData.recipient_address);
      setValue("recipient_postal", testData.recipient_postal);
      setValue("recipient_city", testData.recipient_city);
      setValue("recipient_country", testData.recipient_country);

      setValue("label_language", testData.label_language);
      setValue("carrier", testData.carrier);
      setValue("tracking_number", testData.tracking_number);
    }
  }, [setValue, carrier]);

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);

      // Construire le LabelPayload
      const payload: LabelPayload = {
        sender_firstname: senderIsCompany ? "" : data.sender_firstname,
        sender_lastname: senderIsCompany ? "" : data.sender_lastname,
        sender_company: senderIsCompany ? data.sender_company : "",
        sender_address: data.sender_address,
        sender_postal: data.sender_postal,
        sender_city: data.sender_city,
        sender_country: data.sender_country,
        recipient_firstname: recipientIsCompany ? "" : data.recipient_firstname,
        recipient_lastname: recipientIsCompany ? "" : data.recipient_lastname,
        recipient_company: recipientIsCompany ? data.recipient_company : "",
        recipient_address: data.recipient_address,
        recipient_postal: data.recipient_postal,
        recipient_city: data.recipient_city,
        recipient_country: data.recipient_country,
        carrier: data.carrier,
        tracking_number: data.tracking_number,
        label_language: data.label_language,
      };

      // Charger le template SVG
      const svgTemplate = await loadSvgTemplate(data.carrier);

      // Générer le label SVG
      const { svg, trackingShown: shown } = buildLabelSvg(payload, svgTemplate);

      setTrackingShown(shown);

      // Convertir en PDF
      const pdfBlob = await svgToPdf(svg);
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      setIsDialogOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error(err);
    }
  };

  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = "label.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Shipping Label Generator</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* SENDER SECTION */}
        <h4>Sender</h4>

        {!senderIsCompany && (
          <>
            <input
              {...register("sender_firstname", {
                required: "First name is required",
              })}
              className="form-control mb-2"
              placeholder="First name"
            />
            {errors.sender_firstname && (
              <div className="text-danger mb-2">
                {errors.sender_firstname.message}
              </div>
            )}
            <input
              {...register("sender_lastname", {
                required: "Last name is required",
              })}
              className="form-control mb-2"
              placeholder="Last name"
            />
            {errors.sender_lastname && (
              <div className="text-danger mb-2">
                {errors.sender_lastname.message}
              </div>
            )}
          </>
        )}

        {senderIsCompany && (
          <>
            <input
              {...register("sender_company")}
              className="form-control mb-2"
              placeholder="Company name"
            />
          </>
        )}

        <label className="mb-2 d-block">
          <input type="checkbox" {...register("sender_isCompany")} /> Company?
        </label>

        <input
          {...register("sender_address", { required: "Address is required" })}
          className="form-control mb-2"
          placeholder="Address"
        />
        {errors.sender_address && (
          <div className="text-danger mb-2">
            {errors.sender_address.message}
          </div>
        )}
        <input
          {...register("sender_postal", {
            required: "Postal code is required",
          })}
          className="form-control mb-2"
          placeholder="Postal code"
        />
        {errors.sender_postal && (
          <div className="text-danger mb-2">{errors.sender_postal.message}</div>
        )}
        <input
          {...register("sender_city", { required: "City is required" })}
          className="form-control mb-2"
          placeholder="City"
        />
        {errors.sender_city && (
          <div className="text-danger mb-2">{errors.sender_city.message}</div>
        )}
        <select {...register("sender_country")} className="form-select mb-3">
          <option value="BE">Belgium</option>
          <option value="NL">The Netherlands</option>
          <option value="DE">Germany</option>
        </select>

        {/* RECIPIENT SECTION */}
        <h4 className="mt-4">Recipient</h4>

        {!recipientIsCompany && (
          <>
            <input
              {...register("recipient_firstname", {
                required: "First name is required",
              })}
              className="form-control mb-2"
              placeholder="First name"
            />
            {errors.recipient_firstname && (
              <div className="text-danger mb-2">
                {errors.recipient_firstname.message}
              </div>
            )}
            <input
              {...register("recipient_lastname", {
                required: "Last name is required",
              })}
              className="form-control mb-2"
              placeholder="Last name"
            />
            {errors.recipient_lastname && (
              <div className="text-danger mb-2">
                {errors.recipient_lastname.message}
              </div>
            )}
          </>
        )}

        {recipientIsCompany && (
          <>
            <input
              {...register("recipient_company")}
              className="form-control mb-2"
              placeholder="Company name"
            />
          </>
        )}

        <label className="mb-2 d-block">
          <input type="checkbox" {...register("recipient_isCompany")} />{" "}
          Company?
        </label>
        <input
          {...register("recipient_address", {
            required: "Address is required",
          })}
          className="form-control mb-2"
          placeholder="Address"
        />
        {errors.recipient_address && (
          <div className="text-danger mb-2">
            {errors.recipient_address.message}
          </div>
        )}
        <input
          {...register("recipient_postal", {
            required: "Postal code is required",
          })}
          className="form-control mb-2"
          placeholder="Postal code"
        />
        {errors.recipient_postal && (
          <div className="text-danger mb-2">
            {errors.recipient_postal.message}
          </div>
        )}
        <input
          {...register("recipient_city", { required: "City is required" })}
          className="form-control mb-2"
          placeholder="City"
        />
        {errors.recipient_city && (
          <div className="text-danger mb-2">
            {errors.recipient_city.message}
          </div>
        )}
        <select {...register("recipient_country")} className="form-select mb-3">
          <option value="BE">Belgium</option>
          <option value="NL">The Netherlands</option>
          <option value="DE">Germany</option>
        </select>

        {/* LANGUAGE SECTION */}
        <h4 className="mt-4">Label Language</h4>
        <select {...register("label_language")} className="form-select mb-3">
          <option value="fr">French</option>
          <option value="nl">Dutch</option>
          <option value="en">English</option>
        </select>

        {/* CARRIER SECTION */}
        <h4 className="mt-4">Carrier</h4>
        <select {...register("carrier")} className="form-select mb-3">
          <option value="bpost">Bpost</option>
          <option value="postnl">PostNL</option>
        </select>

        {/* TRACKING SECTION */}
        <h4 className="mt-4">Tracking Number</h4>
        <input
          {...register("tracking_number", {
            required: "Tracking number is required",
          })}
          className="form-control mb-3"
          placeholder="24 digits for Bpost"
        />
        {errors.tracking_number && (
          <div className="text-danger mb-2">
            {errors.tracking_number.message}
          </div>
        )}

        <div className="d-flex gap-2">
          <button
            type="submit"
            className="btn btn-success"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Generating..." : "Generate Label"}
          </button>
        </div>
      </form>

      {/* PDF DIALOG */}
      {isDialogOpen && pdfUrl && (
        <div
          className="modal"
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Label Preview</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setIsDialogOpen(false)}
                />
              </div>
              <div className="modal-body">
                <iframe
                  src={pdfUrl}
                  width="100%"
                  height="500px"
                  style={{ border: "none" }}
                />
                {trackingShown && (
                  <p className="mt-2">
                    <strong>Tracking Number (shown):</strong> {trackingShown}
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadPdf}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
