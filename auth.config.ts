import type { NextAuthConfig } from 'next-auth'
import type { Role } from './lib/db/types'

// Shared (edge-safe) auth config. The Credentials provider with bcrypt
// verification lives in auth.ts (node-only). middleware.ts imports this file.
export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isAuthed = !!auth?.user
      const path = request.nextUrl.pathname
      // Allow login + next-auth API + static assets unconditionally
      if (
        path === '/login' ||
        path.startsWith('/api/auth') ||
        path.startsWith('/_next') ||
        path.startsWith('/favicon')
      ) {
        return true
      }
      return isAuthed
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: string; email?: string; name?: string }
        if (u.id) token.sub = u.id
        if (u.role) token.role = u.role
        if (u.email) token.email = u.email
        if (u.name) token.name = u.name
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        const t = token as { sub?: string; role?: Role }
        session.user.id = t.sub ?? session.user.id ?? ''
        session.user.role = (t.role ?? 'analyst') as Role
      }
      return session
    },
  },
} satisfies NextAuthConfig
