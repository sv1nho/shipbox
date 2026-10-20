import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

const authClient = createAuthClient({ plugins: [emailOTPClient()] })

export const { signIn, signOut, useSession, deleteUser, emailOtp } = authClient
