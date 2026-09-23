import { useState } from 'react'
import type { ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type {
  UseFormRegister,
  UseFormSetValue,
  FieldErrors,
  Path,
} from 'react-hook-form'
import type { LabelPayload } from '../types/index.js'
import { CARRIERS, CARRIER_IDS } from '../../shared/carriers.js'
import type { CarrierId } from '../../shared/carriers.js'
import { buildLabelSvg } from '../utils/label-generator.js'
import { loadSvgTemplate } from '../utils/svg-loader.js'
import { svgToPdf, downloadPdf } from '../utils/pdf-generator.js'
import { labelFileName } from '../utils/label-file-name.js'
import { Spinner } from '../components/Spinner.js'
import { LabelPreviewModal } from '../components/LabelPreviewModal.js'
import { TrackOffer } from '../shipments/TrackOffer.js'
import { useT } from '../i18n/context.js'
import type { Translate } from '../i18n/context.js'
import { fakerFR_BE, fakerNL_BE, fakerNL } from '@faker-js/faker'

type Preview = {
  blob: Blob
  url: string
  maskedTracking: string
  carrier: CarrierId
}

const fakers = [fakerFR_BE, fakerNL_BE, fakerNL]
const randomFaker = () => fakers[Math.floor(Math.random() * fakers.length)]

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

interface PartyFieldsetProps {
  t: Translate;
  prefix: 'sender' | 'recipient';
  title: string;
  isCompany: boolean;
  register: UseFormRegister<LabelPayload>;
  errors: FieldErrors<LabelPayload>;
  setValue: UseFormSetValue<LabelPayload>;
}

const PartyFieldset = ({
  t,
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
    <div className='segmented'>
      <button
        type='button'
        onClick={() => setValue(isCompanyKey, false)}
        className={!isCompany ? 'segmented-btn segmented-btn-active' : 'segmented-btn'}
      >
        {t('Individual')}
      </button>
      <button
        type='button'
        onClick={() => setValue(isCompanyKey, true)}
        className={isCompany ? 'segmented-btn segmented-btn-active' : 'segmented-btn'}
      >
        {t('Company')}
      </button>
    </div>
  )

  const fillLabel = t('Fill {party} with random data', { party: t(prefix) })

  const generateBtn = (
    <button
      type='button'
      className='icon-btn icon-btn-random'
      aria-label={fillLabel}
      title={fillLabel}
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
      <svg viewBox='0 0 16 16' width='14' height='14' aria-hidden='true'>
        <rect
          x='2.25'
          y='2.25'
          width='11.5'
          height='11.5'
          rx='2.5'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.3'
        />
        <circle cx='5.5' cy='5.5' r='1.15' fill='currentColor' />
        <circle cx='8' cy='8' r='1.15' fill='currentColor' />
        <circle cx='10.5' cy='10.5' r='1.15' fill='currentColor' />
      </svg>
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
            placeholder={t('Company name')}
          />
          )
        : (
          <>
            <Field error={err('firstname')}>
              <input
                {...register(name('firstname'), {
                  required: t('First name is required'),
                })}
                className='form-input'
                placeholder={t('First name')}
              />
            </Field>
            <Field error={err('lastname')}>
              <input
                {...register(name('lastname'), {
                  required: t('Last name is required'),
                })}
                className='form-input'
                placeholder={t('Last name')}
              />
            </Field>
          </>
          )}

      <Field error={err('address')}>
        <input
          {...register(name('address'), { required: t('Address is required') })}
          className='form-input'
          placeholder={t('Address')}
        />
      </Field>

      <div className='grid grid-cols-2 gap-3'>
        <Field error={err('postal')}>
          <input
            {...register(name('postal'), { required: 'Required' })}
            className='form-input'
            placeholder={t('Postal code')}
          />
        </Field>
        <Field error={err('city')}>
          <input
            {...register(name('city'), { required: 'Required' })}
            className='form-input'
            placeholder={t('City')}
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

  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [labelPayload, setLabelPayload] = useState<LabelPayload | null>(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const t = useT()

  const senderIsCompany = useWatch({ control, name: 'sender_isCompany' })
  const recipientIsCompany = useWatch({ control, name: 'recipient_isCompany' })
  const carrier = useWatch({ control, name: 'carrier' })

  const onSubmit = async (data: LabelPayload) => {
    try {
      setError(null)
      const svgTemplate = await loadSvgTemplate(data.carrier)
      const { svg, maskedTracking } = buildLabelSvg(data, svgTemplate)
      const blob = await svgToPdf(svg)

      setLabelPayload(data)
      setPreview({ blob, url: URL.createObjectURL(blob), maskedTracking, carrier: data.carrier })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Unknown error'))
    }
  }

  const closePreview = (open: Preview) => {
    URL.revokeObjectURL(open.url)
    setPreview(null)
  }

  const offerTracking = (open: Preview) => {
    closePreview(open)
    setOfferOpen(true)
  }

  return (
    <>
      {error && <div className='alert-error mb-6'>{error}</div>}

      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className='space-y-6'>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <PartyFieldset
            prefix='sender'
            t={t}
            title={t('Sender')}
            isCompany={senderIsCompany}
            register={register}
            errors={errors}
            setValue={setValue}
          />
          <PartyFieldset
            prefix='recipient'
            t={t}
            title={t('Recipient')}
            isCompany={recipientIsCompany}
            register={register}
            errors={errors}
            setValue={setValue}
          />
        </div>

        <div className='grid grid-cols-1 gap-6 sm:grid-cols-3'>
          <SectionCard title={t('Language')}>
            <select {...register('label_language')} className='form-select'>
              <option value='fr'>{t('French')}</option>
              <option value='nl'>{t('Dutch')}</option>
              <option value='en'>{t('English')}</option>
            </select>
          </SectionCard>

          <SectionCard title={t('Carrier')}>
            <select {...register('carrier')} className='form-select'>
              {CARRIER_IDS.map((id) => (
                <option key={id} value={id}>{CARRIERS[id].label}</option>
              ))}
            </select>
          </SectionCard>

          <SectionCard title={t('Tracking Number')}>
            <Field error={errors.tracking_number?.message}>
              <input
                {...register('tracking_number', {
                  required: 'Required',
                  validate: (value) =>
                    CARRIERS[carrier].pattern.test(value) ||
                    `Must match: ${CARRIERS[carrier].patternHint}`,
                })}
                className='form-input'
                placeholder={CARRIERS[carrier].placeholder}
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
                  t('Generate Label')
                )}
          </button>
        </div>
      </form>

      {preview !== null && (
        <LabelPreviewModal
          pdfUrl={preview.url}
          maskedTracking={preview.maskedTracking}
          onClose={() => { closePreview(preview) }}
          onDownload={() => {
            downloadPdf(preview.blob, labelFileName(preview.carrier))
            offerTracking(preview)
          }}
          onTrack={() => { offerTracking(preview) }}
        />
      )}

      {offerOpen && labelPayload !== null && (
        <TrackOffer payload={labelPayload} onClose={() => { setOfferOpen(false) }} />
      )}
    </>
  )
}
