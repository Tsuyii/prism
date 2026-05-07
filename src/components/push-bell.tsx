'use client'

import { Bell, BellRing, Loader2 } from 'lucide-react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export function PushBell() {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushSubscription()

  if (!supported) return null

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={loading}
      title={subscribed ? 'Disable notifications' : 'Enable notifications'}
      aria-label={subscribed ? 'Notifications enabled — click to disable' : 'Enable push notifications'}
      className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:bg-surface-3 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin text-text-muted" />
      ) : subscribed ? (
        <BellRing size={18} className="text-warning" />
      ) : (
        <Bell size={18} className="text-text-muted hover:text-text-secondary" />
      )}
    </button>
  )
}
