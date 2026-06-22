"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" })
        if (!res.ok) {
          if (!cancelled) router.push("/login")
          return
        }
        if (!cancelled) setIsLoading(false)
      } catch {
        if (!cancelled) router.push("/login")
      }
    }

    checkAuth()

    return () => {
      cancelled = true
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-sm text-gray-600">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
