import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Button, Input, Label } from '../components/ui/primitives'
import { LogoMark } from '../components/layout/header'
import { useNavigate } from '@tanstack/react-router'

export function AdminLoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      navigate({ to: '/admin' })
    } catch {
      setError('We couldn’t complete your request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6 py-20">
      <div className="w-full max-w-md rounded-card bg-surface ring-1 ring-border shadow-[0_40px_120px_-40px_rgba(5,45,75,0.35)] p-8">
        <div className="text-center mb-8">
          <LogoMark className="justify-center" />
          <h1 className="mt-6 text-2xl font-bold text-navy">Admin Login</h1>
          <p className="mt-1 text-sm text-text-secondary">Sign in to the ParcelVault Logistics administration panel</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label>Email</Label>
            <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@parcelvaultlogistics.com" />
          </div>
          <div>
            <Label>Password</Label>
            <Input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}