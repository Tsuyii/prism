'use client'

import { useState } from 'react'

type State = 'idle' | 'loading' | 'done' | 'error'

export function RepurposeButton() {
  const [state, setState] = useState<State>('idle')
  const [count, setCount] = useState(0)

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/repurpose', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { repurposed: number } = await res.json()
      setCount(data.repurposed)
      setState('done')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'done') {
    return (
      <span className="text-sm text-violet-400 font-medium">
        {count} post{count !== 1 ? 's' : ''} queued
      </span>
    )
  }

  if (state === 'error') {
    return <span className="text-sm text-red-400">Failed — try again</span>
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium text-zinc-300 disabled:opacity-50"
    >
      {state === 'loading' ? (
        <>
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
          Working…
        </>
      ) : (
        'Repurpose Top'
      )}
    </button>
  )
}
