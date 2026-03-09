"use client"

import React, { createContext, useContext, useState } from "react"
import { cn } from "@/lib/utils"

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextType>({ value: '', onValueChange: () => {} })

function Tabs({
  className,
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  children,
  ...props
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
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
    <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
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
  const { value: activeValue, onValueChange } = useContext(TabsContext)
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
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
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

  if (activeValue !== value) return null

  return (
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
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
