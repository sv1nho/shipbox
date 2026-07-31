import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripeClient.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const FRONTEND_URL = Deno.env.get('FRONTEND_URL')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400)
  }

  const planId = (body as { plan_id?: unknown })?.plan_id
  if (typeof planId !== 'string' || planId.length === 0) {
    return jsonResponse({ error: 'plan_id is required' }, 400)
  }

  // Price is always resolved server-side — never trust a price from the client.
  const { data: plan, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id, stripe_price_id')
    .eq('id', planId)
    .eq('active', true)
    .maybeSingle()

  if (planError) {
    console.error('failed to load plan', planError)
    return jsonResponse({ error: 'internal error' }, 500)
  }

  if (!plan) {
    return jsonResponse({ error: 'unknown plan' }, 400)
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      metadata: { plan_id: plan.id },
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/buy`,
    })

    return jsonResponse({ url: session.url })
  } catch (err) {
    console.error('failed to create checkout session', err)
    return jsonResponse({ error: 'internal error' }, 500)
  }
})
