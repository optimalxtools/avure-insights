'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth } from '@/lib/firebaseClient'
import {
  signInWithEmailAndPassword,
  getIdToken,
  getIdTokenResult,
  signOut,
} from 'firebase/auth'
import { STORAGE_KEYS } from '@/lib/config'

type CustomClaims = { allowedApps?: string[] }

function LoginInner() {
  const router = useRouter()
  const search = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const target = process.env.NEXT_PUBLIC_TARGET || 'global'

  useEffect(() => { setError(null) }, [email, password])

  const checkLogin = async () => {
    setError(null)
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    try {
      
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const tokenResult = await getIdTokenResult(user, true)
      const claims = tokenResult.claims as CustomClaims
      const apps = claims.allowedApps ?? []
      const allowed = target === 'global' || apps.includes(String(target))

      if (!allowed) {
        await signOut(auth)
        setError(`Your account is not permitted to access the ${String(target).toUpperCase()} app.`)
        return
      }

      const idToken = await getIdToken(user, true)
      const resp = await fetch('/api/sessionLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, rememberMe }),
      })

      if (!resp.ok) {
        const { error } = await resp.json().catch(() => ({ error: 'Secure session failed' }))
        await signOut(auth)
        throw new Error(error)
      }

      localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true')
      localStorage.setItem(STORAGE_KEYS.LOGGED_IN_USER, email)
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe ? 'true' : 'false')

      const next = search.get('next') || '/'
      router.replace(next)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Login failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      checkLogin()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#181818] relative overflow-hidden">
      {/* SVG Background Pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'url(/13164433_5180058.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div className="bg-transparent md:backdrop-blur-sm p-8 rounded-xl border border-transparent md:border-neutral-600 w-full max-w-sm text-center relative z-10">
        <div className="mx-auto mb-6 w-full h-40 relative">
          <Image src="/logo_avure.png" alt="Avure" fill className="object-contain object-center" />
        </div>
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Email"
          type="email"
          autoComplete="email"
          className="block w-4/5 mx-auto mb-4 p-3 bg-transparent border border-neutral-500 rounded-md text-base text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          className="block w-4/5 mx-auto mb-4 p-3 bg-transparent border border-neutral-500 rounded-md text-base text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />

        <div className="flex items-center gap-2 mb-4 w-4/5 mx-auto">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 accent-neutral-400 border-neutral-500 rounded focus:ring-neutral-400"
          />
          <label htmlFor="rememberMe" className="text-sm text-neutral-300 cursor-pointer">
            Remember me
          </label>
        </div>

        <button
          onClick={checkLogin}
          disabled={loading}
          className="block w-40 mx-auto mt-2 p-3 rounded-md text-white bg-transparent border border-neutral-500 hover:bg-neutral-800 hover:border-neutral-400 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Login'}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
      <LoginInner />
    </Suspense>
  )
}
