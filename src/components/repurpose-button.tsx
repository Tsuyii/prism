'use client'

import { useState, useEffect, useRef } from 'react'

type State = 'idle' | 'loading' | 'done' | 'error'

export function RepurposeButton() {
  const [state, setState] = useState<State>('idle')
  const [count, setCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function handleClick() {
    if (state !== 'idle') return
    setState('loading')
    try {
      const res = await fetch('/api/repurpose', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { repurposed: number } = await res.json()
      setCount(data.repurposed)
      setState('done')
      timerRef.current = setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      timerRef.current = setTimeout(() => setState('idle'), 3000)
    }
  }

  const label =
    state === 'loading' ? 'Working…'
    : state === 'done' ? `${count} post${count !== 1 ? 's' : ''} queued`
    : state === 'error' ? 'Failed — try again'
    : 'Repurpose Top'

  const textColor =
    state === 'done' ? 'text-violet-300'
    : state === 'error' ? 'text-red-400'
    : 'text-zinc-300'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      aria-label="Repurpose top posts"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium disabled:opacity-50 ${textColor}`}
    >
      {state === 'loading' && (
        <svg
          className="animate-spin"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {label}
    </button>
  )
}
