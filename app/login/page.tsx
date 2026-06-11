import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Sign In — Clovion Console',
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
      <div className="w-full max-w-[360px] border border-black p-5">
        <div className="mb-4">
          <div className="font-mono uppercase tracking-[0.18em] text-[10px]">
            CLOVION CONSOLE
          </div>
          <div className="mt-1 font-mono uppercase tracking-[0.12em] text-[10px] text-black/60">
            STAFF SIGN IN
          </div>
        </div>
        <LoginForm />
        <div className="mt-4 pt-3 border-t border-black/10 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black/45">
          DEMO: owner@clovion.ai / admin
        </div>
      </div>
    </main>
  )
}
