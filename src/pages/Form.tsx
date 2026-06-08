import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type {
  UseFormRegister,
  UseFormSetValue,
  FieldErrors,
  Path,
} from 'react-hook-form'
import type { LabelPayload } from '../types/index.js'
import { buildLabelSvg } from '../utils/label-generator.js'
import { loadSvgTemplate } from '../utils/svg-loader.js'
import { svgToPdf, downloadPdf } from '../utils/pdf-generator.js'
import { getTestData } from '../test-data.js'
import { Spinner } from '../components/Spinner.js'
import { LabelPreviewModal } from '../components/LabelPreviewModal.js'
import { fakerFR_BE, fakerNL_BE, fakerNL } from '@faker-js/faker'

const fakers = [fakerFR_BE, fakerNL_BE, fakerNL]
const randomFaker = () => fakers[Math.floor(Math.random() * fakers.length)]

// ── Shared sub-components ────────────────────────────────────────────────────

const SectionCard = ({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) => (
  <div className='card'>
    <div className='card-header'>
      <h3 className='card-title'>{title}</h3>
      {right}
    </div>
    <div className='space-y-3'>{children}</div>
  </div>
)

const Field = ({
  error,
  children,
}: {
  error?: string;
  children: ReactNode;
}) => (
  <div>
    {children}
    {error && <p className='field-error'>{error}</p>}
  </div>
)

// ── PartyFieldset ────────────────────────────────────────────────────────────

interface PartyFieldsetProps {
  prefix: 'sender' | 'recipient';
  title: string;
  isCompany: boolean;
  register: UseFormRegister<LabelPayload>;
  errors: FieldErrors<LabelPayload>;
  setValue: UseFormSetValue<LabelPayload>;
}

const PartyFieldset = ({
  prefix,
  title,
  isCompany,
  register,
  errors,
  setValue,
}: PartyFieldsetProps) => {
  const name = (field: string): Path<LabelPayload> => `${prefix}_${field}` as Path<LabelPayload>
  const err = (field: string): string | undefined => {
    const e = errors[name(field)]
    return e && typeof e === 'object' && 'message' in e
      ? e.message
      : undefined
  }
  const isCompanyKey = name('isCompany') as
    | 'sender_isCompany'
    | 'recipient_isCompany'

  const toggle = (
    <div className='flex rounded-full border border-zinc-200 overflow-hidden text-xs font-medium'>
      <button
        type='button'
        onClick={() => setValue(isCompanyKey, false)}
        className={`px-3 py-1 transition-colors ${!isCompany ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
      >
        Individual
      </button>
      <button
        type='button'
        onClick={() => setValue(isCompanyKey, true)}
        className={`px-3 py-1 transition-colors ${isCompany ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
      >
        Company
      </button>
    </div>
  )

  const generateBtn = (
    <button
      type='button'
      className='btn btn-ghost text-xs px-2.5 py-1'
      onClick={() => {
        const faker = randomFaker()
        if (isCompany) {
          setValue(name('company'), faker.company.name())
        } else {
          setValue(name('firstname'), faker.person.firstName())
          setValue(name('lastname'), faker.person.lastName())
        }
      }}
    >
      Fill with random data
    </button>
  )

  return (
    <SectionCard
      title={title}
      right={
        <div className='flex items-center gap-2'>
          {generateBtn}
          {toggle}
        </div>
      }
    >
      {isCompany
        ? (
          <input
            {...register(name('company'))}
            className='form-input'
            placeholder='Company name'
          />
          )
        : (
          <>
            <Field error={err('firstname')}>
              <input
                {...register(name('firstname'), {
                  required: 'First name is required',
                })}
                className='form-input'
                placeholder='First name'
              />
            </Field>
            <Field error={err('lastname')}>
              <input
                {...register(name('lastname'), {
                  required: 'Last name is required',
                })}
                className='form-input'
                placeholder='Last name'
              />
            </Field>
          </>
          )}

      <Field error={err('address')}>
        <input
          {...register(name('address'), { required: 'Address is required' })}
          className='form-input'
          placeholder='Address'
        />
      </Field>

      <div className='grid grid-cols-2 gap-3'>
        <Field error={err('postal')}>
          <input
            {...register(name('postal'), { required: 'Required' })}
            className='form-input'
            placeholder='Postal code'
          />
        </Field>
        <Field error={err('city')}>
          <input
            {...register(name('city'), { required: 'Required' })}
            className='form-input'
            placeholder='City'
          />
        </Field>
      </div>

      <select {...register(name('country'))} className='form-select'>
        <option value='BE'>Belgium</option>
        <option value='NL'>The Netherlands</option>
        <option value='DE'>Germany</option>
      </select>
    </SectionCard>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────────

export function Form () {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LabelPayload>({
    defaultValues: {
      sender_country: 'BE',
      recipient_country: 'BE',
      label_language: 'fr',
      carrier: 'bpost',
      sender_isCompany: false,
      recipient_isCompany: false,
    },
  })

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [maskedTracking, setMaskedTracking] = useState<string | null>(null)

  const senderIsCompany = useWatch({ control, name: 'sender_isCompany' })
  const recipientIsCompany = useWatch({ control, name: 'recipient_isCompany' })
  const carrier = useWatch({ control, name: 'carrier' })

  useEffect(() => {
    if (import.meta.env.VITE_TEST_MODE !== 'true') return
    const testData = getTestData(carrier);
    (Object.keys(testData) as (keyof typeof testData)[]).forEach((key) => {
      setValue(key, testData[key] as never)
    })
  }, [setValue, carrier])

  const onSubmit = async (data: LabelPayload) => {
    try {
      setError(null)
      const svgTemplate = await loadSvgTemplate(data.carrier)
      const { svg, maskedTracking: masked } = buildLabelSvg(data, svgTemplate)
      setMaskedTracking(masked)

      const blob = await svgToPdf(svg)
      setPdfBlob(blob)
      setPdfUrl(URL.createObjectURL(blob))
      setIsPreviewOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleClose = () => {
    setIsPreviewOpen(false)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setPdfBlob(null)
  }

  const handleDownload = () => {
    if (!pdfBlob) return
    downloadPdf(pdfBlob, 'label.pdf')
  }

  return (
    <>
      {error && <div className='alert-error mb-6'>{error}</div>}

      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className='space-y-6'>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <PartyFieldset
            prefix='sender'
            title='Sender'
            isCompany={senderIsCompany}
            register={register}
            errors={errors}
            setValue={setValue}
          />
          <PartyFieldset
            prefix='recipient'
            title='Recipient'
            isCompany={recipientIsCompany}
            register={register}
            errors={errors}
            setValue={setValue}
          />
        </div>

        <div className='grid grid-cols-1 gap-6 sm:grid-cols-3'>
          <SectionCard title='Language'>
            <select {...register('label_language')} className='form-select'>
              <option value='fr'>French</option>
              <option value='nl'>Dutch</option>
              <option value='en'>English</option>
            </select>
          </SectionCard>

          <SectionCard title='Carrier'>
            <select {...register('carrier')} className='form-select'>
              <option value='bpost'>Bpost</option>
              <option value='postnl'>PostNL</option>
            </select>
          </SectionCard>

          <SectionCard title='Tracking Number'>
            <Field error={errors.tracking_number?.message}>
              <input
                {...register('tracking_number', { required: 'Required' })}
                className='form-input'
                placeholder='24 digits for Bpost'
              />
            </Field>
          </SectionCard>
        </div>

        <div className='flex justify-end'>
          <button
            type='submit'
            disabled={isSubmitting}
            className='btn btn-primary shadow-sm'
          >
            {isSubmitting
              ? (
                <>
                  <Spinner />
                  Generating…
                </>
                )
              : (
                  'Generate Label'
                )}
          </button>
        </div>
      </form>

      {isPreviewOpen && pdfUrl && (
        <LabelPreviewModal
          pdfUrl={pdfUrl}
          maskedTracking={maskedTracking}
          onClose={handleClose}
          onDownload={handleDownload}
        />
      )}
    </>
  )
}
