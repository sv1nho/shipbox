import { stripe } from '../_shared/stripeClient.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!signature) {
    return new Response('missing signature', { status: 400 })
  }

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('signature verification failed', err)
    return new Response('invalid signature', { status: 400 })
  }

  // Idempotent insert: a fresh event lands as 'received'; a retried event
  // (same stripe_event_id) hits the conflict and is skipped here — the
  // *current* status (fetched next) decides whether we still need to act,
  // so a webhook retry after a failed enqueue can actually recover.
  const { error: upsertError } = await supabaseAdmin
    .from('payment_events')
    .upsert(
      { stripe_event_id: event.id, event_type: event.type, payload: event, status: 'received' },
      { onConflict: 'stripe_event_id', ignoreDuplicates: true },
    )

  if (upsertError) {
    console.error('failed to record payment event', upsertError)
    return new Response('internal error', { status: 500 })
  }

  const { data: paymentEvent, error: fetchError } = await supabaseAdmin
    .from('payment_events')
    .select('status')
    .eq('stripe_event_id', event.id)
    .single()

  if (fetchError || !paymentEvent) {
    console.error('failed to load payment event', fetchError)
    return new Response('internal error', { status: 500 })
  }

  if (paymentEvent.status === 'queued') {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string
      customer_details?: { email?: string | null } | null
      metadata?: { plan_id?: string } | null
    }

    const planId = session.metadata?.plan_id
    if (!planId) {
      console.error('checkout session missing plan_id metadata', session.id)
      await supabaseAdmin.from('payment_events').update({ status: 'failed' }).eq('stripe_event_id', event.id)
      return new Response('internal error', { status: 500 })
    }

    const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_key_issuance', {
      p_message: {
        checkout_session_id: session.id,
        customer_email: session.customer_details?.email ?? null,
        plan_id: planId,
      },
    })

    if (enqueueError) {
      console.error('failed to enqueue key issuance', enqueueError)
      await supabaseAdmin.from('payment_events').update({ status: 'failed' }).eq('stripe_event_id', event.id)
      return new Response('internal error', { status: 500 })
    }
  }

  await supabaseAdmin.from('payment_events').update({ status: 'queued' }).eq('stripe_event_id', event.id)

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
