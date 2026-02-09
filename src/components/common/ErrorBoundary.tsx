import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional fallback to render instead of the default error UI */
  fallback?: ReactNode
  /** Name of the feature/page for better error messages */
  featureName?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.featureName ? ` - ${this.props.featureName}` : ''}]`, error, info)
    this.setState({ errorInfo: info.componentStack || '' })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' })
    window.location.hash = '/'
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const { error, errorInfo } = this.state
      const featureName = this.props.featureName || 'This page'

      return (
        <div className="h-full flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold mb-1">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {featureName} encountered an unexpected error. You can try again or go back to the home page.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                Go Home
              </button>
            </div>

            {/* Error details (collapsible) */}
            <details className="text-left rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
              <summary className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none">
                <Bug className="h-3 w-3" />
                Error Details
              </summary>
              <div className="px-3 pb-3 space-y-2">
                <div className="rounded bg-background/80 p-2 text-[11px] font-mono text-destructive break-all">
                  {error?.message || 'Unknown error'}
                </div>
                {errorInfo && (
                  <div className="rounded bg-background/80 p-2 text-[10px] font-mono text-muted-foreground max-h-32 overflow-auto whitespace-pre-wrap">
                    {errorInfo}
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

