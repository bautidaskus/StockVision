'use client'

import React from 'react'
import { Card } from '@/components/ui/card'

interface ClientErrorBoundaryProps {
  children: React.ReactNode
  title?: string
}

interface ClientErrorBoundaryState {
  hasError: boolean
}

export class ClientErrorBoundary extends React.Component<ClientErrorBoundaryProps, ClientErrorBoundaryState> {
  state: ClientErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): ClientErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ClientErrorBoundary caught an error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 bg-card border-border text-center text-muted-foreground">
          {this.props.title || 'Esta sección falló al renderizarse.'}
        </Card>
      )
    }

    return this.props.children
  }
}
