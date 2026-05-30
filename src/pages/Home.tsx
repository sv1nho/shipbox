import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import type {
  UseFormRegister,
  UseFormSetValue,
  FieldErrors,
  Path,
} from "react-hook-form";
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

// ── Shared sub-components ────────────────────────────────────────────────────

const SectionCard = ({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
};

const Field = ({
  error,
  children,
}: {
  error?: string;
  children: React.ReactNode;
}) => {
  return (
    <div>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
};

// ── PartyFieldset ────────────────────────────────────────────────────────────

interface PartyFieldsetProps {
  prefix: "sender" | "recipient";
  title: string;
  isCompany: boolean;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  setValue: UseFormSetValue<FormData>;
}

const PartyFieldset = ({
  prefix,
  title,
  isCompany,
  register,
  errors,
  setValue,
}: PartyFieldsetProps) => {
  const name = (field: string) => `${prefix}_${field}` as Path<FormData>;
  const err = (field: string): string | undefined => {
    const e = errors[name(field) as keyof FormData];
    return e && typeof e === "object" && "message" in e
      ? (e.message as string)
      : undefined;
  };

  const toggle = (
    <div className="flex rounded-full border border-zinc-200 overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() =>
          setValue(
            name("isCompany") as "sender_isCompany" | "recipient_isCompany",
            false,
          )
        }
        className={`px-3 py-1 transition-colors ${!isCompany ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-700"}`}
      >
        Individual
      </button>
      <button
        type="button"
        onClick={() =>
          setValue(
            name("isCompany") as "sender_isCompany" | "recipient_isCompany",
            true,
          )
        }
        className={`px-3 py-1 transition-colors ${isCompany ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-700"}`}
      >
        Company
      </button>
    </div>
  );

  return (
    <SectionCard title={title} right={toggle}>
      {isCompany ? (
        <input
          {...register(name("company"))}
          className="form-input"
          placeholder="Company name"
        />
      ) : (
        <>
          <Field error={err("firstname")}>
            <input
              {...register(name("firstname"), {
                required: "First name is required",
              })}
              className="form-input"
              placeholder="First name"
            />
          </Field>
          <Field error={err("lastname")}>
            <input
              {...register(name("lastname"), {
                required: "Last name is required",
              })}
              className="form-input"
              placeholder="Last name"
            />
          </Field>
        </>
      )}

      <Field error={err("address")}>
        <input
          {...register(name("address"), { required: "Address is required" })}
          className="form-input"
          placeholder="Address"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field error={err("postal")}>
          <input
            {...register(name("postal"), { required: "Required" })}
            className="form-input"
            placeholder="Postal code"
          />
        </Field>
        <Field error={err("city")}>
          <input
            {...register(name("city"), { required: "Required" })}
            className="form-input"
            placeholder="City"
          />
        </Field>
      </div>

      <select {...register(name("country"))} className="form-select">
        <option value="BE">Belgium</option>
        <option value="NL">The Netherlands</option>
        <option value="DE">Germany</option>
      </select>
    </SectionCard>
  );
};

// ── Home ─────────────────────────────────────────────────────────────────────

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
    if (!isTestMode) return;
    const testData = getTestData(carrier);
    (Object.keys(testData) as (keyof typeof testData)[]).forEach((key) => {
      setValue(key as Path<FormData>, testData[key] as never);
    });
  }, [setValue, carrier]);

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
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

      const svgTemplate = await loadSvgTemplate(data.carrier);
      const { svg, trackingShown: shown } = buildLabelSvg(payload, svgTemplate);
      setTrackingShown(shown);
      const pdfBlob = await svgToPdf(svg);
      setPdfUrl(URL.createObjectURL(pdfBlob));
      setIsDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error(err);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "label.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {error && <div className="alert-error mb-6">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <PartyFieldset
            prefix="sender"
            title="Sender"
            isCompany={senderIsCompany}
            register={register}
            errors={errors}
            setValue={setValue}
          />
          <PartyFieldset
            prefix="recipient"
            title="Recipient"
            isCompany={recipientIsCompany}
            register={register}
            errors={errors}
            setValue={setValue}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <SectionCard title="Language">
            <select {...register("label_language")} className="form-select">
              <option value="fr">French</option>
              <option value="nl">Dutch</option>
              <option value="en">English</option>
            </select>
          </SectionCard>

          <SectionCard title="Carrier">
            <select {...register("carrier")} className="form-select">
              <option value="bpost">Bpost</option>
              <option value="postnl">PostNL</option>
            </select>
          </SectionCard>

          <SectionCard title="Tracking Number">
            <Field error={errors.tracking_number?.message}>
              <input
                {...register("tracking_number", { required: "Required" })}
                className="form-input"
                placeholder="24 digits for Bpost"
              />
            </Field>
          </SectionCard>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary shadow-sm"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Generating…
              </>
            ) : (
              "Generate Label"
            )}
          </button>
        </div>
      </form>

      {isDialogOpen && pdfUrl && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDialogOpen(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">Label Preview</h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="btn btn-ghost"
                style={{ padding: "0.375rem" }}
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <iframe
                src={pdfUrl}
                className="w-full rounded border border-zinc-200"
                height="480"
                style={{ border: "none" }}
              />
              {trackingShown && (
                <p className="mt-3 text-sm text-zinc-500">
                  <span className="font-medium text-zinc-700">Tracking:</span>{" "}
                  {trackingShown}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="btn btn-ghost"
              >
                Close
              </button>
              <button onClick={handleDownloadPdf} className="btn btn-primary">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
