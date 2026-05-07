import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/* ── GlassCard ─────────────────────────────────────────────────────────────── */

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  padding?: 'sm' | 'md' | 'lg'
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow, padding = 'md', ...props }, ref) => {
    const pad = { sm: 'p-3', md: 'p-4', lg: 'p-6' }[padding]
    return (
      <div
        ref={ref}
        className={cn('glass-card', pad, glow && 'glow-accent', className)}
        {...props}
      />
    )
  },
)
GlassCard.displayName = 'GlassCard'

/* ── Button ────────────────────────────────────────────────────────────────── */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl'

    const variants = {
      primary: 'bg-accent-600 hover:bg-accent-500 text-white shadow-glow-sm hover:shadow-glow-md active:scale-[0.98]',
      secondary: 'bg-surface-3 hover:bg-surface-4 text-text-secondary hover:text-text-primary border border-border-default active:scale-[0.98]',
      ghost: 'hover:bg-surface-3 text-text-muted hover:text-text-secondary',
      danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800/30',
      success: 'bg-green-600 hover:bg-green-500 text-white active:scale-[0.98]',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-lg',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-4 text-sm w-full',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

/* ── Badge ─────────────────────────────────────────────────────────────────── */

interface BadgeProps {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'muted'
  size?: 'sm' | 'md'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', size = 'sm', children, className }: BadgeProps) {
  const variants = {
    default: 'bg-surface-3 text-text-muted border-border-default',
    accent: 'bg-accent-600/20 text-accent-300 border-accent-800/30',
    success: 'bg-success-bg text-success border-success-border',
    warning: 'bg-warning-bg text-warning border-warning-border',
    danger: 'bg-danger-bg text-danger border-danger-border',
    muted: 'bg-surface-2 text-text-muted border-border-subtle',
  }

  return (
    <span className={cn(
      'inline-flex items-center border rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      variants[variant],
      className,
    )}>
      {children}
    </span>
  )
}

/* ── Section heading ───────────────────────────────────────────────────────── */

interface SectionHeadingProps {
  children: React.ReactNode
  className?: string
}

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h2 className={cn('text-xs font-semibold text-text-muted uppercase tracking-wider mb-3', className)}>
      {children}
    </h2>
  )
}

/* ── EmptyState ────────────────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-3 border border-border-default flex items-center justify-center mb-4 text-text-muted">
        {icon}
      </div>
      <p className="text-sm font-medium text-text-secondary mb-1">{title}</p>
      {description && <p className="text-xs text-text-muted mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}

/* ── Skeleton ──────────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}
