import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import "./index.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Root app crash', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', padding: '24px', background: '#fff', color: '#111827', textAlign: 'left' }}>
          <div style={{ maxWidth: '980px', margin: '0 auto', border: '1px solid #fecaca', borderRadius: '24px', padding: '24px', background: '#fff' }}>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#b91c1c' }}>App crashed</h1>
            <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: 1.6 }}>
              A runtime error happened. This message is being shown instead of a blank screen so we can fix the exact cause.
            </p>
            <pre style={{ marginTop: '20px', overflow: 'auto', borderRadius: '16px', padding: '16px', background: '#0f172a', color: '#f8fafc', whiteSpace: 'pre-wrap' }}>
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
