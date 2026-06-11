import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffUsers } from '@/lib/db/schema'
import { authConfig } from './auth.config'
import type { Role } from '@/lib/db/types'

declare module 'next-auth' {
  interface User {
    role?: Role
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
    }
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase()
        const password = String(credentials?.password ?? '')
        if (!email || !password) return null

        const rows = await db
          .select()
          .from(staffUsers)
          .where(eq(staffUsers.email, email))
          .limit(1)
        const user = rows[0]
        if (!user || !user.active || !user.passwordHash) return null

        const ok = bcrypt.compareSync(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
})
