'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/new', label: 'New Post', Icon: PlusCircle },
  { href: '/research', label: 'Research', Icon: Search },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-default bg-surface-0/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] md:relative md:bottom-auto md:left-auto md:right-auto md:border-t-0 md:border-r md:min-h-screen md:w-16 md:pb-0"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo — desktop only */}
      <Link
        href="/"
        className="hidden md:flex items-center justify-center h-14 border-b border-border-default mx-2"
        aria-label="Prism home"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow-sm">
          <Sparkles size={18} className="text-white" strokeWidth={2.5} />
        </div>
      </Link>

      <ul className="flex h-16 items-center justify-around md:flex-col md:h-auto md:justify-start md:gap-1 md:pt-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 text-[11px] font-medium transition-all duration-200 md:px-2 md:py-3 md:rounded-xl md:mx-1.5 md:gap-1.5',
                  active
                    ? 'text-accent-400 md:bg-surface-3'
                    : 'text-text-muted hover:text-text-secondary md:hover:bg-surface-2',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 2}
                  className="transition-all duration-200"
                />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Version — desktop only */}
      <div className="hidden md:flex flex-1 items-end justify-center pb-4">
        <span className="text-[10px] text-text-muted/40 font-mono rotate-180" style={{ writingMode: 'vertical-rl' }}>
          v0.4
        </span>
      </div>
    </nav>
  )
}
