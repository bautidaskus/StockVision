"use client"

import React, { createContext, useContext, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
  layoutId: string
}

const TabsContext = createContext<TabsContextType>({
  value: '',
  onValueChange: () => {},
  layoutId: 'active-tab',
})

function Tabs({
  className,
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  layoutId = 'active-tab',
  children,
  ...props
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  layoutId?: string
  className?: string
  children?: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'>) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const value = controlledValue !== undefined ? controlledValue : internalValue

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange, layoutId }}>
      <div data-slot="tabs" className={cn("flex flex-col", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={cn(
        "inline-flex items-center justify-center rounded-md text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: activeValue, onValueChange, layoutId } = useContext(TabsContext)
  const isActive = activeValue === value

  return (
    <button
      data-slot="tabs-trigger"
      role="tab"
      type="button"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => onValueChange(value)}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive ? "text-foreground" : "hover:text-foreground/80",
        className
      )}
      {...props}
    >
      {isActive && (
        <motion.div
          layoutId={layoutId}
          className="absolute inset-0 rounded-sm bg-secondary"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

function TabsContent({
  className,
  value,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: activeValue } = useContext(TabsContext)
  const isActive = activeValue === value

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div
            data-slot="tabs-content"
            role="tabpanel"
            className={cn(
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              className
            )}
            {...props}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
