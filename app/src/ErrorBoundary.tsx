import { Component } from 'react'
import type { ReactNode } from 'react'

/** If a saved game can't be shown (corrupt or from an older version), offer a clean restart instead of a blank page. */
export default class ErrorBoundary extends Component<{ storageKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  restart = () => {
    try { localStorage.removeItem(this.props.storageKey) } catch { /* storage unavailable: nothing to clear */ }
    location.reload()
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page">
        <h1>Something went wrong</h1>
        <p className="help">The saved game could not be loaded. Your cards on the table are fine: start a new game here and set them up again.</p>
        <button className="big" onClick={this.restart}>Start a new game</button>
      </div>
    )
  }
}
