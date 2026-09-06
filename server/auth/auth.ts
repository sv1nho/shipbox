import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../prisma.js'
import { env, isProduction } from '../env.js'
import { SOCIAL_PROVIDER_IDS } from '../../shared/auth-providers.js'
import type { SocialProviderId } from '../../shared/auth-providers.js'

const credentials: Record<SocialProviderId, { clientId?: string; clientSecret?: string }> = {
  google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
}

export const enabledProviders: SocialProviderId[] = SOCIAL_PROVIDER_IDS.filter(
  (id) => credentials[id].clientId !== undefined && credentials[id].clientSecret !== undefined
)

const socialProviders = Object.fromEntries(
  enabledProviders.map((id) => [
    id,
    {
      clientId: credentials[id].clientId as string,
      clientSecret: credentials[id].clientSecret as string,
    },
  ])
)

export const auth = betterAuth({
  appName: 'ShipBox',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  basePath: '/api/auth',
  trustedOrigins: [env.WEB_ORIGIN],

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: { enabled: false },

  socialProviders,

  account: {
    accountLinking: {
      enabled: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  advanced: {
    cookiePrefix: 'shipbox',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
})

export type AuthUser = {
  id: string
  email: string
  name: string
  image: string | null
}
