/**
 * Error boundary.
 *
 * A control-room screen runs unattended for days. A render error that blanks the
 * page with no explanation is worse than one that says what broke — an operator
 * needs to know immediately that the screen has stopped reflecting the mill.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info: info.componentStack ?? null })
    // Kept: on a 24/7 screen this is the only trace of what happened.
    console.error('[digital-twin] render error', error, info)
  }

  render(): ReactNode {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="bg-base-950 flex h-full items-center justify-center p-8">
        <div className="border-alarm/60 bg-base-900 max-w-[720px] border p-5">
          <h1 className="text-alarm text-body font-semibold tracking-[0.12em]">
            TWIN STOPPED — RENDER ERROR
          </h1>
          <p className="text-text-dim mt-2 text-meta leading-relaxed">
            This screen is no longer reflecting the mill. Do not use it to judge machine state.
          </p>
          <pre className="num text-text-faint border-line bg-base-950 mt-3 max-h-[300px] overflow-auto border p-2 text-micro leading-relaxed">
            {error.message}
            {info ? `\n${info}` : ''}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border-line text-text-dim hover:border-normal/50 hover:text-normal mt-3 border px-3 py-1.5 text-meta tracking-wider transition-colors"
          >
            RELOAD
          </button>
        </div>
      </div>
    )
  }
}
