'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth'

export type LoginState = {
  error?: string
}

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) {
    return { error: 'MISSING CREDENTIALS' }
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: true,
      redirectTo: '/',
    })
    return {}
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'INVALID CREDENTIALS' }
    }
    // Re-throw redirect errors so Next.js can perform the redirect.
    throw err
  }
}
