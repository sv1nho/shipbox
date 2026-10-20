import { env } from '../env.js'
import { log } from '../log.js'

type Code = { email: string; otp: string }

const RESEND = 'https://api.resend.com/emails'

const body = (otp: string): string =>
  `Your ShipBox sign-in code is ${otp}. It is valid for ten minutes, and only once. ` +
  'If you did not ask for it, ignore this message.'

const post = async ({ email, otp }: Code): Promise<void> => {
  const answer = await fetch(RESEND, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${String(env.RESEND_API_KEY)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.OTP_FROM,
      to: email,
      subject: `${otp} is your ShipBox sign-in code`,
      text: body(otp),
    }),
  })

  if (!answer.ok) {
    throw new Error(`the mail provider answered ${String(answer.status)}: ${await answer.text()}`)
  }
}

export const deliverCode = async (code: Code): Promise<void> => {
  if (env.RESEND_API_KEY !== undefined) {
    await post(code)
    return
  }

  log('warn', 'sign-in code not sent, no mail provider is configured', {
    email: code.email,
    otp: code.otp,
  })
}
