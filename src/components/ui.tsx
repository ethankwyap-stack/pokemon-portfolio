// Reusable UI primitives, neon-styled (pattern shared with recipe-planner).

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger'

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-neon text-bg font-semibold hover:bg-neon-dim shadow-[0_0_16px_rgba(0,224,164,0.25)]',
  ghost: 'bg-transparent text-neon border border-neon/40 hover:border-neon hover:bg-neon/10',
  subtle: 'bg-surface-2 text-ink border border-border hover:border-neon/50',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

type BadgeTone = 'default' | 'neon' | 'accent'

const badgeStyles: Record<BadgeTone, string> = {
  default: 'bg-surface-2 text-muted border-border',
  neon: 'bg-neon/10 text-neon border-neon/30',
  accent: 'bg-accent/10 text-accent border-accent/30',
}

export function Badge({ tone = 'default', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-block max-w-full truncate whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${badgeStyles[tone]}`}>
      {children}
    </span>
  )
}
