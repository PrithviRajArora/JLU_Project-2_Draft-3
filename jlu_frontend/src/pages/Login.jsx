import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const [form, setForm]   = useState({ jlu_id: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.jlu_id.trim(), form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function fill(jlu_id, password) {
    setForm({ jlu_id, password })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="mark">JLU <span>Marks</span></div>
          <div className="tagline">Academic Management System</div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">JLU ID</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. FAC001"
              value={form.jlu_id}
              onChange={e => setForm(f => ({ ...f, jlu_id: e.target.value }))}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Signing in…</> : 'Sign In →'}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            Demo Accounts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['ADM001', 'Admin@1234',   'Admin'],
              ['FAC001', 'Faculty@1234', 'Faculty'],
              ['STU001', 'Student@1234', 'Student'],
            ].map(([id, pw, role]) => (
              <button
                key={id}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between' }}
                type="button"
                onClick={() => fill(id, pw)}
              >
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{id}</span>
                <span className="badge badge-gray">{role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
