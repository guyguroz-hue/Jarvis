import { Component } from 'react'

/**
 * Renders crashes to the screen instead of a blank page.
 * Essential here: this project is developed on a phone, where opening
 * a JS console to read a stack trace is impractical.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[JARVIS] runtime fault:', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full w-full items-center justify-center bg-jarvis-void p-4">
        <div className="glass-panel hud-corners max-w-lg p-5 !border-jarvis-alert/50">
          <p className="label !text-jarvis-alert">System Fault</p>
          <p className="mt-2 font-display text-sm text-jarvis-alert">
            {error.name}: {error.message}
          </p>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-jarvis-ice/60">
            {error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded border border-jarvis-cyan/40 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-jarvis-cyan active:bg-jarvis-cyan/20"
          >
            Reboot
          </button>
        </div>
      </div>
    )
  }
}
