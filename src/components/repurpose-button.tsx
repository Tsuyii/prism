'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

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

  const config = {
    idle: { label: 'Repurpose', icon: null, className: 'text-text-secondary hover:text-text-primary' },
    loading: { label: 'Working...', icon: <RefreshCw size={13} className="animate-spin" />, className: 'text-text-muted' },
    done: { label: `${count} queued`, icon: <CheckCircle2 size={13} />, className: 'text-accent-400' },
    error: { label: 'Failed', icon: <AlertCircle size={13} />, className: 'text-red-400' },
  }[state]

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      aria-label="Repurpose top posts"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 bg-surface-3 hover:bg-surface-4 border border-border-default ${config.className}`}
    >
      {config.icon}
      {config.label}
    </button>
  )
}
