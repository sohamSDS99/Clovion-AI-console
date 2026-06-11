'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { loginAction, type LoginState } from './actions'

const initialState: LoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-9 bg-black text-white font-mono uppercase text-[11px] tracking-[0.16em] disabled:opacity-60"
    >
      {pending ? 'SIGNING IN' : 'SIGN IN'}
    </button>
  )
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
          EMAIL
        </span>
        <input
          name="email"
          type="email"
          autoFocus
          autoComplete="email"
          required
          spellCheck={false}
          className="h-8 border border-black/30 bg-paper px-2 font-mono text-[11px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
          PASSWORD
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-8 border border-black/30 bg-paper px-2 font-mono text-[11px]"
        />
      </label>
      {state.error ? (
        <div
          role="alert"
          className="border border-black px-2 py-1 text-[9.5px] font-mono uppercase tracking-[0.12em]"
        >
          {state.error}
        </div>
      ) : null}
      <SubmitButton />
    </form>
  )
}

export default LoginForm
