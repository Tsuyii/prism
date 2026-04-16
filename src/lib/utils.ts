import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Platform } from './supabase/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatScheduledTime(iso: string | null): string {
  if (!iso) return 'Not scheduled'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    x_thread: 'X Thread',
    x_video: 'X Video',
  }
  return labels[platform]
}
