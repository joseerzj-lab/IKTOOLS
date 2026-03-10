import React from 'react'
import { motion, MotionProps } from 'framer-motion'

type MotionButtonProps = MotionProps & {
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
}

type HTMLButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'ref'>

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, #0051BA, #1a6dd4)',
    color: '#fff',
    border: '1px solid rgba(56,139,253,0.4)',
    boxShadow: '0 2px 12px rgba(0,81,186,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    color: '#c9d1d9',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  danger: {
    background: 'rgba(248,81,73,0.15)',
    color: '#ff7b72',
    border: '1px solid rgba(248,81,73,0.35)',
    boxShadow: '0 2px 8px rgba(248,81,73,0.2)',
  },
  ghost: {
    background: 'transparent',
    color: '#8b949e',
    border: '1px solid transparent',
    boxShadow: 'none',
  },
  success: {
    background: 'rgba(63,185,80,0.15)',
    color: '#3fb950',
    border: '1px solid rgba(63,185,80,0.35)',
    boxShadow: '0 2px 8px rgba(63,185,80,0.15)',
  },
}

const SIZES = {
  sm: { fontSize: 11, padding: '5px 12px', borderRadius: 8, height: 28 },
  md: { fontSize: 12, padding: '7px 16px', borderRadius: 10, height: 36 },
  lg: { fontSize: 13, padding: '10px 22px', borderRadius: 12, height: 44 },
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  MotionButtonProps & HTMLButtonProps
>(({ children, className, variant = 'primary', size = 'md', style, ...props }, ref) => {
  const v = VARIANTS[variant]
  const s = SIZES[size]

  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.94 }}
      whileHover={{ filter: 'brightness(1.12)' }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '0.01em',
        transition: 'background 0.15s, border-color 0.15s',
        ...v,
        ...s,
        ...style,
      }}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
})

Button.displayName = 'Button'