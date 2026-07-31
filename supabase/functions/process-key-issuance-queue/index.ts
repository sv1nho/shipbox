import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { generateLicenseKey, toBytea } from '../_shared/licenseKey.ts'

const KEY_PEPPER = Deno.env.get('KEY_PEPPER')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM = Deno.env.get('RESEND_FROM')!

interface QueueMessage {
  msg_id: number
  message: {
    checkout_session_id: string
    customer_email: string | null
    plan_id: string
  }
}

async function sendKeyEmail (email: string, licenseKey: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: email,
      subject: 'Votre clé de licence Label Generator',
      text: `Voici votre clé de licence : ${licenseKey}\n\nRendez-vous sur /redeem pour l'activer.`,
    }),
  })

  if (!res.ok) {
    throw new Error(`resend error ${res.status}: ${await res.text()}`)
  }
}

async function processMessage (msg: QueueMessage): Promise<void> {
  const { checkout_session_id: checkoutSessionId, customer_email: customerEmail, plan_id: planId } = msg.message

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('license_keys')
    .select('id, email_sent_at')
    .eq('stripe_checkout_session_id', checkoutSessionId)
    .maybeSingle()

  if (existingError) throw existingError

  // Already fully processed (key issued + email delivered) — nothing left to do.
  if (existing?.email_sent_at) {
    await supabaseAdmin.rpc('delete_key_issuance_queue_message', { p_msg_id: msg.msg_id })
    return
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from('plans')
    .select('quota')
    .eq('id', planId)
    .single()

  if (planError || !plan) throw planError ?? new Error(`unknown plan_id ${planId}`)

  // The raw key is never persisted, so a retry after a failed email send
  // mints a fresh key for the same row rather than trying to recover the
  // previous one — the customer only ever sees whichever key is currently
  // stored, and email_sent_at only flips once that exact email succeeds.
  const { raw, hash, prefix } = await generateLicenseKey(KEY_PEPPER)

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('license_keys')
      .update({ key_hash: toBytea(hash), key_prefix: prefix })
      .eq('id', existing.id)
    if (updateError) throw updateError
  } else {
    const { error: insertError } = await supabaseAdmin.from('license_keys').insert({
      key_hash: toBytea(hash),
      key_prefix: prefix,
      plan_id: planId,
      quota_total: plan.quota,
      customer_email: customerEmail,
      stripe_checkout_session_id: checkoutSessionId,
    })
    if (insertError) throw insertError
  }

  if (customerEmail) {
    await sendKeyEmail(customerEmail, raw)
  }

  const { error: markSentError } = await supabaseAdmin
    .from('license_keys')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', checkoutSessionId)
  if (markSentError) throw markSentError

  await supabaseAdmin.rpc('delete_key_issuance_queue_message', { p_msg_id: msg.msg_id })
}

Deno.serve(async () => {
  const { data: messages, error: readError } = await supabaseAdmin.rpc('read_key_issuance_queue', {
    p_qty: 10,
    p_vt: 30,
  })

  if (readError) {
    console.error('failed to read queue', readError)
    return new Response('error', { status: 500 })
  }

  for (const msg of (messages ?? []) as QueueMessage[]) {
    try {
      await processMessage(msg)
    } catch (err) {
      // Leave the message in the queue — pgmq's visibility timeout will
      // make it reappear for a retry (by the next Database Webhook call
      // or the pg_cron backup sweep).
      console.error('failed to process message', msg.msg_id, err)
    }
  }

  return new Response('ok', { status: 200 })
})
