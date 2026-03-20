'use client'

import { useEffect, useRef } from 'react'
import { useMotionValue, useSpring, useTransform, motion } from 'framer-motion'

interface CountUpProps {
  value: number
  format?: (n: number) => string
  className?: string
}

export function CountUp({ value, format, className }: CountUpProps) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 80, damping: 20 })
  const display = useTransform(spring, (v) => (format ? format(v) : v.toFixed(2)))
  const prevValue = useRef(0)

  useEffect(() => {
    motionValue.set(prevValue.current)
    spring.set(prevValue.current)
    motionValue.set(value)
    prevValue.current = value
  }, [value, motionValue, spring])

  return <motion.span className={className}>{display}</motion.span>
}
