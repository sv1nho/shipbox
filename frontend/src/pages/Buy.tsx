import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabaseClient'

interface Plan {
  id: string
  quota: number
  price_cents: number
}

export const Buy = () => {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void supabase
      .from('plans')
      .select('id, quota, price_cents')
      .order('quota', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError('Unable to load plans right now.')
          return
        }
        setPlans(data)
      })

    return () => { cancelled = true }
  }, [])

  const onBuy = async (planId: string) => {
    try {
      setError(null)
      setPendingPlanId(planId)

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- @supabase/functions-js types FunctionsResponseFailure.error as `any`
      const { data, error: invokeError } = await supabase.functions.invoke<{ url: string }>(
        'create-checkout-session',
        { body: { plan_id: planId } },
      )

      if (invokeError || !data?.url) {
        throw invokeError ?? new Error('missing checkout url')
      }

      window.location.assign(data.url)
    } catch {
      setError('Unable to start checkout. Please try again.')
      setPendingPlanId(null)
    }
  }

  return (
    <div>
      <div className='hero'>
        <h1 className='hero-title'>Buy a label pack</h1>
        <p className='hero-text'>
          Pick a pack, pay securely via Stripe, and receive your license key by email.
        </p>
      </div>

      {error !== null && (
        <p className='alert-error' style={{ marginTop: '1.5rem' }}>{error}</p>
      )}

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4' style={{ marginTop: '1.5rem' }}>
        {plans?.map((plan) => (
          <div key={plan.id} className='card' style={{ textAlign: 'center' }}>
            <div className='card-header' style={{ justifyContent: 'center' }}>
              <span className='card-title'>{plan.quota} labels</span>
            </div>
            <p style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 1rem' }}>
              {(plan.price_cents / 100).toFixed(2)} €
            </p>
            <button
              type='button'
              className='btn btn-primary'
              disabled={pendingPlanId !== null}
              onClick={() => { void onBuy(plan.id) }}
            >
              {pendingPlanId === plan.id ? 'Redirecting…' : 'Buy'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
