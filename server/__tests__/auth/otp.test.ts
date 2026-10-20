import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../log.js', () => ({ log: vi.fn() }))

import { log } from '../../log.js'

const withEnv = async (keys: Record<string, string>) => {
  vi.resetModules()

  const chosen = { RESEND_API_KEY: '', OTP_FROM: '', ...keys }

  for (const [name, value] of Object.entries(chosen)) vi.stubEnv(name, value)

  return import('../../auth/otp.js')
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('with no mail provider configured', () => {
  it('writes the code where a developer will see it, and says why', async () => {
    const { deliverCode } = await withEnv({})

    await deliverCode({ email: 'someone@example.test', otp: '123456' })

    expect(log).toHaveBeenCalledWith(
      'warn',
      'sign-in code not sent, no mail provider is configured',
      { email: 'someone@example.test', otp: '123456' }
    )
  })
})

describe('with a mail provider configured', () => {
  const configured = {
    RESEND_API_KEY: 'key-for-the-test',
    OTP_FROM: 'ShipBox <hello@shipbox.example>',
  }

  it('hands the code to the provider rather than the log', async () => {
    const sent = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', sent)

    const { deliverCode } = await withEnv(configured)

    await deliverCode({ email: 'someone@example.test', otp: '123456' })

    const [url, init] = sent.mock.calls[0] as [string, { headers: Record<string, string>; body: string }]
    const body = JSON.parse(init.body) as { to: string; from: string; subject: string; text: string }

    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer key-for-the-test')
    expect(body.to).toBe('someone@example.test')
    expect(body.from).toBe('ShipBox <hello@shipbox.example>')
    expect(body.subject).toContain('123456')
    expect(body.text).toContain('123456')
    expect(log).not.toHaveBeenCalled()
  })

  it('raises when the provider refuses, so the caller is not told it was sent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('domain not verified'),
    }))

    const { deliverCode } = await withEnv(configured)

    await expect(deliverCode({ email: 'a@example.test', otp: '1' }))
      .rejects.toThrow('422')
  })
})
